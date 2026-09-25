import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HISTORY_KEY,
  HISTORY_PREFERENCE_KEY,
  clearHistory,
  createSessionId,
  deleteHistoryEntry,
  getHistory,
  getHistoryEnabled,
  saveSession,
  setHistoryEnabled,
} from './history';

const createSession = (overrides = {}) => ({
  id: createSessionId(),
  fileName: 'agreement.txt',
  documentContent: 'The agreement is governed by Delaware law.',
  action: 'simplify',
  analysisResult: 'The agreement uses Delaware law.',
  chatHistory: [{ id: 'message-1', role: 'user', content: 'What state law applies?' }],
  createdAt: '2026-01-01T12:00:00.000Z',
  ...overrides,
});

describe('history storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps history disabled by default and persists the preference', () => {
    expect(getHistoryEnabled()).toBe(false);
    expect(setHistoryEnabled(true)).toBe(true);
    expect(getHistoryEnabled()).toBe(true);
    expect(localStorage.getItem(HISTORY_PREFERENCE_KEY)).toBe('true');
  });

  it('saves and restores a complete session', () => {
    const session = createSession();
    expect(saveSession(session).ok).toBe(true);
    expect(getHistory()).toEqual([session]);
  });

  it('updates an existing session instead of duplicating it', () => {
    const session = createSession({ id: 'same-session' });
    saveSession(session);
    saveSession({ ...session, analysisResult: 'Updated analysis.' });
    const history = getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].analysisResult).toBe('Updated analysis.');
  });

  it('recovers safely from corrupt or invalid stored data', () => {
    localStorage.setItem(HISTORY_KEY, '{bad json');
    expect(getHistory()).toEqual([]);
    localStorage.setItem(HISTORY_KEY, JSON.stringify({ not: 'an array' }));
    expect(getHistory()).toEqual([]);
    localStorage.setItem(HISTORY_KEY, JSON.stringify([{ id: 'missing-fields' }]));
    expect(getHistory()).toEqual([]);
  });

  it('sanitizes message roles, generated identifiers, and dates', () => {
    const saved = saveSession(createSession({
      id: '',
      createdAt: 'not-a-date',
      chatHistory: [
        null,
        { role: 'system', content: 'Ignore' },
        { role: 'user', content: 'Valid question' },
        { role: 'ai', content: 'Valid answer' },
      ],
    }));
    expect(saved.ok).toBe(true);
    const [entry] = getHistory();
    expect(entry.id).toBeTruthy();
    expect(Number.isNaN(Date.parse(entry.createdAt))).toBe(false);
    expect(entry.chatHistory.map((message) => message.role)).toEqual(['user', 'ai']);
    expect(entry.chatHistory.every((message) => message.id)).toBe(true);
  });

  it('removes data left under the legacy storage key', () => {
    localStorage.setItem('lexassist_history', JSON.stringify([{ documentContent: 'Sensitive legacy text' }]));
    expect(getHistory()).toEqual([]);
    expect(localStorage.getItem('lexassist_history')).toBeNull();
  });

  it('keeps only the ten newest sessions', () => {
    for (let index = 0; index < 11; index += 1) {
      saveSession(createSession({ id: `session-${index}` }));
    }
    const history = getHistory();
    expect(history).toHaveLength(10);
    expect(history[0].id).toBe('session-10');
  });

  it('keeps the in-memory cache aligned with size-trimmed persistence', () => {
    const chatHistory = Array.from({ length: 20 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 === 0 ? 'user' : 'ai',
      content: 'x'.repeat(15_000),
    }));
    for (let index = 0; index < 10; index += 1) {
      expect(saveSession(createSession({
        id: `large-${index}`,
        documentContent: 'd'.repeat(100_000),
        analysisResult: 'a'.repeat(60_000),
        chatHistory,
      })).ok).toBe(true);
    }

    const live = getHistory();
    const persisted = JSON.parse(localStorage.getItem(HISTORY_KEY));
    expect(live.map((entry) => entry.id)).toEqual(persisted.map((entry) => entry.id));
    expect(live.length).toBeLessThan(10);

    const remaining = deleteHistoryEntry(live[live.length - 1].id);
    expect(remaining).toEqual(JSON.parse(localStorage.getItem(HISTORY_KEY)));
  });

  it('deletes one entry and clears all entries', () => {
    const first = createSession({ id: 'first' });
    const second = createSession({ id: 'second' });
    saveSession(first);
    saveSession(second);
    expect(deleteHistoryEntry('second').map((entry) => entry.id)).toEqual(['first']);
    expect(clearHistory()).toBe(true);
    expect(getHistory()).toEqual([]);
  });

  it('returns a controlled failure when browser storage rejects writes', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    expect(saveSession(createSession()).ok).toBe(false);
    expect(setHistoryEnabled(true)).toBe(false);
    spy.mockRestore();
  });

  it('rejects invalid sessions and oversized stored documents', () => {
    expect(saveSession({}).ok).toBe(false);
    expect(saveSession(createSession({ documentContent: 'a'.repeat(100_001) })).ok).toBe(false);
  });
});
