import React from 'react';
import { BookOpen, Search, MessageSquare, Files, ExternalLink, RefreshCw } from 'lucide-react';

interface NavbarProps {
  activeTab: 'chat' | 'search' | 'documents';
  setActiveTab: (tab: 'chat' | 'search' | 'documents') => void;
  documentCount: number;
  isBackendHealthy: boolean;
  isCheckingHealth?: boolean;
  onRetryConnection?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  documentCount,
  isBackendHealthy,
  isCheckingHealth = false,
  onRetryConnection,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">College AI</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Knowledge Assistant
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Hybrid RAG &bull; Page-Aware Provenance</p>
          </div>
        </div>

        {/* Mode Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'chat'
                ? 'bg-sky-500 text-slate-950 shadow-md font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>AI Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'search'
                ? 'bg-sky-500 text-slate-950 shadow-md font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'documents'
                ? 'bg-sky-500 text-slate-950 shadow-md font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Files className="w-4 h-4" />
            <span>Library</span>
            <span
              className={`text-xs px-1.5 py-0.2 rounded-full ${
                activeTab === 'documents'
                  ? 'bg-slate-900 text-sky-400 font-bold'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {documentCount}
            </span>
          </button>
        </nav>

        {/* Backend Status & API link */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                isBackendHealthy
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : isCheckingHealth
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
              }`}
            />
            <span className="text-slate-300">
              {isBackendHealthy
                ? 'API Connected'
                : isCheckingHealth
                ? 'Connecting...'
                : 'API Offline'}
            </span>
            {onRetryConnection && !isBackendHealthy && (
              <button
                onClick={onRetryConnection}
                disabled={isCheckingHealth}
                className="ml-1 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-300 transition-colors"
                title="Retry backend health check"
              >
                <RefreshCw className={`w-3 h-3 ${isCheckingHealth ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          <a
            href="http://127.0.0.1:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-400 transition-colors px-2 py-1"
            title="Interactive Swagger API Documentation"
          >
            <span>Swagger API</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
