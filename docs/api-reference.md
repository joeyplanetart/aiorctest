# API 参考文档

所有接口均以 `/` 为根路径（开发环境下前端通过 `/api` 代理访问）。

交互式文档（Swagger UI）：`http://localhost:8000/docs`  
ReDoc 文档：`http://localhost:8000/redoc`

## 目录

- [认证](#认证)
- [用户管理（管理员）](#用户管理管理员)
- [项目管理](#项目管理)
- [API 文件夹](#api-文件夹)
- [API 端点](#api-端点)
- [场景（DAG）](#场景dag)
- [RAG 知识库](#rag-知识库)
- [LLM 配置与用量](#llm-配置与用量)
- [通用约定](#通用约定)

---

## 通用约定

### 认证

除注册和登录接口外，所有接口需在请求头中携带 JWT Token：

```
Authorization: Bearer <token>
```

### 响应格式

成功响应直接返回数据对象或数组，HTTP 状态码为 `200`、`201`。

错误响应格式：

```json
{
  "detail": "错误描述信息"
}
```

常见状态码：

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证（Token 缺失或过期） |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 422 | 请求体校验失败 |
| 500 | 服务器内部错误 |

---

## 认证

### 注册

```
POST /auth/register
```

**请求体：**

```json
{
  "email": "user@example.com",
  "password": "yourpassword",
  "full_name": "张三"
}
```

**响应：**

```json
{
  "id": 1,
  "email": "user@example.com",
  "full_name": "张三",
  "is_active": true,
  "is_superadmin": false,
  "created_at": "2026-01-01T00:00:00"
}
```

---

### 登录

```
POST /auth/login
```

**请求体（form-data）：**

```
username=user@example.com
password=yourpassword
```

**响应：**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

---

### 获取当前用户信息

```
GET /auth/me
```

**响应：**

```json
{
  "id": 1,
  "email": "user@example.com",
  "full_name": "张三",
  "is_active": true,
  "is_superadmin": false,
  "created_at": "2026-01-01T00:00:00"
}
```

---

### 更新个人信息

```
PATCH /auth/me
```

**请求体（所有字段可选）：**

```json
{
  "full_name": "李四",
  "email": "new@example.com"
}
```

---

### 修改密码

```
POST /auth/me/password
```

**请求体：**

```json
{
  "current_password": "oldpassword",
  "new_password": "newpassword"
}
```

---

## 用户管理（管理员）

> 以下接口需要超级管理员权限。

### 获取用户列表

```
GET /auth/admin/users
```

**响应：** 用户对象数组

---

### 更新用户

```
PATCH /auth/admin/users/{user_id}
```

**请求体（所有字段可选）：**

```json
{
  "is_active": true,
  "is_superadmin": false
}
```

---

## 项目管理

### 获取项目列表

```
GET /projects
```

返回当前用户有权访问的项目列表。

---

### 创建项目

```
POST /projects
```

> 需要超级管理员权限

**请求体：**

```json
{
  "name": "电商平台测试",
  "description": "电商平台 API 测试项目"
}
```

**响应：** 新建的项目对象（含自动创建的三个环境）

---

### 获取项目详情

```
GET /projects/{project_id}
```

---

### 更新项目

```
PATCH /projects/{project_id}
```

**请求体（所有字段可选）：**

```json
{
  "name": "新项目名",
  "description": "新描述"
}
```

---

### 删除项目

```
DELETE /projects/{project_id}
```

> 需要超级管理员权限

---

### 获取项目成员

```
GET /projects/{project_id}/members
```

---

### 添加项目成员

```
POST /projects/{project_id}/members
```

**请求体：**

```json
{
  "email": "member@example.com",
  "role": "editor"
}
```

`role` 可选值：`owner` | `editor` | `viewer`

---

### 更新成员角色

```
PATCH /projects/{project_id}/members/{member_id}
```

**请求体：**

```json
{
  "role": "viewer"
}
```

---

### 移除成员

```
DELETE /projects/{project_id}/members/{member_id}
```

---

### 获取环境变量

```
GET /projects/{project_id}/variables?env_slug=stage
```

**查询参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `env_slug` | `stage` | 环境标识：`stage` / `pre` / `prod` |

**响应：**

```json
[
  {"key": "base_url", "value": "https://api-staging.example.com"},
  {"key": "token", "value": "test-token-123"}
]
```

---

### 保存环境变量

```
PUT /projects/{project_id}/variables?env_slug=stage
```

**请求体（数组，全量替换）：**

```json
[
  {"key": "base_url", "value": "https://api-staging.example.com"},
  {"key": "token", "value": "new-token"}
]
```

---

### 更新环境配置

```
PATCH /projects/{project_id}/environments/{environment_id}
```

---

## API 文件夹

### 获取文件夹列表

```
GET /projects/{project_id}/folders
```

---

### 获取文件夹树

```
GET /projects/{project_id}/folders/tree
```

返回嵌套的文件夹树结构（含子文件夹和端点）。

---

### 创建文件夹

```
POST /projects/{project_id}/folders
```

**请求体：**

```json
{
  "name": "用户模块",
  "parent_id": null
}
```

`parent_id` 为 `null` 表示根文件夹，填写文件夹 ID 则创建子文件夹。

---

### 更新文件夹

```
PATCH /projects/{project_id}/folders/{folder_id}
```

**请求体：**

```json
{
  "name": "新文件夹名"
}
```

---

### 删除文件夹

```
DELETE /projects/{project_id}/folders/{folder_id}
```

> 删除文件夹会级联删除其下所有子文件夹和端点

---

## API 端点

### 获取端点列表

```
GET /projects/{project_id}/endpoints?folder_id=1
```

**查询参数：**

| 参数 | 说明 |
|------|------|
| `folder_id` | 可选，按文件夹过滤 |

---

### 创建端点

```
POST /projects/{project_id}/endpoints
```

**请求体：**

```json
{
  "folder_id": 1,
  "name": "用户登录",
  "method": "POST",
  "url": "{{base_url}}/auth/login",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "email": "{{test_email}}",
    "password": "{{test_password}}"
  },
  "assertions": [
    {
      "path": "$.data.token",
      "type": "exists",
      "expected": null
    },
    {
      "path": "$.code",
      "type": "equals",
      "expected": 0
    }
  ]
}
```

**断言类型（`type`）：**

| 类型 | 说明 |
|------|------|
| `equals` | 提取值等于期望值 |
| `not_equals` | 提取值不等于期望值 |
| `contains` | 提取值包含期望字符串 |
| `exists` | 路径存在（`expected` 传 `null`） |
| `regex` | 提取值匹配正则表达式 |
| `greater_than` | 提取值大于期望值（数字比较） |
| `less_than` | 提取值小于期望值（数字比较） |

---

### 更新端点

```
PATCH /projects/{project_id}/endpoints/{endpoint_id}
```

---

### 删除端点

```
DELETE /projects/{project_id}/endpoints/{endpoint_id}
```

---

### 从 cURL 导入

```
POST /projects/{project_id}/import/curl
```

**请求体：**

```json
{
  "curl_command": "curl -X POST 'https://api.example.com/login' -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\",\"password\":\"123456\"}'",
  "folder_id": 1,
  "name": "用户登录"
}
```

---

### 从 OpenAPI 导入

```
POST /projects/{project_id}/import/openapi
```

**请求体：**

```json
{
  "spec": { /* OpenAPI 3.0 或 Swagger 2.0 JSON 对象 */ },
  "folder_id": 1
}
```

按 `tags` 自动创建子文件夹并批量导入端点。

---

### 执行单次请求

```
POST /projects/{project_id}/run
```

**请求体：**

```json
{
  "endpoint_id": 5,
  "env_slug": "stage",
  "override_url": null,
  "override_headers": {},
  "override_body": null
}
```

**响应：**

```json
{
  "status_code": 200,
  "headers": {
    "content-type": "application/json"
  },
  "body": {
    "code": 0,
    "data": {
      "token": "eyJ..."
    }
  },
  "elapsed_ms": 234,
  "assertions": [
    {
      "path": "$.data.token",
      "type": "exists",
      "expected": null,
      "actual": "eyJ...",
      "passed": true
    },
    {
      "path": "$.code",
      "type": "equals",
      "expected": 0,
      "actual": 0,
      "passed": true
    }
  ],
  "all_passed": true
}
```

---

## 场景（DAG）

### 获取场景列表

```
GET /projects/{project_id}/scenarios
```

---

### 创建场景

```
POST /projects/{project_id}/scenarios
```

**请求体：**

```json
{
  "name": "用户注册登录流程",
  "description": "测试完整的注册和登录业务流",
  "nodes_json": [],
  "edges_json": []
}
```

---

### 获取场景详情

```
GET /projects/{project_id}/scenarios/{scenario_id}
```

**响应中的场景数据结构：**

```json
{
  "id": 1,
  "name": "用户注册登录流程",
  "description": "...",
  "nodes_json": [
    {
      "id": "node-1",
      "type": "apiNode",
      "position": {"x": 100, "y": 100},
      "data": {
        "endpoint_id": 5,
        "label": "用户注册",
        "override_body": {"email": "{{test_email}}"}
      }
    }
  ],
  "edges_json": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "data": {
        "mappings": [
          {
            "source_path": "$.data.user_id",
            "target_key": "created_user_id"
          }
        ]
      }
    }
  ],
  "created_at": "2026-01-01T00:00:00"
}
```

---

### 更新场景

```
PUT /projects/{project_id}/scenarios/{scenario_id}
```

**请求体（同创建场景，全量更新）**

---

### 删除场景

```
DELETE /projects/{project_id}/scenarios/{scenario_id}
```

---

### 运行场景

```
POST /projects/{project_id}/scenarios/{scenario_id}/run?env_slug=stage
```

**查询参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `env_slug` | `stage` | 运行环境 |

**响应：**

```json
{
  "scenario_id": 1,
  "env_slug": "stage",
  "started_at": "2026-01-01T10:00:00",
  "finished_at": "2026-01-01T10:00:02",
  "elapsed_ms": 2150,
  "total_nodes": 3,
  "passed_nodes": 3,
  "failed_nodes": 0,
  "results": [
    {
      "node_id": "node-1",
      "label": "用户注册",
      "status": "passed",
      "status_code": 201,
      "elapsed_ms": 850,
      "body": {"code": 0, "data": {"user_id": 42}},
      "assertions": [
        {
          "path": "$.code",
          "type": "equals",
          "expected": 0,
          "actual": 0,
          "passed": true
        }
      ]
    }
  ]
}
```

---

### AI 生成场景

```
POST /projects/{project_id}/scenarios/ai-generate
```

**请求体：**

```json
{
  "description": "测试用户注册流程：先注册一个新用户，然后用注册的账号登录，最后验证能否正确获取用户信息。"
}
```

**响应：** 生成的场景草稿（与场景详情结构相同，但未保存到数据库）

---

## RAG 知识库

### RAG 健康检查

```
GET /rag/health
```

**响应：**

```json
{
  "status": "ok",
  "collection": "aiorctest",
  "document_count": 42
}
```

---

### 入库文档

```
POST /rag/ingest
```

**请求体：**

```json
{
  "text": "用户接口说明文档...\n\nPOST /auth/login\n请求参数...",
  "metadata": {
    "source": "接口文档 v1.0",
    "author": "后端团队"
  }
}
```

**响应：**

```json
{
  "status": "ok",
  "chunks_created": 5
}
```

---

### 查询知识库

```
POST /rag/query
```

**请求体：**

```json
{
  "question": "登录接口需要哪些参数？",
  "top_k": 3
}
```

**响应：**

```json
{
  "answer": "登录接口 POST /auth/login 需要以下参数：\n- email：用户邮箱\n- password：密码\n\n返回 access_token 用于后续认证。",
  "sources": [
    {
      "content": "POST /auth/login\n请求参数...",
      "metadata": {"source": "接口文档 v1.0"},
      "score": 0.92
    }
  ]
}
```

---

## LLM 配置与用量

### 获取 LLM 配置

```
GET /llm/config
```

**响应：**

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "api_key": "sk-***（已脱敏）",
  "api_base": null,
  "temperature": 0.7,
  "max_tokens": 4096
}
```

---

### 更新 LLM 配置

```
PUT /llm/config
```

> 需要超级管理员权限

**请求体（所有字段可选）：**

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "api_key": "sk-新的key",
  "api_base": "https://openrouter.ai/api/v1",
  "temperature": 0.5,
  "max_tokens": 8192
}
```

---

### 获取用量记录

```
GET /llm/usage?days=7&limit=100
```

**查询参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `days` | `7` | 最近 N 天 |
| `limit` | `100` | 最多返回记录数 |

**响应：** 用量记录数组

```json
[
  {
    "id": 1,
    "model": "gpt-4o-mini",
    "endpoint": "ai-generate",
    "prompt_tokens": 1234,
    "completion_tokens": 567,
    "total_tokens": 1801,
    "created_at": "2026-01-01T10:00:00"
  }
]
```

---

### 获取用量统计（按天）

```
GET /llm/usage/stats?days=30
```

**响应：**

```json
[
  {
    "date": "2026-01-01",
    "total_tokens": 15000,
    "prompt_tokens": 10000,
    "completion_tokens": 5000,
    "call_count": 12
  }
]
```

---

### 获取用量汇总

```
GET /llm/usage/summary?days=30
```

**响应：**

```json
{
  "total_tokens": 450000,
  "total_prompt_tokens": 300000,
  "total_completion_tokens": 150000,
  "total_calls": 358,
  "by_endpoint": {
    "ai-generate": {"calls": 200, "tokens": 300000},
    "rag-query": {"calls": 158, "tokens": 150000}
  }
}
```

---

## 系统

### 健康检查

```
GET /health
```

**响应：**

```json
{"status": "ok"}
```
