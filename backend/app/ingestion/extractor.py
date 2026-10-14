"""PDF Text Extraction using PyMuPDF with page-level provenance and scanned PDF detection."""

from dataclasses import dataclass
from typing import BinaryIO, List, Union
import pymupdf


@dataclass
class PageContent:
    page_number: int  # 1-indexed
    text: str
    char_count: int


@dataclass
class ExtractionResult:
    pages: List[PageContent]
    total_pages: int
    total_characters: int
    is_scanned: bool
    warning_message: str = ""


class PDFExtractor:
    """Extracts text page-by-page from PDFs and identifies image-only/scanned documents."""

    MIN_TOTAL_CHARS_THRESHOLD = 50
    MIN_AVG_CHARS_PER_PAGE = 20

    @classmethod
    def extract_from_bytes(cls, pdf_bytes: bytes, filename: str = "document.pdf") -> ExtractionResult:
        """Extract text from PDF byte content."""
        try:
            doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        except Exception as exc:
            raise ValueError(f"Invalid or corrupted PDF file '{filename}': {str(exc)}") from exc

        pages: List[PageContent] = []
        total_chars = 0

        try:
            for page_idx in range(len(doc)):
                page = doc[page_idx]
                text = page.get_text("text").strip()
                char_count = len(text)
                total_chars += char_count

                pages.append(
                    PageContent(
                        page_number=page_idx + 1,  # 1-indexed
                        text=text,
                        char_count=char_count,
                    )
                )
        finally:
            doc.close()

        total_pages = len(pages)
        avg_chars_per_page = (total_chars / total_pages) if total_pages > 0 else 0

        # Detect scanned/image-only PDFs
        is_scanned = (
            total_chars < cls.MIN_TOTAL_CHARS_THRESHOLD
            or (total_pages > 1 and avg_chars_per_page < cls.MIN_AVG_CHARS_PER_PAGE)
        )

        warning_message = ""
        if is_scanned:
            warning_message = (
                f"Document '{filename}' appears to be a scanned image or contains minimal text "
                f"({total_chars} characters across {total_pages} pages). "
                "Optical Character Recognition (OCR) is recommended for full searchability."
            )

        return ExtractionResult(
            pages=pages,
            total_pages=total_pages,
            total_characters=total_chars,
            is_scanned=is_scanned,
            warning_message=warning_message,
        )
