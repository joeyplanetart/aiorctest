from __future__ import annotations

from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStoreRetriever

from app.rag.vectorstore import get_vectorstore


def get_retriever(
    k: int = 4,
    search_type: str = "similarity",
    metadata_filter: dict | None = None,
) -> VectorStoreRetriever:
    search_kwargs: dict = {"k": k}
    if metadata_filter:
        search_kwargs["filter"] = metadata_filter
    return get_vectorstore().as_retriever(
        search_type=search_type,
        search_kwargs=search_kwargs,
    )


async def retrieve(
    question: str,
    k: int = 4,
    metadata_filter: dict | None = None,
) -> list[Document]:
    retriever = get_retriever(k=k, metadata_filter=metadata_filter)
    return await retriever.ainvoke(question)
