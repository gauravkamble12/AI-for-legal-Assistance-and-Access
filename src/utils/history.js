import {
  MAX_CHAT_MESSAGES,
  MAX_DOCUMENT_CHARS,
  MAX_RESPONSE_CHARS,
  normalizeText,
} from './security';

export const HISTORY_KEY = 'lexassist_history_v2';
const LEGACY_HISTORY_KEY = 'lexassist_history';
export const HISTORY_PREFERENCE_KEY = 'lexassist_history_enabled';
export const HISTORY_UPDATED_EVENT = 'lexassist:history-updated';

const MAX_HISTORY_ENTRIES = 10;
const MAX_FILE_NAME_CHARS = 180;
const MAX_CHAT_MESSAGE_CHARS = 15_000;
const MAX_STORAGE_BYTES = 4 * 1024 * 1024;
const VALID_ACTIONS = new Set(['simplify', 'risks', 'questions', 'chat']);
let cachedSerializedHistory = null;
let cachedHistory = [];

const getStorage = () => {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
};

const notifyHistoryChanged = () => {
  if (typeof globalThis.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT));
};

export const createSessionId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

const sanitizeChatHistory = (messages) => {
  if (!Array.isArray(messages)) return [];

  return messages.slice(-MAX_CHAT_MESSAGES).flatMap((message) => {
    if (!message || typeof message !== 'object') return [];
    const role = message.role === 'user' ? 'user' : message.role === 'ai' ? 'ai' : null;
    const content = normalizeText(message.content).slice(0, MAX_CHAT_MESSAGE_CHARS);
    if (!role || !content) return [];
    return [{
      id: typeof message.id === 'string' ? message.id.slice(0, 80) : createSessionId(),
      role,
      content,
    }];
  });
};

const sanitizeEntry = (entry) => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;

  const fileName = normalizeText(entry.fileName).slice(0, MAX_FILE_NAME_CHARS);
  const documentContent = normalizeText(entry.documentContent);
  const analysisResult = normalizeText(entry.analysisResult).slice(0, MAX_RESPONSE_CHARS);
  const action = VALID_ACTIONS.has(entry.action) ? entry.action : null;
  const createdAt = typeof entry.createdAt === 'string' && !Number.isNaN(Date.parse(entry.createdAt))
    ? entry.createdAt
    : new Date().toISOString();

  if (!fileName || !documentContent || documentContent.length > MAX_DOCUMENT_CHARS || !action) return null;

  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id.slice(0, 100) : createSessionId(),
    fileName,
    documentContent,
    action,
    analysisResult,
    chatHistory: sanitizeChatHistory(entry.chatHistory),
    createdAt,
  };
};

const serializeWithinLimit = (entries) => {
  const serialized = JSON.stringify(entries);
  const size = typeof Blob === 'function' ? new Blob([serialized]).size : serialized.length * 2;
  if (size <= MAX_STORAGE_BYTES) return { serialized, entries };

  const trimmed = [...entries];
  while (trimmed.length > 1) {
    trimmed.pop();
    const candidate = JSON.stringify(trimmed);
    const candidateSize = typeof Blob === 'function' ? new Blob([candidate]).size : candidate.length * 2;
    if (candidateSize <= MAX_STORAGE_BYTES) return { serialized: candidate, entries: trimmed };
  }

  return null;
};

export const getHistoryEnabled = () => {
  const storage = getStorage();
  if (!storage) return false;
  try {
    return storage.getItem(HISTORY_PREFERENCE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setHistoryEnabled = (enabled) => {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(HISTORY_PREFERENCE_KEY, enabled ? 'true' : 'false');
    return true;
  } catch {
    return false;
  }
};

export const getHistory = () => {
  const storage = getStorage();
  if (!storage) return [];

  try {
    try {
      storage.removeItem(LEGACY_HISTORY_KEY);
    } catch {
      return [];
    }

    const serialized = storage.getItem(HISTORY_KEY) || '[]';
    if (serialized === cachedSerializedHistory) return cachedHistory;

    const parsed = JSON.parse(serialized);
    cachedSerializedHistory = serialized;
    cachedHistory = Array.isArray(parsed)
      ? parsed.map(sanitizeEntry).filter(Boolean).slice(0, MAX_HISTORY_ENTRIES)
      : [];
    return cachedHistory;
  } catch {
    return [];
  }
};

export const saveSession = (session) => {
  const storage = getStorage();
  if (!storage) return { ok: false, entry: null, error: 'Local storage is unavailable.' };

  const entry = sanitizeEntry(session);
  if (!entry) return { ok: false, entry: null, error: 'The session could not be saved.' };

  try {
    const updated = [entry, ...getHistory().filter((item) => item.id !== entry.id)]
      .slice(0, MAX_HISTORY_ENTRIES);
    const payload = serializeWithinLimit(updated);
    if (!payload) return { ok: false, entry: null, error: 'This session is too large for local storage.' };
    storage.setItem(HISTORY_KEY, payload.serialized);
    cachedSerializedHistory = payload.serialized;
    cachedHistory = payload.entries;
    notifyHistoryChanged();
    return { ok: true, entry, error: null };
  } catch {
    return { ok: false, entry: null, error: 'The session could not be saved on this device.' };
  }
};

export const deleteHistoryEntry = (id) => {
  const existing = getHistory();
  const updated = existing.filter((entry) => entry.id !== id);
  const storage = getStorage();
  if (!storage) return existing;

  try {
    const payload = serializeWithinLimit(updated);
    if (!payload) return existing;
    storage.setItem(HISTORY_KEY, payload.serialized);
    cachedSerializedHistory = payload.serialized;
    cachedHistory = payload.entries;
    notifyHistoryChanged();
    return payload.entries;
  } catch {
    return existing;
  }
};

export const clearHistory = () => {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(HISTORY_KEY);
    storage.removeItem(LEGACY_HISTORY_KEY);
    cachedSerializedHistory = null;
    cachedHistory = [];
    notifyHistoryChanged();
    return true;
  } catch {
    return false;
  }
};
