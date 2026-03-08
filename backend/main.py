import os
import re
import json
import time
import asyncio
import hashlib
import httpx
from datetime import datetime
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from database import (
    init_db, close_db, get_db, insert_log, get_logs, get_setting, set_setting,
    get_dashboard_stats, get_upstreams, add_upstream, update_upstream,
    delete_upstream, activate_upstream, get_active_upstream, increment_upstream_stats,
    get_api_keys, update_api_key_note, track_api_key,
    get_db_size, clear_all_logs, clean_old_logs, increment_model_list_count, DB_PATH,
    update_log_starred, update_log_tags, update_log_note, get_all_tags,
)

UPSTREAM_URL = os.environ.get("UPSTREAM_URL", "http://127.0.0.1:3000")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
PORT = int(os.environ.get("PORT", "7891"))
VERSION = os.environ.get("APP_VERSION", "1.0.0")

# Login rate limiting: ip -> {"count": int, "locked_until": float}
_login_attempts = defaultdict(lambda: {"count": 0, "locked_until": 0.0})

# Track start time for uptime
_start_time = None


# ─── Response parser ────────────────────────────────────────

def parse_chat_response(json_data: dict) -> dict:
    """Parse non-streaming chat completion JSON into unified result dict."""
    content = ""
    thinking = None
    tool_calls_data = None

    if json_data.get("choices"):
        msg = json_data["choices"][0].get("message", {})
        content = msg.get("content", "") or ""
        thinking = msg.get("thinking") or msg.get("reasoning_content") or msg.get("reasoning")
        if msg.get("tool_calls"):
            tool_calls_data = msg["tool_calls"]

    return {
        "content": content,
        "thinking": thinking,
        "tool_calls": tool_calls_data,
        "usage": json_data.get("usage", {}),
        "model": json_data.get("model"),
    }


def parse_streaming_chunks(chunks: list) -> dict:
    """Parse collected SSE streaming chunks into unified result dict."""
    content_parts = []
    thinking_parts = []
    tool_calls_map = {}  # index -> {id, type, function: {name, arguments}}
    usage = {}
    model = None

    for chunk in chunks:
        if not chunk.get("choices"):
            # Last chunk may only have usage
            if chunk.get("usage"):
                usage = chunk["usage"]
            if chunk.get("model") and not model:
                model = chunk["model"]
            continue

        if chunk.get("model") and not model:
            model = chunk["model"]
        if chunk.get("usage"):
            usage = chunk["usage"]

        delta = chunk["choices"][0].get("delta", {})

        if delta.get("content"):
            content_parts.append(delta["content"])

        thinking = delta.get("thinking") or delta.get("reasoning_content") or delta.get("reasoning")
        if thinking:
            thinking_parts.append(thinking)

        if delta.get("tool_calls"):
            for tc in delta["tool_calls"]:
                idx = tc.get("index", 0)
                if idx not in tool_calls_map:
                    tool_calls_map[idx] = {
                        "id": tc.get("id", ""),
                        "type": tc.get("type", "function"),
                        "function": {"name": "", "arguments": ""},
                    }
                if tc.get("id"):
                    tool_calls_map[idx]["id"] = tc["id"]
                fn = tc.get("function", {})
                if fn.get("name"):
                    tool_calls_map[idx]["function"]["name"] = fn["name"]
                if fn.get("arguments"):
                    tool_calls_map[idx]["function"]["arguments"] += fn["arguments"]

    content = "".join(content_parts)
    thinking_text = "".join(thinking_parts) if thinking_parts else None
    tool_calls_data = [tool_calls_map[k] for k in sorted(tool_calls_map)] if tool_calls_map else None

    return {
        "content": content,
        "thinking": thinking_text,
        "tool_calls": tool_calls_data,
        "usage": usage,
        "model": model,
    }


def extract_error_summary(raw: str, status_code: int) -> str:
    """Extract a short error summary. If HTML, try to get <title>."""
    if not raw:
        return f"{status_code} Error"
    raw = raw.strip()
    if raw.startswith("<"):
        m = re.search(r"<title[^>]*>(.*?)</title>", raw, re.IGNORECASE | re.DOTALL)
        if m:
            return m.group(1).strip()
        return f"{status_code} Gateway Error"
    return raw[:500]


# ─── Lifecycle ──────────────────────────────────────────────

async def _log_cleanup_task():
    """Background task: check log_retention_days every hour and clean old logs."""
    while True:
        try:
            await asyncio.sleep(3600)
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
    global ADMIN_PASSWORD, _start_time
    _start_time = time.time()
    await init_db()
    saved_pw = await get_setting("admin_password", None)
    if saved_pw:
        ADMIN_PASSWORD = saved_pw
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


# ─── Security middleware: nosniff header ─────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/admin/api/"):
        response.headers["X-Content-Type-Options"] = "nosniff"
    return response


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
    client_ip = get_client_ip(request)
    attempt = _login_attempts[client_ip]

    if attempt["locked_until"] > time.time():
        remaining = int(attempt["locked_until"] - time.time())
        raise HTTPException(status_code=429, detail=f"Too many attempts. Try again in {remaining}s")

    body = await request.json()
    if body.get("password") == ADMIN_PASSWORD:
        _login_attempts[client_ip] = {"count": 0, "locked_until": 0.0}
        return {"ok": True}

    attempt["count"] += 1
    if attempt["count"] >= 5:
        attempt["locked_until"] = time.time() + 900
        attempt["count"] = 0
        raise HTTPException(status_code=429, detail="Too many failed attempts. Locked for 15 minutes")
    raise HTTPException(status_code=401, detail="Wrong password")


@app.get("/admin/api/dashboard")
async def admin_dashboard(request: Request, _=Depends(verify_admin)):
    return await get_dashboard_stats()


@app.get("/admin/api/logs")
async def admin_get_logs(
    request: Request,
    model: str = None, start_time: str = None, end_time: str = None,
    status_code: int = None, upstream_name: str = None, keyword: str = None,
    starred: bool = False, tag: str = None,
    page: int = 1, page_size: int = 50,
    _=Depends(verify_admin),
):
    return await get_logs(model, start_time, end_time, status_code, upstream_name, keyword,
                          starred_only=starred, tag=tag, page=page, page_size=page_size)


@app.get("/admin/api/logs/export")
async def admin_export_logs(
    request: Request,
    model: str = None, start_time: str = None, end_time: str = None,
    status_code: int = None, upstream_name: str = None, keyword: str = None,
    _=Depends(verify_admin),
):
    data = await get_logs(model, start_time, end_time, status_code, upstream_name, keyword, page=1, page_size=10000)
    return JSONResponse(data["logs"], headers={
        "Content-Disposition": "attachment; filename=logs_export.json"
    })


@app.patch("/admin/api/logs/{log_id}/star")
async def admin_toggle_star(log_id: int, request: Request, _=Depends(verify_admin)):
    body = await request.json()
    await update_log_starred(log_id, body.get("is_starred", False))
    return {"ok": True}


@app.patch("/admin/api/logs/{log_id}/tags")
async def admin_update_tags(log_id: int, request: Request, _=Depends(verify_admin)):
    body = await request.json()
    await update_log_tags(log_id, body.get("tags", ""))
    return {"ok": True}


@app.patch("/admin/api/logs/{log_id}/note")
async def admin_update_note(log_id: int, request: Request, _=Depends(verify_admin)):
    body = await request.json()
    await update_log_note(log_id, body.get("note", ""))
    return {"ok": True}


@app.get("/admin/api/tags")
async def admin_get_tags(_=Depends(verify_admin)):
    return await get_all_tags()


# ─── Upstream management ────────────────────────────────────


@app.get("/admin/api/upstreams")
async def admin_get_upstreams(_=Depends(verify_admin)):
    return await get_upstreams()


@app.post("/admin/api/upstreams")
async def admin_add_upstream(request: Request, _=Depends(verify_admin)):
    body = await request.json()
    await add_upstream(body["name"], body["url"], body.get("custom_headers", "{}"))
    return {"ok": True}


@app.put("/admin/api/upstreams/{upstream_id}")
async def admin_update_upstream(upstream_id: int, request: Request, _=Depends(verify_admin)):
    body = await request.json()
    await update_upstream(upstream_id, body["name"], body["url"], body.get("custom_headers"))
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
            start = time.time()
            try:
                resp = await client.get(f"{base_url}/api/status")
                latency_ms = int((time.time() - start) * 1000)
                if resp.status_code == 200:
                    return {"status": resp.status_code, "ok": True, "body": resp.text[:500], "latency_ms": latency_ms}
            except Exception:
                pass
            start = time.time()
            resp = await client.get(f"{base_url}/v1/models")
            latency_ms = int((time.time() - start) * 1000)
            return {"status": resp.status_code, "ok": resp.status_code == 200, "body": resp.text[:500], "latency_ms": latency_ms}
    except Exception as e:
        return {"status": 0, "ok": False, "body": str(e), "latency_ms": 0}


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
    log_only_errors = await get_setting("log_only_errors", "false")
    db_size = await get_db_size()
    uptime = int(time.time() - _start_time) if _start_time else 0
    return {
        "log_enabled": log_enabled == "true",
        "log_retention_days": int(log_retention_days),
        "log_only_errors": log_only_errors == "true",
        "db_size": db_size,
        "version": VERSION,
        "uptime_seconds": uptime,
    }


@app.post("/admin/api/settings")
async def admin_set_settings(request: Request, _=Depends(verify_admin)):
    body = await request.json()
    if "log_enabled" in body:
        await set_setting("log_enabled", "true" if body["log_enabled"] else "false")
    if "log_retention_days" in body:
        await set_setting("log_retention_days", str(body["log_retention_days"]))
    if "log_only_errors" in body:
        await set_setting("log_only_errors", "true" if body["log_only_errors"] else "false")
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


@app.get("/admin/api/settings/backup")
async def admin_backup(_=Depends(verify_admin)):
    if not os.path.isfile(DB_PATH):
        raise HTTPException(404, "Database file not found")
    db = await get_db()
    await db.execute("PRAGMA wal_checkpoint(FULL)")
    return FileResponse(DB_PATH, filename="proxy.db", media_type="application/octet-stream")


# ─── Serve frontend ─────────────────────────────────────────

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(FRONTEND_DIR):
    assets_dir = os.path.join(FRONTEND_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    async def serve_root():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/favicon.svg")
    async def serve_favicon():
        fav = os.path.join(FRONTEND_DIR, "favicon.svg")
        if os.path.isfile(fav):
            return FileResponse(fav, media_type="image/svg+xml")
        raise HTTPException(404)

    @app.get("/admin/{full_path:path}")
    async def serve_admin(full_path: str):
        file_path = os.path.join(FRONTEND_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


# ─── Unified Transparent Proxy ──────────────────────────────

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy(request: Request, path: str):
    # Resolve upstream
    active = await get_active_upstream()
    if active:
        upstream = active["url"].rstrip("/")
        upstream_name = active["name"]
        upstream_id = active["id"]
        custom_headers_json = active.get("custom_headers", "{}")
    else:
        upstream = UPSTREAM_URL.rstrip("/")
        upstream_name = "default"
        upstream_id = None
        custom_headers_json = "{}"

    target_url = f"{upstream}/{path}"
    if request.url.query:
        target_url += f"?{request.url.query}"

    body = await request.body()

    # Check logging settings
    log_enabled = (await get_setting("log_enabled", "true")) == "true"
    log_only_errors = (await get_setting("log_only_errors", "false")) == "true"

    # Detect request type
    is_chat_completion = "/chat/completions" in path
    is_models_list = path.rstrip("/") in ("v1/models", "models")
    request_data = None
    is_streaming = False

    if body and is_chat_completion:
        try:
            request_data = json.loads(body)
            is_streaming = bool(request_data.get("stream"))
        except json.JSONDecodeError:
            pass

    # Build headers
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("Host", None)
    try:
        custom_headers = json.loads(custom_headers_json) if custom_headers_json else {}
        for k, v in custom_headers.items():
            headers[k] = v
    except (json.JSONDecodeError, AttributeError):
        pass

    client_ip = get_client_ip(request)
    api_key_hint = mask_api_key(request.headers.get("authorization", ""))
    start_time = time.time()

    # ── Streaming path ──
    if is_chat_completion and is_streaming:
        return await _handle_streaming_proxy(
            request, path, target_url, headers, body, request_data,
            log_enabled, log_only_errors, upstream_name, upstream_id,
            client_ip, api_key_hint, start_time,
        )

    # ── Non-streaming path ──
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0)) as client:
        resp = await client.request(
            method=request.method, url=target_url, headers=headers, content=body,
        )

    duration_ms = int((time.time() - start_time) * 1000)
    raw_content = resp.content
    raw_text = resp.text

    # ── Track /v1/models requests ──
    if is_models_list:
        try:
            await increment_model_list_count()
            if upstream_id:
                await increment_upstream_stats(upstream_id)
        except Exception:
            pass

    # ── Log chat completions ──
    if is_chat_completion:
        should_log = log_enabled and (not log_only_errors or resp.status_code != 200)
        if should_log:
            try:
                error_msg = None
                if resp.status_code != 200:
                    error_msg = extract_error_summary(raw_text, resp.status_code)

                try:
                    resp_json = resp.json()
                except Exception:
                    resp_json = {}
                parsed = parse_chat_response(resp_json)

                usage = parsed["usage"]
                model_name = (request_data.get("model") if request_data else None) or parsed["model"]

                log_data = {
                    "timestamp": datetime.utcnow().isoformat(),
                    "model": model_name,
                    "messages": request_data.get("messages") if request_data else None,
                    "assistant_reply": parsed["content"],
                    "thinking_content": parsed["thinking"],
                    "tool_calls": parsed["tool_calls"],
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
                await track_api_key(api_key_hint, usage.get("total_tokens", 0), upstream_name)
                if upstream_id:
                    await increment_upstream_stats(upstream_id)
            except Exception:
                pass

    # ── Return response to client ──
    resp_headers = dict(resp.headers)
    resp_headers.pop("content-encoding", None)
    resp_headers.pop("transfer-encoding", None)

    return Response(
        content=raw_content,
        status_code=resp.status_code,
        headers=resp_headers,
        media_type=resp.headers.get("content-type"),
    )


async def _handle_streaming_proxy(
    request: Request, path: str, target_url: str, headers: dict, body: bytes,
    request_data: dict, log_enabled: bool, log_only_errors: bool,
    upstream_name: str, upstream_id: int | None,
    client_ip: str, api_key_hint: str, start_time: float,
):
    """Handle streaming chat completion: passthrough SSE to client, collect chunks for logging."""
    collected_chunks = []

    async def stream_generator():
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0)) as client:
            async with client.stream(
                method=request.method, url=target_url, headers=headers, content=body,
            ) as resp:
                # Yield status/headers info won't work with StreamingResponse directly,
                # but we need to handle non-200 separately
                stream_generator.status_code = resp.status_code
                stream_generator.resp_headers = dict(resp.headers)

                async for line in resp.aiter_lines():
                    yield f"{line}\n\n"

                    # Collect SSE data lines for logging
                    stripped = line.strip()
                    if stripped.startswith("data: ") and stripped != "data: [DONE]":
                        try:
                            chunk_json = json.loads(stripped[6:])
                            collected_chunks.append(chunk_json)
                        except json.JSONDecodeError:
                            pass

    stream_generator.status_code = 200
    stream_generator.resp_headers = {}

    # We need to consume the generator to get status code, so use a wrapper
    async def wrapped_generator():
        async for chunk in stream_generator():
            yield chunk.encode("utf-8") if isinstance(chunk, str) else chunk

    # Create response with streaming
    response = StreamingResponse(
        wrapped_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

    # Background logging after stream completes
    original_body_iterator = response.body_iterator

    async def logging_body_iterator():
        async for chunk in original_body_iterator:
            yield chunk

        # Stream finished, now log
        duration_ms = int((time.time() - start_time) * 1000)
        status_code = stream_generator.status_code
        should_log = log_enabled and (not log_only_errors or status_code != 200)

        if should_log and collected_chunks:
            try:
                parsed = parse_streaming_chunks(collected_chunks)
                usage = parsed["usage"]
                model_name = (request_data.get("model") if request_data else None) or parsed["model"]

                log_data = {
                    "timestamp": datetime.utcnow().isoformat(),
                    "model": model_name,
                    "messages": request_data.get("messages") if request_data else None,
                    "assistant_reply": parsed["content"],
                    "thinking_content": parsed["thinking"],
                    "tool_calls": parsed["tool_calls"],
                    "prompt_tokens": usage.get("prompt_tokens"),
                    "completion_tokens": usage.get("completion_tokens"),
                    "total_tokens": usage.get("total_tokens"),
                    "duration_ms": duration_ms,
                    "client_ip": client_ip,
                    "api_key_hint": api_key_hint,
                    "path": f"/{path}",
                    "method": request.method,
                    "upstream_name": upstream_name,
                    "status_code": status_code,
                    "error_message": None,
                }
                await insert_log(log_data)
                await track_api_key(api_key_hint, usage.get("total_tokens", 0), upstream_name)
                if upstream_id:
                    await increment_upstream_stats(upstream_id)
            except Exception:
                pass

    response.body_iterator = logging_body_iterator()
    return response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
