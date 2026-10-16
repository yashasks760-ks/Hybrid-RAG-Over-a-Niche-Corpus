import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  User,
  Bot,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Clock,
  Bookmark,
  AlertCircle,
  FileText,
  ChevronRight,
  GraduationCap,
  Brain,
  Globe,
  ExternalLink,
  History,
  Trash2,
  Plus,
  X,
  FileSearch,
  ShieldCheck,
} from 'lucide-react';
import {
  ChatMessage,
  CitationItem,
  SearchResultItem,
  ChatMode,
  Conversation,
} from '../types';
import { chatWithDocuments, getDocumentFileUrl, isLocalMode } from '../services/api';
import {
  loadConversations,
  saveConversation,
  deleteConversation,
  createConversation,
  getActiveConversationId,
  setActiveConversationId,
  clearAllConversations,
} from '../services/chatStorage';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatPanelProps {
  onSelectCitation: (citation: CitationItem | SearchResultItem) => void;
  documentCount: number;
  isBackendHealthy?: boolean;
  onRetryConnection?: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  onSelectCitation,
  documentCount,
  isBackendHealthy = true,
  onRetryConnection,
}) => {
  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Active chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [mode, setMode] = useState<ChatMode>('notes');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested prompts per mode
  const modePrompts: Record<ChatMode, string[]> = {
    notes: [
      'What are the ACID properties in transaction management?',
      'Explain Database Normalization and why 3NF is important.',
      'How does Two-Phase Locking prevent concurrency anomalies?',
      'What are the 4 conditions necessary for Deadlock to occur?',
    ],
    general: [
      'Explain Python loops with beginner-friendly examples.',
      'Explain C++ pointers, references, and memory layout.',
      'Write a 5-mark university exam answer for Normalization vs Denormalization.',
      'Generate 3 practice MCQs on OS Virtual Memory with answer keys.',
    ],
    web: [
      'What are the latest features and changes in React 19?',
      'FastAPI async performance benchmarks and recent best practices.',
      'What are the latest releases and updates in Qdrant vector database?',
      'Current trends and benchmarks in Hybrid RAG architectures in 2026.',
    ],
  };

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    const stored = loadConversations();
    setConversations(stored);

    const savedActiveId = getActiveConversationId();
    if (savedActiveId && stored.some((c) => c.id === savedActiveId)) {
      const active = stored.find((c) => c.id === savedActiveId)!;
      setActiveConvId(active.id);
      setMessages(active.messages);
      setMode(active.mode);
    } else if (stored.length > 0) {
      setActiveConvId(stored[0].id);
      setMessages(stored[0].messages);
      setMode(stored[0].mode);
      setActiveConversationId(stored[0].id);
    } else {
      // Create first initial conversation
      const initial = createConversation('notes', 'New Chat');
      setConversations([initial]);
      setActiveConvId(initial.id);
      setMessages([]);
      setMode('notes');
      setActiveConversationId(initial.id);
    }
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Adjust textarea height automatically
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputQuestion(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  // Start a new conversation
  const handleNewChat = (newMode: ChatMode = mode) => {
    const newConv = createConversation(newMode, 'New Chat');
    const updated = [newConv, ...conversations];
    setConversations(updated);
    setActiveConvId(newConv.id);
    setMessages([]);
    setMode(newMode);
    setInputQuestion('');
    setActiveConversationId(newConv.id);
    setIsHistoryOpen(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Switch to an existing conversation
  const handleSelectConversation = (conv: Conversation) => {
    setActiveConvId(conv.id);
    setMessages(conv.messages);
    setMode(conv.mode);
    setActiveConversationId(conv.id);
    setIsHistoryOpen(false);
  };

  // Delete a specific conversation
  const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deleteConversation(id);
    setConversations(updated);

    if (activeConvId === id) {
      if (updated.length > 0) {
        setActiveConvId(updated[0].id);
        setMessages(updated[0].messages);
        setMode(updated[0].mode);
        setActiveConversationId(updated[0].id);
      } else {
        const fresh = createConversation(mode, 'New Chat');
        setConversations([fresh]);
        setActiveConvId(fresh.id);
        setMessages([]);
        setActiveConversationId(fresh.id);
      }
    }
  };

  // Clear all conversations
  const handleClearAllHistory = () => {
    if (window.confirm('Are you sure you want to clear all stored chat history? This cannot be undone.')) {
      clearAllConversations();
      const fresh = createConversation(mode, 'New Chat');
      setConversations([fresh]);
      setActiveConvId(fresh.id);
      setMessages([]);
      setActiveConversationId(fresh.id);
      setIsHistoryOpen(false);
    }
  };

  // Change active mode
  const handleModeChange = (newMode: ChatMode) => {
    setMode(newMode);
    // If conversation is empty, update conversation mode too
    if (messages.length === 0 && activeConvId) {
      const updated = conversations.map((c) =>
        c.id === activeConvId ? { ...c, mode: newMode } : c
      );
      setConversations(updated);
      const current = updated.find((c) => c.id === activeConvId);
      if (current) saveConversation(current);
    }
  };

  const getPlaceholder = () => {
    switch (mode) {
      case 'notes':
        return documentCount > 0
          ? 'Ask a question grounded in your uploaded college notes (e.g. ACID properties)...'
          : 'Upload PDFs in Library tab first, then ask questions grounded in your notes...';
      case 'general':
        return 'Ask any programming, academic, or exam preparation question...';
      case 'web':
        return 'Search live web for current tech docs, updates, and articles...';
    }
  };

  const getLoadingText = () => {
    switch (mode) {
      case 'notes':
        return 'Retrieving hybrid passages & generating citation-grounded response...';
      case 'general':
        return 'Synthesizing comprehensive explanation with Gemini...';
      case 'web':
        return 'Searching live web & synthesizing verified sources...';
    }
  };

  // Send message
  const handleSend = async (questionText?: string) => {
    const q = (questionText || inputQuestion).trim();
    if (!q || isLoading) return;

    const currentMode = mode;
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: q,
      mode: currentMode,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputQuestion('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    // Auto-update conversation title if it's the first question
    let activeConv = conversations.find((c) => c.id === activeConvId);
    let titleToSet = activeConv?.title || 'New Chat';
    if (!activeConv || activeConv.messages.length === 0 || activeConv.title === 'New Chat') {
      titleToSet = q.length > 36 ? `${q.slice(0, 36).trim()}...` : q;
    }

    try {
      // Build conversation history payload preserving past turns
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await chatWithDocuments(q, historyPayload, 5, undefined, currentMode);

      const assistantMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: res.mode || currentMode,
        citations: res.citations,
        sources: res.sources,
        web_sources: res.web_sources,
        latency: res.latency,
        evidence_found: res.evidence_found,
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      // Persist to localStorage
      const updatedConv: Conversation = {
        id: activeConvId || `conv_${Date.now()}`,
        title: titleToSet,
        mode: currentMode,
        createdAt: activeConv?.createdAt || Date.now(),
        updatedAt: Date.now(),
        messages: finalMessages,
      };

      const savedList = saveConversation(updatedConv);
      setConversations(savedList);
      if (!activeConvId) {
        setActiveConvId(updatedConv.id);
        setActiveConversationId(updatedConv.id);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to generate answer'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: currentMode,
        error: err.message,
      };

      const finalMessages = [...updatedMessages, errorMsg];
      setMessages(finalMessages);

      const updatedConv: Conversation = {
        id: activeConvId || `conv_${Date.now()}`,
        title: titleToSet,
        mode: currentMode,
        createdAt: activeConv?.createdAt || Date.now(),
        updatedAt: Date.now(),
        messages: finalMessages,
      };

      const savedList = saveConversation(updatedConv);
      setConversations(savedList);
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isBackendHealthy && !isLoading) {
        handleSend();
      }
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to extract hostname for web link chips
  const extractDomain = (urlStr: string) => {
    try {
      return new URL(urlStr).hostname.replace('www.', '');
    } catch {
      return 'web';
    }
  };

  // Handler for in-markdown citation clicks
  const handleInTextCitationClick = (filename: string, pageNumber: number) => {
    // Find matching citation item if exists in current messages
    for (const msg of messages) {
      if (msg.citations) {
        const found = msg.citations.find(
          (c) => c.filename.toLowerCase() === filename.toLowerCase() && c.page_number === pageNumber
        );
        if (found) {
          onSelectCitation(found);
          return;
        }
      }
    }
    // Fallback synthetic citation item
    onSelectCitation({
      source_id: filename,
      filename,
      page_number: pageNumber,
      excerpt: `Referenced citation on page ${pageNumber} of ${filename}.`,
      verified: true,
    });
  };

  return (
    <div className="relative max-w-5xl mx-auto py-5 px-4 flex flex-col h-[calc(100vh-5rem)]">
      {/* History Slide-over Drawer / Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsHistoryOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-full max-w-xs bg-slate-900 border-r border-slate-800 flex flex-col z-50 shadow-2xl h-full animate-fade-in">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-sky-400" />
                <h3 className="font-semibold text-white text-sm">Chat History</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-800">
              <button
                type="button"
                onClick={() => handleNewChat()}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Conversation</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {conversations.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No conversation history yet
                </div>
              ) : (
                conversations.map((c) => {
                  const isActive = c.id === activeConvId;
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectConversation(c)}
                      className={`group relative flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-all border ${
                        isActive
                          ? 'bg-slate-800/90 border-sky-500/50 text-white font-medium shadow-sm'
                          : 'bg-slate-900/60 hover:bg-slate-800/50 border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate mr-2">
                        <MessageSquare
                          className={`w-3.5 h-3.5 flex-shrink-0 ${
                            isActive ? 'text-sky-400' : 'text-slate-500'
                          }`}
                        />
                        <div className="truncate">
                          <p className="truncate text-xs">{c.title || 'Untitled Chat'}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                            <span className="capitalize">{c.mode}</span>
                            <span>&bull;</span>
                            <span>{c.messages.length} msgs</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(e, c.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-300 transition-all cursor-pointer flex-shrink-0"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500">
              <span title="Stored locally in browser localStorage">Saved in browser storage</span>
              {conversations.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllHistory}
                  className="text-rose-400/80 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium"
            title="Open Chat History"
          >
            <History className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">History</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-400 font-mono">
              {conversations.length}
            </span>
          </button>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white leading-tight">AI Study Assistant</h2>
              {activeConvId && (
                <span className="text-xs text-slate-400 truncate max-w-[200px] hidden md:inline">
                  &bull; {conversations.find((c) => c.id === activeConvId)?.title || 'New Chat'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {mode === 'notes' && 'Strictly grounded in uploaded college materials & citations'}
              {mode === 'general' && 'General AI tutor for coding, CS concepts & exam prep'}
              {mode === 'web' && 'Real-time live web search with verified sources'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleNewChat()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-semibold transition-colors border border-sky-500/30 cursor-pointer"
            title="Start a new chat session"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Mode Selector Navigation */}
      <div className="py-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2 p-1 bg-slate-900/90 border border-slate-800 rounded-xl overflow-x-auto">
          {/* Notes Mode */}
          <button
            type="button"
            onClick={() => handleModeChange('notes')}
            className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'notes'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm shadow-sky-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <GraduationCap className={`w-4 h-4 ${mode === 'notes' ? 'text-sky-400' : 'text-slate-500'}`} />
            <span>College Notes</span>
          </button>

          {/* General Learning Mode */}
          <button
            type="button"
            onClick={() => handleModeChange('general')}
            className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'general'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm shadow-indigo-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Brain className={`w-4 h-4 ${mode === 'general' ? 'text-indigo-400' : 'text-slate-500'}`} />
            <span>General Learning</span>
          </button>

          {/* Web Search Mode */}
          <button
            type="button"
            onClick={() => handleModeChange('web')}
            className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'web'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Globe className={`w-4 h-4 ${mode === 'web' ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span>Web Search</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        {messages.length === 0 ? (
          <div className="text-center py-8 px-4 max-w-lg mx-auto">
            <div
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center mx-auto mb-4 shadow-lg ${
                mode === 'notes'
                  ? 'bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border-sky-500/30 text-sky-400 shadow-sky-500/10'
                  : mode === 'general'
                  ? 'bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-400 shadow-indigo-500/10'
                  : 'bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10'
              }`}
            >
              {mode === 'notes' && <GraduationCap className="w-6 h-6" />}
              {mode === 'general' && <Brain className="w-6 h-6" />}
              {mode === 'web' && <Globe className="w-6 h-6" />}
            </div>

            <h3 className="text-lg font-bold text-white mb-2">
              {mode === 'notes' && 'College Notes Assistant'}
              {mode === 'general' && 'General AI Academic Mentor'}
              {mode === 'web' && 'Live Web Search Assistant'}
            </h3>

            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              {mode === 'notes' &&
                'Every factual statement is backed by verifiable citations directly referencing your uploaded PDFs and exact page numbers.'}
              {mode === 'general' &&
                'Ask about any CS concept, programming language, algorithm, or university exam question. Gemini explains with examples and practice quizzes.'}
              {mode === 'web' &&
                'Search the live internet for recent documentation, real URLs, tech releases, and latest verified references.'}
            </p>

            {!isBackendHealthy && (
              <div className="mb-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between gap-3 text-xs text-rose-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>
                    <strong>Backend Offline:</strong>{' '}
                    {isLocalMode() ? (
                      <>
                        Start FastAPI on{' '}
                        <code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono">127.0.0.1:8000</code>{' '}
                        via <code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono font-semibold">.\start-dev.ps1</code> to enable AI answers.
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
                    <RotateCcw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2 text-left">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                <span>Suggested Prompts ({mode.toUpperCase()})</span>
              </div>
              {modePrompts[mode].map((p, idx) => (
                <button
                  key={idx}
                  disabled={!isBackendHealthy}
                  onClick={() => isBackendHealthy && handleSend(p)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between group ${
                    isBackendHealthy
                      ? 'bg-slate-900 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white cursor-pointer'
                      : 'bg-slate-900/50 border-slate-800/60 text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  <span className="truncate">{p}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 sm:gap-4 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div
                  className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center border mt-1 ${
                    msg.mode === 'web'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : msg.mode === 'general'
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                  }`}
                >
                  {msg.mode === 'web' ? (
                    <Globe className="w-4 h-4" />
                  ) : msg.mode === 'general' ? (
                    <Brain className="w-4 h-4" />
                  ) : (
                    <GraduationCap className="w-4 h-4" />
                  )}
                </div>
              )}

              <div
                className={`max-w-[90%] sm:max-w-[82%] rounded-2xl p-4 sm:p-5 shadow-lg ${
                  msg.role === 'user'
                    ? 'bg-sky-600 text-white rounded-br-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between gap-4 mb-2 pb-1 border-b border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold opacity-80">
                      {msg.role === 'user' ? 'You' : 'Study Assistant'}
                    </span>
                    {msg.mode && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          msg.mode === 'notes'
                            ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                            : msg.mode === 'general'
                            ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {msg.mode === 'notes'
                          ? 'Notes Mode'
                          : msg.mode === 'general'
                          ? 'General AI'
                          : 'Web Search'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-mono">{msg.timestamp}</span>
                    {msg.role === 'assistant' && !msg.error && (
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                        title="Copy Answer"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Message Content */}
                {msg.error ? (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="leading-relaxed">{msg.content}</div>
                  </div>
                ) : msg.role === 'user' ? (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <div className="text-sm leading-relaxed">
                    <MarkdownRenderer
                      content={msg.content}
                      onCitationClick={handleInTextCitationClick}
                    />
                  </div>
                )}

                {/* Insufficient Evidence Notice for Notes Mode */}
                {msg.evidence_found === false && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                    <div className="leading-relaxed">
                      <strong className="font-semibold text-amber-200">Insufficient Evidence:</strong>{' '}
                      The uploaded college notes do not contain sufficient verified passages to definitively answer this question without hallucinating.
                      Try switching to <strong>General Learning</strong> mode for broad academic explanations.
                    </div>
                  </div>
                )}

                {/* Document Citations List (Notes Mode) */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                    <div className="text-xs font-semibold text-slate-400 flex items-center justify-between uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <Bookmark className="w-3.5 h-3.5 text-sky-400" />
                        <span>Document Citations & Page References ({msg.citations.length})</span>
                      </div>
                      <span className="text-[10px] text-slate-500 lowercase">Click to inspect or open</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.citations.map((cite, cIdx) => {
                        const docId = cite.document_id || cite.source_id;
                        return (
                          <div
                            key={cIdx}
                            className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-2 text-xs"
                          >
                            <button
                              type="button"
                              onClick={() => onSelectCitation(cite)}
                              className="flex items-center gap-2 truncate text-left group flex-1 cursor-pointer"
                              title={`Inspect excerpt from ${cite.filename}`}
                            >
                              <FileText className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                              <div className="truncate">
                                <span className="text-slate-200 font-medium truncate block text-xs group-hover:text-sky-300 transition-colors">
                                  {cite.filename}
                                </span>
                                <span className="text-[10px] text-sky-400 font-semibold">
                                  Page {cite.page_number}
                                </span>
                              </div>
                            </button>

                            {docId && (
                              <a
                                href={getDocumentFileUrl(docId, cite.page_number)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-sky-500/20 text-slate-300 hover:text-sky-300 border border-slate-700 hover:border-sky-500/40 text-[10px] font-semibold transition-all flex-shrink-0"
                                title={`Open ${cite.filename} at page ${cite.page_number} in a new tab`}
                              >
                                <span>PDF</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Web Sources & Links (Web Search Mode) */}
                {msg.web_sources && msg.web_sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                    <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Verified Web Sources ({msg.web_sources.length})</span>
                    </div>

                    <div className="space-y-2">
                      {msg.web_sources.map((webSrc, wIdx) => (
                        <div
                          key={wIdx}
                          className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-emerald-500/40 transition-all text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <a
                              href={webSrc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 truncate group"
                            >
                              <span className="truncate">{webSrc.title || webSrc.url}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-70 group-hover:opacity-100" />
                            </a>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono flex-shrink-0">
                              {extractDomain(webSrc.url)}
                            </span>
                          </div>
                          {webSrc.snippet && (
                            <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-2">
                              {webSrc.snippet}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Web Search Disabled notice if web mode returned no sources */}
                {msg.mode === 'web' && (!msg.web_sources || msg.web_sources.length === 0) && !msg.error && (
                  <div className="mt-3 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 text-xs flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>
                      Live Web Search provider is unconfigured or returned no external web links for this prompt.
                    </span>
                  </div>
                )}

                {/* Latency Telemetry */}
                {msg.latency && (
                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {msg.latency.retrieval_ms !== undefined && (
                      <>
                        <span>Retrieval: {msg.latency.retrieval_ms}ms</span>
                        <span>&bull;</span>
                      </>
                    )}
                    <span>LLM: {msg.latency.llm_generation_ms}ms</span>
                    <span>&bull;</span>
                    <span>Total: {msg.latency.total_ms}ms</span>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex-shrink-0 flex items-center justify-center border border-indigo-500/30 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="flex gap-3 items-center text-slate-400 text-xs py-2 animate-pulse">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                mode === 'web'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : mode === 'general'
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                  : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
              }`}
            >
              {mode === 'web' ? (
                <Globe className="w-4 h-4" />
              ) : mode === 'general' ? (
                <Brain className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>
            <span>{getLoadingText()}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Multi-line Textarea Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isBackendHealthy && !isLoading) handleSend();
        }}
        className="pt-3 border-t border-slate-800"
      >
        <div className="relative flex items-end bg-slate-900 border border-slate-800 rounded-2xl shadow-inner focus-within:border-sky-500/80 transition-colors p-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputQuestion}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !isBackendHealthy}
            placeholder={
              !isBackendHealthy
                ? 'Backend is offline — Start server with .\\start-dev.ps1 to chat...'
                : getPlaceholder()
            }
            className="w-full pl-3 pr-12 py-1.5 bg-transparent text-white placeholder-slate-500 focus:outline-none text-xs sm:text-sm resize-none disabled:opacity-50 disabled:cursor-not-allowed max-h-36 overflow-y-auto"
          />

          <button
            type="submit"
            disabled={isLoading || !isBackendHealthy || !inputQuestion.trim()}
            className={`p-2.5 rounded-xl disabled:opacity-40 transition-all shadow-md flex-shrink-0 cursor-pointer ${
              mode === 'web'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold'
                : mode === 'general'
                ? 'bg-indigo-500 hover:bg-indigo-400 text-white font-semibold'
                : 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold'
            }`}
            title={
              !isBackendHealthy
                ? 'Backend is offline'
                : 'Send question (Enter, Shift+Enter for newline)'
            }
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between px-2 pt-2 text-[11px] text-slate-500">
          <span>
            Press <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">Enter</kbd> to send,{' '}
            <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">Shift+Enter</kbd> for newline
          </span>
          <span className="hidden sm:inline">
            Mode: <strong className="text-slate-300 capitalize">{mode}</strong>
          </span>
        </div>
      </form>
    </div>
  );
};
