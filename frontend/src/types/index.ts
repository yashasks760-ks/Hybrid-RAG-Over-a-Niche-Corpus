export interface DocumentItem {
  id: string;
  filename: string;
  original_filename: string;
  file_size_bytes: number;
  content_hash: string;
  page_count: number;
  chunk_count: number;
  status: 'uploaded' | 'processing' | 'indexed' | 'scanned_needs_ocr' | 'failed';
  is_scanned: boolean;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchResultItem {
  chunk_id: string;
  doc_id: string;
  document_id?: string;
  filename: string;
  page_number: number;
  chunk_index: number;
  text: string;
  score: number;
  retrieval_method: 'semantic' | 'keyword' | 'hybrid';
  metadata?: Record<string, any>;
}

export interface SearchLatency {
  query_embedding_ms: number;
  semantic_search_ms: number;
  keyword_search_ms: number;
  fusion_ms: number;
  total_ms: number;
}

export interface SearchResponse {
  query: string;
  total_results: number;
  results: SearchResultItem[];
  latency: SearchLatency;
}

export interface CitationItem {
  source_id: string;
  document_id?: string;
  filename: string;
  page_number: number;
  excerpt: string;
  verified: boolean;
}

export type ChatMode = 'notes' | 'general' | 'web';

export interface WebSourceItem {
  title: string;
  url: string;
  snippet: string;
  score?: number | null;
}

export interface ChatLatency {
  retrieval_ms: number;
  llm_generation_ms: number;
  total_ms: number;
}

export interface ChatResponse {
  answer: string;
  citations: CitationItem[];
  evidence_found: boolean;
  sources: SearchResultItem[];
  web_sources?: WebSourceItem[];
  latency: ChatLatency;
  provider_used?: string;
  model_used?: string;
  mode?: ChatMode;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode?: ChatMode;
  citations?: CitationItem[];
  sources?: SearchResultItem[];
  web_sources?: WebSourceItem[];
  latency?: ChatLatency;
  evidence_found?: boolean;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  mode: ChatMode;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

