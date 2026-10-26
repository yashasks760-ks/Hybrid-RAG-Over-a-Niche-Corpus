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
    <div className="max-w-5xl mx-auto py-4 sm:py-8 px-2.5 sm:px-4 space-y-4 sm:space-y-6 animate-fade-in">
      {/* Search Header & Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-8 shadow-xl">
        <div className="mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-sky-400 flex-shrink-0" />
            <span>Hybrid Document Search</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
            Combines dense vector embeddings with exact BM25 keyword matching via Reciprocal Rank Fusion (RRF). Zero LLM cost.
          </p>
        </div>

        {!isBackendHealthy && (
          <div className="mb-4 p-3 sm:p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 text-xs text-rose-200">
            <div className="flex items-start sm:items-center gap-2 min-w-0 break-words">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5 sm:mt-0" />
              <span className="leading-relaxed">
                <strong>Backend Offline:</strong>{' '}
                {isLocalMode() ? (
                  <>
                    Start FastAPI on <code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono text-[11px] sm:text-xs break-all">127.0.0.1:8000</code> via <code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono font-semibold text-[11px] sm:text-xs break-all">.\start-dev.ps1</code> to search.
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
                className="w-full sm:w-auto flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-medium transition-colors cursor-pointer flex-shrink-0 min-h-[36px]"
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
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 absolute left-3 sm:left-4 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isSearching || !isBackendHealthy}
            placeholder={
              !isBackendHealthy
                ? 'Backend offline — Start with .\\start-dev.ps1...'
                : "Search keywords ('3NF', 'ACID') or natural questions..."
            }
            className="w-full pl-9 sm:pl-12 pr-20 sm:pr-28 py-2.5 sm:py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-xs sm:text-sm shadow-inner transition-colors disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
          />
          <button
            type="submit"
            disabled={isSearching || !isBackendHealthy || !query.trim()}
            className="absolute right-1.5 sm:right-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-semibold text-xs rounded-lg transition-all shadow-md min-h-[36px] sm:min-h-[40px] flex items-center justify-center cursor-pointer"
            title={!isBackendHealthy ? 'Backend is offline' : 'Search documents'}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Preset Query Chips */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-800/80">
          <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
            <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
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
              className={`text-[11px] sm:text-xs px-2.5 py-1 rounded-md border transition-colors min-h-[30px] flex items-center ${
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
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-medium">
            <Clock className="w-4 h-4 text-sky-400 flex-shrink-0" />
            <span>Retrieved {searchResponse.total_results} passages in</span>
            <span className="text-sky-300 font-bold font-mono">
              {searchResponse.latency.total_ms.toFixed(1)} ms
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-slate-500 font-mono text-[11px] sm:text-xs">
            <span>Embed: {searchResponse.latency.query_embedding_ms.toFixed(1)}ms</span>
            <span>&bull;</span>
            <span>Qdrant: {searchResponse.latency.semantic_search_ms.toFixed(1)}ms</span>
            <span>&bull;</span>
            <span>BM25: {searchResponse.latency.keyword_search_ms.toFixed(1)}ms</span>
            <span>&bull;</span>
            <span>RRF: {searchResponse.latency.fusion_ms.toFixed(1)}ms</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs sm:text-sm">
          {error}
        </div>
      )}

      {/* Search Results List */}
      {searchResponse && searchResponse.results.length === 0 && (
        <div className="text-center py-10 sm:py-12 border border-slate-800 rounded-xl bg-slate-900/40 px-3 sm:px-4">
          <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-300 font-medium text-sm sm:text-base">No passages matched your query</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Try adjusting keywords or ensure relevant documents are indexed in the library.
          </p>
        </div>
      )}

      {searchResponse && searchResponse.results.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          {searchResponse.results.map((res, index) => (
            <div
              key={res.chunk_id}
              onClick={() => onSelectSource(res)}
              className="group bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 sm:p-5 shadow-lg transition-all cursor-pointer min-w-0"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="w-6 h-6 rounded-md bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center font-bold flex-shrink-0">
                    #{index + 1}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white min-w-0 truncate">
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 flex-shrink-0" />
                    <span className="truncate">{res.filename}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-sky-300 text-[11px] sm:text-xs font-semibold border border-slate-700 flex-shrink-0">
                    Page {res.page_number}
                  </span>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  {getMethodBadge(res.retrieval_method)}
                  <span className="text-[11px] sm:text-xs text-slate-500 font-mono font-medium whitespace-nowrap">
                    Score: {res.score.toFixed(4)}
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-3 group-hover:text-slate-200 transition-colors">
                {res.text}
              </p>

              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/60 text-[11px] sm:text-xs text-slate-500">
                <span className="font-mono truncate max-w-[150px] sm:max-w-none">Chunk ID: {res.chunk_id}</span>
                <span className="text-sky-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-medium whitespace-nowrap">
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
