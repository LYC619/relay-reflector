import aiosqlite
import json
import os
from datetime import datetime

DB_PATH = os.environ.get("DB_PATH", "/data/proxy.db")

async def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                model TEXT,
                messages TEXT,
                assistant_reply TEXT,
                prompt_tokens INTEGER,
                completion_tokens INTEGER,
                total_tokens INTEGER,
                duration_ms INTEGER,
                client_ip TEXT,
                api_key_hint TEXT,
                path TEXT,
                method TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        await db.commit()

async def insert_log(data: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO logs (timestamp, model, messages, assistant_reply,
                prompt_tokens, completion_tokens, total_tokens,
                duration_ms, client_ip, api_key_hint, path, method)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("timestamp", datetime.utcnow().isoformat()),
            data.get("model"),
            json.dumps(data.get("messages"), ensure_ascii=False) if data.get("messages") else None,
            data.get("assistant_reply"),
            data.get("prompt_tokens"),
            data.get("completion_tokens"),
            data.get("total_tokens"),
            data.get("duration_ms"),
            data.get("client_ip"),
            data.get("api_key_hint"),
            data.get("path"),
            data.get("method"),
        ))
        await db.commit()

async def get_logs(model: str = None, start_time: str = None, end_time: str = None, page: int = 1, page_size: int = 50):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
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
        
        where = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        # Count total
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

async def get_setting(key: str, default: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = await cursor.fetchone()
        return row[0] if row else default

async def set_setting(key: str, value: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            (key, value)
        )
        await db.commit()
