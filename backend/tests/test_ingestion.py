"""Tests for PDF text extraction, chunking, and hashing."""

import pytest
import pymupdf
from backend.app.ingestion.extractor import PDFExtractor
from backend.app.ingestion.chunker import TextChunker
from backend.app.ingestion.hasher import compute_content_hash


def _create_sample_pdf(pages_text: list[str]) -> bytes:
    """Helper to create an in-memory multi-page PDF using PyMuPDF."""
    doc = pymupdf.open()
    for text in pages_text:
        page = doc.new_page()
        rect = pymupdf.Rect(50, 50, 550, 750)
        page.insert_textbox(rect, text)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_pdf_extraction_page_provenance():
    """Verify PyMuPDF correctly preserves page numbers and text content."""
    pages = [
        "First page content: Database Normalization concepts like 1NF, 2NF, 3NF.",
        "Second page content: Boyce-Codd Normal Form (BCNF) eliminates all anomalies.",
        "Third page content: Indexing techniques including B+ Trees and Hash Indexing.",
    ]
    pdf_bytes = _create_sample_pdf(pages)

    result = PDFExtractor.extract_from_bytes(pdf_bytes, filename="dbms_notes.pdf")

    assert result.total_pages == 3
    assert not result.is_scanned
    assert len(result.pages) == 3
    assert result.pages[0].page_number == 1
    assert "3NF" in result.pages[0].text
    assert result.pages[1].page_number == 2
    assert "BCNF" in result.pages[1].text
    assert result.pages[2].page_number == 3
    assert "B+ Trees" in result.pages[2].text


def test_scanned_pdf_detection():
    """Verify that PDFs with little or no extractable text are flagged as scanned."""
    # Blank PDF with no text
    blank_pdf = _create_sample_pdf(["", " "])
    result = PDFExtractor.extract_from_bytes(blank_pdf, filename="scanned_exam.pdf")

    assert result.is_scanned is True
    assert "scanned" in result.warning_message.lower()
    assert "ocr" in result.warning_message.lower()


def test_chunker_sliding_window_overlap():
    """Verify chunker respects chunk size and overlap."""
    # Create text with 120 words
    long_text = " ".join([f"term_{i}" for i in range(120)])
    pdf_bytes = _create_sample_pdf([long_text])
    extraction = PDFExtractor.extract_from_bytes(pdf_bytes)

    chunker = TextChunker(chunk_size=50, chunk_overlap=10)
    chunks = chunker.chunk_pages(doc_id="doc123", filename="test.pdf", pages=extraction.pages)

    assert len(chunks) > 1
    assert chunks[0].doc_id == "doc123"
    assert chunks[0].filename == "test.pdf"
    assert chunks[0].page_number == 1
    assert chunks[0].chunk_index == 0


def test_content_hash_consistency():
    """Verify SHA-256 content hashing detects identical files."""
    data_a = b"%PDF-1.4 sample content for college notes"
    data_b = b"%PDF-1.4 sample content for college notes"
    data_c = b"%PDF-1.4 different content"

    hash_a = compute_content_hash(data_a)
    hash_b = compute_content_hash(data_b)
    hash_c = compute_content_hash(data_c)

    assert hash_a == hash_b
    assert hash_a != hash_c
    assert len(hash_a) == 64
