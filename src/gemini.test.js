import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeDocument } from './gemini';

// Mock the global fetch function
global.fetch = vi.fn();

// Mock security utils to control rate limiting in tests
vi.mock('./utils/security', () => ({
  sanitizeInput: vi.fn((text) => text),
  checkRateLimit: vi.fn(() => true),
}));

import { sanitizeInput, checkRateLimit } from './utils/security';

describe('gemini.js - analyzeDocument()', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockReturnValue(true);
    sanitizeInput.mockImplementation((text) => text ?? '');
  });

  // --- Error Handling ---
  it('should throw if API key is missing', async () => {
    await expect(analyzeDocument(null, 'Some text', 'risks'))
      .rejects.toThrow("API Key is missing.");
  });

  it('should throw if API key is empty string', async () => {
    await expect(analyzeDocument('', 'Some text', 'risks'))
      .rejects.toThrow("API Key is missing.");
  });

  it('should throw when rate limited', async () => {
    checkRateLimit.mockReturnValue(false);
    await expect(analyzeDocument('key', 'text', 'simplify'))
      .rejects.toThrow("Too many requests");
  });

  it('should throw if document content is empty after sanitization', async () => {
    sanitizeInput.mockReturnValue('');
    await expect(analyzeDocument('valid-key', '   ', 'risks'))
      .rejects.toThrow("Document content is empty or invalid.");
  });

  it('should handle Gemini API error responses gracefully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "Invalid API key provided." } })
    });
    await expect(analyzeDocument('bad-key', 'contract text', 'risks'))
      .rejects.toThrow("Invalid API key provided.");
  });

  it('should handle network failures gracefully', async () => {
    global.fetch.mockRejectedValueOnce(new Error("Network error"));
    await expect(analyzeDocument('key', 'text', 'simplify'))
      .rejects.toThrow("Network error");
  });

  // --- Success Cases ---
  const mockSuccess = (text = "Mocked AI response") => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text }] } }]
      })
    });
  };

  it('should return AI text on successful simplify call', async () => {
    mockSuccess("Simple explanation: ...");
    const result = await analyzeDocument('key', 'contract text', 'simplify');
    expect(result).toBe("Simple explanation: ...");
  });

  it('should return AI text on successful risks call', async () => {
    mockSuccess("Risk analysis result");
    const result = await analyzeDocument('key', 'contract text', 'risks');
    expect(result).toBe("Risk analysis result");
  });

  it('should return AI text on successful questions call', async () => {
    mockSuccess("1. What are my rights?");
    const result = await analyzeDocument('key', 'contract text', 'questions');
    expect(result).toBe("1. What are my rights?");
  });

  it('should include userQuestion in chat prompt', async () => {
    mockSuccess("Based on the document...");
    await analyzeDocument('key', 'contract text', 'chat', 'Can I be terminated?');
    const bodyParsed = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(bodyParsed.contents[0].parts[0].text).toContain("Can I be terminated?");
  });

  it('should call the correct Gemini API endpoint', async () => {
    mockSuccess();
    await analyzeDocument('my-api-key', 'text', 'risks');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('my-api-key'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should send Content-Type: application/json header', async () => {
    mockSuccess();
    await analyzeDocument('key', 'text', 'risks');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' }
      })
    );
  });
});
