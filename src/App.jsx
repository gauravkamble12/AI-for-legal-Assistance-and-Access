import React, { useState, useCallback } from 'react';
import { FileText, Scale, BookOpen, Clock, Upload, Download, Send } from 'lucide-react';
import { analyzeDocument } from './gemini';
import * as pdfjsLib from 'pdfjs-dist';
import ActionCards from './components/ActionCards';
import ChatWindow from './components/ChatWindow';
import './index.css';

// Configure PDF.js worker securely and efficiently
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [hasFile, setHasFile] = useState(false);
  const [fileName, setFileName] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  
  const [selectedAction, setSelectedAction] = useState(null);
  const [analysisResult, setAnalysisResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  
  // Security: Using environment variables instead of hardcoded keys
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);
    setError(null);

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const typedarray = new Uint8Array(event.target.result);
          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          let fullText = '';
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `--- Page ${i} ---\n${pageText}\n\n`;
          }
          
          setDocumentContent(fullText);
          setHasFile(true);
          setActiveTab('actions');
        } catch (err) {
          console.error('Error parsing PDF:', err);
          setError('Failed to extract text from the PDF.');
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } 
    else {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDocumentContent(event.target.result);
        setHasFile(true);
        setActiveTab('actions');
        setIsLoading(false);
      };
      reader.readAsText(file);
    }
  };

  // Efficiency: useCallback to prevent unnecessary re-renders
  const executeAction = useCallback(async (action) => {
    setSelectedAction(action);
    setIsLoading(true);
    setAnalysisResult('');
    setError(null);
    setChatHistory([]);

    try {
      if (!apiKey) throw new Error("API Key missing in environment variables.");
      const result = await analyzeDocument(apiKey, documentContent, action);
      setAnalysisResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, documentContent]);

  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      if (!apiKey) throw new Error("API Key missing in environment variables.");
      const result = await analyzeDocument(apiKey, documentContent, 'chat', userMsg);
      setChatHistory(prev => [...prev, { role: 'ai', content: result }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'ai', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, documentContent, chatInput]);

  const downloadReport = useCallback(() => {
    if (!analysisResult && chatHistory.length === 0) return;
    
    let contentToSave = `# LexAssist AI Report for ${fileName}\n\n`;
    if (analysisResult) contentToSave += `## Analysis (${selectedAction})\n\n${analysisResult}\n\n`;
    if (chatHistory.length > 0) {
      contentToSave += `## Q&A Session\n\n`;
      chatHistory.forEach(msg => {
        contentToSave += `**${msg.role === 'user' ? 'You' : 'AI'}:**\n${msg.content}\n\n`;
      });
    }

    const blob = new Blob([contentToSave], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LexAssist_Report_${fileName}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [analysisResult, chatHistory, fileName, selectedAction]);

  const clearSession = () => {
    setHasFile(false);
    setDocumentContent('');
    setSelectedAction(null);
    setAnalysisResult('');
    setChatHistory([]);
    setActiveTab('upload');
    setFileName('');
    setError(null);
  };

  return (
    <div className="app-container" aria-label="Application Container">
      {/* Semantic HTML & Accessibility */}
      <aside className="sidebar" aria-label="Main Navigation Sidebar">
        <div className="sidebar-logo" role="heading" aria-level="1">
          <Scale size={28} color="#b15dff" aria-hidden="true" />
          LexAssist AI
        </div>

        <nav className="sidebar-nav" aria-label="Primary Navigation">
          <button className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => !hasFile && setActiveTab('upload')} aria-current={activeTab === 'upload' ? 'page' : undefined}>
            <FileText size={20} aria-hidden="true" />
            New Analysis
          </button>
          <button className="nav-item">
            <Clock size={20} aria-hidden="true" />
            History
          </button>
          <button className="nav-item">
            <BookOpen size={20} aria-hidden="true" />
            Legal Glossary
          </button>
        </nav>
      </aside>

      <main className="main-content" role="main">
        <header className="header">
          <div>
            <h2 id="main-heading">Welcome to LexAssist AI</h2>
            <p>Your intelligent legal document navigator. Understand, compare, and analyze with confidence.</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {hasFile && (
              <button className="button-secondary" onClick={clearSession} aria-label="Clear current document">
                Clear Document
              </button>
            )}
          </div>
        </header>

        {!hasFile && (
          <section className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', marginTop: '24px' }} aria-labelledby="upload-heading">
            <label className="file-upload-zone" style={{ display: 'flex', width: '100%', maxWidth: '600px', boxSizing: 'border-box' }}>
              <input 
                type="file" 
                accept=".txt,.md,.pdf" 
                style={{ display: 'none' }} 
                onChange={handleFileUpload}
                aria-label="Upload legal document file"
              />
              <Upload className="file-icon" aria-hidden="true" />
              <h3 id="upload-heading">Upload Legal Document</h3>
              <p>Select your contract or policy. Supported formats: .txt, .pdf</p>
              <span className="button-primary" role="button" tabIndex="0">
                {isLoading ? <span className="loader" aria-label="Loading..."></span> : "Browse Files"}
              </span>
            </label>
            
            {error && <div role="alert" style={{ color: '#ff4757' }}>{error}</div>}
          </section>
        )}

        {hasFile && (
          <section className="workspace animate-fade-in" aria-label="Analysis Workspace">
            <div className="document-pane" aria-label="Document Viewer">
              <div className="pane-header">
                <FileText size={16} aria-hidden="true" /> {fileName}
              </div>
              <div className="document-content" tabIndex="0">
                {documentContent}
              </div>
            </div>

            <div className="analysis-pane" style={{ display: 'flex', flexDirection: 'column' }} aria-label="AI Analysis Panel">
              {!selectedAction && chatHistory.length === 0 && (
                <ActionCards onAction={executeAction} />
              )}

              {(selectedAction || chatHistory.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
                    <h3 style={{ margin: 0 }}>{selectedAction ? 'AI Analysis' : 'Document Q&A'}</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="button-secondary" onClick={downloadReport} aria-label="Download Report as Markdown">
                        <Download size={16} aria-hidden="true" /> Export
                      </button>
                      <button className="button-secondary" onClick={() => { setSelectedAction(null); setChatHistory([]); }} aria-label="Go back to actions">
                        &larr; Back
                      </button>
                    </div>
                  </div>

                  <ChatWindow
                    analysisResult={analysisResult}
                    chatHistory={chatHistory}
                    isLoading={isLoading}
                    error={error}
                  />

                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexShrink: 0 }}>
                    <input
                      type="text"
                      style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '14px', outline: 'none' }}
                      placeholder="Ask a question about this document..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      aria-label="Chat input field"
                      maxLength={2000}
                    />
                    <button className="button-primary" onClick={handleSendMessage} disabled={isLoading || !chatInput.trim()} aria-label="Send message">
                      <Send size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
