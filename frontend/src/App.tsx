import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { DocumentManager } from './components/DocumentManager';
import { SearchPanel } from './components/SearchPanel';
import { ChatPanel } from './components/ChatPanel';
import { SourceModal } from './components/SourceModal';
import { DocumentItem, SearchResultItem, CitationItem } from './types';
import { fetchDocuments, checkHealth, isLocalMode } from './services/api';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'search' | 'documents'>('chat');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean>(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);
  const [hasAttemptedInitialCheck, setHasAttemptedInitialCheck] = useState<boolean>(false);
  const [selectedSource, setSelectedSource] = useState<SearchResultItem | CitationItem | null>(null);

  const prevHealthyRef = useRef<boolean>(false);

  const loadDocuments = useCallback(async () => {
    setIsLoadingDocs(true);
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (err: any) {
      console.warn('Document library unreachable while backend is offline:', err.message);
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  const verifyHealth = useCallback(
    async (isManualRetry = false): Promise<boolean> => {
      setIsCheckingHealth(true);
      const controller = new AbortController();
      const timeoutMs = isManualRetry ? 12000 : (isLocalMode() ? 5000 : 10000);
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await checkHealth(controller.signal);
        clearTimeout(timeoutId);
        const healthy = res && res.status === 'healthy';
        setIsBackendHealthy(healthy);
        setHasAttemptedInitialCheck(true);

        // If backend just recovered or user explicitly clicked retry
        if (healthy && (!prevHealthyRef.current || isManualRetry)) {
          await loadDocuments();
        }
        prevHealthyRef.current = healthy;
        return healthy;
      } catch {
        clearTimeout(timeoutId);
        setIsBackendHealthy(false);
        setHasAttemptedInitialCheck(true);
        prevHealthyRef.current = false;
        return false;
      } finally {
        setIsCheckingHealth(false);
      }
    },
    [loadDocuments]
  );

  const handleRetryConnection = useCallback(async () => {
    await verifyHealth(true);
  }, [verifyHealth]);

  useEffect(() => {
    // Immediate initial check
    verifyHealth(false);

    // Periodic health check every 20 seconds with proper interval cleanup
    const interval = setInterval(() => {
      verifyHealth(false);
    }, 20000);

    return () => clearInterval(interval);
  }, [verifyHealth]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/20 selection:text-sky-300">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        documentCount={documents.length}
        isBackendHealthy={isBackendHealthy}
        isCheckingHealth={isCheckingHealth}
        onRetryConnection={handleRetryConnection}
      />

      {/* Backend Disconnected Warning Banner */}
      {!isBackendHealthy && hasAttemptedInitialCheck && (
        <div className="bg-rose-950/40 border-b border-rose-500/30 px-4 py-3 sm:py-3.5 backdrop-blur-md animate-fade-in">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-start sm:items-center gap-3 text-rose-200">
              <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 flex-shrink-0 mt-0.5 sm:mt-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-rose-100">
                  {isLocalMode() ? 'Local Backend Offline:' : 'AI Backend Service Disconnected:'}
                </span>{' '}
                <span className="text-rose-200/90">
                  {isLocalMode() ? (
                    <>
                      Cannot reach local FastAPI on{' '}
                      <code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono text-xs">127.0.0.1:8000</code>.
                      Run{' '}
                      <code className="bg-rose-900/80 text-rose-100 px-1.5 py-0.5 rounded font-mono text-xs border border-rose-500/30 font-semibold">
                        .\start-dev.ps1
                      </code>{' '}
                      in PowerShell to start the backend and embedded database.
                    </>
                  ) : (
                    <>
                      Cannot reach the cloud backend service. If the server is waking up from idle on Render, this may take 30–60 seconds.
                      Please click <strong className="text-rose-100 font-semibold">Retry Connection</strong> to reconnect.
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
              <button
                onClick={handleRetryConnection}
                disabled={isCheckingHealth}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 font-medium transition-all text-xs disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                <span>{isCheckingHealth ? 'Checking...' : 'Retry Connection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 overflow-x-hidden">
        {activeTab === 'chat' && (
          <ChatPanel
            onSelectCitation={(cite) => setSelectedSource(cite)}
            documentCount={documents.length}
            isBackendHealthy={isBackendHealthy}
            onRetryConnection={handleRetryConnection}
          />
        )}

        {activeTab === 'search' && (
          <SearchPanel
            onSelectSource={(source) => setSelectedSource(source)}
            documentCount={documents.length}
            isBackendHealthy={isBackendHealthy}
            onRetryConnection={handleRetryConnection}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentManager
            documents={documents}
            onRefresh={loadDocuments}
            isLoading={isLoadingDocs}
            isBackendHealthy={isBackendHealthy}
            onRetryConnection={handleRetryConnection}
          />
        )}
      </main>

      {/* Floating Modal for Citation & Source Verification */}
      <SourceModal
        source={selectedSource}
        onClose={() => setSelectedSource(null)}
      />
    </div>
  );
};

export default App;
