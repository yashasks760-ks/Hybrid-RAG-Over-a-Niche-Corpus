"""Hybrid Search Engine combining Dense Semantic Vectors with BM25 Keyword Search via RRF."""

import time
from typing import Dict, List, Optional
from backend.app.core.config import settings
from backend.app.retrieval.bm25_index import BM25Index, get_bm25_index
from backend.app.retrieval.embedder import EmbeddingService, get_embedding_service
from backend.app.retrieval.vector_store import VectorStore, get_vector_store
from backend.app.schemas.document import SearchLatency, SearchResultItem


class HybridSearchEngine:
    """Executes hybrid retrieval by fusing Qdrant dense vector search with BM25 keyword search."""

    def __init__(
        self,
        vector_store: Optional[VectorStore] = None,
        embedder: Optional[EmbeddingService] = None,
        bm25_index: Optional[BM25Index] = None,
        rrf_k: int = None,
    ):
        self.vector_store = vector_store or get_vector_store()
        self.embedder = embedder or get_embedding_service()
        self.bm25_index = bm25_index or get_bm25_index()
        self.rrf_k = rrf_k or settings.RRF_K

    def search(
        self,
        query: str,
        top_k: int = None,
        document_ids: Optional[List[str]] = None,
    ) -> Dict:
        """Execute hybrid search pipeline with granular latency profiling."""
        start_total = time.perf_counter()
        top_k = top_k or settings.DEFAULT_TOP_K
        normalized_query = query.strip()

        if not normalized_query:
            return {
                "results": [],
                "latency": SearchLatency(total_ms=0.0),
            }

        # 1. Query Embedding
        start_embed = time.perf_counter()
        query_vector = self.embedder.embed_query(normalized_query)
        query_embedding_ms = (time.perf_counter() - start_embed) * 1000.0

        # 2. Semantic Search (Qdrant)
        start_semantic = time.perf_counter()
        # Retrieve candidate pool (2x top_k to allow fusion re-ranking)
        candidate_k = max(top_k * 3, 10)
        semantic_hits = self.vector_store.search_vectors(
            query_vector=query_vector,
            top_k=candidate_k,
            document_ids=document_ids,
        )
        semantic_search_ms = (time.perf_counter() - start_semantic) * 1000.0

        # 3. Keyword Search (BM25)
        start_keyword = time.perf_counter()
        keyword_hits = self.bm25_index.search(
            query=normalized_query,
            top_k=candidate_k,
            document_ids=document_ids,
        )
        keyword_search_ms = (time.perf_counter() - start_keyword) * 1000.0

        # 4. Reciprocal Rank Fusion (RRF)
        start_fusion = time.perf_counter()
        fused_scores: Dict[str, float] = {}
        chunk_map: Dict[str, Dict] = {}
        methods_map: Dict[str, set] = {}

        # Process semantic ranks
        for rank, hit in enumerate(semantic_hits):
            cid = hit["chunk_id"]
            rrf_score = 1.0 / (self.rrf_k + (rank + 1))
            fused_scores[cid] = fused_scores.get(cid, 0.0) + rrf_score
            chunk_map[cid] = hit
            methods_map.setdefault(cid, set()).add("semantic")

        # Process keyword ranks
        for rank, hit in enumerate(keyword_hits):
            cid = hit["chunk_id"]
            rrf_score = 1.0 / (self.rrf_k + (rank + 1))
            fused_scores[cid] = fused_scores.get(cid, 0.0) + rrf_score
            if cid not in chunk_map:
                chunk_map[cid] = hit
            methods_map.setdefault(cid, set()).add("keyword")

        # Sort all candidates by fused score
        ranked_chunk_ids = sorted(fused_scores.keys(), key=lambda c: fused_scores[c], reverse=True)

        # Build output results with deduplication
        results: List[SearchResultItem] = []
        seen_texts = set()

        for cid in ranked_chunk_ids:
            chunk = chunk_map[cid]
            text_snippet = chunk["text"][:100].strip()

            # Prevent near-identical duplicated passages
            if text_snippet in seen_texts:
                continue
            seen_texts.add(text_snippet)

            methods = methods_map[cid]
            retrieval_method = "hybrid" if len(methods) > 1 else list(methods)[0]

            results.append(
                SearchResultItem(
                    chunk_id=chunk["chunk_id"],
                    doc_id=chunk["doc_id"],
                    filename=chunk["filename"],
                    page_number=chunk["page_number"],
                    chunk_index=chunk["chunk_index"],
                    text=chunk["text"],
                    score=round(fused_scores[cid], 5),
                    retrieval_method=retrieval_method,
                    metadata=chunk.get("metadata", {}),
                )
            )

            if len(results) >= top_k:
                break

        fusion_ms = (time.perf_counter() - start_fusion) * 1000.0
        total_ms = (time.perf_counter() - start_total) * 1000.0

        latency = SearchLatency(
            query_embedding_ms=round(query_embedding_ms, 2),
            semantic_search_ms=round(semantic_search_ms, 2),
            keyword_search_ms=round(keyword_search_ms, 2),
            fusion_ms=round(fusion_ms, 2),
            total_ms=round(total_ms, 2),
        )

        return {
            "results": results,
            "latency": latency,
        }


# Global HybridSearchEngine singleton
_hybrid_search_instance: Optional[HybridSearchEngine] = None


def get_hybrid_search_engine() -> HybridSearchEngine:
    global _hybrid_search_instance
    if _hybrid_search_instance is None:
        _hybrid_search_instance = HybridSearchEngine()
    return _hybrid_search_instance


def reset_hybrid_search_engine() -> None:
    """Reset the global HybridSearchEngine singleton."""
    global _hybrid_search_instance
    _hybrid_search_instance = None

