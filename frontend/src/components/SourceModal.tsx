import React from 'react';
import { X, FileText, Bookmark, ExternalLink, ShieldCheck } from 'lucide-react';
import { SearchResultItem, CitationItem } from '../types';
import { getDocumentFileUrl } from '../services/api';

interface SourceModalProps {
  source: SearchResultItem | CitationItem | null;
  onClose: () => void;
}

export const SourceModal: React.FC<SourceModalProps> = ({ source, onClose }) => {
  if (!source) return null;

  const isSearchResult = 'chunk_id' in source;
  const filename = source.filename;
  const pageNumber = source.page_number;
  const text = isSearchResult ? (source as SearchResultItem).text : (source as CitationItem).excerpt;
  const docId = source.document_id || (source as any).doc_id;
  const isVerified = (source as CitationItem).verified ?? true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      {/* Backdrop click to dismiss */}
      <div
        className="fixed inset-0 bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[85vh] z-10">
        {/* Modal Header */}
        <div className="flex items-start justify-between px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-900/60 gap-3">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex-shrink-0 mt-0.5">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-white text-sm sm:text-base leading-tight break-all sm:truncate max-w-xs sm:max-w-md">
                {filename}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1 text-[11px] sm:text-xs text-slate-400">
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-sky-300 font-medium border border-slate-700 whitespace-nowrap">
                  Page {pageNumber}
                </span>
                {isSearchResult && (
                  <span className="text-slate-500 whitespace-nowrap">
                    Chunk #{(source as SearchResultItem).chunk_index} &bull; Score:{' '}
                    {(source as SearchResultItem).score.toFixed(4)}
                  </span>
                )}
                {isVerified && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium whitespace-nowrap">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified Source
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center flex-shrink-0"
            aria-label="Close excerpt modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Bookmark className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <span>Extracted Passage & Provenance</span>
          </div>

          <div className="p-3 sm:p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs sm:text-sm leading-relaxed text-slate-200 font-normal whitespace-pre-wrap selection:bg-sky-500/30 break-words">
            {text}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-3.5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/50 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-400">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {docId ? (
              <a
                href={getDocumentFileUrl(docId, pageNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-xs font-semibold transition-all shadow-sm min-h-[38px]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open PDF (Page {pageNumber})</span>
              </a>
            ) : (
              <span className="text-[11px] text-slate-500">Source Grounding Verification</span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium cursor-pointer min-h-[38px] text-center"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SourceModal;
