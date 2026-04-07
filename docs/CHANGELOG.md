# 改动记录

本文档记录项目的重要变更，建议采用 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格。

## [未发布]

### 新增

- 建立 `docs/` 目录，用于项目文档与改动记录。
- 根目录 `scripts/start-backend.sh`、`scripts/start-frontend.sh`：一键启动后端 / 前端开发服务。
- 启动脚本在拉起服务前通过 `scripts/kill-port.sh` 自动释放占用端口（可用 `SKIP_PORT_KILL=1` 关闭）；前端固定通过 `FRONTEND_PORT`（默认 5173）与 Vite `--port` 对齐。

### 变更

### 修复

---

## 版本说明

- **未发布**：尚未打标签的变更，发布时可移动至带日期的版本小节。
