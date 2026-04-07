from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.rag.ingest import ingest_text
from app.rag.pipeline import build_rag_chain
from app.rag.retriever import retrieve
from app.rag.vectorstore import get_chroma_client
from app.schemas.rag import (
    IngestRequest,
    IngestResponse,
    QueryRequest,
    QueryResponse,
    RetrievedChunk,
)

router = APIRouter()


@router.get("/health")
async def rag_health():
    try:
        client = get_chroma_client()
        heartbeat = client.heartbeat()
        return {"status": "ok", "heartbeat": heartbeat}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/ingest", response_model=IngestResponse)
async def rag_ingest(body: IngestRequest):
    meta = {**body.metadata}
    if body.project_id:
        meta["project_id"] = body.project_id

    try:
        ids = ingest_text(text=body.text, metadata=meta)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return IngestResponse(doc_ids=ids, chunk_count=len(ids))


@router.post("/query", response_model=QueryResponse)
async def rag_query(body: QueryRequest):
    docs = await retrieve(
        question=body.question,
        k=body.k,
        metadata_filter=body.metadata_filter,
    )
    chunks = [
        RetrievedChunk(content=d.page_content, metadata=d.metadata)
        for d in docs
    ]

    chain = build_rag_chain(k=body.k, metadata_filter=body.metadata_filter)
    answer: str | None = None
    if chain is not None:
        answer = await chain.ainvoke(body.question)

    return QueryResponse(answer=answer, chunks=chunks)
