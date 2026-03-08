# API Log

[English](#english) | [中文](#中文)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/lyc619/api-log)

---

<a name="english"></a>

## 📝 API Log — Lightweight AI API Transparent Proxy & Conversation Logger

API Log is a lightweight, self-hosted AI API transparent proxy that automatically records complete request context, assistant replies, and token usage for every conversation.

> **Note**: API Log now supports transparent streaming proxy — streaming requests are forwarded as-is while still logging complete conversation data in the background.

### ✨ Features

- **Transparent Proxy** — Forward all OpenAI-compatible API requests to upstream providers
- **Complete Token Recording** — Forces non-streaming to guarantee full `usage` data in every response
- **Request Logging** — Record every conversation: messages, assistant replies, thinking/reasoning, tool calls, and token usage
- **Prompt Favorites & Tags** — Star/bookmark important logs, add tags (e.g. "writing", "code", "roleplay") for quick categorization and retrieval
- **One-Click Prompt Copy** — Copy full prompt (system + user messages) with one click for easy reuse
- **Log Notes** — Add editable notes to any log entry to record why a prompt was interesting or where it came from
- **Multi-Upstream Management** — Add, switch, and test multiple upstream API endpoints with custom headers
- **API Key Statistics** — Track usage per API key with request counts, token consumption, and upstream association
- **Admin Dashboard** — Real-time statistics with charts: hourly/daily request trends, top models, monthly totals
- **Full-text Search** — Search through conversation messages and assistant replies
- **Markdown Rendering** — Beautiful rendering of assistant replies with code highlighting, tables, and lists
- **Database Backup** — One-click database download for backup
- **Login Rate Limiting** — IP-based lockout after 5 failed login attempts (15 min)
- **Mobile Responsive** — Fully functional on mobile devices with adaptive layouts

### 🚀 Quick Start

#### Docker (Recommended)

```bash
docker run -d \
  --name api-log \
  --network host \
  -e UPSTREAM_URL=http://127.0.0.1:3000 \
  -e ADMIN_PASSWORD=yourpassword \
  -v api-log-data:/data \
  ghcr.io/lyc619/api-log:latest
```

> **Note**: `--network host` lets the container access upstream services on localhost. For cloud deployments, use `-p 7891:7891` instead.

#### Docker Compose

```yaml
version: "3.8"
services:
  api-log:
    image: ghcr.io/lyc619/api-log:latest
    network_mode: host
    environment:
      - UPSTREAM_URL=http://127.0.0.1:3000
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-relay123}
      - PORT=7891
    volumes:
      - api-log-data:/data
    restart: unless-stopped

volumes:
  api-log-data:
```

#### Render One-Click Deploy

1. Fork this repository
2. Click the "Deploy to Render" button above
3. Set `UPSTREAM_URL` and `ADMIN_PASSWORD` in environment variables

#### Manual Deployment

```bash
# Install backend dependencies
cd backend
pip install -r requirements.txt

# Build frontend
npm install
npm run build
cp -r dist backend/static

# Start server
cd backend
UPSTREAM_URL=http://127.0.0.1:3000 ADMIN_PASSWORD=yourpassword python main.py
```

### ⚙️ Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `UPSTREAM_URL` | Default upstream API endpoint URL | `http://127.0.0.1:3000` |
| `ADMIN_PASSWORD` | Admin panel login password | `relay123` |
| `PORT` | Server listening port | `7891` |
| `DB_PATH` | SQLite database file path | `/data/proxy.db` |
| `APP_VERSION` | Version string shown in settings | `1.0.0` |

### 💡 Usage Scenario

> **The simplest way to use API Log**: You normally use `api.provider.com` for your AI requests. When you want to log a specific conversation, just change the API URL to `api-log.yourdomain.com` in your client settings — everything else (API key, model, parameters) stays the same. Switch back when you're done. That's it.

### 📖 Usage

1. **Add Upstream** — Go to "上游管理" (Upstream Management) to add your API provider endpoints
2. **View Logs** — All proxied chat completion requests are logged in "请求日志" (Request Logs)
3. **Star & Tag** — Star important prompts and add tags for easy categorization
4. **Add Notes** — Record context about why a prompt was interesting
5. **Copy Prompts** — One-click copy of the full prompt for reuse elsewhere
6. **Client Configuration** — Point your AI client (Cherry Studio, ChatBox, etc.) to `http://your-server:7891` as the API base URL, using your existing API keys

### ⚠️ Important Notes

- All streaming requests are automatically converted to non-streaming. Clients will receive the full response at once (no typewriter effect)
- This is by design to ensure complete token usage data is always captured
- Best suited for prompt logging, debugging, and API usage auditing

### 🛠 Tech Stack

- **Backend**: Python FastAPI + aiosqlite (SQLite WAL mode)
- **Frontend**: React + TypeScript + shadcn/ui + Tailwind CSS + Recharts
- **Deployment**: Docker (multi-stage build with node:20-alpine)

### 📄 License

MIT

---

<a name="中文"></a>

## 📝 API Log — 轻量级 AI API 透明代理 + 对话记录器

API Log 是一个轻量级、可自托管的 AI API 透明代理，自动记录所有请求的完整上下文、回复内容和 Token 用量。

> **注意**：API Log 会将所有流式请求转为非流式，以确保完整记录 `usage` 数据。客户端不会有打字机效果，适合用于提示词记录和调试场景。

### ✨ 功能特点

- **透明代理** — 零修改转发所有 OpenAI 兼容的 API 请求到上游服务商
- **完整 Token 记录** — 强制非流式保证每次响应都包含完整的 `usage` 数据
- **请求日志** — 记录每次对话，包括消息、助手回复、思考推理过程、工具调用和 Token 用量
- **Prompt 收藏与标签** — 给日志加星标收藏，打标签（如"写作类"、"代码类"、"角色扮演"），快速分类检索
- **Prompt 一键复制** — 一键复制完整 Prompt（system + user 消息），方便粘贴复用
- **日志备注** — 给任意日志添加备注，记录"这条 Prompt 好在哪"或"从哪个场景抓到的"
- **多上游管理** — 添加、切换和测试多个上游 API 端点，支持自定义请求头
- **API Key 统计** — 按 API Key 追踪使用情况，包括请求次数、Token 消耗和上游关联
- **管理仪表盘** — 实时统计图表：小时/每日请求趋势、热门模型、月度总计
- **全文搜索** — 搜索对话消息和助手回复内容
- **Markdown 渲染** — 助手回复支持代码高亮、表格、列表等格式化展示
- **数据库备份** — 一键下载数据库文件进行备份
- **登录限流** — 基于 IP 的登录失败锁定（5 次失败后锁定 15 分钟）
- **移动端适配** — 完全支持移动设备，自适应布局

### 🚀 快速部署

#### Docker（推荐）

```bash
docker run -d \
  --name api-log \
  --network host \
  -e UPSTREAM_URL=http://127.0.0.1:3000 \
  -e ADMIN_PASSWORD=你的密码 \
  -v api-log-data:/data \
  ghcr.io/lyc619/api-log:latest
```

#### Docker Compose

```yaml
version: "3.8"
services:
  api-log:
    image: ghcr.io/lyc619/api-log:latest
    network_mode: host
    environment:
      - UPSTREAM_URL=http://127.0.0.1:3000
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-relay123}
      - PORT=7891
    volumes:
      - api-log-data:/data
    restart: unless-stopped

volumes:
  api-log-data:
```

#### Render 一键部署

1. Fork 本仓库
2. 点击上方 "Deploy to Render" 按钮
3. 在环境变量中设置 `UPSTREAM_URL` 和 `ADMIN_PASSWORD`

#### 手动部署

```bash
# 安装后端依赖
cd backend
pip install -r requirements.txt

# 构建前端
npm install
npm run build
cp -r dist backend/static

# 启动服务
cd backend
UPSTREAM_URL=http://127.0.0.1:3000 ADMIN_PASSWORD=你的密码 python main.py
```

### ⚙️ 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `UPSTREAM_URL` | 默认上游 API 端点地址 | `http://127.0.0.1:3000` |
| `ADMIN_PASSWORD` | 管理面板登录密码 | `relay123` |
| `PORT` | 服务监听端口 | `7891` |
| `DB_PATH` | SQLite 数据库文件路径 | `/data/proxy.db` |
| `APP_VERSION` | 设置页面显示的版本号 | `1.0.0` |

### 💡 使用场景

> **最简单的用法**：你平时用 `api.provider.com` 调用 AI，想记录某次对话时，把客户端里的 API 地址改成 `api-log.yourdomain.com`，其他什么都不用改（API Key、模型、参数全部照旧）。记录完切回去就行。

### 📖 使用说明

1. **添加上游** — 进入「上游管理」添加你的 API 服务商端点
2. **查看日志** — 所有代理的聊天补全请求都会记录在「请求日志」中
3. **收藏与标签** — 给感兴趣的 Prompt 加星标、打标签，方便分类检索
4. **添加备注** — 记录这条 Prompt 好在哪，或从哪个场景抓到的
5. **一键复制** — 复制完整 Prompt 到剪贴板，方便粘贴复用
6. **客户端配置** — 在 Cherry Studio、ChatBox 等 AI 客户端中，将 API 地址设为 `http://你的服务器:7891`，使用你原有的 API Key 即可

### ⚠️ 注意事项

- 所有流式请求会自动转为非流式，客户端将一次性收到完整响应（无打字机效果）
- 这是有意设计，以确保每次请求都能完整记录 Token 用量数据
- 最适合用于提示词记录、调试和 API 用量审计

### 🛠 技术栈

- **后端**: Python FastAPI + aiosqlite（SQLite WAL 模式）
- **前端**: React + TypeScript + shadcn/ui + Tailwind CSS + Recharts
- **部署**: Docker（多阶段构建，使用 node:20-alpine）

### 📄 开源许可

MIT
