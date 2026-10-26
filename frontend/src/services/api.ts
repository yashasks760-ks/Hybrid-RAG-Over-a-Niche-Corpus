import { DocumentItem, SearchResponse, ChatResponse, ChatMode } from '../types';

/**
 * Resolves the API base URL cleanly across development and production environments.
 * - Local development: defaults to Vite's dev proxy '/api' unless VITE_API_BASE_URL is explicitly set.
 * - Production (Vercel): uses VITE_API_BASE_URL (or VITE_API_URL), appending '/api' cleanly without trailing slashes.
 */
export const resolveApiBase = (): string => {
  const envUrl = (
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    ''
  ).trim();

  // In local development, use Vite proxy '/api' by default to avoid CORS and port mismatches
  if (import.meta.env.DEV) {
    if (!envUrl || envUrl.replace(/\/+$/, '') === '/api') {
      return '/api';
    }
    const strippedDev = envUrl.replace(/\/+$/, '').replace(/\/api\/api(?:\/|$)/g, '/api');
    return strippedDev.endsWith('/api') ? strippedDev : `${strippedDev}/api`;
  }

  // In production (Vercel), prioritize VITE_API_BASE_URL.
  // Fall back to the deployed Render backend if VITE_API_BASE_URL is not set or set to '/api'.
  const rawUrl = (!envUrl || envUrl.replace(/\/+$/, '') === '/api')
    ? 'https://hybrid-rag-over-a-niche-corpus.onrender.com'
    : envUrl;
  let stripped = rawUrl.replace(/\/+$/, '').replace(/\/api\/api(?:\/|$)/g, '/api');

  return stripped.endsWith('/api') ? stripped : `${stripped}/api`;
};

export const API_BASE = resolveApiBase();
export const getApiBaseUrl = (): string => API_BASE;

/**
 * Detects whether the frontend is in local mode or connected to a remote production backend.
 */
export const isLocalMode = (): boolean => {
  return (
    import.meta.env.DEV ||
    API_BASE.startsWith('/') ||
    API_BASE.includes('127.0.0.1') ||
    API_BASE.includes('localhost')
  );
};

/**
 * Returns the URL to directly view or download a document's raw PDF file,
 * with optional page deep linking (e.g. #page=3).
 */
export const getDocumentFileUrl = (docId: string, pageNumber?: number): string => {
  const base = `${API_BASE}/documents/${encodeURIComponent(docId)}/file`;
  return pageNumber ? `${base}#page=${pageNumber}` : base;
};

/**
 * Returns the URL to interactive Swagger API documentation (/docs).
 */
export const getDocsUrl = (): string => {
  if (isLocalMode()) {
    return 'http://127.0.0.1:8000/docs';
  }
  const root = API_BASE.replace(/\/api\/?$/, '');
  return `${root}/docs`;
};

/**
 * Extract clean, human-readable error messages from API responses,
 * including 502 Bad Gateway proxy errors and FastAPI detail objects.
 */
async function parseApiError(res: Response, defaultMessage: string): Promise<string> {
  if (res.status === 502) {
    return isLocalMode()
      ? 'Backend is unreachable (HTTP 502 Bad Gateway). Please ensure the FastAPI backend is running on 127.0.0.1:8000 via .\\start-dev.ps1.'
      : 'Backend service is temporarily unreachable (HTTP 502 Bad Gateway). If waking from sleep on Render, please wait 30–60 seconds and retry.';
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
    if (data && data.errors && Array.isArray(data.errors)) {
      return data.errors.join('; ');
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

/**
 * Normalizes low-level network errors and timeouts into actionable user-friendly messages.
 * Handles Render cold starts (waking up from idle), local backend offline, and AbortErrors.
 */
function formatNetworkError(err: any, fallbackMessage: string): Error {
  if (err?.name === 'AbortError') {
    if (err.message && err.message.toLowerCase().includes('timed out')) {
      return new Error(
        `${fallbackMessage}: Request timed out. If waking from sleep on Render, please wait 30–60 seconds and retry.`
      );
    }
    return err;
  }
  const msg = err?.message || '';
  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Network request failed') ||
    msg.includes('Load failed')
  ) {
    const detail = isLocalMode()
      ? 'Backend is offline or unreachable on 127.0.0.1:8000. Please start the backend service.'
      : 'Backend service is temporarily unreachable. If waking from sleep on Render, please wait 30–60 seconds and retry.';
    return new Error(`${fallbackMessage}: ${detail}`);
  }
  return new Error(msg || fallbackMessage);
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
    throw formatNetworkError(err, 'Cannot reach backend server');
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
    throw formatNetworkError(err, 'Readiness probe failed');
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
    throw formatNetworkError(err, 'Failed to fetch documents');
  }
}

export async function uploadDocument(
  file: File,
  signal?: AbortSignal
): Promise<{ message: string; document: DocumentItem; duplicate_detected: boolean }> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
      signal,
    });

    if (!res.ok) {
      const msg = await parseApiError(res, 'Upload failed');
      throw new Error(msg);
    }
    return await res.json();
  } catch (err: any) {
    throw formatNetworkError(err, 'Upload failed');
  }
}

export async function deleteDocument(docId: string, signal?: AbortSignal): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/documents/${docId}`, {
      method: 'DELETE',
      signal,
    });
    if (!res.ok) {
      const msg = await parseApiError(res, 'Failed to delete document');
      throw new Error(msg);
    }
  } catch (err: any) {
    throw formatNetworkError(err, 'Failed to delete document');
  }
}

export async function retryDocument(docId: string, signal?: AbortSignal): Promise<DocumentItem> {
  try {
    const res = await fetch(`${API_BASE}/documents/${docId}/retry`, {
      method: 'POST',
      signal,
    });
    if (!res.ok) {
      const msg = await parseApiError(res, 'Retry failed');
      throw new Error(msg);
    }
    return await res.json();
  } catch (err: any) {
    throw formatNetworkError(err, 'Retry failed');
  }
}

export async function searchDocuments(
  query: string,
  topK: number = 5,
  documentIds?: string[],
  signal?: AbortSignal
): Promise<SearchResponse> {
  try {
    const res = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        top_k: topK,
        document_ids: documentIds && documentIds.length > 0 ? documentIds : undefined,
      }),
      signal,
    });

    if (!res.ok) {
      const msg = await parseApiError(res, 'Search query failed');
      throw new Error(msg);
    }
    return await res.json();
  } catch (err: any) {
    throw formatNetworkError(err, 'Search query failed');
  }
}

export async function chatWithDocuments(
  question: string,
  history: { role: string; content: string }[] = [],
  topK: number = 5,
  documentIds?: string[],
  mode: ChatMode = 'notes',
  signal?: AbortSignal
): Promise<ChatResponse> {
  try {
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
      signal,
    });

    if (!res.ok) {
      const msg = await parseApiError(res, 'AI Chat failed');
      throw new Error(msg);
    }
    return await res.json();
  } catch (err: any) {
    throw formatNetworkError(err, 'AI Chat failed');
  }
}
