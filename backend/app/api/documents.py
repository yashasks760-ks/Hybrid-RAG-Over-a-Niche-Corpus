"""Document API endpoints: upload, list, detail, delete, and retry."""

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from backend.app.schemas.document import (
    DocumentListResponse,
    DocumentResponse,
    DocumentUploadResponse,
)
from backend.app.services.document_service import DocumentService, get_document_service

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
):
    """Upload and ingest a college PDF document."""
    service: DocumentService = get_document_service()
    try:
        doc_meta, is_duplicate = await service.upload_document(file)
        message = "Document indexed successfully."
        if is_duplicate:
            message = "Identical document already exists and is indexed."
        elif doc_meta.is_scanned:
            message = "Document uploaded but appears to be a scanned image. OCR is recommended."

        return DocumentUploadResponse(
            message=message,
            document=DocumentResponse(**doc_meta.to_dict()),
            duplicate_detected=is_duplicate,
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process document upload: {str(exc)}",
        )


@router.get("", response_model=DocumentListResponse)
async def list_documents():
    """Retrieve all indexed college documents."""
    service: DocumentService = get_document_service()
    docs = service.list_documents()
    return DocumentListResponse(
        total=len(docs),
        documents=[DocumentResponse(**d.to_dict()) for d in docs],
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str):
    """Retrieve metadata for a specific document."""
    service: DocumentService = get_document_service()
    doc = service.get_document(document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' not found.",
        )
    return DocumentResponse(**doc.to_dict())


@router.get("/{document_id}/file")
async def get_document_file(document_id: str):
    """Serve the original PDF document file for in-browser inspection at specific pages."""
    from fastapi.responses import FileResponse
    service: DocumentService = get_document_service()
    doc = service.get_document(document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' not found.",
        )
    file_path = service.get_document_file_path(document_id)
    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF document file not found on disk.",
        )
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=doc.original_filename,
    )


@router.delete("/{document_id}")
async def delete_document(document_id: str):
    """Permanently delete a document and its vector representations."""
    service: DocumentService = get_document_service()
    success = service.delete_document(document_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' not found.",
        )
    return {
        "message": "Document and associated vectors deleted successfully.",
        "document_id": document_id,
    }


@router.post("/{document_id}/retry", response_model=DocumentResponse)
async def retry_document(document_id: str):
    """Retry processing a failed document."""
    service: DocumentService = get_document_service()
    try:
        doc = service.retry_document(document_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID '{document_id}' not found.",
            )
        return DocumentResponse(**doc.to_dict())
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
