from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.engine import Base

import enum


class RoleEnum(str, enum.Enum):
    admin = "admin"
    member = "member"


class EnvironmentEnum(str, enum.Enum):
    stage = "stage"
    pre = "pre"
    prod = "prod"


def _uuid() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"

    id = Column(String(32), primary_key=True, default=_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=False, default="")
    avatar_url = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superadmin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    memberships = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(32), primary_key=True, default=_uuid)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    environments = relationship("Environment", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_user"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    project_id = Column(String(32), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(SAEnum(RoleEnum), nullable=False, default=RoleEnum.member)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="memberships")


class Environment(Base):
    """Each project auto-creates 3 environments on creation."""
    __tablename__ = "environments"
    __table_args__ = (
        UniqueConstraint("project_id", "slug", name="uq_project_env"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    project_id = Column(String(32), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    slug = Column(SAEnum(EnvironmentEnum), nullable=False)
    label = Column(String(50), nullable=False)
    base_url = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    project = relationship("Project", back_populates="environments")


DEFAULT_ENVIRONMENTS = [
    (EnvironmentEnum.stage, "Stage (开发调试)"),
    (EnvironmentEnum.pre,   "Pre (QA验证)"),
    (EnvironmentEnum.prod,  "Prod (生产环境)"),
]


class HttpMethodEnum(str, enum.Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    PATCH = "PATCH"
    DELETE = "DELETE"
    HEAD = "HEAD"
    OPTIONS = "OPTIONS"


class ApiFolder(Base):
    __tablename__ = "api_folders"

    id = Column(String(32), primary_key=True, default=_uuid)
    project_id = Column(String(32), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(String(32), ForeignKey("api_folders.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(200), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    children = relationship("ApiFolder", back_populates="parent", cascade="all, delete-orphan")
    parent = relationship("ApiFolder", back_populates="children", remote_side=[id])
    endpoints = relationship("ApiEndpoint", back_populates="folder", cascade="all, delete-orphan")


class ApiEndpoint(Base):
    __tablename__ = "api_endpoints"

    id = Column(String(32), primary_key=True, default=_uuid)
    project_id = Column(String(32), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    folder_id = Column(String(32), ForeignKey("api_folders.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(300), nullable=False)
    method = Column(SAEnum(HttpMethodEnum), nullable=False, default=HttpMethodEnum.GET)
    url = Column(Text, nullable=False, default="")
    headers_json = Column(Text, nullable=False, default="{}")
    query_params_json = Column(Text, nullable=False, default="{}")
    body_json = Column(Text, nullable=False, default="")
    body_type = Column(String(30), nullable=False, default="none")
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    folder = relationship("ApiFolder", back_populates="endpoints")


class ProjectVariable(Base):
    __tablename__ = "project_variables"
    __table_args__ = (
        UniqueConstraint("project_id", "env_slug", "key", name="uq_project_env_var"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    project_id = Column(String(32), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    env_slug = Column(String(10), nullable=False, default="stage")
    key = Column(String(200), nullable=False)
    value = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(String(32), primary_key=True, default=_uuid)
    project_id = Column(String(32), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False, default="New Scenario")
    nodes_json = Column(Text, nullable=False, default="[]")
    edges_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class LlmConfig(Base):
    """Singleton-style table: only one row (id='default')."""
    __tablename__ = "llm_config"

    id = Column(String(32), primary_key=True, default="default")
    model_name = Column(String(200), nullable=False, default="gpt-4o-mini")
    api_base = Column(Text, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class LlmUsageRecord(Base):
    __tablename__ = "llm_usage_records"

    id = Column(String(32), primary_key=True, default=_uuid)
    user_id = Column(String(32), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(String(32), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    model = Column(String(200), nullable=False)
    feature = Column(String(100), nullable=False, default="ai_orchestration")
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    prompt_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
