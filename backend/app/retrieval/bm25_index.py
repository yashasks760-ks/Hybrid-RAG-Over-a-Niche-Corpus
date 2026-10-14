"""BM25 Keyword Search Index for exact technical terms, abbreviations, and code symbols."""

import re
from typing import Dict, List, Optional
from rank_bm25 import BM25Okapi
from backend.app.models.document import DocumentChunk


class BM25Index:
    """Manages an in-memory BM25 keyword index over all document chunks."""

    def __init__(self):
        self._chunks: List[DocumentChunk] = []
        self._tokenized_corpus: List[List[str]] = []
        self._bm25: Optional[BM25Okapi] = None

    @staticmethod
    def tokenize(text: str) -> List[str]:
        """Tokenize text into lowercase technical tokens, preserving alphanumeric acronyms and symbols.
        
        Matches terms like '3NF', 'JWT', 'useEffect', 'BCNF', 'O(log n)', 'SHA-256'.
        """
        if not text:
            return []
        # Find alphanumeric words, hyphenated words, and underscore terms
        tokens = re.findall(r"[A-Za-z0-9_#+.-]+", text.lower())
        return [t.strip(".-") for t in tokens if len(t.strip(".-")) > 0]

    def add_chunks(self, new_chunks: List[DocumentChunk]) -> None:
        """Add new chunks to the corpus and rebuild the BM25 index."""
        if not new_chunks:
            return
        # Filter out duplicates if already present
        existing_ids = {c.chunk_id for c in self._chunks}
        filtered_new = [c for c in new_chunks if c.chunk_id not in existing_ids]

        self._chunks.extend(filtered_new)
        self._rebuild_index()

    def remove_document_chunks(self, doc_id: str) -> None:
        """Remove all chunks associated with a deleted document and rebuild index."""
        self._chunks = [c for c in self._chunks if c.doc_id != doc_id]
        self._rebuild_index()

    def clear(self) -> None:
        """Clear all indexed chunks."""
        self._chunks = []
        self._tokenized_corpus = []
        self._bm25 = None

    def _rebuild_index(self) -> None:
        """Re-tokenize corpus and construct BM25Okapi model."""
        if not self._chunks:
            self._tokenized_corpus = []
            self._bm25 = None
            return

        self._tokenized_corpus = [self.tokenize(c.text) for c in self._chunks]
        self._bm25 = BM25Okapi(self._tokenized_corpus)

    def search(
        self,
        query: str,
        top_k: int = 5,
        document_ids: Optional[List[str]] = None,
    ) -> List[Dict]:
        """Search BM25 keyword index for matching chunks."""
        if not self._bm25 or not self._chunks:
            return []

        query_tokens = self.tokenize(query)
        if not query_tokens:
            return []

        scores = self._bm25.get_scores(query_tokens)

        # Pair chunks with scores
        scored_results = []
        for chunk, score in zip(self._chunks, scores):
            if score <= 0.0:
                continue
            if document_ids and chunk.doc_id not in document_ids:
                continue

            scored_results.append(
                {
                    "chunk_id": chunk.chunk_id,
                    "doc_id": chunk.doc_id,
                    "filename": chunk.filename,
                    "page_number": chunk.page_number,
                    "chunk_index": chunk.chunk_index,
                    "text": chunk.text,
                    "score": float(score),
                    "metadata": chunk.metadata,
                }
            )

        # Sort descending by BM25 score
        scored_results.sort(key=lambda x: x["score"], reverse=True)
        return scored_results[:top_k]

    @property
    def total_chunks(self) -> int:
        return len(self._chunks)


# Global BM25 index singleton
_bm25_index_instance: Optional[BM25Index] = None


def get_bm25_index() -> BM25Index:
    global _bm25_index_instance
    if _bm25_index_instance is None:
        _bm25_index_instance = BM25Index()
    return _bm25_index_instance
