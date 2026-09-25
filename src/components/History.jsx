import React, { useEffect, useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import {
  HISTORY_UPDATED_EVENT,
  clearHistory,
  deleteHistoryEntry,
  getHistory,
} from '../utils/history';

const ACTION_LABELS = {
  simplify: 'Plain-language summary',
  risks: 'Risk analysis',
  questions: 'Lawyer questions',
  chat: 'Document Q&A',
};

const History = ({ onLoadSession }) => {
  const [history, setHistory] = useState(getHistory);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const refresh = () => setHistory(getHistory());
    globalThis.addEventListener?.(HISTORY_UPDATED_EVENT, refresh);
    globalThis.addEventListener?.('storage', refresh);
    return () => {
      globalThis.removeEventListener?.(HISTORY_UPDATED_EVENT, refresh);
      globalThis.removeEventListener?.('storage', refresh);
    };
  }, []);

  const handleClearAll = () => {
    if (!window.confirm('Delete all sessions saved on this device?')) return;
    const cleared = clearHistory();
    setHistory(cleared ? [] : getHistory());
    setMessage(cleared ? 'All local session history was deleted.' : 'Local history could not be deleted.');
  };

  const handleDelete = (id) => {
    const updated = deleteHistoryEntry(id);
    setHistory(updated);
  };

  return (
    <div className="history-view animate-fade-in">
      <div className="view-heading">
        <div>
          <h1>Analysis History</h1>
          <p>Up to 10 sessions saved on this device.</p>
        </div>
        {history.length > 0 && (
          <button className="button-secondary compact-button" type="button" onClick={handleClearAll}>
            <Trash2 size={15} aria-hidden="true" /> Clear All
          </button>
        )}
      </div>

      <div className="privacy-note">
        Local history is unencrypted. Delete it when using a shared or public device.
      </div>
      {message && <output className="alert alert-notice">{message}</output>}

      {history.length === 0 ? (
        <div className="empty-state">
          <FileText size={40} aria-hidden="true" />
          <h2>No saved sessions</h2>
          <p>Enable “Save sessions on this device” before uploading a document if you want to restore it later.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((entry) => (
            <article className="history-entry" key={entry.id}>
              <div className="history-entry-heading">
                <div>
                  <strong title={entry.fileName}>{entry.fileName}</strong>
                  <span className="history-action">{ACTION_LABELS[entry.action] || entry.action}</span>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  aria-label={`Delete history entry for ${entry.fileName}`}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
              <time dateTime={entry.createdAt}>
                {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.createdAt))}
              </time>
              <p>{entry.analysisResult || entry.chatHistory.find((messageItem) => messageItem.role === 'ai')?.content || 'Session saved without an analysis result.'}</p>
              <button className="button-secondary compact-button" type="button" onClick={() => onLoadSession(entry)}>
                Load Session
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;
