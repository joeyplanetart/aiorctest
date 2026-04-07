from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_admin import router as admin_router
from app.api.routes_api import router as api_router
from app.api.routes_auth import router as auth_router
from app.api.routes_dag import router as dag_router
from app.api.routes_project import router as project_router
from app.api.routes_rag import router as rag_router
from app.bootstrap import bootstrap_superadmin_emails
from app.db.engine import create_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    bootstrap_superadmin_emails()
    yield


app = FastAPI(title="AIOrcTest", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(admin_router, prefix="/auth")
app.include_router(project_router, prefix="/projects", tags=["Projects"])
app.include_router(api_router, prefix="/projects", tags=["API Endpoints"])
app.include_router(rag_router, prefix="/rag", tags=["RAG"])
app.include_router(dag_router, prefix="/projects", tags=["Scenarios"])


@app.get("/health")
async def health():
    return {"status": "ok"}
