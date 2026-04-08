# AIOrcTest 文档中心

> **AI 驱动的 API 编排测试平台** — 为团队提供可视化 DAG 场景编排、RAG 知识库辅助与智能测试能力。

---

## 文档目录

| 文档 | 说明 |
|------|------|
| [系统架构](./architecture.md) | 整体架构、模块说明、数据流、技术选型 |
| [用户使用指南](./user-guide.md) | 功能演示、操作步骤、使用技巧 |
| [部署指南](./deployment.md) | 本地开发、Docker 部署、生产环境配置 |
| [API 参考](./api-reference.md) | 所有后端接口的请求/响应说明 |
| [开发者指南](./developer-guide.md) | 环境搭建、代码结构、贡献规范 |
| [变更记录](./CHANGELOG.md) | 版本历史与功能变更 |

---

## 快速开始

### 前置要求

- Python 3.10+
- Node.js 18+
- OpenAI API Key（或兼容接口）

### 一键启动（开发模式）

```bash
# 1. 复制并填写环境变量
cp .env.example .env

# 2. 启动后端（自动创建虚拟环境并安装依赖）
./scripts/start-backend.sh

# 3. 新终端启动前端
./scripts/start-frontend.sh
```

启动后访问 **http://localhost:5173** 即可使用。

---

## 平台简介

AIOrcTest 是一款面向 QA 工程师与后端开发团队的 **AI 增强型 API 测试平台**，核心功能包括：

- **项目管理**：多项目隔离，支持成员权限管理与多环境（stage / pre / prod）变量
- **API 管理**：支持 cURL 导入、OpenAPI 导入，可视化管理接口与断言规则
- **DAG 场景编排**：通过拖拽画布将多个 API 节点组合成测试流，支持变量传递与条件分支
- **AI 场景生成**：用自然语言描述测试需求，AI 自动生成测试场景
- **RAG 知识库**：上传接口文档后，AI 可检索文档辅助生成与问答
- **LLM 配置与用量统计**：统一管理模型配置，追踪 Token 消耗

---

## 项目结构概览

```
AIOrcTest/
├── backend/          # FastAPI 后端
│   └── app/
│       ├── api/      # 路由层
│       ├── core/     # 安全与依赖
│       ├── db/       # 数据库模型
│       ├── schemas/  # Pydantic 模型
│       ├── services/ # 业务逻辑
│       └── rag/      # RAG 向量检索
├── frontend/         # React + TypeScript 前端
│   └── src/
│       ├── pages/    # 页面组件
│       ├── components/
│       └── types/
├── docs/             # 项目文档（本目录）
├── scripts/          # 启动脚本
├── docker-compose.yml
└── .env.example
```
