import React, { useState } from 'react';
import {
  Search,
  Zap,
  Clock,
  FileText,
  Bookmark,
  ExternalLink,
  ChevronRight,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { SearchResponse, SearchResultItem } from '../types';
import { searchDocuments, isLocalMode } from '../services/api';

interface SearchPanelProps {
  onSelectSource: (source: SearchResultItem) => void;
  documentCount: number;
  isBackendHealthy?: boolean;
  onRetryConnection?: () => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  onSelectSource,
  documentCount,
  isBackendHealthy = true,
  onRetryConnection,
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sampleQueries = [
    'What are ACID properties?',
    'Explain 3NF with examples',
    'Two-Phase Locking serializability',
    'React useEffect vs useLayoutEffect',
    'Deadlock four necessary conditions',
  ];

  const handleSearch = async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) return;

    setIsSearching(true);
    setError(null);

    try {
      const res = await searchDocuments(q, 5);
      setSearchResponse(res);
    } catch (err: any) {
      setError(err.message || 'Search execution failed');
    } finally {
      setIsSearching(false);
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'hybrid':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Hybrid (Vector + BM25)
          </span>
        );
      case 'semantic':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Semantic Vector
          </span>
        );
      case 'keyword':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            BM25 Keyword
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6 animate-fade-in">
        {/* Search Header & Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-sky-400" />
            Hybrid Document Search
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Combines dense vector embeddings with exact BM25 keyword matching via Reciprocal Rank Fusion (RRF). Zero LLM cost.
          </p>
        </div>

        {!isBackendHealthy && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between gap-3 text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>
                <strong>Backend Offline:</strong>{' '}
                {isLocalMode() ? (
                  <>
                    Start FastAPI on <code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono">127.0.0.1:8000</code> via <code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono font-semibold">.\start-dev.ps1</code> to search.
                  </>
                ) : (
                  <>AI backend service is unreachable. If waking from sleep on Render, click Retry.</>
                )}
              </span>
            </div>
            {onRetryConnection && (
              <button
                type="button"
                onClick={onRetryConnection}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-medium transition-colors cursor-pointer flex-shrink-0"
              >
                <Zap className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isBackendHealthy) handleSearch(query);
          }}
          className="relative flex items-center"
        >
          <Search className="w-5 h-5 text-slate-500 absolute left-4 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isSearching || !isBackendHealthy}
            placeholder={
              !isBackendHealthy
                ? 'Backend is offline — Start server with .\\start-dev.ps1 to search...'
                : "Search keywords ('3NF', 'JWT') or natural questions..."
            }
            className="w-full pl-12 pr-28 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm shadow-inner transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isSearching || !isBackendHealthy || !query.trim()}
            className="absolute right-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-semibold text-xs rounded-lg transition-all shadow-md"
            title={!isBackendHealthy ? 'Backend is offline' : 'Search documents'}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Preset Query Chips */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-800/80">
          <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Try:
          </span>
          {sampleQueries.map((sq, i) => (
            <button
              key={i}
              type="button"
              disabled={!isBackendHealthy}
              onClick={() => {
                if (isBackendHealthy) {
                  setQuery(sq);
                  handleSearch(sq);
                }
              }}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                isBackendHealthy
                  ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700/60 cursor-pointer'
                  : 'bg-slate-800/40 text-slate-500 border-slate-800 cursor-not-allowed opacity-60'
              }`}
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Latency & Telemetry Metrics */}
      {searchResponse && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-medium">
            <Clock className="w-4 h-4 text-sky-400" />
            <span>Retrieved {searchResponse.total_results} passages in</span>
            <span className="text-sky-300 font-bold font-mono">
              {searchResponse.latency.total_ms.toFixed(1)} ms
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-slate-500 font-mono">
            <span>Embed: {searchResponse.latency.query_embedding_ms.toFixed(1)}ms</span>
            <span>&bull;</span>
            <span>Qdrant: {searchResponse.latency.semantic_search_ms.toFixed(1)}ms</span>
            <span>&bull;</span>
            <span>BM25: {searchResponse.latency.keyword_search_ms.toFixed(1)}ms</span>
            <span>&bull;</span>
            <span>RRF Fusion: {searchResponse.latency.fusion_ms.toFixed(1)}ms</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Search Results List */}
      {searchResponse && searchResponse.results.length === 0 && (
        <div className="text-center py-12 border border-slate-800 rounded-xl bg-slate-900/40">
          <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-300 font-medium">No passages matched your query</p>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting keywords or ensure relevant documents are indexed in the library.
          </p>
        </div>
      )}

      {searchResponse && searchResponse.results.length > 0 && (
        <div className="space-y-4">
          {searchResponse.results.map((res, index) => (
            <div
              key={res.chunk_id}
              onClick={() => onSelectSource(res)}
              className="group bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl p-5 shadow-lg transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center font-bold">
                    #{index + 1}
                  </span>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <FileText className="w-4 h-4 text-sky-400" />
                    <span>{res.filename}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-sky-300 text-xs font-semibold border border-slate-700">
                    Page {res.page_number}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {getMethodBadge(res.retrieval_method)}
                  <span className="text-xs text-slate-500 font-mono font-medium">
                    Score: {res.score.toFixed(4)}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed line-clamp-3 group-hover:text-slate-200 transition-colors">
                {res.text}
              </p>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60 text-xs text-slate-500">
                <span className="font-mono">Chunk ID: {res.chunk_id}</span>
                <span className="text-sky-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-medium">
                  View full excerpt <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
