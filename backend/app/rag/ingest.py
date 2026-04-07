from __future__ import annotations

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.rag.config import CHUNK_OVERLAP, CHUNK_SIZE
from app.rag.vectorstore import get_vectorstore


def _build_splitter() -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n## ", "\n### ", "\n\n", "\n", " "],
    )


def ingest_text(
    text: str,
    metadata: dict | None = None,
) -> list[str]:
    """Split *text* into chunks and add them to the vector store.

    Returns the list of document IDs created in Chroma.
    """
    base_meta = metadata or {}
    doc = Document(page_content=text, metadata=base_meta)

    splitter = _build_splitter()
    chunks = splitter.split_documents([doc])

    for i, chunk in enumerate(chunks):
        chunk.metadata = {**base_meta, "chunk_index": i}

    vs = get_vectorstore()
    ids = vs.add_documents(chunks)
    return ids
