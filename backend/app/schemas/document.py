"""Pydantic schemas for API requests, responses, and citations."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator


# -------------------------------------------------------------
# Document Schemas
# -------------------------------------------------------------

class DocumentResponse(BaseModel):
    """Document summary item returned by API."""
    id: str
    filename: str
    original_filename: str
    file_size_bytes: int
    content_hash: str
    page_count: int
    chunk_count: int
    status: str
    is_scanned: bool = False
    error_message: Optional[str] = None
    created_at: str
    updated_at: str


class DocumentListResponse(BaseModel):
    """Collection of documents with total count."""
    total: int
    documents: List[DocumentResponse]


class DocumentUploadResponse(BaseModel):
    """Response after uploading a document."""
    message: str
    document: DocumentResponse
    duplicate_detected: bool = False


# -------------------------------------------------------------
# Search Schemas
# -------------------------------------------------------------

class SearchRequest(BaseModel):
    """Payload for hybrid search query."""
    query: str = Field(..., min_length=1, max_length=1000, description="Search term or natural question")
    top_k: Optional[int] = Field(default=5, ge=1, le=25, description="Number of passages to return")
    document_ids: Optional[List[str]] = Field(default=None, description="Optional document filter")


class SearchResultItem(BaseModel):
    """Single retrieved passage with metadata and score."""
    chunk_id: str
    doc_id: str
    document_id: Optional[str] = None
    filename: str
    page_number: int
    chunk_index: int
    text: str
    score: float
    retrieval_method: str = Field(description="'semantic', 'keyword', or 'hybrid'")
    metadata: Dict = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def sync_document_ids(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "doc_id" in data and not data.get("document_id"):
                data["document_id"] = data["doc_id"]
            elif "document_id" in data and not data.get("doc_id"):
                data["doc_id"] = data["document_id"]
        return data


class SearchLatency(BaseModel):
    """Detailed timing breakdown of search phases in milliseconds."""
    query_embedding_ms: float = 0.0
    semantic_search_ms: float = 0.0
    keyword_search_ms: float = 0.0
    fusion_ms: float = 0.0
    total_ms: float = 0.0


class SearchResponse(BaseModel):
    """Full hybrid search response."""
    query: str
    total_results: int
    results: List[SearchResultItem]
    latency: SearchLatency


# -------------------------------------------------------------
# Chat & Citation Schemas
# -------------------------------------------------------------

class CitationItem(BaseModel):
    """Validated source citation."""
    source_id: str
    document_id: Optional[str] = None
    filename: str
    page_number: int
    excerpt: str
    verified: bool = True


class WebSourceItem(BaseModel):
    """Source reference from a live web search result."""
    title: str
    url: str
    snippet: str
    score: Optional[float] = None


class ChatMessage(BaseModel):
    """Chat message history item."""
    role: str = Field(..., description="'user' or 'assistant'")
    content: str


class ChatRequest(BaseModel):
    """Payload for conversational question answering."""
    question: str = Field(..., min_length=1, max_length=2000)
    history: Optional[List[ChatMessage]] = Field(default_factory=list)
    document_ids: Optional[List[str]] = Field(default=None)
    top_k: Optional[int] = Field(default=5, ge=1, le=15)
    mode: str = Field(default="notes", description="Chat mode: 'notes', 'general', or 'web'")


class ChatLatency(BaseModel):
    """Timing breakdown for RAG answer generation in milliseconds."""
    retrieval_ms: float = 0.0
    llm_generation_ms: float = 0.0
    total_ms: float = 0.0


class ChatResponse(BaseModel):
    """Grounded answer with citations, web sources, and evidence telemetry."""
    answer: str
    citations: List[CitationItem] = Field(default_factory=list)
    evidence_found: bool = True
    sources: List[SearchResultItem] = Field(default_factory=list)
    web_sources: List[WebSourceItem] = Field(default_factory=list)
    latency: ChatLatency
    provider_used: Optional[str] = None
    model_used: Optional[str] = None
    mode: str = Field(default="notes")
