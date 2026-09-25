const HISTORY_KEY = 'lexassist_history';

/**
 * Saves an analysis result to localStorage history.
 * Kept in a separate utility file to satisfy Fast Refresh rules.
 */
export const saveToHistory = (fileName, action, result) => {
  const existing = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  const newEntry = {
    id: Date.now(),
    fileName,
    action,
    result,
    date: new Date().toLocaleString(),
  };
  const updated = [newEntry, ...existing].slice(0, 20);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
};

export const getHistory = () =>
  JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

export const deleteHistoryEntry = (id) => {
  const updated = getHistory().filter(h => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
};

export const clearHistory = () => localStorage.removeItem(HISTORY_KEY);

export { HISTORY_KEY };
