export const analyzeDocument = async (apiKey, documentText, task, userQuestion = "") => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  let prompt = "";
  
  if (task === 'simplify') {
    prompt = `You are a legal‑information assistant. Focus on the provided text. Rewrite it in plain language at about Grade 8 reading level. Keep all key conditions, obligations, and exceptions intact. Add 1 short, realistic example showing how it might apply. Use this structure:
- Simple explanation:
- Example:
- Unclear or risky parts (if any):

Document Text:
${documentText}`;
  } else if (task === 'risks') {
    prompt = `You are a legal‑information assistant. Identify and extract important clauses and risks in this document. For each, provide a short plain-language meaning and risk level (Low/Medium/High). Format as a bulleted list.

Document Text:
${documentText}`;
  } else if (task === 'questions') {
    prompt = `You are a legal‑information assistant. Read the document text and generate 6–10 specific, practical questions the user should ask a qualified lawyer about this document. Prioritize high-risk clauses and unclear terms.

Document Text:
${documentText}`;
  } else if (task === 'chat') {
    prompt = `You are a legal‑information assistant. Answer the user's question based ONLY on the provided legal document. If the document doesn't contain the answer, say "I cannot find the answer to this in the provided document." Do not invent facts.

Document Text:
${documentText}

User Question:
${userQuestion}`;
  } else {
    prompt = `Summarize this legal document in simple terms:
${documentText}`;
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
