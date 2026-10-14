"""Domain models for documents, chunks, and retrieval entities."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional


class ProcessingStatus(str, Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    INDEXED = "indexed"
    SCANNED_NEEDS_OCR = "scanned_needs_ocr"
    FAILED = "failed"


@dataclass
class DocumentChunk:
    """Individual text chunk with page-level provenance."""
    chunk_id: str
    doc_id: str
    filename: str
    page_number: int
    chunk_index: int
    text: str
    token_count: int
    metadata: Dict = field(default_factory=dict)


@dataclass
class DocumentMetadata:
    """Full document metadata record."""
    id: str
    filename: str
    original_filename: str
    file_size_bytes: int
    content_hash: str
    page_count: int
    chunk_count: int
    status: ProcessingStatus
    is_scanned: bool = False
    error_message: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "filename": self.filename,
            "original_filename": self.original_filename,
            "file_size_bytes": self.file_size_bytes,
            "content_hash": self.content_hash,
            "page_count": self.page_count,
            "chunk_count": self.chunk_count,
            "status": self.status.value,
            "is_scanned": self.is_scanned,
            "error_message": self.error_message,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "DocumentMetadata":
        return cls(
            id=data["id"],
            filename=data["filename"],
            original_filename=data["original_filename"],
            file_size_bytes=data["file_size_bytes"],
            content_hash=data["content_hash"],
            page_count=data.get("page_count", 0),
            chunk_count=data.get("chunk_count", 0),
            status=ProcessingStatus(data.get("status", ProcessingStatus.UPLOADED.value)),
            is_scanned=data.get("is_scanned", False),
            error_message=data.get("error_message"),
            created_at=data.get("created_at", datetime.now(timezone.utc).isoformat()),
            updated_at=data.get("updated_at", datetime.now(timezone.utc).isoformat()),
        )
