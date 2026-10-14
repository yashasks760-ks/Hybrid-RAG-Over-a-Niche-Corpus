"""Tests verifying single-client reuse, path normalization, and clean startup/shutdown lifecycle."""

import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from backend.app.core.config import settings
from backend.app.main import app
from backend.app.retrieval.vector_store import (
    VectorStore,
    close_shared_embedded_client,
    get_shared_embedded_client,
    get_vector_store,
    is_client_active,
    reset_vector_store,
)
from backend.app.services.document_service import DocumentService, get_document_service, reset_document_service
from backend.app.retrieval.hybrid_search import HybridSearchEngine, get_hybrid_search_engine, reset_hybrid_search_engine


def test_shared_embedded_client_reuse_and_path_normalization(tmp_path):
    """Verify that multiple requests for the same embedded storage directory reuse the exact same client."""
    qdrant_test_dir = tmp_path / "qdrant_reuse"
    qdrant_test_dir.mkdir(parents=True, exist_ok=True)
    str_path = str(qdrant_test_dir)

    reset_vector_store()
    try:
        # 1. First acquisition
        client1 = get_shared_embedded_client(str_path)
        assert client1 is not None
        assert is_client_active(client1) is True

        # 2. Acquisition with forward slashes or different representation
        alt_path = str_path.replace("\\", "/")
        client2 = get_shared_embedded_client(alt_path)
        assert client1 is client2, "Clients must be identical objects when referring to the same storage folder"

        # 3. Third acquisition with exact canonical path
        canonical_path = os.path.normcase(os.path.abspath(str_path))
        client3 = get_shared_embedded_client(canonical_path)
        assert client1 is client3

        # Collections operation works normally
        collections = client1.get_collections()
        assert collections is not None
    finally:
        reset_vector_store()


def test_vector_store_and_services_reuse_single_client(tmp_path):
    """Verify that DocumentService, HybridSearchEngine, and VectorStore share the same singleton."""
    qdrant_test_dir = tmp_path / "qdrant_services"
    docs_test_dir = tmp_path / "docs_services"
    qdrant_test_dir.mkdir(parents=True, exist_ok=True)
    docs_test_dir.mkdir(parents=True, exist_ok=True)

    orig_qdrant = settings.QDRANT_STORAGE_DIR
    orig_docs = settings.DOCUMENT_STORAGE_DIR
    settings.QDRANT_STORAGE_DIR = str(qdrant_test_dir)
    settings.DOCUMENT_STORAGE_DIR = str(docs_test_dir)

    reset_vector_store()
    reset_document_service()
    reset_hybrid_search_engine()

    try:
        vs1 = get_vector_store()
        vs2 = get_vector_store()
        assert vs1 is vs2, "get_vector_store() must return the same singleton instance"
        assert vs1.client is vs2.client

        doc_service = get_document_service()
        assert doc_service.vector_store is vs1, "DocumentService must share the vector store singleton"

        search_engine = get_hybrid_search_engine()
        assert search_engine.vector_store is vs1, "HybridSearchEngine must share the vector store singleton"
        assert search_engine.vector_store.client is vs1.client
    finally:
        reset_vector_store()
        reset_document_service()
        reset_hybrid_search_engine()
        settings.QDRANT_STORAGE_DIR = orig_qdrant
        settings.DOCUMENT_STORAGE_DIR = orig_docs


def test_clean_repeated_backend_startup_and_health_readiness(tmp_path):
    """Verify that consecutive clean backend startups succeed without persistent lock errors."""
    qdrant_test_dir = tmp_path / "qdrant_startup"
    docs_test_dir = tmp_path / "docs_startup"
    qdrant_test_dir.mkdir(parents=True, exist_ok=True)
    docs_test_dir.mkdir(parents=True, exist_ok=True)

    orig_qdrant = settings.QDRANT_STORAGE_DIR
    orig_docs = settings.DOCUMENT_STORAGE_DIR
    settings.QDRANT_STORAGE_DIR = str(qdrant_test_dir)
    settings.DOCUMENT_STORAGE_DIR = str(docs_test_dir)

    try:
        # First startup & probe
        reset_vector_store()
        with TestClient(app) as client_first:
            resp_health = client_first.get("/api/health")
            assert resp_health.status_code == 200
            assert resp_health.json()["status"] == "healthy"

            resp_ready = client_first.get("/api/health/ready")
            assert resp_ready.status_code == 200
            assert resp_ready.json()["status"] == "ready"

        # Second startup & probe immediately following
        reset_vector_store()
        with TestClient(app) as client_second:
            resp_health2 = client_second.get("/api/health")
            assert resp_health2.status_code == 200
            assert resp_health2.json()["status"] == "healthy"

            resp_ready2 = client_second.get("/api/health/ready")
            assert resp_ready2.status_code == 200
            assert resp_ready2.json()["status"] == "ready"
    finally:
        reset_vector_store()
        settings.QDRANT_STORAGE_DIR = orig_qdrant
        settings.DOCUMENT_STORAGE_DIR = orig_docs
