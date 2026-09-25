import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';

const safeUrlTransform = (url) => {
  if (/^(https?:|mailto:|#)/i.test(url) || /^\/(?!\/)/.test(url)) return url;
  return '';
};

const markdownComponents = {
  a: ({ children, href, title }) => (
    href
      ? <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>
      : <span>{children}</span>
  ),
  img: () => null,
};

const Markdown = ({ children }) => (
  <ReactMarkdown
    skipHtml
    urlTransform={safeUrlTransform}
    components={markdownComponents}
  >
    {children}
  </ReactMarkdown>
);

const ChatWindow = memo(({ analysisResult, chatHistory, isLoading, error }) => (
  <div
    className="result-area"
    role="log"
    tabIndex={0}
    aria-live="polite"
    aria-label="Analysis and conversation output"
  >
    {analysisResult && (
      <article className="analysis-output animate-fade-in">
        <span className="message-label">Analysis</span>
        <Markdown>{analysisResult}</Markdown>
      </article>
    )}

    {chatHistory.map((message) => (
      <article
        key={message.id || `${message.role}-${message.content.slice(0, 12)}`}
        className={`chat-bubble ${message.role}`}
        aria-label={message.role === 'user' ? 'Your message' : 'LexAssist response'}
      >
        <span className="message-label">{message.role === 'user' ? 'You' : 'LexAssist'}</span>
        {message.role === 'ai' ? <Markdown>{message.content}</Markdown> : <p>{message.content}</p>}
      </article>
    ))}

    {isLoading && (
      <div className="thinking-status" aria-busy="true">
        <div className="loader" aria-hidden="true" />
        <span>LexAssist is working...</span>
      </div>
    )}

    {error && <div className="alert alert-error" role="alert">{error}</div>}
  </div>
));

ChatWindow.displayName = 'ChatWindow';

export default ChatWindow;
