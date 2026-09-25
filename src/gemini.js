import {
  MAX_CHAT_CONTEXT_MESSAGE_CHARS,
  MAX_CHAT_CONTEXT_MESSAGES,
  MAX_DOCUMENT_CHARS,
  MAX_QUESTION_CHARS,
  MAX_RESPONSE_CHARS,
  checkRateLimit,
  normalizeText,
} from './utils/security';

const VALID_TASKS = new Set(['simplify', 'risks', 'questions', 'chat']);
const REQUEST_TIMEOUT_MS = 35_000;

export class AnalysisError extends Error {
  constructor(message, status = 500, retryAfter = null) {
    super(message);
    this.name = 'AnalysisError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

const getStatusMessage = (status) => {
  if (status === 400) return 'The request could not be processed.';
  if (status === 403) return 'The analysis request was blocked.';
  if (status === 413) return 'This document is too large to analyze.';
  if (status === 429) return 'The service is busy. Please wait before trying again.';
  if (status === 503) return 'Analysis is temporarily unavailable. Please try again later.';
  return 'Analysis failed. Please try again.';
};

const parseResponse = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const analyzeDocument = async ({
  documentText,
  task,
  question = '',
  history = [],
  signal,
}) => {
  const normalizedDocument = normalizeText(documentText);
  const normalizedQuestion = normalizeText(question);

  if (!VALID_TASKS.has(task)) {
    throw new AnalysisError('Choose a valid analysis task.', 400);
  }

  if (!normalizedDocument) {
    throw new AnalysisError('The document does not contain readable text.', 400);
  }

  if (normalizedDocument.length > MAX_DOCUMENT_CHARS) {
    throw new AnalysisError('The document is too large to analyze.', 413);
  }

  if (task === 'chat' && !normalizedQuestion) {
    throw new AnalysisError('Enter a question about the document.', 400);
  }

  if (normalizedQuestion.length > MAX_QUESTION_CHARS) {
    throw new AnalysisError('The question is too long.', 413);
  }

  if (signal?.aborted) {
    throw new DOMException('The request was cancelled.', 'AbortError');
  }

  const boundedHistory = (Array.isArray(history) ? history : [])
    .slice(-MAX_CHAT_CONTEXT_MESSAGES)
    .flatMap((message) => {
      if (!message || typeof message !== 'object') return [];
      const role = message.role === 'user' ? 'user' : ['assistant', 'ai'].includes(message.role) ? 'assistant' : null;
      const content = normalizeText(message.content).slice(0, MAX_CHAT_CONTEXT_MESSAGE_CHARS);
      return role && content ? [{ role, content }] : [];
    });

  if (!checkRateLimit()) {
    throw new AnalysisError('Too many requests. Please wait a moment and try again.', 429, 60);
  }

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal.reason);
  let timedOut = false;

  if (signal?.aborted) abortFromCaller();
  signal?.addEventListener('abort', abortFromCaller, { once: true });

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentText: normalizedDocument,
        task,
        question: normalizedQuestion,
        history: boundedHistory,
      }),
      signal: controller.signal,
    });

    const payload = await parseResponse(response);

    if (!response.ok) {
      const retryAfter = Number(response.headers.get('retry-after')) || payload?.retryAfter || null;
      const message = typeof payload?.error === 'string' ? payload.error : getStatusMessage(response.status);
      throw new AnalysisError(message, response.status, retryAfter);
    }

    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
    if (!text) {
      throw new AnalysisError('The service returned an empty response. Please try again.', 502);
    }

    return text.slice(0, MAX_RESPONSE_CHARS);
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    if (signal?.aborted) throw error;
    if (timedOut) throw new AnalysisError('The request timed out. Please try again.', 408);
    throw new AnalysisError('Unable to reach the analysis service. Check your connection and try again.', 503);
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
};
