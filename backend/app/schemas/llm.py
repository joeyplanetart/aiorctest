from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class LlmConfigOut(BaseModel):
    model_name: str
    api_base: str | None = None
    updated_at: datetime | None = None


class LlmConfigUpdate(BaseModel):
    model_name: str


class LlmUsageRecordOut(BaseModel):
    id: str
    user_id: str | None = None
    user_email: str | None = None
    project_id: str | None = None
    project_name: str | None = None
    model: str
    feature: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    prompt_summary: str | None = None
    created_at: datetime


class LlmUsageStatsDay(BaseModel):
    date: str
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    count: int


class LlmUsageSummary(BaseModel):
    total_calls: int
    total_tokens: int
    total_prompt_tokens: int
    total_completion_tokens: int
    by_model: dict[str, int]
