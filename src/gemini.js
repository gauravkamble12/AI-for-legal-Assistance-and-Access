import { sanitizeInput, checkRateLimit } from './utils/security';

/**
 * Sends a legal document to the Google Gemini API for analysis.
 * @param {string} apiKey - The Gemini API Key (from env variables)
 * @param {string} documentText - The raw document text
 * @param {string} task - One of: simplify | risks | questions | chat
 * @param {string} userQuestion - Only used when task is 'chat'
 * @returns {Promise<string>} - Markdown-formatted AI response
 */
export const analyzeDocument = async (apiKey, documentText, task, userQuestion = "") => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  // Security: Rate limit check
  if (!checkRateLimit()) {
    throw new Error("Too many requests. Please wait a moment before trying again.");
  }

  // Security: Sanitize all inputs before sending to LLM
  const safeDocument = sanitizeInput(documentText);
  const safeQuestion = sanitizeInput(userQuestion);

  if (!safeDocument) {
    throw new Error("Document content is empty or invalid.");
  }

  let prompt = "";

  if (task === 'simplify') {
    prompt = `You are a legal‑information assistant. Rewrite the document below in plain language at Grade 8 reading level. Keep all key conditions, obligations, and exceptions intact. Add 1 realistic example. Use this structure:
- Simple explanation:
- Example:
- Unclear or risky parts (if any):

Document:
${safeDocument}`;

  } else if (task === 'risks') {
    prompt = `You are a legal‑information assistant. Identify and extract important clauses and risks (e.g. Termination, Auto-renewal, Payment, Confidentiality, IP, Non-compete). For each, provide a plain-language meaning and risk level (Low/Medium/High with a reason). Format as a bullet list.

Document:
${safeDocument}`;

  } else if (task === 'questions') {
    prompt = `You are a legal‑information assistant. Generate 6–10 specific, practical questions for the user to ask a qualified lawyer about this document. Prioritize high-risk clauses and unclear terms.

Document:
${safeDocument}`;

  } else if (task === 'chat') {
    prompt = `You are a legal‑information assistant. Answer the user's question based ONLY on the provided legal document. If the answer is not in the document, say "I cannot find this in the provided document." Do not invent facts. End with "Note: This is general information, not legal advice."

Document:
${safeDocument}

User Question:
${safeQuestion}`;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Failed to analyze document.");
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
