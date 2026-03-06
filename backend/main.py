import os
import json
import time
import httpx
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, insert_log, get_logs, get_setting, set_setting

UPSTREAM_URL = os.environ.get("UPSTREAM_URL", "http://127.0.0.1:3000")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
PORT = int(os.environ.get("PORT", "7891"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

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

@app.get("/admin/api/logs")
async def admin_get_logs(
    request: Request,
    model: str = None,
    start_time: str = None,
    end_time: str = None,
    page: int = 1,
    page_size: int = 50,
    _=Depends(verify_admin),
):
    return await get_logs(model, start_time, end_time, page, page_size)


@app.get("/admin/api/settings")
async def admin_get_settings(request: Request, _=Depends(verify_admin)):
    upstream = await get_setting("upstream_url", UPSTREAM_URL)
    return {"upstream_url": upstream}


@app.post("/admin/api/settings")
async def admin_set_settings(request: Request, _=Depends(verify_admin)):
    body = await request.json()
    if "upstream_url" in body:
        await set_setting("upstream_url", body["upstream_url"])
    return {"ok": True}


@app.post("/admin/api/login")
async def admin_login(request: Request):
    body = await request.json()
    if body.get("password") == ADMIN_PASSWORD:
        return {"ok": True}
    raise HTTPException(status_code=401, detail="Wrong password")


# ─── Serve frontend ─────────────────────────────────────────

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(FRONTEND_DIR):
    @app.get("/admin/{full_path:path}")
    async def serve_admin(full_path: str):
        file_path = os.path.join(FRONTEND_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


# ─── Transparent Proxy ──────────────────────────────────────

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy(request: Request, path: str):
    upstream = await get_setting("upstream_url", UPSTREAM_URL)
    upstream = upstream.rstrip("/")
    target_url = f"{upstream}/{path}"
    if request.url.query:
        target_url += f"?{request.url.query}"

    body = await request.body()
    
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

    # Build headers - pass through everything
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("Host", None)

    client_ip = get_client_ip(request)
    api_key_hint = mask_api_key(request.headers.get("authorization", ""))
    start_time = time.time()

    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0)) as client:
        if is_stream and is_chat_completion:
            # Streaming proxy
            upstream_req = client.build_request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
            )
            upstream_resp = await client.send(upstream_req, stream=True)
            
            collected_content = []
            model_name = request_data.get("model") if request_data else None
            usage_data = {}

            async def stream_generator():
                nonlocal usage_data
                try:
                    async for line in upstream_resp.aiter_lines():
                        yield line + "\n"
                        # Parse SSE data for logging
                        if line.startswith("data: ") and line != "data: [DONE]":
                            try:
                                chunk = json.loads(line[6:])
                                if chunk.get("choices"):
                                    delta = chunk["choices"][0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        collected_content.append(content)
                                if chunk.get("usage"):
                                    usage_data = chunk["usage"]
                                if not model_name and chunk.get("model"):
                                    pass  # already set from request
                            except json.JSONDecodeError:
                                pass
                except Exception:
                    pass
                finally:
                    await upstream_resp.aclose()
                    # Log after stream is done
                    duration_ms = int((time.time() - start_time) * 1000)
                    log_data = {
                        "timestamp": datetime.utcnow().isoformat(),
                        "model": model_name,
                        "messages": request_data.get("messages") if request_data else None,
                        "assistant_reply": "".join(collected_content),
                        "prompt_tokens": usage_data.get("prompt_tokens"),
                        "completion_tokens": usage_data.get("completion_tokens"),
                        "total_tokens": usage_data.get("total_tokens"),
                        "duration_ms": duration_ms,
                        "client_ip": client_ip,
                        "api_key_hint": api_key_hint,
                        "path": f"/{path}",
                        "method": request.method,
                    }
                    try:
                        await insert_log(log_data)
                    except Exception:
                        pass

            # Pass through response headers
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
            # Non-streaming proxy
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
            )
            duration_ms = int((time.time() - start_time) * 1000)

            # Log chat completions
            if is_chat_completion and resp.status_code == 200:
                try:
                    resp_data = resp.json()
                    assistant_reply = ""
                    if resp_data.get("choices"):
                        msg = resp_data["choices"][0].get("message", {})
                        assistant_reply = msg.get("content", "")
                    usage = resp_data.get("usage", {})
                    log_data = {
                        "timestamp": datetime.utcnow().isoformat(),
                        "model": request_data.get("model") if request_data else resp_data.get("model"),
                        "messages": request_data.get("messages") if request_data else None,
                        "assistant_reply": assistant_reply,
                        "prompt_tokens": usage.get("prompt_tokens"),
                        "completion_tokens": usage.get("completion_tokens"),
                        "total_tokens": usage.get("total_tokens"),
                        "duration_ms": duration_ms,
                        "client_ip": client_ip,
                        "api_key_hint": api_key_hint,
                        "path": f"/{path}",
                        "method": request.method,
                    }
                    await insert_log(log_data)
                except Exception:
                    pass

            # Pass through response exactly
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
