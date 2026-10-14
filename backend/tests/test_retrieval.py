"""Tests for BM25 keyword index, vector store, and Hybrid RRF search."""

import pytest
from qdrant_client import QdrantClient
from backend.app.models.document import DocumentChunk
from backend.app.retrieval.bm25_index import BM25Index
from backend.app.retrieval.embedder import get_embedding_service
from backend.app.retrieval.hybrid_search import HybridSearchEngine
from backend.app.retrieval.vector_store import VectorStore


def test_bm25_exact_technical_terms():
    """Verify BM25 accurately matches technical terms like 3NF, useEffect, and JWT."""
    bm25 = BM25Index()
    chunks = [
        DocumentChunk(
            chunk_id="c1",
            doc_id="d1",
            filename="dbms.pdf",
            page_number=14,
            chunk_index=0,
            text="A relation is in 3NF if it is in 2NF and has no transitive dependencies.",
            token_count=16,
        ),
        DocumentChunk(
            chunk_id="c2",
            doc_id="d2",
            filename="react.pdf",
            page_number=5,
            chunk_index=0,
            text="The React useEffect hook lets you perform side effects in functional components.",
            token_count=13,
        ),
        DocumentChunk(
            chunk_id="c3",
            doc_id="d3",
            filename="security.pdf",
            page_number=8,
            chunk_index=0,
            text="JSON Web Token (JWT) is a compact, URL-safe means of representing claims.",
            token_count=12,
        ),
    ]

    bm25.add_chunks(chunks)

    # Search for "3NF"
    results_3nf = bm25.search("3NF", top_k=1)
    assert len(results_3nf) == 1
    assert results_3nf[0]["chunk_id"] == "c1"
    assert "3NF" in results_3nf[0]["text"]

    # Search for "useEffect"
    results_hook = bm25.search("useEffect", top_k=1)
    assert len(results_hook) == 1
    assert results_hook[0]["chunk_id"] == "c2"

    # Search for "JWT"
    results_jwt = bm25.search("JWT", top_k=1)
    assert len(results_jwt) == 1
    assert results_jwt[0]["chunk_id"] == "c3"


def test_hybrid_search_fusion():
    """Verify hybrid search combines vector and BM25 results with latency breakdown."""
    # Use in-memory Qdrant for isolation
    mem_qdrant = QdrantClient(location=":memory:")
    try:
        vector_store = VectorStore(client=mem_qdrant, collection_name="test_hybrid")
        embedder = get_embedding_service()
        bm25 = BM25Index()

        chunks = [
            DocumentChunk(
                chunk_id="chunk_dbms",
                doc_id="doc_dbms",
                filename="DBMS_Chapter3.pdf",
                page_number=42,
                chunk_index=0,
                text="Database transactions must adhere to ACID properties: Atomicity, Consistency, Isolation, and Durability.",
                token_count=16,
            ),
            DocumentChunk(
                chunk_id="chunk_os",
                doc_id="doc_os",
                filename="OS_Chapter2.pdf",
                page_number=19,
                chunk_index=0,
                text="Deadlock occurs when four conditions hold simultaneously: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.",
                token_count=20,
            ),
        ]

        embeddings = embedder.embed_texts([c.text for c in chunks])
        vector_store.upsert_chunks(chunks, embeddings)
        bm25.add_chunks(chunks)

        engine = HybridSearchEngine(vector_store=vector_store, embedder=embedder, bm25_index=bm25)

        # Query with exact keyword and semantic meaning
        output = engine.search("What are ACID properties in database transactions?", top_k=2)

        assert len(output["results"]) > 0
        top_hit = output["results"][0]
        assert top_hit.chunk_id == "chunk_dbms"
        assert top_hit.filename == "DBMS_Chapter3.pdf"
        assert top_hit.page_number == 42
        assert "ACID" in top_hit.text

        # Latency tracking assertions
        latency = output["latency"]
        assert latency.total_ms > 0
        assert latency.query_embedding_ms >= 0
        assert latency.semantic_search_ms >= 0
        assert latency.keyword_search_ms >= 0
        assert latency.fusion_ms >= 0
    finally:
        mem_qdrant.close()
