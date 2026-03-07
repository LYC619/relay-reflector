# Relay Reflector

[English](#english) | [中文](#中文)

---

<a name="english"></a>

## 🔀 Relay Reflector — AI API Transparent Proxy & Request Logger

Relay Reflector is a lightweight, self-hosted AI API transparent proxy with built-in request logging, multi-upstream management, API Key statistics, and a beautiful admin dashboard.

### ✨ Features

- **Transparent Proxy** — Forward all OpenAI-compatible API requests to upstream providers with zero modification
- **Request Logging** — Record every conversation including messages, assistant replies, thinking/reasoning, tool calls, and token usage
- **Multi-Upstream Management** — Add, switch, and test multiple upstream API endpoints with custom headers
- **API Key Statistics** — Track usage per API key with request counts, token consumption, and upstream association
- **Admin Dashboard** — Real-time statistics with charts: hourly/daily request trends, top models, monthly totals
- **Full-text Search** — Search through conversation messages and assistant replies
- **Markdown Rendering** — Beautiful rendering of assistant replies with code highlighting, tables, and lists
- **Database Backup** — One-click database download for backup
- **Login Rate Limiting** — IP-based lockout after 5 failed login attempts (15 min)
- **Mobile Responsive** — Fully functional on mobile devices with adaptive layouts

### 📸 Screenshots

> *Screenshots coming soon*

### 🚀 Quick Start

#### Docker (Recommended)

```bash
docker run -d \
  --name relay-reflector \
  --network host \
  -e UPSTREAM_URL=http://127.0.0.1:3000 \
  -e ADMIN_PASSWORD=yourpassword \
  -v relay-data:/data \
  ghcr.io/lyc619/relay-reflector:latest
```

#### Docker Compose

```yaml
version: "3.8"
services:
  relay-reflector:
    image: ghcr.io/lyc619/relay-reflector:latest
    network_mode: host
    environment:
      - UPSTREAM_URL=http://127.0.0.1:3000
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-relay123}
      - PORT=7891
    volumes:
      - relay-data:/data
    restart: unless-stopped

volumes:
  relay-data:
```

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
| `RELAY_VERSION` | Version string shown in settings | `1.0.0` |

### 📖 Usage

1. **Add Upstream** — Go to "上游管理" (Upstream Management) to add your API provider endpoints
2. **View Logs** — All proxied chat completion requests are logged in "请求日志" (Request Logs)
3. **Client Configuration** — Point your AI client (Cherry Studio, ChatBox, etc.) to `http://your-server:7891` as the API base URL, using your existing API keys

### 🛠 Tech Stack

- **Backend**: Python FastAPI + aiosqlite (SQLite WAL mode)
- **Frontend**: React + TypeScript + shadcn/ui + Tailwind CSS + Recharts
- **Deployment**: Docker (multi-stage build with node:20-alpine)

### 📄 License

MIT

---

<a name="中文"></a>

## 🔀 Relay Reflector — AI API 透明代理 + 请求记录器

Relay Reflector 是一个轻量级、可自托管的 AI API 透明代理，内置请求日志记录、多上游管理、API Key 统计和美观的管理仪表盘。

### ✨ 功能特点

- **透明代理** — 零修改转发所有 OpenAI 兼容的 API 请求到上游服务商
- **请求日志** — 记录每次对话，包括消息、助手回复、思考推理过程、工具调用和 Token 用量
- **多上游管理** — 添加、切换和测试多个上游 API 端点，支持自定义请求头
- **API Key 统计** — 按 API Key 追踪使用情况，包括请求次数、Token 消耗和上游关联
- **管理仪表盘** — 实时统计图表：小时/每日请求趋势、热门模型、月度总计
- **全文搜索** — 搜索对话消息和助手回复内容
- **Markdown 渲染** — 助手回复支持代码高亮、表格、列表等格式化展示
- **数据库备份** — 一键下载数据库文件进行备份
- **登录限流** — 基于 IP 的登录失败锁定（5 次失败后锁定 15 分钟）
- **移动端适配** — 完全支持移动设备，自适应布局

### 📸 截图

> *截图即将补充*

### 🚀 快速部署

#### Docker（推荐）

```bash
docker run -d \
  --name relay-reflector \
  --network host \
  -e UPSTREAM_URL=http://127.0.0.1:3000 \
  -e ADMIN_PASSWORD=你的密码 \
  -v relay-data:/data \
  ghcr.io/lyc619/relay-reflector:latest
```

#### Docker Compose

```yaml
version: "3.8"
services:
  relay-reflector:
    image: ghcr.io/lyc619/relay-reflector:latest
    network_mode: host
    environment:
      - UPSTREAM_URL=http://127.0.0.1:3000
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-relay123}
      - PORT=7891
    volumes:
      - relay-data:/data
    restart: unless-stopped

volumes:
  relay-data:
```

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
| `RELAY_VERSION` | 设置页面显示的版本号 | `1.0.0` |

### 📖 使用说明

1. **添加上游** — 进入「上游管理」添加你的 API 服务商端点
2. **查看日志** — 所有代理的聊天补全请求都会记录在「请求日志」中
3. **客户端配置** — 在 Cherry Studio、ChatBox 等 AI 客户端中，将 API 地址设为 `http://你的服务器:7891`，使用你原有的 API Key 即可

### 🛠 技术栈

- **后端**: Python FastAPI + aiosqlite（SQLite WAL 模式）
- **前端**: React + TypeScript + shadcn/ui + Tailwind CSS + Recharts
- **部署**: Docker（多阶段构建，使用 node:20-alpine）

### 📄 开源许可

MIT
