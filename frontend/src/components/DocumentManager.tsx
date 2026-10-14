import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  FileWarning,
  Sparkles,
} from 'lucide-react';
import { DocumentItem } from '../types';
import { uploadDocument, deleteDocument, retryDocument } from '../services/api';

interface DocumentManagerProps {
  documents: DocumentItem[];
  onRefresh: () => void;
  isLoading: boolean;
  isBackendHealthy?: boolean;
  onRetryConnection?: () => void;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  documents,
  onRefresh,
  isLoading,
  isBackendHealthy = true,
  onRetryConnection,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (file: File) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadMessage({ type: 'error', text: 'Only PDF documents (.pdf) are permitted.' });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadMessage({ type: 'error', text: 'File exceeds maximum permitted size of 15 MB.' });
      return;
    }

    setIsUploading(true);
    setUploadMessage(null);

    try {
      const res = await uploadDocument(file);
      if (res.duplicate_detected) {
        setUploadMessage({
          type: 'warning',
          text: `Duplicate detected: '${file.name}' has identical content to an already indexed document.`,
        });
      } else if (res.document.is_scanned) {
        setUploadMessage({
          type: 'warning',
          text: `Document uploaded: '${file.name}' appears to be a scanned image with minimal text. OCR recommended.`,
        });
      } else {
        setUploadMessage({
          type: 'success',
          text: `Indexed successfully: '${file.name}' with ${res.document.page_count} pages and ${res.document.chunk_count} chunks.`,
        });
      }
      onRefresh();
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: err.message || 'Failed to upload document',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (docId: string, filename: string) => {
    if (!window.confirm(`Permanently remove '${filename}' and its indexed vectors?`)) return;

    setDeletingId(docId);
    try {
      await deleteDocument(docId);
      onRefresh();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleRetry = async (docId: string) => {
    setRetryingId(docId);
    try {
      await retryDocument(docId);
      onRefresh();
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (doc: DocumentItem) => {
    switch (doc.status) {
      case 'indexed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Indexed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            Processing
          </span>
        );
      case 'scanned_needs_ocr':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <FileWarning className="w-3.5 h-3.5" />
            Scanned (Needs OCR)
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
            {doc.status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8 animate-fade-in">
      {/* Upload Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-sky-400" />
              Upload College Documents
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Upload syllabi, lecture notes, textbook chapters, or exam question papers in PDF format.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
            Max 15 MB / PDF
          </span>
        </div>

        {/* Status Alert Banner */}
        {!isBackendHealthy && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between gap-3 text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>
                <strong>Backend Offline:</strong> Ingestion is disabled. Start FastAPI on <code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono">127.0.0.1:8000</code> via <code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono font-semibold">.\start-dev.ps1</code> to upload documents.
              </span>
            </div>
            {onRetryConnection && (
              <button
                type="button"
                onClick={onRetryConnection}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-medium transition-colors cursor-pointer flex-shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        {/* Drag & Drop Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (isBackendHealthy) setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (isBackendHealthy && e.dataTransfer.files?.[0]) {
              handleFileChange(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => {
            if (isBackendHealthy) fileInputRef.current?.click();
          }}
          className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all ${
            !isBackendHealthy
              ? 'border-slate-800 bg-slate-950/30 cursor-not-allowed opacity-60'
              : dragActive
              ? 'border-sky-400 bg-sky-500/5 cursor-pointer'
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/70 cursor-pointer'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            disabled={!isBackendHealthy}
            className="hidden"
            onChange={(e) => {
              if (isBackendHealthy && e.target.files?.[0]) handleFileChange(e.target.files[0]);
            }}
          />

          <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 mx-auto flex items-center justify-center mb-4">
            {isUploading ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
              <FileText className="w-6 h-6" />
            )}
          </div>

          <h3 className="font-semibold text-white text-base">
            {!isBackendHealthy
              ? 'Document upload paused (Backend Offline)'
              : isUploading
              ? 'Extracting text & generating vectors...'
              : 'Click to select or drag PDF file here'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {!isBackendHealthy
              ? 'Run .\\start-dev.ps1 in PowerShell to reconnect database and enable indexing'
              : 'Preserves page numbers, splits into overlapping chunks, and creates BM25 & Qdrant indices'}
          </p>
        </div>

        {/* Status Alert Banner */}
        {uploadMessage && (
          <div
            className={`mt-4 p-4 rounded-xl text-sm border flex items-start gap-3 ${
              uploadMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : uploadMessage.type === 'warning'
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}
          >
            {uploadMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : uploadMessage.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            )}
            <div className="flex-1 leading-relaxed">{uploadMessage.text}</div>
            <button
              onClick={() => setUploadMessage(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              &times;
            </button>
          </div>
        )}
      </div>

      {/* Document Library Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Indexed Document Corpus ({documents.length})
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Available for exact keyword search and grounded conversational Q&A
            </p>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-12 border border-slate-800/80 rounded-xl bg-slate-950/30">
            {!isBackendHealthy ? (
              <div className="space-y-3 px-4">
                <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
                <p className="text-slate-200 font-semibold">Backend Offline — Documents Not Available</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  The API server on port 8000 is unreachable (HTTP 502). Start the backend with{' '}
                  <code className="bg-slate-800 text-rose-300 px-1.5 py-0.5 rounded font-mono">.\start-dev.ps1</code>{' '}
                  in PowerShell to retrieve existing files and index new PDFs.
                </p>
                {onRetryConnection && (
                  <button
                    onClick={onRetryConnection}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Connection</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-300 font-medium">No documents uploaded yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Upload your lecture notes or syllabus above to enable hybrid search and AI study answering.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Pages</th>
                  <th className="py-3 px-4">Chunks</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-800 text-sky-400">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-white truncate max-w-xs sm:max-w-md">
                            {doc.original_filename}
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">
                            ID: {doc.id.slice(0, 8)}... &bull; Hash: {doc.content_hash.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-300 font-medium">
                      {doc.page_count > 0 ? doc.page_count : '-'}
                    </td>
                    <td className="py-4 px-4 text-slate-300 font-medium">
                      {doc.chunk_count > 0 ? doc.chunk_count : '-'}
                    </td>
                    <td className="py-4 px-4 text-slate-400 text-xs font-mono">
                      {formatFileSize(doc.file_size_bytes)}
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(doc)}</td>
                    <td className="py-4 px-4 text-right space-x-2">
                      {doc.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(doc.id)}
                          disabled={retryingId === doc.id || !isBackendHealthy}
                          className="p-1.5 rounded-lg text-sky-400 hover:bg-sky-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={!isBackendHealthy ? 'Backend is offline' : 'Retry Ingestion'}
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${retryingId === doc.id ? 'animate-spin' : ''}`}
                          />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(doc.id, doc.original_filename)}
                        disabled={deletingId === doc.id || !isBackendHealthy}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!isBackendHealthy ? 'Backend is offline' : 'Delete Document'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
