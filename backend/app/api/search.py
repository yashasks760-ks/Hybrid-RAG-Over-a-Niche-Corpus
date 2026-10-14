"""Search API endpoint: Hybrid search combining Qdrant dense vectors and BM25 keywords."""

from fastapi import APIRouter, HTTPException, status
from backend.app.retrieval.hybrid_search import HybridSearchEngine, get_hybrid_search_engine
from backend.app.schemas.document import SearchRequest, SearchResponse

router = APIRouter(prefix="/search", tags=["Search"])


@router.post("", response_model=SearchResponse)
async def search(request: SearchRequest):
    """Execute hybrid search over uploaded documents without requiring an LLM call."""
    try:
        engine: HybridSearchEngine = get_hybrid_search_engine()
        search_output = engine.search(
            query=request.query,
            top_k=request.top_k,
            document_ids=request.document_ids,
        )
        return SearchResponse(
            query=request.query,
            total_results=len(search_output["results"]),
            results=search_output["results"],
            latency=search_output["latency"],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Hybrid search failed: {str(exc)}",
        )
