#!/usr/bin/env bash
# 供 start-*.sh source：结束占用指定 TCP 端口的监听进程（依赖 lsof，适用于 macOS / 多数 Linux）
# 设置 SKIP_PORT_KILL=1 可跳过

free_tcp_port() {
  local port="${1:?端口必填}"
  if [[ "${SKIP_PORT_KILL:-0}" == "1" ]]; then
    return 0
  fi
  local pids
  pids="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    return 0
  fi
  echo "端口 ${port} 已被占用，正在结束监听进程..."
  while IFS= read -r pid; do
    [[ -n "${pid}" ]] || continue
    kill -TERM "$pid" 2>/dev/null || true
  done <<< "$pids"
  sleep 0.4
  pids="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    return 0
  fi
  while IFS= read -r pid; do
    [[ -n "${pid}" ]] || continue
    kill -KILL "$pid" 2>/dev/null || true
  done <<< "$pids"
}
