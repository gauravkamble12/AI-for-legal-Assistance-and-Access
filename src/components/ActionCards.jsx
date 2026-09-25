import React from 'react';
import { CheckCircle, FileSearch, ShieldAlert } from 'lucide-react';

/**
 * ActionCards component - displays the available AI actions for the user to choose from.
 * @param {Function} onAction - Callback when an action card is clicked
 */
const ActionCards = ({ onAction }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}
      role="status"
    >
      <CheckCircle color="#2ed573" aria-hidden="true" />
      <div>
        <strong>Document Loaded Successfully</strong>
        <div style={{ fontSize: '12px', color: '#8b9db8' }}>Choose an AI task below or ask a question!</div>
      </div>
    </div>

    <h3>What would you like to do?</h3>
    <div className="action-cards" role="menu">
      <button className="action-card" onClick={() => onAction('simplify')} role="menuitem" id="action-simplify">
        <FileSearch size={24} color="#4da4ff" aria-hidden="true" />
        <h3>Simplify Document</h3>
        <p>Translate complex legalese into plain language.</p>
      </button>
      <button className="action-card" onClick={() => onAction('risks')} role="menuitem" id="action-risks">
        <ShieldAlert size={24} color="#ff4757" aria-hidden="true" />
        <h3>Extract Risks & Clauses</h3>
        <p>Identify hidden obligations and high-risk terms.</p>
      </button>
    </div>
  </div>
);

export default ActionCards;
