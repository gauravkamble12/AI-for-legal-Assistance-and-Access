import React from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * ChatWindow component - handles the AI result display and chat history.
 * @param {string} analysisResult - The initial AI analysis result (markdown)
 * @param {Array} chatHistory - Array of {role, content} chat messages
 * @param {boolean} isLoading - Whether a request is in progress
 * @param {string|null} error - Error message if any
 */
const ChatWindow = React.memo(({ analysisResult, chatHistory, isLoading, error }) => (
  <div
    className="result-area"
    style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}
    role="log"
    aria-live="polite"
    aria-label="AI analysis output"
  >
    {analysisResult && (
      <div
        className="animate-fade-in"
        style={{ paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <ReactMarkdown>{analysisResult}</ReactMarkdown>
      </div>
    )}

    {chatHistory.map((msg, idx) => (
      <div key={idx} className={`chat-bubble ${msg.role}`} aria-label={`${msg.role === 'user' ? 'Your message' : 'AI response'}`}>
        {msg.role === 'ai' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
      </div>
    ))}

    {isLoading && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px' }} aria-busy="true" aria-label="AI is thinking">
        <div className="loader" aria-hidden="true"></div>
        <span style={{ color: '#8b9db8' }}>Thinking...</span>
      </div>
    )}

    {error && (
      <div role="alert" style={{ color: '#ff4757', padding: '16px', background: 'rgba(255, 71, 87, 0.1)', borderRadius: '8px' }}>
        <strong>Error:</strong> {error}
      </div>
    )}
  </div>
));

ChatWindow.displayName = 'ChatWindow';

export default ChatWindow;
