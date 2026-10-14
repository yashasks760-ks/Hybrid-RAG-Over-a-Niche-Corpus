"""FastEmbed ONNX Text Embedding Model wrapper with batching and persistent instance."""

from typing import List
from fastembed import TextEmbedding
from backend.app.core.config import settings


class EmbeddingService:
    """Manages the FastEmbed ONNX embedding model instance."""

    _instance: "EmbeddingService" = None
    _model: TextEmbedding = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EmbeddingService, cls).__new__(cls)
            cls._instance._initialize_model()
        return cls._instance

    def _initialize_model(self):
        """Load the embedding model once."""
        self._model = TextEmbedding(model_name=settings.EMBEDDING_MODEL)

    def embed_texts(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        """Generate normalized vector embeddings for a list of texts in batches."""
        if not texts:
            return []
        embeddings_generator = self._model.embed(texts, batch_size=batch_size)
        return [embedding.tolist() for embedding in embeddings_generator]

    def embed_query(self, query: str) -> List[float]:
        """Generate embedding vector for a single search query."""
        results = self.embed_texts([query])
        return results[0] if results else []


# Module-level helper
def get_embedding_service() -> EmbeddingService:
    return EmbeddingService()
