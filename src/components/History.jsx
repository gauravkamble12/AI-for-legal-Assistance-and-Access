import React, { useState } from 'react';
import { Clock, Trash2, FileText } from 'lucide-react';
import { getHistory, deleteHistoryEntry, clearHistory } from '../utils/history';

const actionLabels = {
  simplify: '📄 Simplify',
  risks: '🚨 Risk Analysis',
  questions: "❓ Lawyer Q's",
  chat: '💬 Chat',
};

const History = ({ onLoadSession }) => {
  // Initialize state directly from localStorage to avoid setState-in-effect warning
  const [history, setHistory] = useState(() => getHistory());

  const handleClearAll = () => {
    clearHistory();
    setHistory([]);
  };

  const handleDelete = (id) => {
    const updated = deleteHistoryEntry(id);
    setHistory(updated);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Analysis History</h2>
        {history.length > 0 && (
          <button className="button-secondary" onClick={handleClearAll} style={{ fontSize: '13px', padding: '6px 12px' }}>
            <Trash2 size={14} /> Clear All
          </button>
        )}
      </div>
      <p>Your past 20 document analyses are saved here.</p>

      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#8b9db8', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
          <Clock size={40} style={{ marginBottom: '16px', opacity: 0.4 }} />
          <p>No history yet. Start by analyzing a document!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {history.map((entry) => (
            <div key={entry.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <FileText size={14} color="#4da4ff" />
                  <strong style={{ fontSize: '14px' }}>{entry.fileName}</strong>
                  <span style={{ fontSize: '12px', background: 'rgba(177, 93, 255, 0.15)', color: '#b15dff', padding: '2px 8px', borderRadius: '8px' }}>
                    {actionLabels[entry.action] || entry.action}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#8b9db8', marginBottom: '8px' }}>{entry.date}</div>
                <div style={{ fontSize: '13px', color: '#a3b3cc', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  {entry.result?.slice(0, 200)}...
                </div>
                <button
                  className="button-secondary"
                  style={{ marginTop: '12px', fontSize: '13px', padding: '6px 14px' }}
                  onClick={() => onLoadSession(entry)}
                >
                  Load Session
                </button>
              </div>
              <button onClick={() => handleDelete(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4757', padding: '4px' }} aria-label="Delete entry">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;
