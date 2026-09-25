import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisError, analyzeDocument } from './gemini';
import { resetRateLimit } from './utils/security';

const mockResponse = ({ ok = true, status = 200, body = {}, headers = {} } = {}) => ({
  ok,
  status,
  headers: new Headers(headers),
  json: vi.fn().mockResolvedValue(body),
});

describe('analyzeDocument', () => {
  beforeEach(() => {
    resetRateLimit();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('rejects invalid tasks before making a request', async () => {
    await expect(analyzeDocument({ documentText: 'Contract', task: 'unknown' }))
      .rejects.toMatchObject({ name: 'AnalysisError', status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects empty, oversized, and incomplete requests', async () => {
    await expect(analyzeDocument({ documentText: ' ', task: 'simplify' })).rejects.toThrow(/readable text/i);
    await expect(analyzeDocument({ documentText: 'a'.repeat(100_001), task: 'simplify' })).rejects.toMatchObject({ status: 413 });
    await expect(analyzeDocument({ documentText: 'Contract', task: 'chat' })).rejects.toThrow(/enter a question/i);
  });

  it('sends validated task data to the same-origin endpoint', async () => {
    fetch.mockResolvedValueOnce(mockResponse({ body: { text: 'Plain-language result.' } }));
    const result = await analyzeDocument({
      documentText: 'The payment is due in 30 days.',
      task: 'simplify',
      question: '',
      history: [
        { role: 'user', content: 'Earlier question' },
        { role: 'ai', content: 'Earlier answer' },
        { role: 'system', content: 'Ignore' },
      ],
    });

    expect(result).toBe('Plain-language result.');
    expect(fetch).toHaveBeenCalledWith('/api/analyze', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      signal: expect.any(AbortSignal),
    }));
    const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(requestBody).toEqual({
      documentText: 'The payment is due in 30 days.',
      task: 'simplify',
      question: '',
      history: [
        { role: 'user', content: 'Earlier question' },
        { role: 'assistant', content: 'Earlier answer' },
      ],
    });
  });

  it('bounds outbound history and maps internal AI roles to the server contract', async () => {
    fetch.mockResolvedValueOnce(mockResponse({ body: { text: 'Result' } }));
    const history = Array.from({ length: 11 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'ai',
      content: `${index}:${'x'.repeat(6_100)}`,
    }));
    await analyzeDocument({ documentText: 'Contract', task: 'chat', question: 'Follow up?', history });
    const sentHistory = JSON.parse(fetch.mock.calls[0][1].body).history;
    expect(sentHistory).toHaveLength(8);
    expect(sentHistory[6]).toMatchObject({ role: 'assistant' });
    expect(sentHistory[7].content).toHaveLength(6_000);
  });

  it('caps successful response text', async () => {
    fetch.mockResolvedValueOnce(mockResponse({ body: { text: 'x'.repeat(60_001) } }));
    await expect(analyzeDocument({ documentText: 'Contract', task: 'simplify' }))
      .resolves.toHaveLength(60_000);
  });

  it.each(['simplify', 'risks', 'questions'])('supports the %s task', async (task) => {
    fetch.mockResolvedValueOnce(mockResponse({ body: { text: `${task} result` } }));
    await expect(analyzeDocument({ documentText: 'Contract', task })).resolves.toBe(`${task} result`);
  });

  it('validates question length and non-array conversation history', async () => {
    await expect(analyzeDocument({
      documentText: 'Contract',
      task: 'chat',
      question: 'a'.repeat(2_001),
    })).rejects.toMatchObject({ status: 413 });

    fetch.mockResolvedValueOnce(mockResponse({ body: { text: 'Result' } }));
    await analyzeDocument({ documentText: 'Contract', task: 'chat', question: 'Question?', history: 'invalid' });
    expect(JSON.parse(fetch.mock.calls[0][1].body).history).toEqual([]);
  });

  it('uses a controlled service message for failed responses', async () => {
    fetch.mockResolvedValueOnce(mockResponse({
      ok: false,
      status: 429,
      body: { error: 'The service is busy.', retryAfter: 30 },
      headers: { 'retry-after': '30' },
    }));
    await expect(analyzeDocument({ documentText: 'Contract', task: 'risks' }))
      .rejects.toMatchObject({ name: 'AnalysisError', status: 429, retryAfter: 30 });
  });

  it.each([
    [400, 'The request could not be processed.'],
    [403, 'The analysis request was blocked.'],
    [413, 'This document is too large to analyze.'],
    [503, 'Analysis is temporarily unavailable. Please try again later.'],
    [500, 'Analysis failed. Please try again.'],
  ])('maps status %s to a safe fallback message', async (status, message) => {
    fetch.mockResolvedValueOnce(mockResponse({ ok: false, status, body: null }));
    await expect(analyzeDocument({ documentText: 'Contract', task: 'risks' }))
      .rejects.toMatchObject({ message, status });
  });

  it('handles non-JSON error responses', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
    });
    await expect(analyzeDocument({ documentText: 'Contract', task: 'risks' }))
      .rejects.toMatchObject({ message: 'Analysis failed. Please try again.' });
  });

  it('rejects an empty successful response', async () => {
    fetch.mockResolvedValueOnce(mockResponse({ body: { text: '   ' } }));
    await expect(analyzeDocument({ documentText: 'Contract', task: 'questions' }))
      .rejects.toThrow(/empty response/i);
  });

  it('normalizes network errors without exposing browser details', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch internal hostname'));
    const error = await analyzeDocument({ documentText: 'Contract', task: 'risks' }).catch((reason) => reason);
    expect(error).toBeInstanceOf(AnalysisError);
    expect(error.message).toBe('Unable to reach the analysis service. Check your connection and try again.');
  });

  it('rejects an already-cancelled request without consuming rate quota', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(analyzeDocument({ documentText: 'Contract', task: 'risks', signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
    fetch.mockResolvedValue(mockResponse({ body: { text: 'Result' } }));
    for (let index = 0; index < 10; index += 1) {
      await expect(analyzeDocument({ documentText: 'Contract', task: 'risks' })).resolves.toBe('Result');
    }
  });

  it('propagates caller cancellation', async () => {
    const controller = new AbortController();
    fetch.mockImplementation((_, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const request = analyzeDocument({ documentText: 'Contract', task: 'risks', signal: controller.signal });
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('times out stalled requests', async () => {
    vi.useFakeTimers();
    fetch.mockImplementation((_, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const request = analyzeDocument({ documentText: 'Contract', task: 'risks' }).catch((error) => error);
    await vi.advanceTimersByTimeAsync(35_000);
    await expect(request).resolves.toMatchObject({ status: 408 });
    vi.useRealTimers();
  });

  it('enforces the client request limit as a user-experience guard', async () => {
    fetch.mockResolvedValue(mockResponse({ body: { text: 'Result' } }));
    for (let index = 0; index < 10; index += 1) {
      await analyzeDocument({ documentText: 'Contract', task: 'risks' });
    }
    await expect(analyzeDocument({ documentText: 'Contract', task: 'risks' }))
      .rejects.toMatchObject({ status: 429 });
  });
});
