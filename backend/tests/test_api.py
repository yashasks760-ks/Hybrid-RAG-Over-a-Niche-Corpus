"""Integration tests for FastAPI endpoints: upload, list, search, chat, delete."""

import io
import pytest
import pymupdf
from fastapi.testclient import TestClient
from backend.app.main import app


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    """Isolated TestClient fixture using temporary test storage directories."""
    from backend.app.core.config import settings
    from backend.app.retrieval.vector_store import reset_vector_store
    from backend.app.services.document_service import reset_document_service
    from backend.app.retrieval.hybrid_search import reset_hybrid_search_engine
    from backend.app.retrieval.bm25_index import get_bm25_index

    test_dir = tmp_path_factory.mktemp("test_rag_storage")
    docs_dir = test_dir / "documents"
    qdrant_dir = test_dir / "qdrant"
    docs_dir.mkdir(parents=True, exist_ok=True)
    qdrant_dir.mkdir(parents=True, exist_ok=True)

    orig_doc_dir = settings.DOCUMENT_STORAGE_DIR
    orig_qdrant_dir = settings.QDRANT_STORAGE_DIR
    orig_env = settings.APP_ENV

    settings.DOCUMENT_STORAGE_DIR = str(docs_dir)
    settings.QDRANT_STORAGE_DIR = str(qdrant_dir)
    settings.APP_ENV = "test"

    reset_vector_store()
    reset_document_service()
    reset_hybrid_search_engine()
    get_bm25_index().clear()

    try:
        with TestClient(app) as c:
            yield c
    finally:
        reset_vector_store()
        reset_document_service()
        reset_hybrid_search_engine()
        get_bm25_index().clear()

        settings.DOCUMENT_STORAGE_DIR = orig_doc_dir
        settings.QDRANT_STORAGE_DIR = orig_qdrant_dir
        settings.APP_ENV = orig_env
        reset_vector_store()


def _generate_test_pdf() -> bytes:
    doc = pymupdf.open()
    page1 = doc.new_page()
    page1.insert_text((50, 72), "Relational Algebra: Select, Project, Join, and Division operations in DBMS.")
    page2 = doc.new_page()
    page2.insert_text((50, 72), "Concurrency control uses Two-Phase Locking (2PL) to ensure serializability.")
    data = doc.tobytes()
    doc.close()
    return data


def test_health_endpoints(client: TestClient):
    """Verify health and readiness probes."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"

    resp_ready = client.get("/api/health/ready")
    assert resp_ready.status_code == 200
    assert resp_ready.json()["status"] == "ready"


def test_document_lifecycle_and_search(client: TestClient):
    """Test full cycle: upload, list, duplicate detection, hybrid search, and delete."""
    pdf_bytes = _generate_test_pdf()
    file_payload = ("relational_dbms.pdf", io.BytesIO(pdf_bytes), "application/pdf")

    # 1. Upload
    upload_resp = client.post("/api/documents/upload", files={"file": file_payload})
    assert upload_resp.status_code == 201
    upload_data = upload_resp.json()
    assert upload_data["message"] == "Document indexed successfully."
    assert upload_data["duplicate_detected"] is False

    doc_id = upload_data["document"]["id"]
    assert upload_data["document"]["page_count"] == 2
    assert upload_data["document"]["chunk_count"] > 0
    assert upload_data["document"]["status"] == "indexed"

    # 2. Duplicate Detection
    dup_payload = ("renamed_copy.pdf", io.BytesIO(pdf_bytes), "application/pdf")
    dup_resp = client.post("/api/documents/upload", files={"file": dup_payload})
    assert dup_resp.status_code == 201
    assert dup_resp.json()["duplicate_detected"] is True

    # 3. List Documents
    list_resp = client.get("/api/documents")
    assert list_resp.status_code == 200
    docs = list_resp.json()["documents"]
    assert any(d["id"] == doc_id for d in docs)

    # 4. Search Mode (Independent of LLM)
    search_resp = client.post(
        "/api/search",
        json={"query": "Two-Phase Locking serializability", "top_k": 3},
    )
    assert search_resp.status_code == 200
    search_data = search_resp.json()
    assert search_data["total_results"] > 0
    top_result = search_data["results"][0]
    assert "Two-Phase Locking" in top_result["text"]
    assert top_result["page_number"] == 2
    assert search_data["latency"]["total_ms"] > 0

    # 5. Chat Endpoint behavior when LLM is unconfigured or offline
    chat_resp = client.post(
        "/api/chat",
        json={"question": "What is Two-Phase Locking?"},
    )
    # Since LLM_API_KEY may be unconfigured (503) or external provider unreachable (502), fail honestly without hallucinating!
    assert chat_resp.status_code in [200, 502, 503]
    if chat_resp.status_code == 503:
        assert "not configured" in chat_resp.json()["detail"].lower()

    # 5b. Document PDF File Streaming Endpoint
    file_resp = client.get(f"/api/documents/{doc_id}/file")
    assert file_resp.status_code == 200
    assert file_resp.headers["content-type"] == "application/pdf"
    assert len(file_resp.content) == len(pdf_bytes)

    # 6. Delete Document
    del_resp = client.delete(f"/api/documents/{doc_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["document_id"] == doc_id

    # Verify deleted from list
    list_after = client.get("/api/documents").json()["documents"]
    assert not any(d["id"] == doc_id for d in list_after)
