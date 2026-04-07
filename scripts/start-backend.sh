#!/usr/bin/env bash
# 在 backend 目录启动 FastAPI（默认 http://0.0.0.0:8000，与 frontend Vite 代理一致）
# 可选环境变量：BACKEND_HOST、BACKEND_PORT、SKIP_PORT_KILL=1（不释放端口）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=kill-port.sh
source "${SCRIPT_DIR}/kill-port.sh"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT/backend"

if [[ -d .venv ]]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
elif [[ -d venv ]]; then
  # shellcheck source=/dev/null
  source venv/bin/activate
else
  echo "未找到虚拟环境 backend/.venv 或 backend/venv，请先执行："
  echo "  cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

HOST="${BACKEND_HOST:-0.0.0.0}"
PORT="${BACKEND_PORT:-8000}"

free_tcp_port "$PORT"

exec uvicorn app.main:app --reload --host "$HOST" --port "$PORT"
