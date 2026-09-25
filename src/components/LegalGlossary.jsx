import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { debounce } from '../utils/debounce';

const GLOSSARY_TERMS = [
  { term: 'Arbitration', category: 'Dispute', definition: 'A private process where a neutral third party (arbitrator) resolves a dispute outside of court. The decision is usually legally binding.' },
  { term: 'Indemnity', category: 'Liability', definition: 'A clause where one party agrees to compensate the other for certain losses or damages. Common in contracts to shift financial risk.' },
  { term: 'Force Majeure', category: 'General', definition: 'A clause that excuses a party from performing its obligations due to extraordinary events beyond its control, such as war, earthquake, or pandemic.' },
  { term: 'Non-Compete Clause', category: 'Employment', definition: 'Prevents an employee from working for a competitor or starting a competing business for a specified period after leaving a job.' },
  { term: 'Non-Disclosure Agreement (NDA)', category: 'Confidentiality', definition: 'A legal contract that prevents one or both parties from sharing confidential information with third parties.' },
  { term: 'Liquidated Damages', category: 'Payment', definition: 'A pre-agreed amount of money one party must pay if they breach the contract. It is set in advance to avoid disputes about the value of the loss.' },
  { term: 'Governing Law', category: 'Jurisdiction', definition: 'The clause that specifies which state or country laws will be used to interpret and enforce the contract.' },
  { term: 'Jurisdiction', category: 'Jurisdiction', definition: 'Refers to which court system or country has the authority to hear a legal dispute arising from the agreement.' },
  { term: 'Liability Cap', category: 'Liability', definition: 'A maximum limit on the amount of money one party can claim from the other in case of a breach or damages.' },
  { term: 'Auto-Renewal', category: 'General', definition: 'A clause where a contract automatically extends for another term unless one party provides notice to cancel by a specific deadline.' },
  { term: 'Breach of Contract', category: 'General', definition: 'When one party fails to fulfill its obligations under a contract without a valid legal excuse.' },
  { term: 'Termination for Cause', category: 'Employment', definition: 'Ending a contract because one party has failed to meet its obligations, such as misconduct or fraud. Often requires no notice period.' },
  { term: 'Termination for Convenience', category: 'Employment', definition: 'Ending a contract without any specific reason, simply because one party chooses to. Usually requires a notice period.' },
  { term: 'Intellectual Property (IP)', category: 'IP', definition: 'Creations of the mind, including inventions, designs, brands, code, or artistic works, that may be legally protected by patents, copyrights, or trademarks.' },
  { term: 'Severability', category: 'General', definition: 'A clause stating that if one part of the contract is found invalid, the rest of the contract remains valid and enforceable.' },
  { term: 'Entire Agreement Clause', category: 'General', definition: 'States that the written contract is the complete and final agreement, superseding prior discussions or promises.' },
  { term: 'Warranty', category: 'General', definition: 'A promise or guarantee made about a product, service, or fact. Breach of warranty can lead to legal action.' },
  { term: 'Consideration', category: 'General', definition: 'Something of value exchanged between parties. Consideration is often required to make a contract legally binding.' },
  { term: 'Escrow', category: 'Payment', definition: 'A financial arrangement where a third party holds funds or assets until a specified contract condition is met.' },
  { term: 'Lien', category: 'Payment', definition: 'A legal right or claim against property, typically used as security for debt. If the debt is unpaid, the lienholder may seize the asset.' },
  { term: 'Statute of Limitations', category: 'Dispute', definition: 'The maximum time period allowed by law within which a party can initiate legal proceedings after an event such as a contract breach.' },
  { term: 'Notice Period', category: 'Employment', definition: 'The time a party must give before terminating or changing a contract, such as 30, 60, or 90 days.' },
];

const CATEGORIES = ['All', ...new Set(GLOSSARY_TERMS.map((term) => term.category))];

const LegalGlossary = () => {
  const [inputValue, setInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const updateSearch = useMemo(() => debounce(setSearch, 150), []);

  useEffect(() => () => updateSearch.cancel(), [updateSearch]);

  const filteredTerms = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return GLOSSARY_TERMS.filter((term) => {
      const matchesSearch = !query
        || term.term.toLocaleLowerCase().includes(query)
        || term.definition.toLocaleLowerCase().includes(query);
      const matchesCategory = activeCategory === 'All' || term.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [activeCategory, search]);

  const handleSearch = (value) => {
    setInputValue(value);
    updateSearch(value);
  };

  return (
    <div className="glossary-view animate-fade-in">
      <div className="view-heading">
        <div>
          <h1>Legal Glossary</h1>
          <p>Plain-language definitions of {GLOSSARY_TERMS.length} common legal terms.</p>
        </div>
      </div>

      <div className="search-field">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search terms or definitions"
          value={inputValue}
          onChange={(event) => handleSearch(event.target.value)}
          aria-label="Search glossary terms"
        />
      </div>

      <div className="category-filters" aria-label="Filter glossary by category">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            className={activeCategory === category ? 'category-filter active' : 'category-filter'}
            type="button"
            onClick={() => setActiveCategory(category)}
            aria-pressed={activeCategory === category}
            data-category={category}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="glossary-results" aria-live="polite">
        {filteredTerms.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={36} aria-hidden="true" />
            <h2>No matching terms</h2>
            <p>No glossary terms match “{inputValue}”.</p>
          </div>
        ) : filteredTerms.map((item) => (
          <article className="glossary-term" key={item.term} data-category={item.category}>
            <div className="glossary-term-heading">
              <h2>{item.term}</h2>
              <span>{item.category}</span>
            </div>
            <p>{item.definition}</p>
          </article>
        ))}
      </div>
    </div>
  );
};

export default LegalGlossary;
