# 部署指南

## 目录

- [环境要求](#环境要求)
- [本地开发部署](#本地开发部署)
- [Docker 部署](#docker-部署)
- [生产环境部署](#生产环境部署)
  - [Nginx 反向代理](#nginx-反向代理)
  - [切换 PostgreSQL](#切换-postgresql)
  - [进程管理（systemd）](#进程管理systemd)
  - [使用 Supervisor](#使用-supervisor)
- [环境变量参考](#环境变量参考)
- [数据库迁移](#数据库迁移)
- [数据备份](#数据备份)
- [升级](#升级)
- [健康检查](#健康检查)
- [常见问题](#常见问题)

---

## 环境要求

| 组件 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Python | 3.10 | 3.12 |
| Node.js | 18 | 20 LTS |
| npm | 8 | 10 |
| 操作系统 | Linux / macOS | Ubuntu 22.04 / macOS 14 |
| 内存 | 1 GB | 4 GB（含向量库） |
| 磁盘 | 2 GB | 10 GB（含向量数据） |

---

## 本地开发部署

### 1. 克隆仓库

```bash
git clone <repository-url> AIOrcTest
cd AIOrcTest
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少填写：

```dotenv
# 必填：OpenAI 或兼容 API 密钥
OPENAI_API_KEY=sk-...

# 必填：JWT 签名密钥（随机字符串）
SECRET_KEY=your-random-secret-key-here

# 可选：使用 OpenRouter 等兼容 API
# OPENAI_API_BASE=https://openrouter.ai/api/v1
# LLM_MODEL=openai/gpt-4o-mini
```

生成随机 `SECRET_KEY`：

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 3. 启动后端

```bash
./scripts/start-backend.sh
```

脚本自动完成：
- 检测并释放 8000 端口（可用 `SKIP_PORT_KILL=1` 关闭）
- 创建 Python 虚拟环境（`.venv`）
- 安装 `requirements.txt` 依赖
- 以热重载模式启动 Uvicorn

后端就绪后访问 API 文档：http://localhost:8000/docs

### 4. 启动前端

新建终端窗口：

```bash
./scripts/start-frontend.sh
```

脚本自动完成：
- 检测并释放 5173 端口
- 执行 `npm install`（仅首次或依赖变更后）
- 启动 Vite 开发服务器

前端访问地址：http://localhost:5173

### 5. 自定义端口

```bash
# 自定义前端端口
FRONTEND_PORT=3000 ./scripts/start-frontend.sh

# 跳过端口清理（避免杀死其他进程）
SKIP_PORT_KILL=1 ./scripts/start-backend.sh
```

---

## Docker 部署

### 前置准备

1. 安装 [Docker](https://docs.docker.com/get-docker/) 和 [Docker Compose](https://docs.docker.com/compose/install/)
2. 创建 Dockerfile（目前需手动添加，示例见下方）

### 创建后端 Dockerfile

在 `backend/` 目录下创建 `Dockerfile`：

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# 系统依赖（chromadb 编译所需）
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 启动 Docker Compose

```bash
# 构建并启动
docker compose up --build -d

# 查看日志
docker compose logs -f backend

# 停止
docker compose down
```

后端服务运行在 `http://localhost:8000`（Chroma 数据持久化到 `./backend/chroma_data`）。

### 前端 Docker 化（可选）

在 `frontend/` 目录创建 `Dockerfile`：

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

在 `docker-compose.yml` 中添加前端服务：

```yaml
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
```

---

## 生产环境部署

### 前端构建

```bash
cd frontend
npm ci
npm run build
# 构建产物位于 frontend/dist/
```

### Nginx 反向代理

以下配置将前端静态文件与后端 API 统一在同一域名下：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 将 HTTP 重定向到 HTTPS（启用 SSL 后取消注释）
    # return 301 https://$host$request_uri;

    # 前端静态文件
    root /path/to/AIOrcTest/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理（去掉 /api 前缀）
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时设置（场景运行可能较慢）
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
    }
}

# HTTPS 配置（可选，推荐生产使用）
# server {
#     listen 443 ssl http2;
#     server_name your-domain.com;
#     ssl_certificate /path/to/cert.pem;
#     ssl_certificate_key /path/to/key.pem;
#     ... （同上 location 配置）
# }
```

重载 Nginx：

```bash
nginx -t && nginx -s reload
```

### 切换 PostgreSQL

1. 安装并初始化 PostgreSQL：

```bash
# Ubuntu
sudo apt install postgresql postgresql-contrib
sudo -u postgres createuser aiorctest --pwprompt
sudo -u postgres createdb aiorctest --owner=aiorctest
```

2. 安装 Python 异步驱动：

```bash
pip install asyncpg
```

3. 修改 `.env`：

```dotenv
DATABASE_URL=postgresql+asyncpg://aiorctest:yourpassword@localhost:5432/aiorctest
```

4. 重启后端，SQLAlchemy 会自动建表。

### 进程管理（systemd）

创建 `/etc/systemd/system/aiorctest-backend.service`：

```ini
[Unit]
Description=AIOrcTest Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/AIOrcTest/backend
EnvironmentFile=/path/to/AIOrcTest/.env
ExecStart=/path/to/AIOrcTest/backend/.venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 2
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable aiorctest-backend
sudo systemctl start aiorctest-backend
sudo systemctl status aiorctest-backend
```

### 使用 Supervisor

安装 Supervisor 后创建配置 `/etc/supervisor/conf.d/aiorctest.conf`：

```ini
[program:aiorctest-backend]
command=/path/to/AIOrcTest/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
directory=/path/to/AIOrcTest/backend
user=www-data
autostart=true
autorestart=true
stderr_logfile=/var/log/aiorctest/backend.err.log
stdout_logfile=/var/log/aiorctest/backend.out.log
environment=PYTHONPATH="/path/to/AIOrcTest/backend"
```

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start aiorctest-backend
```

---

## 环境变量参考

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `OPENAI_API_KEY` | 是 | — | OpenAI 或兼容 API 密钥 |
| `OPENAI_API_BASE` | 否 | — | 自定义 API 基础 URL（OpenRouter/Azure/本地代理） |
| `LLM_MODEL` | 否 | `gpt-4o-mini` | 默认 LLM 模型名 |
| `EMBEDDING_MODEL` | 否 | `text-embedding-3-small` | 文本嵌入模型 |
| `DATABASE_URL` | 否 | `sqlite:///./aiorctest.db` | 数据库连接字符串 |
| `SECRET_KEY` | 是 | — | JWT 签名密钥（建议 32 字节随机串） |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 否 | `1440` | Token 有效期（分钟），默认 24 小时 |
| `BOOTSTRAP_SUPERADMIN_EMAILS` | 否 | — | 启动时自动设为超级管理员的邮箱（逗号分隔） |
| `CHROMA_PERSIST_DIR` | 否 | `./chroma_data` | Chroma 向量库持久化目录 |
| `CHROMA_COLLECTION` | 否 | `aiorctest` | Chroma 集合名 |
| `CHUNK_SIZE` | 否 | `1000` | RAG 文本分块大小（字符数） |
| `CHUNK_OVERLAP` | 否 | `200` | RAG 分块重叠大小（字符数） |

### 使用 OpenRouter 示例

```dotenv
OPENAI_API_KEY=sk-or-v1-xxxxxxxxxxxx
OPENAI_API_BASE=https://openrouter.ai/api/v1
LLM_MODEL=openai/gpt-4o-mini
EMBEDDING_MODEL=openai/text-embedding-3-small
```

### 使用 Azure OpenAI 示例

```dotenv
OPENAI_API_KEY=your-azure-key
OPENAI_API_BASE=https://your-resource.openai.azure.com/openai/deployments/your-deployment
LLM_MODEL=gpt-4o
```

---

## 数据库迁移

当前项目使用 SQLAlchemy 的 `create_all` 在启动时自动建表（开发友好，无需手动迁移）。

**生产环境注意事项：**

如果后续引入 Alembic 进行迁移管理，流程如下：

```bash
cd backend
# 初始化 Alembic（仅一次）
alembic init alembic

# 生成迁移脚本
alembic revision --autogenerate -m "describe your change"

# 应用迁移
alembic upgrade head

# 查看当前版本
alembic current
```

---

## 数据备份

### SQLite 备份

```bash
# 备份数据库文件
cp backend/aiorctest.db backup/aiorctest-$(date +%Y%m%d).db

# 使用 SQLite 在线备份（不影响运行中的服务）
sqlite3 backend/aiorctest.db ".backup 'backup/aiorctest-$(date +%Y%m%d).db'"
```

### PostgreSQL 备份

```bash
# 备份
pg_dump -U aiorctest aiorctest > backup/aiorctest-$(date +%Y%m%d).sql

# 恢复
psql -U aiorctest aiorctest < backup/aiorctest-YYYYMMDD.sql
```

### Chroma 向量库备份

```bash
# 停止服务后备份（或在运行时做快照）
tar -czf backup/chroma-$(date +%Y%m%d).tar.gz backend/chroma_data/
```

---

## 升级

```bash
# 1. 拉取最新代码
git pull

# 2. 后端依赖更新
cd backend
source .venv/bin/activate
pip install -r requirements.txt

# 3. 前端依赖更新
cd ../frontend
npm install

# 4. 重启服务
# systemd：
sudo systemctl restart aiorctest-backend

# 开发模式：重新运行启动脚本
```

---

## 健康检查

```bash
# 后端健康检查
curl http://localhost:8000/health

# 预期响应
{"status": "ok"}

# RAG 服务检查
curl http://localhost:8000/rag/health
```

---

## 常见问题

### 端口被占用

```bash
# 查看占用 8000 端口的进程
lsof -i :8000

# 手动释放
./scripts/kill-port.sh 8000
```

### ChromaDB 启动报错

ChromaDB 需要 C++ 编译环境，安装失败时：

```bash
# macOS
xcode-select --install

# Ubuntu
sudo apt install build-essential python3-dev
```

### 前端请求 404（/api 路径）

开发模式下检查 Vite 代理配置（`frontend/vite.config.ts`）：

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    rewrite: (path) => path.replace(/^\/api/, ''),
  }
}
```

生产模式下检查 Nginx 的 `/api/` location 是否正确配置。

### bcrypt 版本冲突

`requirements.txt` 中 `bcrypt>=4.0.1,<4.1` 是为兼容 `passlib` 所需。如遇版本冲突：

```bash
pip install bcrypt==4.0.1 passlib[bcrypt]
```

### 超级管理员无法登录

首次部署时设置 `BOOTSTRAP_SUPERADMIN_EMAILS` 并重启服务：

```dotenv
BOOTSTRAP_SUPERADMIN_EMAILS=admin@example.com
```

重启后该邮箱用户（必须已注册）会被设置为超级管理员。
