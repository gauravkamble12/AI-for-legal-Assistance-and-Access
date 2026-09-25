import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAnalyzeRequest, resetServerRateLimit } from './analyze';

const API_KEY = 'server-only-test-key';

const createRequest = (body = {}, options = {}) => new Request('http://localhost/api/analyze', {
  method: options.method || 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'http://localhost',
    ...options.headers,
  },
  body: options.method === 'GET' ? undefined : JSON.stringify(body),
});

const mockGemini = (text = 'Analysis result', status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: vi.fn().mockResolvedValue(JSON.stringify({
    candidates: [{ content: { parts: [{ text }] } }],
  })),
});

describe('handleAnalyzeRequest', () => {
  beforeEach(() => {
    resetServerRateLimit();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockGemini()));
  });

  it('rejects unsupported HTTP methods', async () => {
    const response = await handleAnalyzeRequest(createRequest({}, { method: 'GET' }), { apiKey: API_KEY });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });

  it('rejects cross-origin requests', async () => {
    const response = await handleAnalyzeRequest(
      createRequest({ documentText: 'Contract', task: 'risks' }, { headers: { Origin: 'https://attacker.example' } }),
      { apiKey: API_KEY },
    );
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requires configured credentials, valid tasks, and readable documents', async () => {
    let response = await handleAnalyzeRequest(createRequest({ documentText: 'Contract', task: 'risks' }), { apiKey: '' });
    expect(response.status).toBe(503);

    response = await handleAnalyzeRequest(createRequest({ documentText: 'Contract', task: 'unknown' }), { apiKey: API_KEY });
    expect(response.status).toBe(400);

    response = await handleAnalyzeRequest(createRequest({ documentText: '', task: 'risks' }), { apiKey: API_KEY });
    expect(response.status).toBe(400);
  });

  it('calls Gemini with a server header and untrusted-data boundaries', async () => {
    const response = await handleAnalyzeRequest(createRequest({
      documentText: '<contract>Payment & termination</contract>',
      task: 'chat',
      question: 'What happens on termination?',
      history: [
        { role: 'user', content: 'Earlier question' },
        { role: 'assistant', content: 'Earlier answer' },
      ],
    }), { apiKey: API_KEY });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: 'Analysis result' });
    expect(fetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-goog-api-key': API_KEY }),
      }),
    );
    const geminiBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(geminiBody.systemInstruction.parts[0].text).toMatch(/untrusted source material/i);
    expect(geminiBody.contents[0].parts[0].text).toContain('&lt;contract&gt;Payment &amp; termination&lt;/contract&gt;');
    expect(geminiBody.contents[0].parts[0].text).toContain('<message speaker="user">\nEarlier question\n</message>');
    expect(geminiBody.contents[0].parts[0].text).toContain('<message speaker="assistant">\nEarlier answer\n</message>');
  });

  it('requires a current question for chat requests', async () => {
    const response = await handleAnalyzeRequest(createRequest({ documentText: 'Contract', task: 'chat' }), { apiKey: API_KEY });
    expect(response.status).toBe(400);
  });

  it('rejects oversized request bodies before parsing them', async () => {
    const response = await handleAnalyzeRequest(createRequest({}, {
      headers: { 'Content-Length': '600001' },
    }), { apiKey: API_KEY });
    expect(response.status).toBe(413);
  });

  it('returns controlled errors for provider failures', async () => {
    fetch.mockResolvedValueOnce(mockGemini('', 429));
    let response = await handleAnalyzeRequest(createRequest({ documentText: 'Contract', task: 'simplify' }), { apiKey: API_KEY });
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');

    fetch.mockResolvedValueOnce({ ok: true, status: 200, text: vi.fn().mockResolvedValue('{invalid json') });
    response = await handleAnalyzeRequest(createRequest({ documentText: 'Contract', task: 'simplify' }), { apiKey: API_KEY });
    expect(response.status).toBe(502);
  });

  it('returns a controlled error when Gemini produces no text', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ candidates: [] })),
    });
    const response = await handleAnalyzeRequest(createRequest({ documentText: 'Contract', task: 'questions' }), { apiKey: API_KEY });
    expect(response.status).toBe(422);
  });

  it('distinguishes provider safety and output-length failures', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } })),
    });
    let response = await handleAnalyzeRequest(createRequest({ documentText: 'Contract', task: 'chat', question: 'Explain' }), { apiKey: API_KEY });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/provider declined/i) });

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'Partial' }] } }],
      })),
    });
    response = await handleAnalyzeRequest(createRequest({ documentText: 'Contract', task: 'simplify' }), { apiKey: API_KEY });
    expect(response.status).toBe(502);
  });

  it('accepts documents with multibyte UTF-8 content within the byte budget', async () => {
    const response = await handleAnalyzeRequest(createRequest({ documentText: '法'.repeat(100_000), task: 'risks' }), { apiKey: API_KEY });
    expect(response.status).toBe(200);
  });

  it('does not charge invalid requests against the rate limit', async () => {
    for (let index = 0; index < 10; index += 1) {
      const response = await handleAnalyzeRequest(createRequest({ documentText: '', task: 'risks' }), { apiKey: API_KEY });
      expect(response.status).toBe(400);
    }
    const response = await handleAnalyzeRequest(createRequest({ documentText: 'Contract', task: 'risks' }), { apiKey: API_KEY });
    expect(response.status).toBe(200);
  });

  it('enforces a per-client server request window', async () => {
    for (let index = 0; index < 10; index += 1) {
      const response = await handleAnalyzeRequest(createRequest({ documentText: 'Contract', task: 'risks' }), { apiKey: API_KEY });
      expect(response.status).toBe(200);
    }
    const response = await handleAnalyzeRequest(createRequest({ documentText: 'Contract', task: 'risks' }), { apiKey: API_KEY });
    expect(response.status).toBe(429);
  });
});
