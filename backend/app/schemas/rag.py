from __future__ import annotations

from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Raw text to ingest")
    metadata: dict = Field(default_factory=dict, description="Arbitrary metadata attached to every chunk")
    project_id: str | None = Field(default=None, description="Optional project scope")


class IngestResponse(BaseModel):
    doc_ids: list[str]
    chunk_count: int


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1)
    k: int = Field(default=4, ge=1, le=20)
    metadata_filter: dict | None = None


class RetrievedChunk(BaseModel):
    content: str
    metadata: dict


class QueryResponse(BaseModel):
    answer: str | None = Field(None, description="LLM answer, None when in retrieval-only mode")
    chunks: list[RetrievedChunk]
