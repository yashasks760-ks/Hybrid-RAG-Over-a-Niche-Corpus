import { DocumentItem, SearchResponse, ChatResponse, ChatMode } from '../types';

// Configurable API Base URL for separate frontend/backend deployment
const resolveApiBase = (): string => {
  const envUrl = (
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    'https://hybrid-rag-over-a-niche-corpus.onrender.com/api'
  ).trim();

  const stripped = envUrl.replace(/\/+$/, '');

  if (!stripped || stripped === '/api') {
    return 'https://hybrid-rag-over-a-niche-corpus.onrender.com/api';
  }

  return stripped.endsWith('/api') ? stripped : `${stripped}/api`;
};

export const API_BASE = resolveApiBase();
export const getApiBaseUrl = (): string => API_BASE;

/**
 * Returns the URL to directly view or download a document's raw PDF file,
 * with optional page deep linking (e.g. #page=3).
 */
export const getDocumentFileUrl = (docId: string, pageNumber?: number): string => {
  const base = `${API_BASE}/documents/${encodeURIComponent(docId)}/file`;
  return pageNumber ? `${base}#page=${pageNumber}` : base;
};

/**
 * Extract clean, human-readable error messages from API responses,
 * including 502 Bad Gateway proxy errors and FastAPI detail objects.
 */
async function parseApiError(res: Response, defaultMessage: string): Promise<string> {
  if (res.status === 502) {
    return 'Backend is unreachable (HTTP 502 Bad Gateway). Please ensure the FastAPI backend is running on 127.0.0.1:8000.';
  }
  if (res.status === 503) {
    return 'Backend service is temporarily unavailable (HTTP 503). Vector store or storage may still be initializing.';
  }
  if (res.status === 504) {
    return 'Gateway Timeout (HTTP 504). The backend took too long to respond.';
  }
  try {
    const data = await res.json();
    if (data && data.detail) {
      return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
    }
    if (data && data.error) {
      return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    }
  } catch {
    // Response was not JSON (e.g. HTML proxy error)
    try {
      const text = await res.text();
      if (text && text.trim().length > 0 && text.length < 200 && !text.includes('<!DOCTYPE')) {
        return text.trim();
      }
    } catch {
      // Ignore text read failure
    }
  }
  return `${defaultMessage} (${res.status} ${res.statusText})`;
}

export async function checkHealth(signal?: AbortSignal): Promise<{ status: string; service: string }> {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const msg = await parseApiError(res, 'Backend health check failed');
      throw new Error(msg);
    }
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    throw new Error(err.message || 'Cannot reach backend server');
  }
}

export async function checkReadiness(signal?: AbortSignal): Promise<{ status: string; storage: string; vector_db: string }> {
  try {
    const res = await fetch(`${API_BASE}/health/ready`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const msg = await parseApiError(res, 'Backend readiness probe failed');
      throw new Error(msg);
    }
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    throw new Error(err.message || 'Readiness probe failed');
  }
}

export async function fetchDocuments(signal?: AbortSignal): Promise<DocumentItem[]> {
  try {
    const res = await fetch(`${API_BASE}/documents`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const msg = await parseApiError(res, 'Failed to fetch documents');
      throw new Error(msg);
    }
    const data = await res.json();
    return data.documents || [];
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    throw new Error(err.message || 'Failed to fetch documents');
  }
}

export async function uploadDocument(
  file: File
): Promise<{ message: string; document: DocumentItem; duplicate_detected: boolean }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const msg = await parseApiError(res, 'Upload failed');
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteDocument(docId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${docId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const msg = await parseApiError(res, 'Failed to delete document');
    throw new Error(msg);
  }
}

export async function retryDocument(docId: string): Promise<DocumentItem> {
  const res = await fetch(`${API_BASE}/documents/${docId}/retry`, {
    method: 'POST',
  });
  if (!res.ok) {
    const msg = await parseApiError(res, 'Retry failed');
    throw new Error(msg);
  }
  return res.json();
}

export async function searchDocuments(
  query: string,
  topK: number = 5,
  documentIds?: string[]
): Promise<SearchResponse> {
  const res = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      top_k: topK,
      document_ids: documentIds && documentIds.length > 0 ? documentIds : undefined,
    }),
  });

  if (!res.ok) {
    const msg = await parseApiError(res, 'Search query failed');
    throw new Error(msg);
  }
  return res.json();
}

export async function chatWithDocuments(
  question: string,
  history: { role: string; content: string }[] = [],
  topK: number = 5,
  documentIds?: string[],
  mode: ChatMode = 'notes'
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      history,
      top_k: topK,
      document_ids: documentIds && documentIds.length > 0 ? documentIds : undefined,
      mode,
    }),
  });

  if (!res.ok) {
    const msg = await parseApiError(res, 'AI Chat failed');
    throw new Error(msg);
  }
  return res.json();
}
