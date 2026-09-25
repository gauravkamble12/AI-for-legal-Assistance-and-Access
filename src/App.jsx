import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Clock, Download, FileText, Scale, Send, Upload } from 'lucide-react';
import { analyzeDocument } from './gemini';
import ActionCards from './components/ActionCards';
import ChatWindow from './components/ChatWindow';
import History from './components/History';
import LegalGlossary from './components/LegalGlossary';
import { extractTextFromFile } from './utils/documents';
import {
  createSessionId,
  getHistoryEnabled,
  saveSession,
  setHistoryEnabled,
} from './utils/history';
import {
  MAX_CHAT_MESSAGES,
  MAX_QUESTION_CHARS,
  normalizeText,
  validateFile,
} from './utils/security';

const SAMPLE_CONTRACT = `EMPLOYMENT AGREEMENT

1. POSITION AND DUTIES
The Employer agrees to employ the Employee as Software Engineer.

2. COMPENSATION
The Employee will be paid a base salary of $100,000 per year.

3. NON-COMPETE
During the term of employment and for a period of 2 years thereafter, the Employee shall not engage in any business that competes with the Employer within a 100-mile radius.

4. TERMINATION
This Agreement may be terminated by either party with 30 days written notice.`;

const ACTION_LABELS = {
  simplify: 'Plain-language summary',
  risks: 'Risk and clause analysis',
  questions: 'Lawyer question checklist',
  chat: 'Document Q&A',
};

const getErrorMessage = (error) => {
  if (error?.name === 'AbortError') return '';
  return error instanceof Error && error.message
    ? error.message
    : 'Something went wrong. Please try again.';
};

const sanitizeReportName = (fileName) => {
  const withoutExtension = normalizeText(fileName.replace(/\.[^.]+$/, ''));
  const safeName = Array.from(withoutExtension, (character) => (
    '<>:"/\\|?*'.includes(character) ? '_' : character
  )).join('').replace(/\s+/g, ' ').trim().slice(0, 100);
  return safeName || 'Document';
};

const DocumentPane = memo(({ fileName, documentContent }) => (
  <div className="document-pane">
    <div className="pane-header">
      <FileText size={16} aria-hidden="true" />
      <span title={fileName}>{fileName}</span>
    </div>
    <section
      className="document-content"
      tabIndex={0}
      aria-label="Uploaded document text"
    >
      {documentContent}
    </section>
  </div>
));

DocumentPane.displayName = 'DocumentPane';

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [hasFile, setHasFile] = useState(false);
  const [fileName, setFileName] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [selectedAction, setSelectedAction] = useState(null);
  const [analysisResult, setAnalysisResult] = useState('');
  const [operation, setOperation] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [historyEnabled, setHistoryPreference] = useState(getHistoryEnabled);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const requestControllerRef = useRef(null);
  const uploadControllerRef = useRef(null);
  const sessionVersionRef = useRef(0);
  const historyEnabledRef = useRef(historyEnabled);

  useEffect(() => {
    historyEnabledRef.current = historyEnabled;
  }, [historyEnabled]);

  const isLoading = operation !== null;
  const canExport = Boolean(analysisResult || chatHistory.length > 0);

  const abortActiveWork = useCallback(() => {
    sessionVersionRef.current += 1;
    requestControllerRef.current?.abort();
    uploadControllerRef.current?.abort();
    requestControllerRef.current = null;
    uploadControllerRef.current = null;
  }, []);

  useEffect(() => () => {
    sessionVersionRef.current += 1;
    requestControllerRef.current?.abort();
    uploadControllerRef.current?.abort();
  }, []);

  const clearAnalysis = useCallback(() => {
    setSelectedAction(null);
    setAnalysisResult('');
    setChatHistory([]);
    setChatInput('');
    setError('');
    setNotice('');
  }, []);

  const clearSession = useCallback(() => {
    abortActiveWork();
    setHasFile(false);
    setFileName('');
    setDocumentContent('');
    setSessionId('');
    setOperation(null);
    setUploadProgress(null);
    setIsDragging(false);
    clearAnalysis();
    setActiveTab('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [abortActiveWork, clearAnalysis]);

  const handleNewAnalysis = () => {
    if (hasFile && !window.confirm('Start a new analysis and clear the current document?')) return;
    clearSession();
  };

  const handleClearSession = () => {
    if (hasFile && !window.confirm('Clear the current document and its results?')) return;
    clearSession();
  };

  const processFile = useCallback(async (file) => {
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error);
      setNotice('');
      return;
    }

    abortActiveWork();
    const version = sessionVersionRef.current;
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    setOperation('upload');
    setUploadProgress(null);
    setError('');
    setNotice('');

    try {
      const content = await extractTextFromFile(file, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (version === sessionVersionRef.current) setUploadProgress(progress);
        },
      });

      if (version !== sessionVersionRef.current) return;
      setFileName(file.name);
      setDocumentContent(content);
      setSessionId(createSessionId());
      setHasFile(true);
      setSelectedAction(null);
      setAnalysisResult('');
      setChatHistory([]);
      setChatInput('');
      setActiveTab('actions');
    } catch (uploadError) {
      if (version !== sessionVersionRef.current || uploadError?.name === 'AbortError') return;
      setError(getErrorMessage(uploadError));
    } finally {
      if (version === sessionVersionRef.current && uploadControllerRef.current === controller) {
        uploadControllerRef.current = null;
        setOperation(null);
        setUploadProgress(null);
      }
    }
  }, [abortActiveWork]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    processFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length !== 1) {
      setError('Drop one document at a time.');
      return;
    }
    processFile(files[0]);
  };

  const loadSampleContract = () => {
    abortActiveWork();
    clearAnalysis();
    setFileName('Sample_Contract.txt');
    setDocumentContent(SAMPLE_CONTRACT);
    setSessionId(createSessionId());
    setHasFile(true);
    setOperation(null);
    setUploadProgress(null);
    setActiveTab('actions');
  };

  const persistSession = useCallback((action, result, messages) => {
    if (!historyEnabledRef.current) return;

    const saved = saveSession({
      id: sessionId,
      fileName,
      documentContent,
      action,
      analysisResult: result,
      chatHistory: messages,
      createdAt: new Date().toISOString(),
    });

    setNotice(saved.ok ? 'Session saved on this device.' : saved.error);
  }, [documentContent, fileName, sessionId]);

  const executeAction = useCallback(async (action) => {
    if (isLoading || requestControllerRef.current || !documentContent || !ACTION_LABELS[action] || action === 'chat') return;

    const version = sessionVersionRef.current;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setSelectedAction(action);
    setAnalysisResult('');
    setChatHistory([]);
    setChatInput('');
    setOperation('analysis');
    setError('');
    setNotice('');

    try {
      const result = await analyzeDocument({
        documentText: documentContent,
        task: action,
        signal: controller.signal,
      });

      if (version !== sessionVersionRef.current) return;
      setAnalysisResult(result);
      persistSession(action, result, []);
    } catch (requestError) {
      if (version !== sessionVersionRef.current || requestError?.name === 'AbortError') return;
      setError(getErrorMessage(requestError));
    } finally {
      if (version === sessionVersionRef.current && requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        setOperation(null);
      }
    }
  }, [documentContent, isLoading, persistSession]);

  const openChat = useCallback(() => {
    if (isLoading || requestControllerRef.current) return;
    setSelectedAction('chat');
    setAnalysisResult('');
    setChatHistory([]);
    setChatInput('');
    setError('');
    setNotice('');
  }, [isLoading]);

  const handleSendMessage = useCallback(async () => {
    const content = normalizeText(chatInput);
    if (isLoading || requestControllerRef.current || !documentContent || !content || content.length > MAX_QUESTION_CHARS) return;

    const previousMessages = chatHistory.slice(-MAX_CHAT_MESSAGES);
    const userMessage = { id: createSessionId(), role: 'user', content };
    const version = sessionVersionRef.current;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setChatHistory([...previousMessages, userMessage]);
    setChatInput('');
    setOperation('chat');
    setError('');
    setNotice('');

    try {
      const result = await analyzeDocument({
        documentText: documentContent,
        task: 'chat',
        question: content,
        history: previousMessages.map(({ role, content: messageContent }) => ({
          role: role === 'user' ? 'user' : 'assistant',
          content: messageContent,
        })),
        signal: controller.signal,
      });

      if (version !== sessionVersionRef.current) return;
      const nextMessages = [
        ...previousMessages,
        userMessage,
        { id: createSessionId(), role: 'ai', content: result },
      ];
      setChatHistory(nextMessages);
      persistSession(selectedAction || 'chat', analysisResult, nextMessages);
    } catch (requestError) {
      if (version !== sessionVersionRef.current || requestError?.name === 'AbortError') return;
      setChatHistory(previousMessages);
      setChatInput(content);
      setError(getErrorMessage(requestError));
    } finally {
      if (version === sessionVersionRef.current && requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        setOperation(null);
      }
    }
  }, [analysisResult, chatHistory, chatInput, documentContent, isLoading, persistSession, selectedAction]);

  const downloadReport = useCallback(() => {
    if (!canExport) return;

    let report = `# LexAssist AI Report for ${fileName}\n\n`;
    report += '> General information only; this is not legal advice.\n\n';
    if (analysisResult) {
      report += `## ${ACTION_LABELS[selectedAction] || 'Analysis'}\n\n${analysisResult}\n\n`;
    }
    if (chatHistory.length > 0) {
      report += '## Document Q&A\n\n';
      for (const message of chatHistory) {
        report += `**${message.role === 'user' ? 'You' : 'LexAssist'}:**\n${message.content}\n\n`;
      }
    }

    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `LexAssist_${sanitizeReportName(fileName)}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [analysisResult, canExport, chatHistory, fileName, selectedAction]);

  const loadHistorySession = (entry) => {
    abortActiveWork();
    setFileName(entry.fileName);
    setDocumentContent(entry.documentContent);
    setSessionId(entry.id);
    setSelectedAction(entry.action);
    setAnalysisResult(entry.analysisResult);
    setChatHistory(entry.chatHistory);
    setHasFile(true);
    setOperation(null);
    setUploadProgress(null);
    setError('');
    setNotice('Loaded a session saved on this device.');
    historyEnabledRef.current = true;
    setHistoryPreference(true);
    setActiveTab('actions');
  };

  const handleHistoryPreference = (enabled) => {
    const saved = setHistoryEnabled(enabled);
    historyEnabledRef.current = saved ? enabled : false;
    setHistoryPreference(historyEnabledRef.current);
    setNotice(saved
      ? enabled
        ? 'New sessions will be saved on this device.'
        : 'New sessions will no longer be saved. Existing history remains until cleared.'
      : 'Browser storage is unavailable.');
  };

  const isSidebarView = activeTab === 'history' || activeTab === 'glossary';

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Scale size={28} aria-hidden="true" />
          LexAssist AI
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {hasFile && (
            <button
              className={`nav-item ${activeTab === 'actions' ? 'active' : ''}`}
              onClick={() => setActiveTab('actions')}
              aria-current={activeTab === 'actions' ? 'page' : undefined}
            >
              <FileText size={20} aria-hidden="true" />
              Current Document
            </button>
          )}
          <button
            className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={handleNewAnalysis}
            aria-current={activeTab === 'upload' ? 'page' : undefined}
          >
            <Upload size={20} aria-hidden="true" />
            New Analysis
          </button>
          <button
            className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            aria-current={activeTab === 'history' ? 'page' : undefined}
          >
            <Clock size={20} aria-hidden="true" />
            History
          </button>
          <button
            className={`nav-item ${activeTab === 'glossary' ? 'active' : ''}`}
            onClick={() => setActiveTab('glossary')}
            aria-current={activeTab === 'glossary' ? 'page' : undefined}
          >
            <BookOpen size={20} aria-hidden="true" />
            Legal Glossary
          </button>
        </nav>

        <p className="sidebar-disclaimer">General legal information, not legal advice.</p>
      </aside>

      <main className="main-content">
        {isSidebarView && (
          <section className="sidebar-view">
            {activeTab === 'history'
              ? <History onLoadSession={loadHistorySession} />
              : <LegalGlossary />}
          </section>
        )}

        {!isSidebarView && (
          <>
            <header className="header">
              <div>
                <h1>Legal document analysis</h1>
                <p>Understand key terms, identify risks, and prepare focused questions.</p>
              </div>
              {hasFile && (
                <button className="button-secondary" onClick={handleClearSession}>
                  Clear Document
                </button>
              )}
            </header>

            {!hasFile && (
              <section className="upload-section animate-fade-in" aria-labelledby="upload-heading">
                <div
                  className={`file-upload-zone ${isDragging ? 'dragging' : ''}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false);
                  }}
                  onDrop={handleDrop}
                  aria-busy={operation === 'upload'}
                >
                  <input
                    ref={fileInputRef}
                    className="visually-hidden"
                    type="file"
                    accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                    onChange={handleFileChange}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <Upload className="file-icon" aria-hidden="true" />
                  <h2 id="upload-heading">Upload a legal document</h2>
                  <p>Drag and drop a PDF, TXT, or Markdown file up to 5 MB. PDFs must contain selectable text.</p>
                  <button
                    className="button-primary"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {operation === 'upload' ? <span className="loader" aria-hidden="true" /> : 'Browse Files'}
                  </button>
                  {operation === 'upload' && uploadProgress && (
                    <output className="upload-status">
                      Reading page {uploadProgress.current} of {uploadProgress.total}
                    </output>
                  )}
                </div>

                {error && <div className="alert alert-error" role="alert">{error}</div>}
                {notice && <output className="alert alert-notice">{notice}</output>}

                <label className="history-toggle">
                  <input
                    type="checkbox"
                    aria-label="Save sessions on this device"
                    checked={historyEnabled}
                    onChange={(event) => handleHistoryPreference(event.target.checked)}
                  />
                  <span>
                    <strong>Save sessions on this device</strong>
                    <small>Off by default. Saved documents are not encrypted and remain in browser storage until cleared.</small>
                  </span>
                </label>

                <div className="or-divider"><span>or</span></div>

                <button className="button-secondary" type="button" onClick={loadSampleContract}>
                  Load Sample Contract
                </button>

                <p className="privacy-note">
                  Document text and questions are sent to Google Gemini for processing. Do not upload confidential or privileged information.
                </p>
              </section>
            )}

            {hasFile && (
              <section className="workspace animate-fade-in" aria-label="Analysis workspace">
                <DocumentPane fileName={fileName} documentContent={documentContent} />

                <section
                  className="analysis-pane"
                  tabIndex={0}
                  aria-label="Analysis controls and results"
                >
                  {notice && <output className="alert alert-notice workspace-notice">{notice}</output>}

                  <label className="history-toggle workspace-history-toggle">
                    <input
                      type="checkbox"
                      aria-label="Save sessions on this device"
                      checked={historyEnabled}
                      onChange={(event) => handleHistoryPreference(event.target.checked)}
                    />
                    <span>
                      <strong>Save sessions on this device</strong>
                      <small>Includes document text. Storage is not encrypted until history is cleared.</small>
                    </span>
                  </label>

                  {!selectedAction && (
                    <ActionCards onAction={executeAction} onChat={openChat} />
                  )}

                  {selectedAction && (
                    <div className="analysis-workspace">
                      <div className="analysis-toolbar">
                        <h2>{analysisResult ? `${ACTION_LABELS[selectedAction]} & Q&A` : ACTION_LABELS[selectedAction]}</h2>
                        <div className="toolbar-actions">
                          <button
                            className="button-secondary compact-button"
                            onClick={downloadReport}
                            disabled={!canExport || isLoading}
                            aria-label="Download report as Markdown"
                          >
                            <Download size={16} aria-hidden="true" /> Export
                          </button>
                          <button
                            className="button-secondary compact-button"
                            onClick={clearAnalysis}
                            disabled={isLoading}
                          >
                            Back
                          </button>
                        </div>
                      </div>

                      {selectedAction === 'chat' && !analysisResult && !chatHistory.length && (
                        <p className="chat-empty">Ask a question about the uploaded document.</p>
                      )}

                      <ChatWindow
                        analysisResult={analysisResult}
                        chatHistory={chatHistory}
                        isLoading={isLoading}
                        error={error}
                      />

                      <form
                        className="chat-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          handleSendMessage();
                        }}
                      >
                        <label className="visually-hidden" htmlFor="document-question">Ask a question about this document</label>
                        <input
                          id="document-question"
                          type="text"
                          placeholder="Ask a question about this document..."
                          value={chatInput}
                          onChange={(event) => setChatInput(event.target.value)}
                          maxLength={MAX_QUESTION_CHARS}
                          disabled={isLoading}
                          autoComplete="off"
                        />
                        <button
                          className="button-primary"
                          type="submit"
                          disabled={isLoading || !normalizeText(chatInput)}
                          aria-label="Send message"
                        >
                          <Send size={16} aria-hidden="true" />
                        </button>
                      </form>
                    </div>
                  )}
                </section>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
