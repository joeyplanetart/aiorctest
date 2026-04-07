from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None


class EnvironmentOut(BaseModel):
    id: str
    slug: str
    label: str
    base_url: str | None = None

    model_config = {"from_attributes": True}


class EnvironmentUpdate(BaseModel):
    label: str | None = Field(default=None, max_length=50)
    base_url: str | None = None


class MemberOut(BaseModel):
    id: str
    user_id: str
    email: str
    display_name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    created_at: datetime
    updated_at: datetime
    environments: list[EnvironmentOut] = []
    members: list[MemberOut] = []

    model_config = {"from_attributes": True}


class ProjectListItem(BaseModel):
    id: str
    name: str
    description: str | None = None
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberAdd(BaseModel):
    email: str
    role: str = "member"


class MemberRoleUpdate(BaseModel):
    role: str
