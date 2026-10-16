# College AI Knowledge Assistant (Hybrid RAG)

A production-grade College AI Knowledge Assistant featuring hybrid retrieval-augmented generation (RAG) over academic notes, lecture slides, and syllabus documents.

---

## Features

- Hybrid Search Engine: Combines semantic vector retrieval (FastEmbed ONNX bge-small-en-v1.5 + Qdrant) and exact keyword search (BM25 Okapi) fused via Reciprocal Rank Fusion (RRF).
- Page-Aware Document Ingestion: PyMuPDF text extraction preserving document structure, exact page numbering, and deep-linkable citations.
- LLM Integration: Native Google Gemini support with model fallback cascades, grounded prompting, temperature controls, and citation validation.
- Modern Web Interface: React 19 + TypeScript + Vite with chat, document upload, status tracking, and source inspection modal.
- Independent Deployment Architecture: Designed for separate backend deployment on Render and frontend deployment on Vercel.

---

## Project Structure

- backend/app/api: API endpoints (/chat, /search, /documents, /health)
- backend/app/core: Pydantic Settings and environment configuration
- backend/app/ingestion: PyMuPDF extractor, chunker, content hasher
- backend/app/retrieval: FastEmbed, BM25 Okapi, Qdrant VectorStore, RRF
- backend/app/services: LLM service (Gemini), document service
- backend/app/main.py: FastAPI application entry point
- backend/tests: Pytest test suite
- backend/requirements.txt: Python dependencies
- frontend/src/components: Chat, Search, Document Manager, Source Viewer
- frontend/src/services/api.ts: API client with dynamic VITE_API_BASE_URL resolution
- frontend/src/App.tsx: Main application shell
- frontend/package.json: Frontend dependencies and scripts
- frontend/vite.config.ts: Vite build configuration and dev proxy
- data/documents/: Uploaded PDF files and metadata (gitignored)
- data/qdrant_storage/: Embedded Qdrant vector index (gitignored)
- .env.example: Backend environment template
- .gitignore: Git ignore configuration
- package.json: Root script orchestrator

---

## Local Development Setup

### 1. Prerequisites
- Python 3.10 or higher
- Node.js 18.x or higher
- Google Gemini API Key (from Google AI Studio)

### 2. Environment Configuration
Copy .env.example to .env in the project root:
cp .env.example .env

Open .env and set your LLM_API_KEY:
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
LLM_API_KEY=your_actual_gemini_api_key

### 3. Quick Start (Windows PowerShell)
Use the included automated startup script to launch both services:
.\start-dev.ps1

Endpoints:
- Frontend: http://localhost:5173
- Backend API: http://127.0.0.1:8000
- Interactive Swagger Docs: http://127.0.0.1:8000/docs

To stop development processes:
.\stop-dev.ps1

### 4. Manual Start (Separate Terminals)

Terminal 1 - Backend:
python -m venv venv
.\venv\Scripts\activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

Terminal 2 - Frontend:
cd frontend
npm install
npm run dev

---

## Production Deployment

### 1. Backend on Render (Web Service)
- Blueprint: You can deploy automatically using the included `render.yaml` or create a manual Web Service:
- Root Directory: . (repository root)
- Environment: Python
- Build Command: `pip install -r backend/requirements.txt` (or default `pip install -r requirements.txt`)
- Start Command: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT --workers 1`
  (Note: Keep `--workers 1` when using embedded local disk Qdrant storage to prevent database file locking across multiple processes).
- Required Environment Variables on Render:
  - `APP_ENV=production`
  - `LLM_PROVIDER=gemini`
  - `LLM_MODEL=gemini-2.5-flash`
  - `LLM_API_KEY=<your-gemini-api-key>`
  - `CORS_ORIGINS=https://<your-vercel-frontend-domain>.vercel.app`
- Persistent Storage:
  Render free web services use ephemeral disk storage. To retain uploaded PDFs and embedded Qdrant vectors across restarts, attach a Render Persistent Disk (e.g., mounted to `data/documents` and `data/qdrant_storage`), or configure Qdrant Cloud (`QDRANT_URL`, `QDRANT_API_KEY`). Note: original PDFs are stored on disk in `DOCUMENT_STORAGE_DIR`, not inside Qdrant Cloud.

### 2. Frontend on Vercel
- Framework Preset: Vite
- Root Directory: frontend
- Build Command: npm run build
- Output Directory: dist
- Install Command: npm install
- Environment Variables on Vercel:
  - VITE_API_BASE_URL=https://<your-render-backend-domain>.onrender.com

---

## Health & Verification Endpoints

- GET /api/health: Basic liveness probe confirming backend responsiveness.
- GET /api/health/ready: Readiness probe validating storage directories, vector database availability, and embedding model initialization.
- GET /docs: Interactive OpenAPI / Swagger UI documentation.

---

## Security Policy
- Never commit real .env files or API credentials to GitHub.
- Uploaded PDFs, cached chunks, and local vector indices are automatically excluded by .gitignore.
