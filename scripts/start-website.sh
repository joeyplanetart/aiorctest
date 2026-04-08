#!/usr/bin/env bash
# 在 website 目录启动 Vite 开发服务器（默认端口 4173，可用 WEBSITE_PORT 覆盖）
# 可选环境变量：WEBSITE_PORT、SKIP_PORT_KILL=1（不释放端口）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=kill-port.sh
source "${SCRIPT_DIR}/kill-port.sh"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT/website"

WEBSITE_PORT="${WEBSITE_PORT:-4173}"
free_tcp_port "$WEBSITE_PORT"

if [[ ! -d node_modules ]]; then
  echo "未找到 node_modules，正在执行 npm install..."
  npm install
fi

exec npm run dev -- --port "$WEBSITE_PORT"
