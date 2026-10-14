"""Document management, validation, PDF processing, and persistence service."""

import json
import os
import shutil
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from fastapi import UploadFile
from backend.app.core.config import settings
from backend.app.ingestion.chunker import TextChunker
from backend.app.ingestion.extractor import PDFExtractor
from backend.app.ingestion.hasher import compute_content_hash
from backend.app.models.document import DocumentChunk, DocumentMetadata, ProcessingStatus
from backend.app.retrieval.bm25_index import BM25Index, get_bm25_index
from backend.app.retrieval.embedder import EmbeddingService, get_embedding_service
from backend.app.retrieval.vector_store import VectorStore, get_vector_store


class DocumentService:
    """Manages document uploads, disk storage, vector ingestion, and status tracking."""

    def __init__(
        self,
        vector_store: Optional[VectorStore] = None,
        bm25_index: Optional[BM25Index] = None,
        embedder: Optional[EmbeddingService] = None,
    ):
        self.vector_store = vector_store or get_vector_store()
        self.bm25_index = bm25_index or get_bm25_index()
        self.embedder = embedder or get_embedding_service()
        self.storage_dir = Path(settings.DOCUMENT_STORAGE_DIR)
        self.metadata_file = self.storage_dir / "metadata.json"
        self._ensure_storage()

    def _ensure_storage(self):
        """Ensure directories exist and initialize metadata file if missing."""
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        if not self.metadata_file.exists():
            self._save_metadata_dict({})

    def _load_metadata_dict(self) -> Dict[str, Dict]:
        """Read all document metadata records from disk."""
        if not self.metadata_file.exists():
            return {}
        try:
            with open(self.metadata_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _save_metadata_dict(self, data: Dict[str, Dict]) -> None:
        """Atomically persist metadata to disk."""
        temp_file = self.storage_dir / f"metadata.json.tmp.{uuid.uuid4().hex}"
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        shutil.move(temp_file, self.metadata_file)

    def list_documents(self) -> List[DocumentMetadata]:
        """Return all tracked documents sorted by creation date descending."""
        records = self._load_metadata_dict()
        docs = [DocumentMetadata.from_dict(v) for v in records.values()]
        docs.sort(key=lambda d: d.created_at, reverse=True)
        return docs

    def get_document(self, doc_id: str) -> Optional[DocumentMetadata]:
        """Fetch a specific document's metadata by ID."""
        records = self._load_metadata_dict()
        data = records.get(doc_id)
        return DocumentMetadata.from_dict(data) if data else None

    def get_document_file_path(self, doc_id: str) -> Optional[Path]:
        """Return the filesystem Path to the raw PDF file if it exists."""
        p = self.storage_dir / f"{doc_id}.pdf"
        return p if p.exists() else None

    def validate_file(self, filename: str, content: bytes, content_type: Optional[str]) -> None:
        """Thorough validation of uploaded file format, size, and header bytes."""
        # 1. Extension check
        if not filename.lower().endswith(".pdf"):
            raise ValueError(f"Invalid file extension: '{filename}'. Only PDF documents (.pdf) are permitted.")

        # 2. Size check
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if len(content) > max_bytes:
            raise ValueError(
                f"File size ({len(content) / (1024 * 1024):.2f} MB) exceeds the maximum allowed "
                f"limit of {settings.MAX_UPLOAD_SIZE_MB} MB."
            )

        if len(content) == 0:
            raise ValueError(f"Uploaded file '{filename}' is empty (0 bytes).")

        # 3. PDF Magic Bytes Signature check
        if not content.startswith(b"%PDF-"):
            raise ValueError(f"File '{filename}' lacks a valid PDF header signature.")

    def process_and_ingest(
        self,
        doc_id: str,
        filename: str,
        content: bytes,
    ) -> DocumentMetadata:
        """Extract text, chunk, embed, and index document into Qdrant and BM25."""
        records = self._load_metadata_dict()
        doc_meta = DocumentMetadata.from_dict(records[doc_id])

        try:
            doc_meta.status = ProcessingStatus.PROCESSING
            records[doc_id] = doc_meta.to_dict()
            self._save_metadata_dict(records)

            # 1. Extract text and page numbers
            extraction = PDFExtractor.extract_from_bytes(content, filename=filename)
            doc_meta.page_count = extraction.total_pages
            doc_meta.is_scanned = extraction.is_scanned

            if extraction.is_scanned:
                doc_meta.status = ProcessingStatus.SCANNED_NEEDS_OCR
                doc_meta.error_message = extraction.warning_message
                records[doc_id] = doc_meta.to_dict()
                self._save_metadata_dict(records)
                return doc_meta

            # 2. Chunk text
            chunker = TextChunker()
            chunks = chunker.chunk_pages(doc_id=doc_id, filename=filename, pages=extraction.pages)
            doc_meta.chunk_count = len(chunks)

            if not chunks:
                doc_meta.status = ProcessingStatus.FAILED
                doc_meta.error_message = "No extractable text chunks could be produced from document."
                records[doc_id] = doc_meta.to_dict()
                self._save_metadata_dict(records)
                return doc_meta

            # 3. Generate embeddings in batches
            texts = [c.text for c in chunks]
            embeddings = self.embedder.embed_texts(texts, batch_size=32)

            # 4. Upsert into Qdrant Vector Store
            self.vector_store.upsert_chunks(chunks, embeddings)

            # 5. Index into BM25 Keyword Index
            self.bm25_index.add_chunks(chunks)

            # 6. Save chunk cache on disk for quick BM25 rebuilds on server restart
            chunks_cache_file = self.storage_dir / f"{doc_id}_chunks.json"
            chunks_payload = [
                {
                    "chunk_id": c.chunk_id,
                    "doc_id": c.doc_id,
                    "filename": c.filename,
                    "page_number": c.page_number,
                    "chunk_index": c.chunk_index,
                    "text": c.text,
                    "token_count": c.token_count,
                    "metadata": c.metadata,
                }
                for c in chunks
            ]
            with open(chunks_cache_file, "w", encoding="utf-8") as f:
                json.dump(chunks_payload, f)

            # 7. Update status to INDEXED
            doc_meta.status = ProcessingStatus.INDEXED
            doc_meta.error_message = None
            records[doc_id] = doc_meta.to_dict()
            self._save_metadata_dict(records)
            return doc_meta

        except Exception as exc:
            doc_meta.status = ProcessingStatus.FAILED
            doc_meta.error_message = f"Ingestion error: {str(exc)}"
            records[doc_id] = doc_meta.to_dict()
            self._save_metadata_dict(records)
            return doc_meta

    async def upload_document(self, file: UploadFile) -> Tuple[DocumentMetadata, bool]:
        """Validate, check duplicates, store file on disk, and ingest."""
        filename = os.path.basename(file.filename or "uploaded.pdf")
        content = await file.read()

        # Validate
        self.validate_file(filename=filename, content=content, content_type=file.content_type)

        # Compute content hash
        content_hash = compute_content_hash(content)

        # Check for existing duplicate
        records = self._load_metadata_dict()
        for existing_id, existing_data in records.items():
            if existing_data.get("content_hash") == content_hash:
                existing_doc = DocumentMetadata.from_dict(existing_data)
                if existing_doc.status in [ProcessingStatus.INDEXED, ProcessingStatus.PROCESSING]:
                    return existing_doc, True

        doc_id = str(uuid.uuid4())
        doc_filename = f"{doc_id}.pdf"
        doc_path = self.storage_dir / doc_filename

        with open(doc_path, "wb") as f:
            f.write(content)

        doc_meta = DocumentMetadata(
            id=doc_id,
            filename=doc_filename,
            original_filename=filename,
            file_size_bytes=len(content),
            content_hash=content_hash,
            page_count=0,
            chunk_count=0,
            status=ProcessingStatus.UPLOADED,
        )

        records[doc_id] = doc_meta.to_dict()
        self._save_metadata_dict(records)

        # Ingest
        processed_doc = self.process_and_ingest(doc_id=doc_id, filename=filename, content=content)
        return processed_doc, False

    def delete_document(self, doc_id: str) -> bool:
        """Permanently delete a document, its raw file, vectors in Qdrant, and BM25 entries."""
        records = self._load_metadata_dict()
        if doc_id not in records:
            return False

        # 1. Remove vectors from Qdrant
        try:
            self.vector_store.delete_document_vectors(doc_id)
        except Exception:
            pass

        # 2. Remove chunks from BM25
        self.bm25_index.remove_document_chunks(doc_id)

        # 3. Remove raw file and chunk cache from disk
        doc_path = self.storage_dir / f"{doc_id}.pdf"
        if doc_path.exists():
            try:
                os.remove(doc_path)
            except Exception:
                pass

        chunks_cache = self.storage_dir / f"{doc_id}_chunks.json"
        if chunks_cache.exists():
            try:
                os.remove(chunks_cache)
            except Exception:
                pass

        # 4. Remove metadata entry
        del records[doc_id]
        self._save_metadata_dict(records)
        return True

    def retry_document(self, doc_id: str) -> Optional[DocumentMetadata]:
        """Retry ingestion for a document that previously failed."""
        records = self._load_metadata_dict()
        if doc_id not in records:
            return None

        doc_data = records[doc_id]
        doc_path = self.storage_dir / f"{doc_id}.pdf"
        if not doc_path.exists():
            raise FileNotFoundError("Underlying PDF file was not found on disk.")

        with open(doc_path, "rb") as f:
            content = f.read()

        return self.process_and_ingest(
            doc_id=doc_id,
            filename=doc_data["original_filename"],
            content=content,
        )

    def rehydrate_bm25_on_startup(self) -> int:
        """Re-populate the in-memory BM25 index from stored chunk cache files on startup."""
        total_rehydrated = 0
        records = self._load_metadata_dict()
        for doc_id, doc_data in records.items():
            if doc_data.get("status") == ProcessingStatus.INDEXED.value:
                chunks_cache = self.storage_dir / f"{doc_id}_chunks.json"
                if chunks_cache.exists():
                    try:
                        with open(chunks_cache, "r", encoding="utf-8") as f:
                            raw_chunks = json.load(f)
                            chunks = [
                                DocumentChunk(
                                    chunk_id=c["chunk_id"],
                                    doc_id=c["doc_id"],
                                    filename=c["filename"],
                                    page_number=c["page_number"],
                                    chunk_index=c["chunk_index"],
                                    text=c["text"],
                                    token_count=c.get("token_count", 0),
                                    metadata=c.get("metadata", {}),
                                )
                                for c in raw_chunks
                            ]
                            self.bm25_index.add_chunks(chunks)
                            total_rehydrated += len(chunks)
                    except Exception:
                        pass
        return total_rehydrated


# Global DocumentService singleton
_document_service_instance: Optional[DocumentService] = None


def get_document_service() -> DocumentService:
    global _document_service_instance
    if _document_service_instance is None:
        _document_service_instance = DocumentService()
    return _document_service_instance


def reset_document_service() -> None:
    """Reset the global DocumentService singleton."""
    global _document_service_instance
    _document_service_instance = None

