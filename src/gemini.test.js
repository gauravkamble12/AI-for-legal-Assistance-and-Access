import { describe, it, expect, vi } from 'vitest';
import { analyzeDocument } from './gemini';

// Mock the global fetch function
global.fetch = vi.fn();

describe('gemini API utility', () => {
  it('should throw an error if API key is missing', async () => {
    await expect(analyzeDocument(null, 'Some text', 'summarize')).rejects.toThrow("API Key is missing.");
  });

  it('should call the correct endpoint with the correct payload', async () => {
    // Mock successful response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Mocked response" }] } }]
      })
    });

    const result = await analyzeDocument('mock-api-key', 'Document text here', 'simplify');
    
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('mock-api-key'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(result).toBe("Mocked response");
  });

  it('should handle API errors gracefully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: { message: "Invalid API key" }
      })
    });

    await expect(analyzeDocument('bad-key', 'text', 'risks')).rejects.toThrow("Invalid API key");
  });
});
