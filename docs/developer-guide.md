# 开发者指南

## 目录

- [开发环境搭建](#开发环境搭建)
- [项目结构详解](#项目结构详解)
- [后端开发](#后端开发)
  - [新增 API 路由](#新增-api-路由)
  - [数据库模型变更](#数据库模型变更)
  - [编写 Service](#编写-service)
- [前端开发](#前端开发)
  - [新增页面](#新增页面)
  - [API 调用规范](#api-调用规范)
  - [状态管理](#状态管理)
  - [国际化](#国际化)
- [DAG 节点扩展](#dag-节点扩展)
- [测试](#测试)
- [代码规范](#代码规范)
- [Git 工作流](#git-工作流)
- [调试技巧](#调试技巧)

---

## 开发环境搭建

### 1. 后端环境

```bash
cd backend

# 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 安装依赖（含开发工具）
pip install -r requirements.txt

# 安装开发工具（可选）
pip install ruff black pytest pytest-asyncio httpx
```

### 2. 前端环境

```bash
cd frontend
npm install
```

### 3. IDE 推荐配置

**VS Code / Cursor 推荐插件：**

- `Python`（Microsoft）
- `Pylance`
- `Ruff`（Linting）
- `ESLint`
- `Prettier`
- `TypeScript Vue Plugin`

**前端 `.editorconfig`（如需添加）：**

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

---

## 项目结构详解

### 后端路由注册

在 `backend/app/main.py` 中查看所有路由前缀：

```python
app.include_router(auth_router, prefix="/auth")
app.include_router(admin_router, prefix="/auth")      # /auth/admin/*
app.include_router(project_router, prefix="/projects")
app.include_router(api_router, prefix="/projects")    # 复用 /projects 前缀
app.include_router(dag_router, prefix="/projects")    # 复用 /projects 前缀
app.include_router(rag_router, prefix="/rag")
app.include_router(llm_router, prefix="/llm")
```

### 后端依赖注入

```python
from app.core.deps import get_db, get_current_user, require_superadmin

# 普通认证
async def my_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ...

# 超级管理员校验
async def admin_endpoint(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_superadmin)
):
    ...
```

### 前端路由

路由定义在 `frontend/src/App.tsx`，使用 React Router 7 + Refine：

```
/ → 重定向到 /projects
/login → 登录页
/register → 注册页
/projects → 项目列表
/projects/:projectId/apis → API 管理（Wrapper）
/projects/:projectId/orchestration → 场景编排（Wrapper）
/llm-admin → LLM 管理
/profile → 个人信息
/admin → 用户管理
```

---

## 后端开发

### 新增 API 路由

以新增「标签管理」功能为例：

**第一步：定义 Schema（`backend/app/schemas/tag.py`）**

```python
from pydantic import BaseModel
from datetime import datetime

class TagCreate(BaseModel):
    name: str
    color: str = "#1976d2"

class TagRead(BaseModel):
    id: int
    name: str
    color: str
    project_id: int
    created_at: datetime

    model_config = {"from_attributes": True}
```

**第二步：定义数据库模型（在 `db/models.py` 中添加）**

```python
class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    color: Mapped[str] = mapped_column(String(20), default="#1976d2")
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
```

**第三步：创建路由（`backend/app/api/routes_tag.py`）**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.deps import get_db, get_current_user
from app.db.models import Tag, User
from app.schemas.tag import TagCreate, TagRead

router = APIRouter()

@router.get("/projects/{project_id}/tags", response_model=list[TagRead])
async def list_tags(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Tag).where(Tag.project_id == project_id)
    )
    return result.scalars().all()

@router.post("/projects/{project_id}/tags", response_model=TagRead, status_code=201)
async def create_tag(
    project_id: int,
    body: TagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tag = Tag(**body.model_dump(), project_id=project_id)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag
```

**第四步：注册路由（`backend/app/main.py`）**

```python
from app.api.routes_tag import router as tag_router

app.include_router(tag_router)
```

### 数据库模型变更

> 当前使用 `create_all` 自动建表，对新增字段需注意：

1. **新表**：直接添加模型，重启后自动创建
2. **现有表新增列**：`create_all` 不会自动添加列，需手动迁移：

```bash
# 开发环境：删除旧 DB 重建（会丢失数据）
rm backend/aiorctest.db

# 生产环境：使用 ALTER TABLE
sqlite3 aiorctest.db "ALTER TABLE tags ADD COLUMN updated_at DATETIME;"

# 或者引入 Alembic 管理迁移（推荐生产使用）
```

### 编写 Service

Service 封装复杂业务逻辑，保持路由层简洁。参考 `services/ai_orchestration.py`：

```python
# backend/app/services/my_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Project

async def calculate_project_stats(project_id: int, db: AsyncSession) -> dict:
    """计算项目统计信息"""
    # 业务逻辑...
    return {"endpoints": 10, "scenarios": 5}
```

在路由中调用：

```python
from app.services.my_service import calculate_project_stats

@router.get("/projects/{project_id}/stats")
async def get_stats(project_id: int, db: AsyncSession = Depends(get_db)):
    return await calculate_project_stats(project_id, db)
```

---

## 前端开发

### 新增页面

以新增「标签管理」页面为例：

**第一步：创建页面组件（`frontend/src/pages/tags/index.tsx`）**

```tsx
import React from "react";
import { useList, useCreate } from "@refinedev/core";
import { Box, Typography, Button } from "@mui/material";

export const TagsPage: React.FC = () => {
  const { data, isLoading } = useList({
    resource: `projects/${projectId}/tags`,
  });

  return (
    <Box>
      <Typography variant="h5">标签管理</Typography>
      {/* 页面内容 */}
    </Box>
  );
};
```

**第二步：注册路由（`frontend/src/App.tsx`）**

```tsx
import { TagsPage } from "./pages/tags";

// 在 Routes 中添加
<Route path="/projects/:projectId/tags" element={<TagsPage />} />
```

**第三步：添加导航（`frontend/src/components/Layout.tsx`）**

```tsx
{ label: "标签管理", path: `/projects/${projectId}/tags`, icon: <LabelIcon /> }
```

### API 调用规范

**使用 Refine Hooks（推荐）：**

```tsx
import { useList, useCreate, useUpdate, useDelete, useOne } from "@refinedev/core";

// 列表
const { data, isLoading, isError } = useList({
  resource: `projects/${projectId}/tags`,
  pagination: { pageSize: 20 },
  filters: [{ field: "name", operator: "contains", value: searchText }],
});

// 单条
const { data } = useOne({ resource: "tags", id: tagId });

// 创建
const { mutate: createTag, isLoading: creating } = useCreate();
createTag({ resource: `projects/${projectId}/tags`, values: { name, color } });

// 更新
const { mutate: updateTag } = useUpdate();
updateTag({ resource: `projects/${projectId}/tags`, id: tagId, values: { name } });

// 删除
const { mutate: deleteTag } = useDelete();
deleteTag({ resource: `projects/${projectId}/tags`, id: tagId });
```

**直接使用 fetch（复杂场景）：**

```tsx
import { useApiUrl } from "@refinedev/core";

const apiUrl = useApiUrl();

const runScenario = async () => {
  const token = localStorage.getItem("access_token");
  const response = await fetch(
    `${apiUrl}/projects/${projectId}/scenarios/${scenarioId}/run?env_slug=${envSlug}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const result = await response.json();
  // 处理结果
};
```

### 状态管理

**Zustand（客户端全局状态）：**

```tsx
// frontend/src/stores/useProjectStore.ts
import { create } from "zustand";

interface ProjectStore {
  currentProjectId: number | null;
  setCurrentProjectId: (id: number) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProjectId: null,
  setCurrentProjectId: (id) => set({ currentProjectId: id }),
}));
```

**TanStack Query（服务端状态）：**

Refine 内部使用 TanStack Query，使用 `useList` / `useOne` 等 Hook 时自动处理缓存与失效。

### 国际化

翻译文件位于 `frontend/src/i18n/`：

- `zh.json`：中文翻译
- `en.json`：英文翻译

**添加新翻译键：**

```json
// zh.json
{
  "pages": {
    "tags": {
      "title": "标签管理",
      "create": "新建标签"
    }
  }
}
```

```json
// en.json
{
  "pages": {
    "tags": {
      "title": "Tag Management",
      "create": "Create Tag"
    }
  }
}
```

**在组件中使用：**

```tsx
import { useTranslation } from "react-i18next";

const { t } = useTranslation();
<Typography>{t("pages.tags.title")}</Typography>
```

---

## DAG 节点扩展

DAG 画布使用 `@xyflow/react`，节点类型定义在 `frontend/src/pages/orchestration/nodeTypes.tsx`。

### 添加新节点类型

```tsx
// nodeTypes.tsx
import { NodeProps, Handle, Position } from "@xyflow/react";

interface ConditionNodeData {
  label: string;
  condition: string;
}

export const ConditionNode: React.FC<NodeProps<ConditionNodeData>> = ({ data }) => {
  return (
    <div style={{ background: "#fff9c4", border: "1px solid #f9a825", borderRadius: 8, padding: 12 }}>
      <Handle type="target" position={Position.Left} />
      <div>条件：{data.condition}</div>
      <Handle type="source" position={Position.Right} id="true" style={{ top: "30%" }} />
      <Handle type="source" position={Position.Right} id="false" style={{ top: "70%" }} />
    </div>
  );
};

// 注册到 nodeTypes 对象
export const nodeTypes = {
  apiNode: ApiNode,
  conditionNode: ConditionNode,  // 新增
};
```

---

## 测试

### 后端测试

使用 `pytest` + `httpx.AsyncClient`：

```python
# backend/tests/test_auth.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_register():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/auth/register", json={
            "email": "test@example.com",
            "password": "password123",
            "full_name": "Test User"
        })
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"

@pytest.mark.asyncio
async def test_login():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/auth/login", data={
            "username": "test@example.com",
            "password": "password123"
        })
    assert response.status_code == 200
    assert "access_token" in response.json()
```

运行测试：

```bash
cd backend
pytest tests/ -v
```

### 前端测试

目前项目未内置前端测试框架，推荐使用 Vitest + React Testing Library：

```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

---

## 代码规范

### Python（后端）

使用 `ruff` 作为 Linter 和格式化工具：

```bash
# 检查
ruff check backend/

# 自动修复
ruff check --fix backend/

# 格式化
ruff format backend/
```

推荐配置（在 `backend/pyproject.toml` 中添加）：

```toml
[tool.ruff]
line-length = 100
target-version = "py310"

[tool.ruff.lint]
select = ["E", "W", "F", "I"]
```

**命名规范：**
- 文件名：`snake_case.py`
- 类名：`PascalCase`
- 函数/变量：`snake_case`
- 常量：`UPPER_SNAKE_CASE`

### TypeScript（前端）

使用 ESLint + Prettier：

```bash
# 检查
npm run lint

# 格式化（如配置了 prettier）
npx prettier --write src/
```

**命名规范：**
- 组件文件：`PascalCase.tsx`（如 `DagCanvas.tsx`）
- 工具文件：`camelCase.ts`（如 `lastProject.ts`）
- 组件名：`PascalCase`
- 函数/变量：`camelCase`
- 类型接口：`PascalCase`（如 `interface UserInfo`）
- 常量：`UPPER_SNAKE_CASE`

---

## Git 工作流

### 分支策略

```
main          ← 稳定版本，每次发布打 tag
├── develop   ← 开发主分支，功能合并到此
│   ├── feat/add-tags        ← 功能分支
│   ├── fix/login-timeout    ← Bug 修复
│   └── docs/update-readme   ← 文档
```

### 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <描述>

[可选正文]

[可选脚注]
```

**常用类型：**

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更 |
| `refactor` | 代码重构（非功能变更） |
| `test` | 测试相关 |
| `chore` | 构建/工具/配置变更 |
| `perf` | 性能优化 |

**示例：**

```
feat(dag): 支持条件节点类型

新增 ConditionNode，可在场景 DAG 中添加条件分支。
分支结果根据上游节点响应的 JSONPath 表达式决定。

Closes #42
```

---

## 调试技巧

### 后端调试

**查看 SQL 语句：**

在 `db/engine.py` 中启用 SQL 日志：

```python
engine = create_async_engine(DATABASE_URL, echo=True)  # echo=True 打印所有 SQL
```

**使用 FastAPI 内置调试器：**

访问 `http://localhost:8000/docs` 可以直接在 Swagger UI 中测试所有接口。

**查看 Chroma 状态：**

```python
# 在 Python shell 中
import chromadb
client = chromadb.PersistentClient(path="./chroma_data")
collection = client.get_collection("aiorctest")
print(collection.count())  # 文档数量
```

### 前端调试

**查看 Refine 数据请求：**

打开浏览器 DevTools → Network 标签，筛选 `api/` 请求查看详情。

**TanStack Query DevTools：**

```bash
npm install @tanstack/react-query-devtools
```

```tsx
// main.tsx
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// 在根组件内添加
<ReactQueryDevtools initialIsOpen={false} />
```

**XYFlow 画布调试：**

使用 `useNodes()` 和 `useEdges()` Hook 在控制台打印当前 DAG 状态：

```tsx
import { useNodes, useEdges } from "@xyflow/react";

const nodes = useNodes();
const edges = useEdges();
console.log("节点:", nodes, "连线:", edges);
```

### 日志查看

```bash
# 后端日志（开发模式下直接输出到终端）
./scripts/start-backend.sh

# systemd 生产日志
journalctl -u aiorctest-backend -f

# Docker 日志
docker compose logs -f backend
```
