import { Conversation, ChatMode } from '../types';

const STORAGE_KEY = 'college_ai_conversations_v1';
const ACTIVE_CONV_KEY = 'college_ai_active_conv_id_v1';
const MAX_CONVERSATIONS = 50;

/**
 * Loads all stored conversations from browser localStorage.
 * Returns an array sorted by updatedAt descending.
 */
export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (err) {
    console.warn('Failed to load conversations from localStorage:', err);
    return [];
  }
}

/**
 * Persists an array of conversations to browser localStorage.
 * Limits the total stored to MAX_CONVERSATIONS (50) to prevent storage quota issues.
 */
export function saveConversations(conversations: Conversation[]): void {
  try {
    const trimmed = conversations.slice(0, MAX_CONVERSATIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('Failed to save conversations to localStorage:', err);
  }
}

/**
 * Gets the ID of the currently active conversation, if any.
 */
export function getActiveConversationId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CONV_KEY);
  } catch {
    return null;
  }
}

/**
 * Persists the active conversation ID.
 */
export function setActiveConversationId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_CONV_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_CONV_KEY);
    }
  } catch (err) {
    console.warn('Failed to save active conversation id:', err);
  }
}

/**
 * Creates a brand new conversation object.
 */
export function createConversation(mode: ChatMode = 'notes', initialTitle = 'New Chat'): Conversation {
  const now = Date.now();
  return {
    id: `conv_${now}_${Math.random().toString(36).substring(2, 7)}`,
    title: initialTitle,
    mode,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

/**
 * Saves or updates a specific conversation in localStorage,
 * maintaining recency ordering.
 */
export function saveConversation(conversation: Conversation): Conversation[] {
  const current = loadConversations();
  const existingIndex = current.findIndex((c) => c.id === conversation.id);

  let updated: Conversation[];
  const updatedConversation = {
    ...conversation,
    updatedAt: Date.now(),
  };

  if (existingIndex >= 0) {
    updated = [
      updatedConversation,
      ...current.filter((c) => c.id !== conversation.id),
    ];
  } else {
    updated = [updatedConversation, ...current];
  }

  saveConversations(updated);
  return updated;
}

/**
 * Deletes a conversation by ID.
 */
export function deleteConversation(id: string): Conversation[] {
  const current = loadConversations();
  const updated = current.filter((c) => c.id !== id);
  saveConversations(updated);

  const activeId = getActiveConversationId();
  if (activeId === id) {
    setActiveConversationId(updated.length > 0 ? updated[0].id : null);
  }

  return updated;
}

/**
 * Clears all conversations from localStorage.
 */
export function clearAllConversations(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVE_CONV_KEY);
  } catch (err) {
    console.warn('Failed to clear conversations:', err);
  }
}
