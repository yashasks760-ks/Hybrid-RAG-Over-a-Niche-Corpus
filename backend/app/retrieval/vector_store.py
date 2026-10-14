"""Qdrant Vector Database manager with embedded local disk and remote cloud support."""

import atexit
import os
import threading
import time
import uuid
from typing import Dict, List, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from backend.app.core.config import settings
from backend.app.models.document import DocumentChunk


# Process-level shared embedded QdrantClient instance and lock
_shared_client_instance: Optional[QdrantClient] = None
_shared_client_path: Optional[str] = None
_client_lock = threading.Lock()


def _normalize_storage_path(path: str) -> str:
    """Normalize and canonicalize path for reliable cross-platform identity checks."""
    if path == ":memory:":
        return path
    return os.path.normcase(os.path.abspath(os.path.realpath(path)))


def is_client_active(client: Optional[QdrantClient]) -> bool:
    """Check if a QdrantClient is alive, connected, and not closed."""
    if client is None:
        return False
    try:
        local_backend = getattr(client, "_client", None)
        if local_backend is not None and getattr(local_backend, "_closed", False):
            return False
        # Lightweight probe to confirm client handle is valid
        client.get_collections()
        return True
    except Exception:
        return False


def get_shared_embedded_client(path: str) -> QdrantClient:
    """Return the shared embedded QdrantClient for this process, creating it if needed."""
    global _shared_client_instance, _shared_client_path
    canonical_path = _normalize_storage_path(path)
    with _client_lock:
        if _shared_client_instance is not None:
            if _shared_client_path == canonical_path and is_client_active(_shared_client_instance):
                return _shared_client_instance
            # If storage path changed (e.g. during test isolation) or was closed, clean up previous client
            try:
                _shared_client_instance.close()
            except Exception:
                pass
            _shared_client_instance = None
            _shared_client_path = None

        settings.ensure_storage_directories()
        max_retries = 10
        last_err = None
        for attempt in range(max_retries):
            try:
                _shared_client_instance = QdrantClient(path=canonical_path)
                _shared_client_path = canonical_path
                return _shared_client_instance
            except (RuntimeError, PermissionError) as exc:
                last_err = exc
                err_msg = str(exc)
                if "already accessed by another instance" in err_msg or "Permission denied" in err_msg:
                    if attempt < max_retries - 1:
                        time.sleep(0.5)
                        continue
                raise RuntimeError(
                    f"Storage folder '{path}' is locked by another Qdrant client instance. "
                    "Ensure only one backend server instance is running. "
                    "For concurrent multi-process access, configure a remote Qdrant server (QDRANT_URL)."
                ) from last_err


def close_shared_embedded_client() -> None:
    """Close and release the process-level shared embedded Qdrant client."""
    global _shared_client_instance, _shared_client_path
    with _client_lock:
        if _shared_client_instance is not None:
            try:
                _shared_client_instance.close()
            except Exception:
                pass
            finally:
                _shared_client_instance = None
                _shared_client_path = None


class VectorStore:
    """Manages Qdrant collections, vector indexing, search, and deletion."""

    def __init__(self, client: Optional[QdrantClient] = None, collection_name: Optional[str] = None):
        self.collection_name = collection_name or settings.QDRANT_COLLECTION_NAME

        if client is not None:
            self.client = client
            self._owns_client = False
        elif settings.QDRANT_URL:
            self.client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY,
            )
            self._owns_client = True
        else:
            self.client = get_shared_embedded_client(settings.QDRANT_STORAGE_DIR)
            self._owns_client = False

        self.ensure_collection()

    def ensure_collection(self, vector_size: int = 384):
        """Create the vector collection if it does not already exist."""
        collections = [col.name for col in self.client.get_collections().collections]
        if self.collection_name not in collections:
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=qmodels.VectorParams(
                    size=vector_size,
                    distance=qmodels.Distance.COSINE,
                ),
            )

    @staticmethod
    def _chunk_id_to_uuid(chunk_id: str) -> str:
        """Convert an arbitrary chunk ID into a deterministic UUID for Qdrant point IDs."""
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk_id))

    def upsert_chunks(self, chunks: List[DocumentChunk], embeddings: List[List[float]]) -> None:
        """Store chunk vectors and payloads in Qdrant in batches."""
        if not chunks or not embeddings:
            return

        points = []
        for chunk, embedding in zip(chunks, embeddings):
            point_id = self._chunk_id_to_uuid(chunk.chunk_id)
            payload = {
                "chunk_id": chunk.chunk_id,
                "doc_id": chunk.doc_id,
                "filename": chunk.filename,
                "page_number": chunk.page_number,
                "chunk_index": chunk.chunk_index,
                "text": chunk.text,
                "metadata": chunk.metadata,
            }
            points.append(
                qmodels.PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=payload,
                )
            )

        # Upsert in batches of 100
        batch_size = 100
        for i in range(0, len(points), batch_size):
            self.client.upsert(
                collection_name=self.collection_name,
                points=points[i : i + batch_size],
            )

    def search_vectors(
        self,
        query_vector: List[float],
        top_k: int = 5,
        document_ids: Optional[List[str]] = None,
    ) -> List[Dict]:
        """Perform semantic cosine similarity search."""
        query_filter = None
        if document_ids:
            query_filter = qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="doc_id",
                        match=qmodels.MatchAny(any=document_ids),
                    )
                ]
            )

        try:
            # Qdrant client 1.10+ query_points API
            results = self.client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                limit=top_k,
                query_filter=query_filter,
                with_payload=True,
            ).points
        except Exception:
            # Fallback for search API
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                limit=top_k,
                query_filter=query_filter,
                with_payload=True,
            )

        hits = []
        for point in results:
            payload = point.payload or {}
            hits.append(
                {
                    "chunk_id": payload.get("chunk_id", str(point.id)),
                    "doc_id": payload.get("doc_id", ""),
                    "filename": payload.get("filename", ""),
                    "page_number": payload.get("page_number", 1),
                    "chunk_index": payload.get("chunk_index", 0),
                    "text": payload.get("text", ""),
                    "score": float(point.score),
                    "metadata": payload.get("metadata", {}),
                }
            )
        return hits

    def delete_document_vectors(self, doc_id: str) -> None:
        """Remove all vector points belonging to a specific document ID."""
        filter_selector = qmodels.FilterSelector(
            filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="doc_id",
                        match=qmodels.MatchValue(value=doc_id),
                    )
                ]
            )
        )
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=filter_selector,
        )


    def close(self, force: bool = False) -> None:
        """Close Qdrant client connection if owned or explicitly forced."""
        if (getattr(self, "_owns_client", False) or force) and hasattr(self, "client") and self.client is not None:
            try:
                self.client.close()
            except Exception:
                pass
            finally:
                self.client = None


# Thread-safe global VectorStore singleton
_vector_store_instance: Optional[VectorStore] = None
_vector_store_lock = threading.Lock()


def get_vector_store() -> VectorStore:
    """Return the global thread-safe VectorStore singleton for this process."""
    global _vector_store_instance
    with _vector_store_lock:
        if _vector_store_instance is None or not is_client_active(_vector_store_instance.client):
            _vector_store_instance = VectorStore()
        return _vector_store_instance


def reset_vector_store() -> None:
    """Close and reset the global VectorStore singleton and shared embedded QdrantClient."""
    global _vector_store_instance
    with _vector_store_lock:
        if _vector_store_instance is not None:
            _vector_store_instance = None
    close_shared_embedded_client()


# Register process exit hook to ensure Qdrant lock is always released
atexit.register(reset_vector_store)
