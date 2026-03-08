import aiosqlite
import asyncio
import json
import os
from datetime import datetime

DB_PATH = os.environ.get("DB_PATH", "/data/proxy.db")

# Global connection and write lock
_db = None
_write_lock = asyncio.Lock()

# Settings cache
_settings_cache = {}
_settings_cache_valid = False


async def get_db():
    global _db
    if _db is None:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        _db = await aiosqlite.connect(DB_PATH)
        _db.row_factory = aiosqlite.Row
        await _db.execute("PRAGMA journal_mode=WAL")
    return _db


async def close_db():
    global _db
    if _db:
        await _db.close()
        _db = None


async def init_db():
    db = await get_db()
    await db.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            model TEXT,
            messages TEXT,
            assistant_reply TEXT,
            thinking_content TEXT,
            tool_calls TEXT,
            prompt_tokens INTEGER,
            completion_tokens INTEGER,
            total_tokens INTEGER,
            duration_ms INTEGER,
            client_ip TEXT,
            api_key_hint TEXT,
            path TEXT,
            method TEXT,
            upstream_name TEXT,
            status_code INTEGER,
            error_message TEXT
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS upstreams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            is_active INTEGER DEFAULT 0,
            total_requests INTEGER DEFAULT 0,
            last_used_at TEXT,
            created_at TEXT NOT NULL,
            custom_headers TEXT DEFAULT '{}'
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_hint TEXT NOT NULL UNIQUE,
            note TEXT DEFAULT '',
            first_seen_at TEXT NOT NULL,
            last_seen_at TEXT,
            total_requests INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            last_upstream TEXT DEFAULT ''
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    # Migrate: add new columns if missing
    for col in ["thinking_content TEXT", "tool_calls TEXT", "upstream_name TEXT",
                "status_code INTEGER", "error_message TEXT",
                "is_starred INTEGER DEFAULT 0", "tags TEXT DEFAULT ''", "note TEXT DEFAULT ''"]:
        try:
            await db.execute(f"ALTER TABLE logs ADD COLUMN {col}")
        except Exception:
            pass
    # Migrate api_keys
    try:
        await db.execute("ALTER TABLE api_keys ADD COLUMN last_upstream TEXT DEFAULT ''")
    except Exception:
        pass
    # Migrate upstreams
    try:
        await db.execute("ALTER TABLE upstreams ADD COLUMN custom_headers TEXT DEFAULT '{}'")
    except Exception:
        pass
    await db.commit()


async def insert_log(data: dict):
    async with _write_lock:
        db = await get_db()
        await db.execute("""
            INSERT INTO logs (timestamp, model, messages, assistant_reply, thinking_content, tool_calls,
                prompt_tokens, completion_tokens, total_tokens,
                duration_ms, client_ip, api_key_hint, path, method,
                upstream_name, status_code, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("timestamp", datetime.utcnow().isoformat()),
            data.get("model"),
            json.dumps(data.get("messages"), ensure_ascii=False) if data.get("messages") else None,
            data.get("assistant_reply"),
            data.get("thinking_content"),
            json.dumps(data.get("tool_calls"), ensure_ascii=False) if data.get("tool_calls") else None,
            data.get("prompt_tokens"),
            data.get("completion_tokens"),
            data.get("total_tokens"),
            data.get("duration_ms"),
            data.get("client_ip"),
            data.get("api_key_hint"),
            data.get("path"),
            data.get("method"),
            data.get("upstream_name"),
            data.get("status_code"),
            data.get("error_message"),
        ))
        await db.commit()


async def get_logs(model=None, start_time=None, end_time=None, status_code=None,
                   upstream_name=None, keyword=None, starred_only=False, tag=None,
                   page=1, page_size=50):
    db = await get_db()
    conditions = []
    params = []
    if model:
        conditions.append("model LIKE ?")
        params.append(f"%{model}%")
    if start_time:
        conditions.append("timestamp >= ?")
        params.append(start_time)
    if end_time:
        conditions.append("timestamp <= ?")
        params.append(end_time)
    if status_code:
        conditions.append("status_code = ?")
        params.append(status_code)
    if upstream_name:
        conditions.append("upstream_name = ?")
        params.append(upstream_name)
    if keyword:
        conditions.append("(messages LIKE ? OR assistant_reply LIKE ?)")
        params.extend([f"%{keyword}%", f"%{keyword}%"])
    if starred_only:
        conditions.append("is_starred = 1")
    if tag:
        conditions.append("(',' || tags || ',' LIKE ?)")
        params.append(f"%,{tag},%")

    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    cursor = await db.execute(f"SELECT COUNT(*) FROM logs {where}", params)
    row = await cursor.fetchone()
    total = row[0]

    offset = (page - 1) * page_size
    cursor = await db.execute(
        f"SELECT * FROM logs {where} ORDER BY id DESC LIMIT ? OFFSET ?",
        params + [page_size, offset]
    )
    rows = await cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    logs = [dict(zip(columns, row)) for row in rows]
    return {"logs": logs, "total": total, "page": page, "page_size": page_size}


async def get_dashboard_stats():
    db = await get_db()
    today = datetime.utcnow().strftime("%Y-%m-%d")
    month_start = datetime.utcnow().strftime("%Y-%m-01")

    cursor = await db.execute("SELECT COUNT(*) FROM logs WHERE timestamp >= ?", (today,))
    today_requests = (await cursor.fetchone())[0]

    cursor = await db.execute("SELECT COALESCE(SUM(total_tokens),0) FROM logs WHERE timestamp >= ?", (today,))
    today_tokens = (await cursor.fetchone())[0]

    cursor = await db.execute("SELECT COALESCE(AVG(duration_ms),0) FROM logs WHERE timestamp >= ?", (today,))
    avg_duration = round((await cursor.fetchone())[0])

    cursor = await db.execute(
        "SELECT COUNT(*) FROM logs WHERE timestamp >= ? AND (status_code IS NOT NULL AND status_code != 200)",
        (today,))
    error_count = (await cursor.fetchone())[0]
    error_rate = round(error_count / today_requests * 100, 1) if today_requests > 0 else 0

    # Monthly stats
    cursor = await db.execute("SELECT COUNT(*) FROM logs WHERE timestamp >= ?", (month_start,))
    month_requests = (await cursor.fetchone())[0]

    cursor = await db.execute("SELECT COALESCE(SUM(total_tokens),0) FROM logs WHERE timestamp >= ?", (month_start,))
    month_tokens = (await cursor.fetchone())[0]

    cursor = await db.execute("""
        SELECT strftime('%Y-%m-%dT%H:00:00', timestamp) as hour, COUNT(*) as count,
               COALESCE(SUM(total_tokens),0) as tokens
        FROM logs
        WHERE timestamp >= datetime('now', '-24 hours')
        GROUP BY hour ORDER BY hour
    """)
    hourly = [dict(zip(["hour", "count", "tokens"], r)) for r in await cursor.fetchall()]

    # Daily stats for last 7 days
    cursor = await db.execute("""
        SELECT strftime('%Y-%m-%d', timestamp) as day, COUNT(*) as count
        FROM logs
        WHERE timestamp >= datetime('now', '-7 days')
        GROUP BY day ORDER BY day
    """)
    daily_7d = [dict(zip(["day", "count"], r)) for r in await cursor.fetchall()]

    cursor = await db.execute("""
        SELECT model, COUNT(*) as count FROM logs
        WHERE timestamp >= ? AND model IS NOT NULL
        GROUP BY model ORDER BY count DESC LIMIT 5
    """, (today,))
    top_models = [dict(zip(["model", "count"], r)) for r in await cursor.fetchall()]

    cursor = await db.execute(
        "SELECT id, timestamp, model, total_tokens, duration_ms, status_code, api_key_hint, upstream_name FROM logs ORDER BY id DESC LIMIT 10"
    )
    columns = [desc[0] for desc in cursor.description]
    recent = [dict(zip(columns, r)) for r in await cursor.fetchall()]

    return {
        "today_requests": today_requests,
        "today_tokens": today_tokens,
        "avg_duration": avg_duration,
        "error_rate": error_rate,
        "month_requests": month_requests,
        "month_tokens": month_tokens,
        "hourly": hourly,
        "daily_7d": daily_7d,
        "top_models": top_models,
        "recent": recent,
    }


# ─── Upstream management ────────────────────────────────────

async def get_upstreams():
    db = await get_db()
    cursor = await db.execute("SELECT * FROM upstreams ORDER BY is_active DESC, id ASC")
    columns = [desc[0] for desc in cursor.description]
    return [dict(zip(columns, r)) for r in await cursor.fetchall()]


async def add_upstream(name: str, url: str, custom_headers: str = "{}"):
    async with _write_lock:
        db = await get_db()
        now = datetime.utcnow().isoformat()
        cursor = await db.execute("SELECT COUNT(*) FROM upstreams")
        count = (await cursor.fetchone())[0]
        is_active = 1 if count == 0 else 0
        await db.execute(
            "INSERT INTO upstreams (name, url, is_active, created_at, custom_headers) VALUES (?, ?, ?, ?, ?)",
            (name, url, is_active, now, custom_headers)
        )
        await db.commit()


async def update_upstream(upstream_id: int, name: str, url: str, custom_headers: str = None):
    async with _write_lock:
        db = await get_db()
        if custom_headers is not None:
            await db.execute("UPDATE upstreams SET name=?, url=?, custom_headers=? WHERE id=?",
                             (name, url, custom_headers, upstream_id))
        else:
            await db.execute("UPDATE upstreams SET name=?, url=? WHERE id=?", (name, url, upstream_id))
        await db.commit()


async def delete_upstream(upstream_id: int):
    async with _write_lock:
        db = await get_db()
        await db.execute("DELETE FROM upstreams WHERE id=?", (upstream_id,))
        await db.commit()


async def activate_upstream(upstream_id: int):
    async with _write_lock:
        db = await get_db()
        await db.execute("UPDATE upstreams SET is_active=0")
        await db.execute("UPDATE upstreams SET is_active=1 WHERE id=?", (upstream_id,))
        await db.commit()


async def get_active_upstream():
    db = await get_db()
    cursor = await db.execute("SELECT * FROM upstreams WHERE is_active=1 LIMIT 1")
    row = await cursor.fetchone()
    if row:
        columns = [desc[0] for desc in cursor.description]
        return dict(zip(columns, row))
    return None


async def increment_upstream_stats(upstream_id: int):
    async with _write_lock:
        db = await get_db()
        now = datetime.utcnow().isoformat()
        await db.execute(
            "UPDATE upstreams SET total_requests=total_requests+1, last_used_at=? WHERE id=?",
            (now, upstream_id)
        )
        await db.commit()


# ─── API Key tracking ───────────────────────────────────────

async def track_api_key(key_hint: str, tokens: int = 0, upstream_name: str = ""):
    if not key_hint:
        return
    async with _write_lock:
        db = await get_db()
        now = datetime.utcnow().isoformat()
        cursor = await db.execute("SELECT id FROM api_keys WHERE key_hint=?", (key_hint,))
        row = await cursor.fetchone()
        if row:
            await db.execute(
                "UPDATE api_keys SET last_seen_at=?, total_requests=total_requests+1, total_tokens=total_tokens+?, last_upstream=? WHERE key_hint=?",
                (now, tokens or 0, upstream_name or "", key_hint)
            )
        else:
            await db.execute(
                "INSERT INTO api_keys (key_hint, first_seen_at, last_seen_at, total_requests, total_tokens, last_upstream) VALUES (?, ?, ?, 1, ?, ?)",
                (key_hint, now, now, tokens or 0, upstream_name or "")
            )
        await db.commit()


async def get_api_keys():
    db = await get_db()
    cursor = await db.execute("SELECT * FROM api_keys ORDER BY total_requests DESC")
    columns = [desc[0] for desc in cursor.description]
    return [dict(zip(columns, r)) for r in await cursor.fetchall()]


async def update_api_key_note(key_id: int, note: str):
    async with _write_lock:
        db = await get_db()
        await db.execute("UPDATE api_keys SET note=? WHERE id=?", (note, key_id))
        await db.commit()


# ─── Settings ───────────────────────────────────────────────

async def get_setting(key: str, default: str = None):
    global _settings_cache, _settings_cache_valid
    if _settings_cache_valid and key in _settings_cache:
        return _settings_cache[key]
    db = await get_db()
    cursor = await db.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = await cursor.fetchone()
    value = row[0] if row else default
    _settings_cache[key] = value
    _settings_cache_valid = True
    return value


async def set_setting(key: str, value: str):
    global _settings_cache, _settings_cache_valid
    async with _write_lock:
        db = await get_db()
        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            (key, value)
        )
        await db.commit()
    _settings_cache[key] = value


async def get_db_size():
    try:
        return os.path.getsize(DB_PATH)
    except OSError:
        return 0


async def clear_all_logs():
    async with _write_lock:
        db = await get_db()
        await db.execute("DELETE FROM logs")
        await db.commit()


async def update_log_starred(log_id: int, is_starred: bool):
    async with _write_lock:
        db = await get_db()
        await db.execute("UPDATE logs SET is_starred=? WHERE id=?", (1 if is_starred else 0, log_id))
        await db.commit()


async def update_log_tags(log_id: int, tags: str):
    async with _write_lock:
        db = await get_db()
        await db.execute("UPDATE logs SET tags=? WHERE id=?", (tags, log_id))
        await db.commit()


async def update_log_note(log_id: int, note: str):
    async with _write_lock:
        db = await get_db()
        await db.execute("UPDATE logs SET note=? WHERE id=?", (note, log_id))
        await db.commit()


async def get_all_tags():
    db = await get_db()
    cursor = await db.execute("SELECT DISTINCT tags FROM logs WHERE tags != '' AND tags IS NOT NULL")
    rows = await cursor.fetchall()
    tag_set = set()
    for row in rows:
        for t in row[0].split(","):
            t = t.strip()
            if t:
                tag_set.add(t)
    return sorted(tag_set)


async def clean_old_logs(days: int):
    async with _write_lock:
        db = await get_db()
        await db.execute(
            "DELETE FROM logs WHERE timestamp < datetime('now', ? || ' days')",
            (f"-{days}",)
        )
        await db.commit()


async def increment_model_list_count():
    """Increment a simple counter for /v1/models requests in settings."""
    async with _write_lock:
        db = await get_db()
        cursor = await db.execute("SELECT value FROM settings WHERE key = 'model_list_requests'")
        row = await cursor.fetchone()
        count = int(row[0]) if row else 0
        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('model_list_requests', ?)",
            (str(count + 1),)
        )
        await db.commit()
