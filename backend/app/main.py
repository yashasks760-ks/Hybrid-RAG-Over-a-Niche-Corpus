"""College AI Knowledge Assistant - Main FastAPI Application."""
# Reload trigger

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from backend.app.api import chat, documents, search
from backend.app.core.config import settings
from backend.app.retrieval.vector_store import get_vector_store, reset_vector_store
from backend.app.services.document_service import get_document_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle management."""
    try:
        # 1. Ensure storage directories exist
        settings.ensure_storage_directories()

        # 2. Initialize vector store collection
        get_vector_store()

        # 3. Re-hydrate BM25 in-memory index from cached document chunks
        rehydrated = get_document_service().rehydrate_bm25_on_startup()
        print(f"[Startup] Rehydrated {rehydrated} chunks into BM25 keyword index.")

        yield
    finally:
        # 4. Graceful shutdown: close embedded Qdrant client and release locks
        print("[Shutdown] Closing VectorStore and releasing local Qdrant locks...")
        reset_vector_store()


app = FastAPI(
    title=settings.APP_TITLE,
    description="Production-grade AI search engine and study assistant for college documents.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(documents.router, prefix=settings.API_PREFIX)
app.include_router(search.router, prefix=settings.API_PREFIX)
app.include_router(chat.router, prefix=settings.API_PREFIX)


@app.get("/", response_class=HTMLResponse)
async def root():
    """Welcoming landing dashboard with system status and documentation links."""
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{settings.APP_TITLE}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            :root {{
                --bg: #0b0f19;
                --card-bg: rgba(23, 32, 54, 0.7);
                --card-border: rgba(255, 255, 255, 0.08);
                --text-primary: #f8fafc;
                --text-muted: #94a3b8;
                --accent: #38bdf8;
                --accent-hover: #0ea5e9;
                --badge-bg: rgba(56, 189, 248, 0.15);
                --badge-text: #38bdf8;
                --success: #34d399;
            }}
            * {{
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }}
            body {{
                font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                background-color: var(--bg);
                color: var(--text-primary);
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 2rem 1rem;
                background-image: 
                    radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.12) 0%, transparent 50%),
                    radial-gradient(circle at 80% 80%, rgba(129, 140, 248, 0.08) 0%, transparent 40%);
            }}
            .container {{
                max-width: 740px;
                width: 100%;
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                backdrop-filter: blur(16px);
                border-radius: 20px;
                padding: 2.5rem;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            }}
            .badge {{
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.35rem 0.85rem;
                border-radius: 9999px;
                background: var(--badge-bg);
                color: var(--badge-text);
                font-size: 0.82rem;
                font-weight: 600;
                letter-spacing: 0.02em;
                margin-bottom: 1.25rem;
                border: 1px solid rgba(56, 189, 248, 0.25);
            }}
            .pulse-dot {{
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background-color: var(--success);
                box-shadow: 0 0 8px var(--success);
            }}
            h1 {{
                font-size: 2.1rem;
                font-weight: 700;
                letter-spacing: -0.025em;
                margin-bottom: 0.75rem;
                background: linear-gradient(to right, #ffffff, #cbd5e1);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }}
            p.lead {{
                font-size: 1.05rem;
                color: var(--text-muted);
                line-height: 1.6;
                margin-bottom: 2rem;
            }}
            .grid {{
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin-bottom: 2rem;
            }}
            .card {{
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid var(--card-border);
                border-radius: 14px;
                padding: 1.25rem;
            }}
            .card-title {{
                font-size: 0.82rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--text-muted);
                margin-bottom: 0.4rem;
            }}
            .card-value {{
                font-size: 1.15rem;
                font-weight: 600;
                color: var(--text-primary);
            }}
            .endpoints-box {{
                background: rgba(15, 23, 42, 0.4);
                border: 1px solid var(--card-border);
                border-radius: 12px;
                padding: 1rem;
                margin-bottom: 2rem;
                font-size: 0.85rem;
                color: var(--text-muted);
            }}
            .endpoints-box code {{
                color: var(--accent);
                font-family: monospace;
            }}
            .btn-group {{
                display: flex;
                flex-wrap: wrap;
                gap: 0.85rem;
            }}
            a.btn {{
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                padding: 0.75rem 1.4rem;
                font-size: 0.92rem;
                font-weight: 600;
                border-radius: 12px;
                text-decoration: none;
                transition: all 0.2s ease;
            }}
            a.btn-primary {{
                background: var(--accent);
                color: #04101e;
            }}
            a.btn-primary:hover {{
                background: var(--accent-hover);
                transform: translateY(-1px);
            }}
            a.btn-secondary {{
                background: rgba(255, 255, 255, 0.06);
                color: var(--text-primary);
                border: 1px solid var(--card-border);
            }}
            a.btn-secondary:hover {{
                background: rgba(255, 255, 255, 0.1);
                transform: translateY(-1px);
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="badge">
                <span class="pulse-dot"></span>
                Backend API Active & Healthy
            </div>
            <h1>{settings.APP_TITLE}</h1>
            <p class="lead">
                Hybrid RAG server with PyMuPDF page-aware extraction, BM25 keyword search, Qdrant semantic vector index, and citation grounding.
            </p>
            <div class="grid">
                <div class="card">
                    <div class="card-title">Vector Engine</div>
                    <div class="card-value">Qdrant (Embedded)</div>
                </div>
                <div class="card">
                    <div class="card-title">Keyword Engine</div>
                    <div class="card-value">BM25 Okapi</div>
                </div>
                <div class="card">
                    <div class="card-title">Embedding Model</div>
                    <div class="card-value">bge-small-en-v1.5</div>
                </div>
            </div>
            <div class="endpoints-box">
                Active Endpoints: 
                <code>POST /api/documents/upload</code> &bull; 
                <code>GET /api/documents</code> &bull; 
                <code>POST /api/search</code> &bull; 
                <code>POST /api/chat</code>
            </div>
            <div class="btn-group">
                <a href="/docs" class="btn btn-primary" target="_blank">
                    Interactive Swagger API Docs &rarr;
                </a>
                <a href="/api/health" class="btn btn-secondary">
                    Health Check Endpoint
                </a>
            </div>
        </div>
    </body>
    </html>
    """


@app.get("/api/health")
async def health_check():
    """Liveness probe: returns basic service health status."""
    return {
        "status": "healthy",
        "service": settings.APP_TITLE,
        "environment": settings.APP_ENV,
        "version": "0.1.0",
    }


@app.get("/api/health/ready")
async def readiness_check():
    """Readiness probe: validates dependencies and storage paths are available."""
    storage_ready = True
    try:
        settings.ensure_storage_directories()
    except Exception as exc:
        storage_ready = False
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "error": f"Storage initialization failed: {str(exc)}"},
        )

    return {
        "status": "ready",
        "storage": "ready" if storage_ready else "error",
        "vector_db": "embedded_disk" if not settings.QDRANT_URL else "remote_cluster",
        "embedding_model": settings.EMBEDDING_MODEL,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.API_HOST, port=settings.API_PORT, reload=False)

