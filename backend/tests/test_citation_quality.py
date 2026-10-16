"""Unit tests for citation extraction, system prompts, and PDF file streaming resolution."""

from pathlib import Path
from backend.app.schemas.document import SearchResultItem
from backend.app.services.llm_service import LLMService
from backend.app.services.document_service import get_document_service


def test_system_prompt_modes_and_markdown_rules():
    """Verify system instructions enforce markdown headings, code blocks, tables, and grounded answers."""
    service = LLMService()

    # Notes mode
    notes_prompt = service._build_system_instruction("notes")
    assert "study assistant for college students" in notes_prompt.lower()
    assert "Markdown" in notes_prompt
    assert "sufficient evidence" in notes_prompt.lower()

    # General mode
    general_prompt = service._build_system_instruction("general")
    assert "college professor and technical mentor" in general_prompt.lower()
    assert "Markdown" in general_prompt

    # Web mode
    web_prompt = service._build_system_instruction("web")
    assert "academic research assistant" in web_prompt.lower()


def test_validate_and_extract_citations_matches_retrieved_passages():
    """Verify citations are extracted and verified against retrieved passages, and never hallucinated."""
    service = LLMService()

    retrieved = [
        SearchResultItem(
            chunk_id="c1",
            doc_id="doc_dbms_123",
            document_id="doc_dbms_123",
            filename="Database_Systems.pdf",
            page_number=45,
            chunk_index=0,
            text="ACID properties guarantee that database transactions are processed reliably.",
            score=0.92,
            retrieval_method="hybrid",
        ),
        SearchResultItem(
            chunk_id="c2",
            doc_id="doc_os_456",
            document_id="doc_os_456",
            filename="Operating_Systems.pdf",
            page_number=12,
            chunk_index=1,
            text="Virtual memory enables execution of processes not completely in memory.",
            score=0.85,
            retrieval_method="hybrid",
        ),
    ]

    # Case 1: Answer mentions exact citation
    answer_text = (
        "Database transactions follow ACID properties [Database_Systems.pdf, page 45]. "
        "Also Operating systems use virtual memory [Operating_Systems.pdf, page 12]."
    )
    citations = service._validate_and_extract_citations(answer_text, retrieved)
    assert len(citations) == 2
    assert citations[0].filename == "Database_Systems.pdf"
    assert citations[0].page_number == 45
    assert citations[0].document_id == "doc_dbms_123"
    assert citations[0].verified is True
    assert citations[1].filename == "Operating_Systems.pdf"
    assert citations[1].page_number == 12
    assert citations[1].document_id == "doc_os_456"

    # Case 2: Hallucinated citation in LLM text (not in retrieved passages) is excluded
    fake_answer = "This fact comes from [Unknown_Fake_Book.pdf, page 99]."
    fake_citations = service._validate_and_extract_citations(fake_answer, retrieved)
    # The fake citation must NOT be in the citations!
    assert not any(c.filename == "Unknown_Fake_Book.pdf" for c in fake_citations)

    # Case 3: When no explicit citation tags exist, falls back to top retrieved passages
    plain_answer = "ACID properties ensure atomicity and consistency."
    fallback_citations = service._validate_and_extract_citations(plain_answer, retrieved)
    assert len(fallback_citations) > 0
    assert fallback_citations[0].filename == "Database_Systems.pdf"
    assert fallback_citations[0].page_number == 45
    assert fallback_citations[0].document_id == "doc_dbms_123"


def test_document_file_path_resolution(tmp_path):
    """Verify document service correctly locates raw PDF files on disk for streaming."""
    from backend.app.core.config import settings
    from backend.app.services.document_service import reset_document_service

    orig_dir = settings.DOCUMENT_STORAGE_DIR
    orig_qdrant = settings.QDRANT_STORAGE_DIR
    settings.DOCUMENT_STORAGE_DIR = str(tmp_path)
    settings.QDRANT_STORAGE_DIR = str(tmp_path / "qdrant")
    reset_document_service()

    try:
        doc_service = get_document_service()
        # Create a test PDF file
        test_pdf = tmp_path / "doc_test_999.pdf"
        test_pdf.write_bytes(b"%PDF-1.4 test")

        resolved = doc_service.get_document_file_path("doc_test_999")
        assert resolved is not None
        assert resolved.exists()
        assert resolved.name == "doc_test_999.pdf"

        # Non-existent document
        missing = doc_service.get_document_file_path("non_existent_doc")
        assert missing is None
    finally:
        settings.DOCUMENT_STORAGE_DIR = orig_dir
        settings.QDRANT_STORAGE_DIR = orig_qdrant
        reset_document_service()
