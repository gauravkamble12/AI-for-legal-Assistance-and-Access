import React, { useState } from 'react';
import { Search, BookOpen } from 'lucide-react';

const GLOSSARY_TERMS = [
  { term: 'Arbitration', category: 'Dispute', definition: 'A private process where a neutral third party (arbitrator) resolves a dispute outside of court. The decision is usually legally binding.' },
  { term: 'Indemnity', category: 'Liability', definition: 'A clause where one party agrees to compensate the other for certain losses or damages. Common in contracts to shift financial risk.' },
  { term: 'Force Majeure', category: 'General', definition: 'A clause that excuses a party from performing its obligations due to extraordinary events beyond its control (e.g., war, earthquake, pandemic).' },
  { term: 'Non-Compete Clause', category: 'Employment', definition: 'Prevents an employee from working for a competitor or starting a competing business for a specified period after leaving a job.' },
  { term: 'Non-Disclosure Agreement (NDA)', category: 'Confidentiality', definition: 'A legal contract that prevents one or both parties from sharing confidential information with third parties.' },
  { term: 'Liquidated Damages', category: 'Payment', definition: 'A pre-agreed amount of money one party must pay if they breach the contract. It is set in advance to avoid disputes about the value of the loss.' },
  { term: 'Governing Law', category: 'Jurisdiction', definition: 'The clause that specifies which state or country\'s laws will be used to interpret and enforce the contract.' },
  { term: 'Jurisdiction', category: 'Jurisdiction', definition: 'Refers to which court system or country has the authority to hear any legal dispute arising from the agreement.' },
  { term: 'Liability Cap', category: 'Liability', definition: 'A maximum limit on the amount of money one party can claim from the other in case of a breach or damages.' },
  { term: 'Auto-Renewal', category: 'General', definition: 'A clause where a contract automatically extends for another term unless one party provides notice to cancel by a specific deadline.' },
  { term: 'Breach of Contract', category: 'General', definition: 'When one party fails to fulfill their obligations under a contract without a valid legal excuse.' },
  { term: 'Termination for Cause', category: 'Employment', definition: 'Ending a contract because one party has failed to meet its obligations (e.g., misconduct, fraud). Often requires no notice period.' },
  { term: 'Termination for Convenience', category: 'Employment', definition: 'Ending a contract without any specific reason, simply because one party chooses to. Usually requires a notice period.' },
  { term: 'Intellectual Property (IP)', category: 'IP', definition: 'Creations of the mind — inventions, designs, brands, code, or artistic works — that are legally protected by patents, copyrights, or trademarks.' },
  { term: 'Severability', category: 'General', definition: 'A clause stating that if one part of the contract is found invalid, the rest of the contract remains valid and enforceable.' },
  { term: 'Entire Agreement Clause', category: 'General', definition: 'States that the written contract is the complete and final agreement between the parties, superseding all prior discussions or promises.' },
  { term: 'Warranty', category: 'General', definition: 'A promise or guarantee made by one party about a product, service, or fact. Breach of warranty can lead to legal action.' },
  { term: 'Consideration', category: 'General', definition: 'Something of value exchanged between parties (e.g., money, service, goods). Consideration is what makes a contract legally binding.' },
  { term: 'Escrow', category: 'Payment', definition: 'A financial arrangement where a third party holds funds or assets until a specific condition in the contract is met.' },
  { term: 'Lien', category: 'Payment', definition: 'A legal right or claim against a property, typically used as security for a debt. If the debt is unpaid, the lienholder may seize the asset.' },
  { term: 'Statute of Limitations', category: 'Dispute', definition: 'The maximum time period allowed by law within which a party can initiate legal proceedings after an event (e.g., breach of contract).' },
  { term: 'Notice Period', category: 'Employment', definition: 'The amount of time (e.g., 30, 60, or 90 days) a party must give the other before terminating or making changes to a contract.' },
];

const CATEGORIES = ['All', ...new Set(GLOSSARY_TERMS.map(t => t.category))];

const categoryColors = {
  'Dispute': '#4da4ff',
  'Liability': '#ff4757',
  'General': '#8b9db8',
  'Employment': '#ffa502',
  'Confidentiality': '#b15dff',
  'Payment': '#2ed573',
  'Jurisdiction': '#ff6b81',
  'IP': '#eccc68',
};

const LegalGlossary = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = GLOSSARY_TERMS.filter(term => {
    const matchesSearch = term.term.toLowerCase().includes(search.toLowerCase()) ||
      term.definition.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'All' || term.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ margin: 0 }}>Legal Glossary</h2>
        <p>Plain-language definitions of {GLOSSARY_TERMS.length} common legal terms.</p>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Search size={16} color="#8b9db8" />
        <input
          type="text"
          placeholder="Search terms..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', width: '100%', fontSize: '14px' }}
          aria-label="Search glossary terms"
        />
      </div>

      {/* Category Filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '5px 14px',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: activeCategory === cat ? (categoryColors[cat] || '#b15dff') : 'rgba(255,255,255,0.1)',
              background: activeCategory === cat ? `${categoryColors[cat] || '#b15dff'}22` : 'transparent',
              color: activeCategory === cat ? (categoryColors[cat] || '#b15dff') : '#8b9db8',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Terms */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#8b9db8' }}>
            <BookOpen size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
            <p>No terms found for "{search}"</p>
          </div>
        ) : filtered.map((item) => (
          <div key={item.term} style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${categoryColors[item.category] || '#b15dff'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '15px', color: '#fff' }}>{item.term}</strong>
              <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '10px', background: `${categoryColors[item.category] || '#b15dff'}22`, color: categoryColors[item.category] || '#b15dff', fontWeight: 600 }}>
                {item.category}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#a3b3cc' }}>{item.definition}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LegalGlossary;
