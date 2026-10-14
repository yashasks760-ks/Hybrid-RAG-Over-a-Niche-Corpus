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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base leading-tight truncate max-w-md">
                {filename}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-sky-300 font-medium border border-slate-700">
                  Page {pageNumber}
                </span>
                {isSearchResult && (
                  <span className="text-slate-500">
                    Chunk #{(source as SearchResultItem).chunk_index} &bull; Score:{' '}
                    {(source as SearchResultItem).score}
                  </span>
                )}
                {isVerified && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Bookmark className="w-3.5 h-3.5 text-sky-400" />
            <span>Extracted Passage & Provenance</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-sm leading-relaxed text-slate-200 font-normal whitespace-pre-wrap selection:bg-sky-500/30">
            {text}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            {docId ? (
              <a
                href={getDocumentFileUrl(docId, pageNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-xs font-semibold transition-all shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open PDF (Page {pageNumber})</span>
              </a>
            ) : (
              <span>Source Grounding Verification</span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
