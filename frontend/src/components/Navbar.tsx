import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  MessageSquare,
  Files,
  ExternalLink,
  RefreshCw,
  Menu,
  X,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { getDocsUrl } from '../services/api';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSelectTab = (tab: 'chat' | 'search' | 'documents') => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Main Header Bar */}
        <div className="h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Brand */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 flex-shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-base sm:text-lg text-white tracking-tight truncate">
                  College AI
                </span>
                <span className="hidden min-[400px]:inline-block text-[11px] sm:text-xs px-2 py-0.5 rounded-full font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 whitespace-nowrap">
                  Knowledge Assistant
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block truncate">
                Hybrid RAG &bull; Page-Aware Provenance
              </p>
            </div>
          </div>

          {/* Desktop Mode Navigation Tabs (md and up) */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-sky-500 text-slate-950 shadow-md font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>AI Chat</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-sky-500 text-slate-950 shadow-md font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
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

          {/* Right Controls: Backend Status, Swagger Link, Mobile Menu Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {/* Backend Status Pill */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 transition-all ${
                  isBackendHealthy
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                    : isCheckingHealth
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                }`}
              />
              <span className="text-slate-300 text-[11px] sm:text-xs whitespace-nowrap">
                {isBackendHealthy
                  ? 'API Connected'
                  : isCheckingHealth
                  ? 'Connecting...'
                  : 'API Offline'}
              </span>
              {onRetryConnection && !isBackendHealthy && (
                <button
                  type="button"
                  onClick={onRetryConnection}
                  disabled={isCheckingHealth}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-300 transition-colors cursor-pointer"
                  title="Retry backend health check"
                  aria-label="Retry backend connection"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {/* Swagger Link (Desktop) */}
            <a
              href={getDocsUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-400 transition-colors px-2 py-1"
              title="Interactive Swagger API Documentation"
            >
              <span>Swagger API</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center min-w-[40px] min-h-[40px]"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-sky-400" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Sub-Header: Segmented Tab Bar (md:hidden) */}
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden py-1.5 border-t border-slate-800/80"
        >
          <div className="grid grid-cols-3 gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => handleSelectTab('chat')}
              className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[40px] ${
                activeTab === 'chat'
                  ? 'bg-sky-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Chat</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('search')}
              className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[40px] ${
                activeTab === 'search'
                  ? 'bg-sky-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Search</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('documents')}
              className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[40px] ${
                activeTab === 'documents'
                  ? 'bg-sky-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Files className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Library</span>
              <span
                className={`text-[10px] px-1 py-0.2 rounded-full leading-none font-bold ${
                  activeTab === 'documents'
                    ? 'bg-slate-950 text-sky-400'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {documentCount}
              </span>
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile Drawer / Slide-Over Menu (md:hidden) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-sm bg-slate-900 border-b border-slate-800 shadow-2xl z-50 flex flex-col p-4 space-y-4 max-h-[85dvh] overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">College AI Menu</h3>
                  <p className="text-[11px] text-slate-400">Hybrid RAG Knowledge Assistant</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Options with Descriptions */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 pb-1">
                Navigation
              </div>

              <button
                type="button"
                onClick={() => handleSelectTab('chat')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all cursor-pointer min-h-[48px] ${
                  activeTab === 'chat'
                    ? 'bg-sky-500/20 border border-sky-500/40 text-white'
                    : 'bg-slate-950/60 border border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    activeTab === 'chat'
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm">AI Chat</div>
                  <div className="text-xs text-slate-400 truncate">
                    Grounded answers from your uploaded notes
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('search')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all cursor-pointer min-h-[48px] ${
                  activeTab === 'search'
                    ? 'bg-sky-500/20 border border-sky-500/40 text-white'
                    : 'bg-slate-950/60 border border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    activeTab === 'search'
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Search className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm">Hybrid Search</div>
                  <div className="text-xs text-slate-400 truncate">
                    Instant Vector + BM25 keyword matching
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('documents')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all cursor-pointer min-h-[48px] ${
                  activeTab === 'documents'
                    ? 'bg-sky-500/20 border border-sky-500/40 text-white'
                    : 'bg-slate-950/60 border border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    activeTab === 'documents'
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Files className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Document Library</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 font-bold">
                      {documentCount}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    Upload & manage lecture notes & syllabi
                  </div>
                </div>
              </button>
            </div>

            {/* Developer & API Section */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2">
                Developer Documentation
              </div>
              <a
                href={getDocsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-300 hover:text-sky-300 hover:border-slate-700 transition-all text-xs font-medium cursor-pointer min-h-[44px]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-sky-500/10 text-sky-400 flex items-center justify-center">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                  <span>Interactive Swagger API Docs</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              </a>
            </div>

            {/* Backend Health Status Card */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Backend Status</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isBackendHealthy
                        ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                        : isCheckingHealth
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                    }`}
                  />
                  <span
                    className={`font-semibold ${
                      isBackendHealthy
                        ? 'text-emerald-400'
                        : isCheckingHealth
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {isBackendHealthy
                      ? 'Connected'
                      : isCheckingHealth
                      ? 'Connecting...'
                      : 'Offline'}
                  </span>
                </div>
              </div>

              {onRetryConnection && !isBackendHealthy && (
                <button
                  type="button"
                  onClick={() => {
                    onRetryConnection();
                  }}
                  disabled={isCheckingHealth}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-semibold transition-all cursor-pointer min-h-[40px]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                  <span>{isCheckingHealth ? 'Checking Status...' : 'Retry Connection'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
