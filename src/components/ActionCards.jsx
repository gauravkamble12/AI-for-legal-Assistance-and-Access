import React from 'react';
import { CheckCircle, FileSearch, HelpCircle, MessageCircle, ShieldAlert } from 'lucide-react';

const ActionCards = ({ onAction, onChat }) => (
  <div className="action-choice">
    <output className="document-ready">
      <CheckCircle color="#2ed573" aria-hidden="true" />
      <div>
        <strong>Document loaded</strong>
        <span>Choose an analysis or ask a document-specific question.</span>
      </div>
    </output>

    <h2>What would you like to do?</h2>
    <div className="action-cards" aria-label="Document analysis options">
      <button className="action-card" type="button" onClick={() => onAction('simplify')}>
        <FileSearch size={24} color="#4da4ff" aria-hidden="true" />
        <span className="action-title">Simplify Document</span>
        <span className="action-description">Translate complex legal language into plain terms.</span>
      </button>
      <button className="action-card" type="button" onClick={() => onAction('risks')}>
        <ShieldAlert size={24} color="#ff4757" aria-hidden="true" />
        <span className="action-title">Extract Risks & Clauses</span>
        <span className="action-description">Identify obligations, deadlines, and potentially high-risk terms.</span>
      </button>
      <button className="action-card" type="button" onClick={() => onAction('questions')}>
        <HelpCircle size={24} color="#eccc68" aria-hidden="true" />
        <span className="action-title">Prepare Lawyer Questions</span>
        <span className="action-description">Create focused questions about unclear or material clauses.</span>
      </button>
    </div>

    <button className="chat-shortcut" type="button" onClick={onChat}>
      <MessageCircle size={18} aria-hidden="true" />
      Ask a question about this document
    </button>
  </div>
);

export default ActionCards;
