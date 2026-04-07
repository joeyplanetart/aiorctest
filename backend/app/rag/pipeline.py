from __future__ import annotations

from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough

from app.rag.config import LLM_MODEL, OPENAI_API_KEY
from app.rag.retriever import get_retriever

SYSTEM_TEMPLATE = (
    "You are an expert QA engineer assistant for the AIOrcTest platform. "
    "Use the following retrieved context to answer the question. "
    "If the context is insufficient, say so.\n\n"
    "Context:\n{context}"
)

_PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", SYSTEM_TEMPLATE),
        ("human", "{question}"),
    ]
)


def _format_docs(docs: list[Document]) -> str:
    return "\n\n---\n\n".join(d.page_content for d in docs)


def build_rag_chain(
    k: int = 4,
    metadata_filter: dict | None = None,
):
    """Assemble a full RAG chain: retriever | prompt | LLM.

    When OPENAI_API_KEY is not set the chain is *not* constructed and
    ``None`` is returned so callers can fall back to retrieval-only mode.
    """
    if not OPENAI_API_KEY:
        return None

    from langchain_openai import ChatOpenAI

    retriever = get_retriever(k=k, metadata_filter=metadata_filter)
    llm = ChatOpenAI(model=LLM_MODEL, temperature=0, openai_api_key=OPENAI_API_KEY)

    chain = (
        {"context": retriever | _format_docs, "question": RunnablePassthrough()}
        | _PROMPT
        | llm
        | StrOutputParser()
    )
    return chain
