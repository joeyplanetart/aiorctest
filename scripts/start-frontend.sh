#!/usr/bin/env bash
# 在 frontend 目录启动 Vite 开发服务器（默认端口 5173，可用 FRONTEND_PORT 覆盖）
# API 请求经 vite.config.ts 中 /api 代理到 http://localhost:8000
# 可选环境变量：FRONTEND_PORT、SKIP_PORT_KILL=1（不释放端口）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=kill-port.sh
source "${SCRIPT_DIR}/kill-port.sh"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT/frontend"

FRONTEND_PORT="${FRONTEND_PORT:-5173}"
free_tcp_port "$FRONTEND_PORT"

if [[ ! -d node_modules ]]; then
  echo "未找到 node_modules，正在执行 npm install..."
  npm install
fi

exec npm run dev -- --port "$FRONTEND_PORT"
