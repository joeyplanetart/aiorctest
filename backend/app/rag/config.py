from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

CHROMA_PERSIST_DIR: str = os.getenv(
    "CHROMA_PERSIST_DIR",
    str(Path(__file__).resolve().parents[2] / "chroma_data"),
)

CHROMA_COLLECTION: str = os.getenv("CHROMA_COLLECTION", "aiorctest")

EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")

LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o-mini")

CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "200"))
