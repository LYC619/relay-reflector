import os
import json
import time
import asyncio
import httpx
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from database import (
    init_db, close_db, insert_log, get_logs, get_setting, set_setting,
    get_dashboard_stats, get_upstreams, add_upstream, update_upstream,
    delete_upstream, activate_upstream, get_active_upstream, increment_upstream_stats,
    get_api_keys, update_api_key_note, track_api_key,
    get_db_size, clear_all_logs, clean_old_logs,
)

UPSTREAM_URL = os.environ.get("UPSTREAM_URL", "http://127.0.0.1:3000")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
PORT = int(os.environ.get("PORT", "7891"))



async def _log_cleanup_task():
    """Background task: check log_retention_days every hour and clean old logs."""
    while True:
        try:
            await asyncio.sleep(3600)  # every hour
            days_str = await get_setting("log_retention_days", "0")
            days = int(days_str)
            if days > 0:
                await clean_old_logs(days)
        except asyncio.CancelledError:
            break
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ADMIN_PASSWORD
    await init_db()
    # 从数据库读取持久化的密码
    saved_pw = await get_setting("admin_password", None)
    if saved_pw:
        ADMIN_PASSWORD = saved_pw
    # Start background cleanup task
    cleanup_task = asyncio.create_task(_log_cleanup_task())
    yield
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    await close_db()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def mask_api_key(auth_header: str) -> str:
    if not auth_header:
        return None
    key = auth_header.replace("Bearer ", "").strip()
    if len(key) <= 4:
        return key
    return "*" * (len(key) - 4) + key[-4:]


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def verify_admin(request: Request):
    auth = request.headers.get("x-admin-password", "")
    if auth != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ─── Admin API ───────────────────────────────────────────────

@app.post("/admin/api/login")
async def admin_login(request: Request):
    body = await request.json()
    if body.get("password") == ADMIN_PASSWORD:
        return {"ok": True}
    raise HTTPException(status_code=401, detail="Wrong password")


@app.get("/admin/api/dashboard")
async def admin_dashboard(request: Request, _=Depends(verify_admin)):
    return await get_dashboard_stats()


@app.get("/admin/api/logs")
async def admin_get_logs(
    request: Request,
    model: str = None, start_time: str = None, end_time: str = None,
    status_code: int = None, upstream_name: str = None,
    page: int = 1, page_size: int = 50,
    _=Depends(verify_admin),
):
    return await get_logs(model, start_time, end_time, status_code, upstream_name, page, page_size)


@app.get("/admin/api/logs/export")
async def admin_export_logs(
    request: Request,
    model: str = None, start_time: str = None, end_time: str = None,
    status_code: int = None, upstream_name: str = None,
    _=Depends(verify_admin),
):
    data = await get_logs(model, start_time, end_time, status_code, upstream_name, page=1, page_size=10000)
    return JSONResponse(data["logs"], headers={
        "Content-Disposition": "attachment; filename=logs_export.json"
    })


# ─── Upstream management ────────────────────────────────────

@app.get("/admin/api/upstreams")
async def admin_get_upstreams(_=Depends(verify_admin)):
    return await get_upstreams()


@app.post("/admin/api/upstreams")
async def admin_add_upstream(request: Request, _=Depends(verify_admin)):
    body = await request.json()
    await add_upstream(body["name"], body["url"])
    return {"ok": True}


@app.put("/admin/api/upstreams/{upstream_id}")
async def admin_update_upstream(upstream_id: int, request: Request, _=Depends(verify_admin)):
    body = await request.json()
    await update_upstream(upstream_id, body["name"], body["url"])
    return {"ok": True}


@app.delete("/admin/api/upstreams/{upstream_id}")
async def admin_delete_upstream(upstream_id: int, _=Depends(verify_admin)):
    await delete_upstream(upstream_id)
    return {"ok": True}


@app.post("/admin/api/upstreams/{upstream_id}/activate")
async def admin_activate_upstream(upstream_id: int, _=Depends(verify_admin)):
    await activate_upstream(upstream_id)
    return {"ok": True}


@app.post("/admin/api/upstreams/{upstream_id}/test")
async def admin_test_upstream(upstream_id: int, _=Depends(verify_admin)):
    upstreams = await get_upstreams()
    target = next((u for u in upstreams if u["id"] == upstream_id), None)
    if not target:
        raise HTTPException(404, "Not found")
    base_url = target['url'].rstrip('/')
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # 先试 /api/status
            try:
                resp = await client.get(f"{base_url}/api/status")
                if resp.status_code == 200:
                    return {"status": resp.status_code, "ok": True, "body": resp.text[:500]}
            except Exception:
                pass
            # 回退到 /v1/models
            resp = await client.get(f"{base_url}/v1/models")
            return {"status": resp.status_code, "ok": resp.status_code == 200, "body": resp.text[:500]}
    except Exception as e:
        return {"status": 0, "ok": False, "body": str(e)}


# ─── API Key management ─────────────────────────────────────

@app.get("/admin/api/keys")
async def admin_get_keys(_=Depends(verify_admin)):
    return await get_api_keys()


@app.put("/admin/api/keys/{key_id}")
async def admin_update_key(key_id: int, request: Request, _=Depends(verify_admin)):
    body = await request.json()
    await update_api_key_note(key_id, body.get("note", ""))
    return {"ok": True}


# ─── Settings ───────────────────────────────────────────────

@app.get("/admin/api/settings")
async def admin_get_settings(request: Request, _=Depends(verify_admin)):
    log_enabled = await get_setting("log_enabled", "true")
    log_retention_days = await get_setting("log_retention_days", "0")
    db_size = await get_db_size()
    return {
        "log_enabled": log_enabled == "true",
        "log_retention_days": int(log_retention_days),
        "db_size": db_size,
    }


@app.post("/admin/api/settings")
async def admin_set_settings(request: Request, _=Depends(verify_admin)):
    body = await request.json()
    if "log_enabled" in body:
        await set_setting("log_enabled", "true" if body["log_enabled"] else "false")
    if "log_retention_days" in body:
        await set_setting("log_retention_days", str(body["log_retention_days"]))
    return {"ok": True}


@app.post("/admin/api/settings/change-password")
async def admin_change_password(request: Request, _=Depends(verify_admin)):
    global ADMIN_PASSWORD
    body = await request.json()
    new_password = body["password"]
    ADMIN_PASSWORD = new_password
    await set_setting("admin_password", new_password)
    return {"ok": True}


@app.post("/admin/api/settings/clear-logs")
async def admin_clear_logs(_=Depends(verify_admin)):
    await clear_all_logs()
    return {"ok": True}


# ─── Serve frontend ─────────────────────────────────────────

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(FRONTEND_DIR):
    # Serve /assets/ statically to prevent proxy catch-all from intercepting JS/CSS
    assets_dir = os.path.join(FRONTEND_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    async def serve_root():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/admin/{full_path:path}")
    async def serve_admin(full_path: str):
        file_path = os.path.join(FRONTEND_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


# ─── Transparent Proxy ──────────────────────────────────────

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy(request: Request, path: str):
    # Determine upstream
    active = await get_active_upstream()
    if active:
        upstream = active["url"].rstrip("/")
        upstream_name = active["name"]
        upstream_id = active["id"]
    else:
        upstream = UPSTREAM_URL.rstrip("/")
        upstream_name = "default"
        upstream_id = None

    target_url = f"{upstream}/{path}"
    if request.url.query:
        target_url += f"?{request.url.query}"

    body = await request.body()

    # Check logging enabled
    log_enabled = (await get_setting("log_enabled", "true")) == "true"

    # Parse request body for logging
    request_data = None
    is_chat_completion = "/chat/completions" in path
    is_stream = False
    if body and is_chat_completion:
        try:
            request_data = json.loads(body)
            is_stream = request_data.get("stream", False)
        except json.JSONDecodeError:
            pass

    # Build headers
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("Host", None)

    client_ip = get_client_ip(request)
    api_key_hint = mask_api_key(request.headers.get("authorization", ""))
    start_time = time.time()

    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0)) as client:
        if is_stream and is_chat_completion:
            upstream_req = client.build_request(
                method=request.method, url=target_url, headers=headers, content=body,
            )
            upstream_resp = await client.send(upstream_req, stream=True)

            collected_content = []
            collected_thinking = []
            collected_tool_calls = []
            model_name = request_data.get("model") if request_data else None
            usage_data = {}
            resp_status = upstream_resp.status_code
            error_msg = None

            # Internal line buffer for parsing SSE, separate from raw byte forwarding
            line_buffer = b""

            async def stream_generator():
                nonlocal usage_data, line_buffer, error_msg
                try:
                    async for chunk in upstream_resp.aiter_bytes():
                        # Forward raw bytes immediately
                        yield chunk
                        # Buffer for line-based SSE parsing
                        line_buffer += chunk
                        while b"\n" in line_buffer:
                            line, line_buffer = line_buffer.split(b"\n", 1)
                            line_str = line.decode("utf-8", errors="replace").strip()
                            if line_str.startswith("data: ") and line_str != "data: [DONE]":
                                try:
                                    data = json.loads(line_str[6:])
                                    if data.get("choices"):
                                        delta = data["choices"][0].get("delta", {})
                                        if delta.get("content"):
                                            collected_content.append(delta["content"])
                                        if delta.get("thinking"):
                                            collected_thinking.append(delta["thinking"])
                                        if delta.get("tool_calls"):
                                            collected_tool_calls.extend(delta["tool_calls"])
                                    if data.get("usage"):
                                        usage_data = data["usage"]
                                except json.JSONDecodeError:
                                    pass
                except Exception:
                    pass
                finally:
                    await upstream_resp.aclose()
                    if log_enabled:
                        duration_ms = int((time.time() - start_time) * 1000)
                        log_data = {
                            "timestamp": datetime.utcnow().isoformat(),
                            "model": model_name,
                            "messages": request_data.get("messages") if request_data else None,
                            "assistant_reply": "".join(collected_content),
                            "thinking_content": "".join(collected_thinking) or None,
                            "tool_calls": collected_tool_calls or None,
                            "prompt_tokens": usage_data.get("prompt_tokens"),
                            "completion_tokens": usage_data.get("completion_tokens"),
                            "total_tokens": usage_data.get("total_tokens"),
                            "duration_ms": duration_ms,
                            "client_ip": client_ip,
                            "api_key_hint": api_key_hint,
                            "path": f"/{path}",
                            "method": request.method,
                            "upstream_name": upstream_name,
                            "status_code": resp_status,
                            "error_message": error_msg,
                        }
                        try:
                            await insert_log(log_data)
                            await track_api_key(api_key_hint, usage_data.get("total_tokens", 0))
                            if upstream_id:
                                await increment_upstream_stats(upstream_id)
                        except Exception:
                            pass

            resp_headers = dict(upstream_resp.headers)
            resp_headers.pop("content-length", None)
            resp_headers.pop("content-encoding", None)
            resp_headers.pop("transfer-encoding", None)

            return StreamingResponse(
                stream_generator(),
                status_code=upstream_resp.status_code,
                headers=resp_headers,
                media_type=upstream_resp.headers.get("content-type", "text/event-stream"),
            )
        else:
            resp = await client.request(
                method=request.method, url=target_url, headers=headers, content=body,
            )
            duration_ms = int((time.time() - start_time) * 1000)

            if is_chat_completion and log_enabled:
                try:
                    error_msg = None
                    if resp.status_code != 200:
                        error_msg = resp.text[:500]

                    resp_data = resp.json() if resp.status_code == 200 else {}
                    assistant_reply = ""
                    thinking_content = None
                    tool_calls_data = None

                    if resp_data.get("choices"):
                        msg = resp_data["choices"][0].get("message", {})
                        assistant_reply = msg.get("content", "")
                        thinking_content = msg.get("thinking") or msg.get("reasoning")
                        if msg.get("tool_calls"):
                            tool_calls_data = msg["tool_calls"]

                    usage = resp_data.get("usage", {})
                    log_data = {
                        "timestamp": datetime.utcnow().isoformat(),
                        "model": request_data.get("model") if request_data else resp_data.get("model"),
                        "messages": request_data.get("messages") if request_data else None,
                        "assistant_reply": assistant_reply,
                        "thinking_content": thinking_content,
                        "tool_calls": tool_calls_data,
                        "prompt_tokens": usage.get("prompt_tokens"),
                        "completion_tokens": usage.get("completion_tokens"),
                        "total_tokens": usage.get("total_tokens"),
                        "duration_ms": duration_ms,
                        "client_ip": client_ip,
                        "api_key_hint": api_key_hint,
                        "path": f"/{path}",
                        "method": request.method,
                        "upstream_name": upstream_name,
                        "status_code": resp.status_code,
                        "error_message": error_msg,
                    }
                    await insert_log(log_data)
                    await track_api_key(api_key_hint, usage.get("total_tokens", 0))
                    if upstream_id:
                        await increment_upstream_stats(upstream_id)
                except Exception:
                    pass

            resp_headers = dict(resp.headers)
            resp_headers.pop("content-encoding", None)
            resp_headers.pop("transfer-encoding", None)

            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=resp_headers,
                media_type=resp.headers.get("content-type"),
            )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
