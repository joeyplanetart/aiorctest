# 系统架构

## 目录

- [架构总览](#架构总览)
- [技术栈](#技术栈)
- [模块说明](#模块说明)
  - [前端](#前端)
  - [后端](#后端)
  - [RAG 知识库](#rag-知识库)
  - [数据层](#数据层)
- [数据模型](#数据模型)
- [数据流](#数据流)
- [安全设计](#安全设计)
- [扩展性设计](#扩展性设计)

---

## 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                          浏览器 / Client                             │
│                React 18 + TypeScript + MUI + Refine                 │
└─────────────────────────┬───────────────────────────────────────────┘
                          │  HTTP / REST  (Vite Dev Proxy: /api → :8000)
                          │  生产: Nginx 反向代理
┌─────────────────────────▼───────────────────────────────────────────┐
│                     FastAPI  (Uvicorn :8000)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  /auth   │  │/projects │  │  /llm    │  │  /rag    │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
│         │             │             │              │                 │
│  ┌──────▼─────────────▼─────────────▼──────────────▼──────┐        │
│  │               Services / Business Logic                  │        │
│  │  ai_orchestration  │  curl_parser  │  openapi_parser     │        │
│  └──────┬─────────────┬──────────────┬──────────────┬──────┘        │
│         │             │              │              │                │
│  ┌──────▼──────┐  ┌───▼──────┐  ┌───▼──────┐  ┌───▼──────┐        │
│  │  SQLAlchemy │  │ LangChain│  │  httpx   │  │ChromaDB  │        │
│  │  ORM        │  │ (RAG/LLM)│  │(HTTP代理)│  │(向量检索) │        │
│  └──────┬──────┘  └───┬──────┘  └──────────┘  └───┬──────┘        │
└─────────┼─────────────┼──────────────────────────  ┼───────────────┘
          │             │                              │
    ┌─────▼──────┐  ┌───▼──────────────┐  ┌───────────▼──────┐
    │  SQLite /  │  │  OpenAI / 兼容 API│  │  Chroma 向量库    │
    │ PostgreSQL │  │  (Embeddings+LLM) │  │  (本地持久化)     │
    └────────────┘  └──────────────────┘  └──────────────────┘
```

---

## 技术栈

### 后端

| 组件 | 版本要求 | 说明 |
|------|----------|------|
| Python | 3.10+ | 运行时语言 |
| FastAPI | ≥0.115 | Web 框架，自动生成 OpenAPI 文档 |
| Uvicorn | ≥0.34 | ASGI 服务器 |
| SQLAlchemy | ≥2.0 | ORM，支持异步 |
| Pydantic | v2 | 数据校验与序列化 |
| python-jose | ≥3.3 | JWT 签发与验证 |
| passlib/bcrypt | ≥1.7 / ≥4.0 | 密码哈希 |
| httpx | ≥0.28 | 异步 HTTP 客户端（API 代理执行） |
| jsonpath-ng | ≥1.6 | JSONPath 断言提取 |
| LangChain | ≥0.3 | AI 编排框架 |
| langchain-openai | ≥0.3 | OpenAI / 兼容模型集成 |
| langchain-chroma | ≥0.2 | Chroma 向量库集成 |
| ChromaDB | ≥0.6 | 本地向量数据库 |

### 前端

| 组件 | 版本要求 | 说明 |
|------|----------|------|
| React | 18 | UI 框架 |
| TypeScript | ~5.7 | 类型安全 |
| Vite | 6 | 构建工具与开发服务器 |
| MUI (Material UI) | 7 | UI 组件库 |
| Refine | 4 | 数据管理框架（CRUD、权限、路由） |
| React Router | 7 | 客户端路由 |
| TanStack Query | 5 | 服务端状态管理 |
| @xyflow/react | 12 | DAG 流程图画布 |
| Recharts | 3 | 图表（LLM 用量统计） |
| Zustand | 5 | 客户端状态管理 |
| i18next | 26 | 国际化（中英文切换） |

---

## 模块说明

### 前端

```
frontend/src/
├── App.tsx              # 根组件，路由定义，Refine 数据层配置
├── theme.ts             # MUI 主题定制
├── main.tsx             # 入口，挂载 React 应用
├── components/
│   └── Layout.tsx       # 全局布局（侧边栏导航、顶栏、语言切换）
├── pages/
│   ├── auth/            # 登录、注册页
│   ├── projects/        # 项目列表与管理
│   ├── apis/            # API 端点管理（文件夹树、端点列表、调试、断言）
│   ├── orchestration/   # DAG 场景编排画布
│   │   ├── index.tsx    # 场景列表与运行历史
│   │   ├── DagCanvas.tsx # XYFlow 拖拽画布
│   │   └── nodeTypes.tsx # 自定义节点渲染
│   ├── llm-admin/       # LLM 配置与用量统计
│   ├── admin/           # 用户管理（superadmin 专用）
│   └── profile/         # 个人信息与密码修改
├── providers/
│   └── authProvider.ts  # Refine 认证 Provider（JWT 存储、登录/登出）
├── lib/
│   ├── roles.ts         # 角色权限常量
│   └── lastProject.ts   # 记住上次选中项目（localStorage）
├── types/               # TypeScript 类型定义
└── i18n/                # 多语言翻译文件（zh.json / en.json）
```

**关键设计：**
- Refine 的 `simple-rest` 数据 Provider 统一管理 CRUD 请求
- 所有请求通过 Vite 代理 `/api` → `http://localhost:8000`，生产部署时由 Nginx 处理
- 登录后 JWT 存入 `localStorage`，每次请求在 `Authorization: Bearer <token>` 头携带
- DAG 画布使用 `@xyflow/react` 实现节点拖拽与连线，节点数据序列化为 JSON 存入数据库

### 后端

```
backend/app/
├── main.py              # 应用入口，注册路由，CORS，lifespan（建表+引导）
├── bootstrap.py         # 超级管理员引导（读 BOOTSTRAP_SUPERADMIN_EMAILS）
├── api/
│   ├── routes_auth.py   # 注册、登录、个人信息
│   ├── routes_admin.py  # 用户管理（superadmin）
│   ├── routes_project.py # 项目、成员、环境、变量管理
│   ├── routes_api.py    # API 文件夹、端点 CRUD、cURL/OpenAPI 导入、HTTP 代理执行
│   ├── routes_dag.py    # 场景（Scenario）CRUD 与运行
│   ├── routes_rag.py    # RAG 文档入库与查询
│   └── routes_llm.py    # LLM 配置、用量查询
├── core/
│   ├── deps.py          # FastAPI 依赖（get_db, get_current_user, require_superadmin）
│   └── security.py      # JWT 创建/验证，密码哈希
├── db/
│   ├── engine.py        # SQLAlchemy 异步引擎与 SessionLocal
│   └── models.py        # ORM 模型定义
├── schemas/             # Pydantic v2 请求/响应 Schema
└── services/
    ├── ai_orchestration.py  # 调用 LLM 将自然语言转换为场景 DAG 结构
    ├── curl_parser.py       # 解析 cURL 命令为 API 端点结构
    └── openapi_parser.py    # 解析 OpenAPI/Swagger JSON 批量导入端点
```

### RAG 知识库

```
backend/app/rag/
├── config.py      # 从环境变量读取 Chroma/Embedding/LLM 配置
├── ingest.py      # 文档加载、文本分块（RecursiveCharacterTextSplitter）、向量入库
├── pipeline.py    # 组装 RAG 链（检索 → 提示词 → LLM → 输出）
├── retriever.py   # 封装 Chroma 检索器，支持相似度搜索
└── vectorstore.py # ChromaDB 初始化与持久化管理
```

RAG 流程：
1. **入库**：接收文本，分块（默认 1000 字符，重叠 200），转为 Embedding 向量，存入 Chroma
2. **查询**：将用户问题转为 Embedding，在 Chroma 中检索相关文档片段
3. **生成**：将检索结果注入 LLM 提示词，生成最终答案

### 数据层

使用 **SQLAlchemy 2（异步模式）** 管理关系数据。

默认使用 SQLite（文件 `backend/aiorctest.db`），生产环境可切换为 PostgreSQL（修改 `DATABASE_URL`）。

---

## 数据模型

```
User
├── id, email, hashed_password, full_name
├── is_active, is_superadmin
└── created_at

Project
├── id, name, description
└── environments: [Environment]   # 自动创建 stage / pre / prod

ProjectMember
├── project_id → Project
├── user_id → User
└── role: "owner" | "editor" | "viewer"

Environment
├── project_id, slug ("stage"|"pre"|"prod"), name
└── variables: [ProjectVariable]

ProjectVariable
├── environment_id, key, value
└── (按 env_slug 查询，用于场景运行时变量替换)

ApiFolder
├── project_id, name, parent_id (支持嵌套)
└── endpoints: [ApiEndpoint]

ApiEndpoint
├── folder_id, name, method, url, headers, body
└── assertions: []   # JSONPath 断言规则

Scenario
├── project_id, name, description
├── nodes_json    # XYFlow 节点数组（含 API 端点配置）
└── edges_json    # XYFlow 连线数组（含数据映射规则）

LlmConfig
├── id = "default" (单行配置)
├── provider, model, api_key, api_base
└── temperature, max_tokens

LlmUsageRecord
├── model, prompt_tokens, completion_tokens, total_tokens
├── endpoint (调用来源)
└── created_at
```

---

## 数据流

### API 调试执行流

```
前端 [单次请求] → POST /projects/{id}/run
  → 后端从数据库读取端点配置（headers/body/URL）
  → 替换环境变量（{variable_name} → 实际值）
  → httpx 发起真实 HTTP 请求
  → 执行断言（JSONPath 提取 + 期望值比较）
  → 返回 {status_code, headers, body, assertions_result, elapsed_ms}
```

### DAG 场景执行流

```
前端 [运行场景] → POST /projects/{id}/scenarios/{sid}/run?env_slug=stage
  → 加载场景 nodes + edges JSON
  → 拓扑排序（基于 edges 依赖关系）
  → 按序执行每个 API 节点：
      ① 从上游节点结果中提取变量（edges 中的 source_path → target_key）
      ② 替换节点 URL/headers/body 中的 {{variable}}
      ③ httpx 发起 HTTP 请求
      ④ 执行断言，记录结果
  → 返回每个节点的执行结果（含断言通过/失败详情）
```

### AI 场景生成流

```
前端 [自然语言描述] → POST /projects/{id}/scenarios/ai-generate
  → 加载项目已有 API 端点（提供给 LLM 作为上下文）
  → （可选）RAG 检索相关文档片段
  → 构造提示词：端点列表 + 用户需求描述
  → 调用 LLM（OpenAI / 兼容 API）生成场景 DAG 结构 JSON
  → 解析并验证 JSON（nodes + edges）
  → 返回场景草稿（前端可预览编辑后保存）
```

---

## 安全设计

| 机制 | 实现方式 |
|------|----------|
| 认证 | JWT Bearer Token，HS256 签名，过期时间可配置 |
| 密码存储 | bcrypt 哈希，不存明文 |
| 角色权限 | 三级：superadmin / 项目 owner / 项目 editor/viewer |
| 项目隔离 | 所有资源查询强制过滤 `project_id`，成员资格校验 |
| CORS | FastAPI 中间件，生产部署时应限制 `allow_origins` |
| API Key 存储 | LLM API Key 存储于数据库，建议生产启用加密 |

---

## 扩展性设计

当前架构预留了以下扩展能力（见 `docker-compose.yml` 注释）：

- **PostgreSQL**：替换 SQLite，适合多实例部署
- **Redis + Celery**：异步任务队列，适合长时间运行的场景批量执行
- **多模型支持**：LLM 配置抽象为数据库记录，可热切换模型（OpenAI / OpenRouter / Azure / 本地 Ollama）
- **多语言 UI**：i18n 框架已接入，翻译文件位于 `frontend/src/i18n/`
