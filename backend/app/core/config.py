"""Application Configuration using Pydantic Settings.

Supports environment variables, .env file loading, and type-validated defaults.
"""

from pathlib import Path
from typing import List, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Project root directory (two levels up from backend/app/core)
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    """Central configuration for College AI Knowledge Assistant."""

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    APP_ENV: str = Field(default="development", description="development | production | test")
    APP_TITLE: str = Field(default="College AI Knowledge Assistant", description="Application Title")
    API_HOST: str = Field(default="0.0.0.0", description="FastAPI host binding")
    API_PORT: int = Field(default=8000, description="FastAPI port binding")
    API_PREFIX: str = Field(default="/api", description="Root API route prefix")

    # CORS
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173",
        description="Comma-separated allowed origins",
    )

    # Document Storage
    DOCUMENT_STORAGE_DIR: str = Field(
        default=str(BASE_DIR / "data" / "documents"),
        description="Directory where original uploaded PDF files are saved",
    )
    MAX_UPLOAD_SIZE_MB: int = Field(
        default=15,
        description="Maximum permitted single PDF upload size in megabytes",
    )

    # Vector Database (Qdrant)
    QDRANT_STORAGE_DIR: str = Field(
        default=str(BASE_DIR / "data" / "qdrant_storage"),
        description="Local persistent directory for Qdrant storage when QDRANT_URL is not set",
    )
    QDRANT_URL: Optional[str] = Field(
        default=None,
        description="Remote Qdrant cluster URL (e.g. Qdrant Cloud). If unset, uses local disk storage.",
    )
    QDRANT_API_KEY: Optional[str] = Field(
        default=None,
        description="API Key for remote Qdrant cluster",
    )
    QDRANT_COLLECTION_NAME: str = Field(
        default="college_knowledge_assistant",
        description="Qdrant collection name for document vectors",
    )

    @field_validator("DOCUMENT_STORAGE_DIR", "QDRANT_STORAGE_DIR", mode="after")
    @classmethod
    def resolve_storage_paths(cls, v: str) -> str:
        """Resolve storage directories to absolute paths relative to project BASE_DIR."""
        path = Path(v)
        if not path.is_absolute():
            return str((BASE_DIR / path).resolve())
        return str(path.resolve())

    # Ingestion & Chunking
    CHUNK_SIZE: int = Field(default=500, description="Target chunk size in tokens/words")
    CHUNK_OVERLAP: int = Field(default=100, description="Overlapping tokens/words between chunks")

    # Embeddings
    EMBEDDING_MODEL: str = Field(
        default="BAAI/bge-small-en-v1.5",
        description="Embedding model identifier for FastEmbed",
    )

    # Retrieval & Ranking
    DEFAULT_TOP_K: int = Field(default=5, description="Default number of passages retrieved for RAG context")
    RRF_K: int = Field(default=60, description="Reciprocal Rank Fusion constant parameter (k)")
    SIMILARITY_THRESHOLD: float = Field(
        default=0.35,
        description="Minimum score threshold to filter irrelevant passages",
    )

    # LLM Settings
    LLM_PROVIDER: str = Field(
        default="gemini",
        description="LLM Provider: 'gemini', 'groq', 'openai', 'ollama'",
    )
    LLM_MODEL: str = Field(
        default="gemini-2.5-flash",
        description="LLM Model ID",
    )
    LLM_API_KEY: Optional[str] = Field(
        default=None,
        description="API Key for LLM provider (Backend-only, never sent to frontend)",
    )
    LLM_BASE_URL: Optional[str] = Field(
        default=None,
        description="Optional custom base URL for OpenAI-compatible endpoints or proxies",
    )
    LLM_MAX_TOKENS: int = Field(default=1024, description="Maximum token length for generation")
    LLM_TEMPERATURE: float = Field(default=0.2, description="Generation temperature for grounded responses")

    # Live Web Search
    WEB_SEARCH_ENABLED: bool = Field(
        default=True,
        description="Enable optional live web search mode",
    )
    WEB_SEARCH_PROVIDER: str = Field(
        default="tavily",
        description="Search provider: 'tavily', 'duckduckgo'",
    )
    TAVILY_API_KEY: Optional[str] = Field(
        default=None,
        description="API Key for Tavily live web search",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Return CORS origins parsed as a list."""
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        for local_origin in ["http://localhost:5173", "http://127.0.0.1:5173"]:
            if local_origin not in origins:
                origins.append(local_origin)
        return origins

    def ensure_storage_directories(self) -> None:
        """Ensure necessary storage directories exist on disk."""
        Path(self.DOCUMENT_STORAGE_DIR).mkdir(parents=True, exist_ok=True)
        if not self.QDRANT_URL:
            Path(self.QDRANT_STORAGE_DIR).mkdir(parents=True, exist_ok=True)


# Global settings singleton
settings = Settings()
_last_env_mtime: float = 0.0


def get_settings() -> Settings:
    """Return central settings, reloading if .env file has been modified on disk."""
    global settings, _last_env_mtime
    env_file = BASE_DIR / ".env"
    if env_file.exists():
        try:
            mtime = env_file.stat().st_mtime
            if mtime > _last_env_mtime:
                _last_env_mtime = mtime
                settings = Settings()
        except Exception:
            pass
    return settings

