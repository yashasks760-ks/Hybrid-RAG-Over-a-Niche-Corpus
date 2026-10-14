"""Milestone 1 Test: Verify Python environment, core dependencies, and configuration."""

import sys
from pathlib import Path
import pytest


def test_python_version():
    """Verify supported Python version (>= 3.10)."""
    assert sys.version_info >= (3, 10), f"Python version must be >= 3.10, found: {sys.version}"


def test_core_dependencies_import():
    """Verify all required backend dependencies import without error."""
    import pymupdf
    import fastembed
    import rank_bm25
    import qdrant_client
    import fastapi
    import pydantic
    import pydantic_settings
    import httpx

    assert pymupdf.__version__ is not None
    assert fastapi.__version__ is not None
    assert pydantic.__version__ is not None


def test_settings_loaded_and_directories():
    """Verify application configuration loads and directory helpers function."""
    from backend.app.core.config import settings

    assert settings.APP_TITLE == "College AI Knowledge Assistant"
    assert settings.CHUNK_SIZE > 0
    assert settings.CHUNK_OVERLAP >= 0
    assert len(settings.cors_origins_list) > 0

    # Test storage creation
    settings.ensure_storage_directories()
    assert Path(settings.DOCUMENT_STORAGE_DIR).exists()


def test_qdrant_in_memory_initialization():
    """Verify Qdrant client initializes and can create a test collection."""
    from qdrant_client import QdrantClient
    from qdrant_client.models import VectorParams, Distance

    client = QdrantClient(location=":memory:")
    try:
        collection_name = "test_smoke_collection"

        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )

        collections = [col.name for col in client.get_collections().collections]
        assert collection_name in collections
    finally:
        client.close()
