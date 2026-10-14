"""Chat API endpoint: Multi-mode AI assistant (College Notes, General Learning, Live Web Search)."""

import time
from fastapi import APIRouter, HTTPException, status
from backend.app.core.config import settings
from backend.app.retrieval.hybrid_search import HybridSearchEngine, get_hybrid_search_engine
from backend.app.schemas.document import ChatLatency, ChatRequest, ChatResponse
from backend.app.services.llm_service import (
    LLMConfigurationError,
    LLMGenerationError,
    LLMService,
    get_llm_service,
)
from backend.app.services.web_search_service import WebSearchService, get_web_search_service

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Generate study assistant response across College Notes, General Learning, or Web Search modes."""
    total_start = time.perf_counter()
    selected_mode = (request.mode or "notes").lower().strip()
    if selected_mode not in ["notes", "general", "web"]:
        selected_mode = "notes"

    llm: LLMService = get_llm_service()

    if not llm.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f"LLM Provider '{llm.provider}' is not configured with an API key. "
                "Please configure LLM_API_KEY in your backend .env file. "
                "Search mode (/api/search) remains fully operational."
            ),
        )

    # ---------------------------------------------------------
    # Mode 1: General Learning Mode (No document retrieval required)
    # ---------------------------------------------------------
    if selected_mode == "general":
        try:
            raw_answer, llm_ms = await llm.generate_general_answer(
                question=request.question,
                history=request.history,
            )
        except LLMConfigurationError as lce:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(lce))
        except LLMGenerationError as lge:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(lge))
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error generating general learning answer: {str(exc)}",
            )

        total_ms = (time.perf_counter() - total_start) * 1000.0
        return ChatResponse(
            answer=raw_answer,
            citations=[],
            evidence_found=True,
            sources=[],
            web_sources=[],
            latency=ChatLatency(
                retrieval_ms=0.0,
                llm_generation_ms=round(llm_ms, 2),
                total_ms=round(total_ms, 2),
            ),
            provider_used=llm.provider,
            model_used=llm.model,
            mode="general",
        )

    # ---------------------------------------------------------
    # Mode 2: Optional Live Web Search Mode
    # ---------------------------------------------------------
    if selected_mode == "web":
        web_search: WebSearchService = get_web_search_service()

        if not web_search.is_configured():
            explanation_message = (
                "**Live Web Search is currently not configured or disabled.**\n\n"
                "To enable Live Web Search in your environment:\n"
                "1. Open your backend `.env` file.\n"
                "2. Set `WEB_SEARCH_ENABLED=true`.\n"
                "3. Set `WEB_SEARCH_PROVIDER=tavily` and provide `TAVILY_API_KEY=your_key_here` "
                "(get a free API key at [https://tavily.com](https://tavily.com)).\n"
                "   *(Alternatively, set `WEB_SEARCH_PROVIDER=duckduckgo` for search without an API key).*\n\n"
                "**Note:** You can continue using **College Notes Mode** and **General Learning Mode** immediately without any web search configuration!"
            )
            total_ms = (time.perf_counter() - total_start) * 1000.0
            return ChatResponse(
                answer=explanation_message,
                citations=[],
                evidence_found=False,
                sources=[],
                web_sources=[],
                latency=ChatLatency(
                    retrieval_ms=0.0,
                    llm_generation_ms=0.0,
                    total_ms=round(total_ms, 2),
                ),
                provider_used=llm.provider,
                model_used=llm.model,
                mode="web",
            )

        # Execute web search
        retrieval_start = time.perf_counter()
        web_sources, search_err = await web_search.search(request.question, max_results=5)
        search_ms = (time.perf_counter() - retrieval_start) * 1000.0

        if search_err and not web_sources:
            return ChatResponse(
                answer=f"Web search query failed: {search_err}\n\nPlease check your internet connection or web search provider settings.",
                citations=[],
                evidence_found=False,
                sources=[],
                web_sources=[],
                latency=ChatLatency(
                    retrieval_ms=round(search_ms, 2),
                    llm_generation_ms=0.0,
                    total_ms=round((time.perf_counter() - total_start) * 1000.0, 2),
                ),
                provider_used=llm.provider,
                model_used=llm.model,
                mode="web",
            )

        try:
            raw_answer, llm_ms = await llm.generate_web_answer(
                question=request.question,
                web_sources=web_sources,
                history=request.history,
            )
        except Exception as exc:
            # If LLM synthesis encounters quota or error, still return the verified web sources
            summary_lines = [f"- **[{s.title}]({s.url})**: {s.snippet}" for s in web_sources]
            raw_answer = (
                f"**Live Web Search Results:**\n\n"
                f"*(Note: AI synthesis is temporarily limited: {str(exc)}. "
                f"Here are the verified web sources retrieved for your query:)*\n\n" +
                "\n\n".join(summary_lines)
            )
            llm_ms = 0.0


        total_ms = (time.perf_counter() - total_start) * 1000.0
        return ChatResponse(
            answer=raw_answer,
            citations=[],
            evidence_found=bool(web_sources),
            sources=[],
            web_sources=web_sources,
            latency=ChatLatency(
                retrieval_ms=round(search_ms, 2),
                llm_generation_ms=round(llm_ms, 2),
                total_ms=round(total_ms, 2),
            ),
            provider_used=llm.provider,
            model_used=llm.model,
            mode="web",
        )

    # ---------------------------------------------------------
    # Mode 3: College Notes Mode (Default - Grounded RAG with citations)
    # ---------------------------------------------------------
    engine: HybridSearchEngine = get_hybrid_search_engine()
    retrieval_output = engine.search(
        query=request.question,
        top_k=request.top_k or settings.DEFAULT_TOP_K,
        document_ids=request.document_ids,
    )
    passages = retrieval_output["results"]
    retrieval_ms = retrieval_output["latency"].total_ms

    try:
        raw_answer, citations, evidence_found, llm_ms = await llm.generate_grounded_answer(
            question=request.question,
            passages=passages,
            history=request.history,
        )
    except LLMConfigurationError as lce:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(lce))
    except LLMGenerationError as lge:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(lge))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during answer generation: {str(exc)}",
        )

    total_ms = (time.perf_counter() - total_start) * 1000.0

    return ChatResponse(
        answer=raw_answer,
        citations=citations,
        evidence_found=evidence_found,
        sources=passages,
        web_sources=[],
        latency=ChatLatency(
            retrieval_ms=round(retrieval_ms, 2),
            llm_generation_ms=round(llm_ms, 2),
            total_ms=round(total_ms, 2),
        ),
        provider_used=llm.provider,
        model_used=llm.model,
        mode="notes",
    )
