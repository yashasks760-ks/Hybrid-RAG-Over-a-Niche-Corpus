"""Page-aware sliding window text chunker with configurable token size and overlap."""

import re
from typing import List
from backend.app.core.config import settings
from backend.app.ingestion.extractor import PageContent
from backend.app.models.document import DocumentChunk


class TextChunker:
    """Splits page-extracted text into overlapping chunks while preserving page numbers."""

    def __init__(self, chunk_size: int = None, chunk_overlap: int = None):
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap if chunk_overlap is not None else settings.CHUNK_OVERLAP
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be strictly less than chunk_size")

    def _approx_token_count(self, text: str) -> int:
        """Estimate token count based on whitespace and punctuation words."""
        return len(re.findall(r"\w+|[^\w\s]", text))

    def chunk_pages(
        self,
        doc_id: str,
        filename: str,
        pages: List[PageContent],
    ) -> List[DocumentChunk]:
        """Split pages into overlapping chunks with page-level provenance.
        
        Chunks are generated primarily within page boundaries to ensure citations
        accurately reflect the page where the content was printed. When individual pages
        contain large passages, a sliding window is applied.
        """
        chunks: List[DocumentChunk] = []
        chunk_idx = 0

        step_size = max(1, self.chunk_size - self.chunk_overlap)

        for page in pages:
            text = page.text.strip()
            if not text:
                continue

            words = text.split()
            if not words:
                continue

            # If page is shorter than chunk size, treat the whole page as a single chunk
            if len(words) <= self.chunk_size:
                chunk_id = f"{doc_id}_c{chunk_idx}"
                token_count = self._approx_token_count(text)
                chunks.append(
                    DocumentChunk(
                        chunk_id=chunk_id,
                        doc_id=doc_id,
                        filename=filename,
                        page_number=page.page_number,
                        chunk_index=chunk_idx,
                        text=text,
                        token_count=token_count,
                        metadata={
                            "page_number": page.page_number,
                            "word_count": len(words),
                        },
                    )
                )
                chunk_idx += 1
            else:
                # Sliding window over the page's words
                start_idx = 0
                while start_idx < len(words):
                    end_idx = min(start_idx + self.chunk_size, len(words))
                    window_words = words[start_idx:end_idx]
                    window_text = " ".join(window_words)
                    token_count = self._approx_token_count(window_text)

                    chunk_id = f"{doc_id}_c{chunk_idx}"
                    chunks.append(
                        DocumentChunk(
                            chunk_id=chunk_id,
                            doc_id=doc_id,
                            filename=filename,
                            page_number=page.page_number,
                            chunk_index=chunk_idx,
                            text=window_text,
                            token_count=token_count,
                            metadata={
                                "page_number": page.page_number,
                                "word_count": len(window_words),
                                "start_word": start_idx,
                                "end_word": end_idx,
                            },
                        )
                    )
                    chunk_idx += 1

                    if end_idx >= len(words):
                        break
                    start_idx += step_size

        return chunks
