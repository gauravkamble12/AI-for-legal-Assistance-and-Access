import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractTextFromFile } from './documents';

const pdfMocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: pdfMocks.getDocument,
}));

const createPdfFile = (content = '%PDF-1.7\ntext') => new File([content], 'agreement.pdf', {
  type: 'application/pdf',
});

describe('extractTextFromFile', () => {
  beforeEach(() => {
    pdfMocks.getDocument.mockReset();
  });

  it('extracts and normalizes a text file', async () => {
    const file = new File(['  First clause.\r\n\r\n\r\n\r\nSecond clause.  '], 'contract.txt', {
      type: 'text/plain',
    });
    await expect(extractTextFromFile(file)).resolves.toBe('First clause.\n\n\nSecond clause.');
  });

  it('rejects invalid, empty, and binary files before extraction', async () => {
    await expect(extractTextFromFile(null)).rejects.toThrow(/no valid file/i);
    await expect(extractTextFromFile(new File([], 'empty.txt', { type: 'text/plain' }))).rejects.toThrow(/empty/i);
    const binary = new File(['hello\u0000world'], 'binary.txt', { type: 'text/plain' });
    await expect(extractTextFromFile(binary)).rejects.toThrow(/binary/i);
  });

  it('rejects extracted text above the supported character limit', async () => {
    const file = new File(['a'.repeat(100_001)], 'long.txt', { type: 'text/plain' });
    await expect(extractTextFromFile(file)).rejects.toThrow(/100,000 characters/i);
  });

  it('honors cancellation before reading a file', async () => {
    const controller = new AbortController();
    controller.abort();
    const file = new File(['Contract'], 'contract.txt', { type: 'text/plain' });
    await expect(extractTextFromFile(file, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('validates the PDF signature before invoking PDF.js', async () => {
    const file = createPdfFile('not actually a pdf');
    await expect(extractTextFromFile(file)).rejects.toThrow(/not a valid PDF/i);
    expect(pdfMocks.getDocument).not.toHaveBeenCalled();
  });

  it('extracts PDF text while preserving line boundaries and progress', async () => {
    const cleanup = vi.fn();
    const page = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [
          { str: 'Clause one', hasEOL: true },
          { str: 'continues here', hasEOL: false },
        ],
      }),
      cleanup,
    };
    const destroy = vi.fn().mockResolvedValue(undefined);
    pdfMocks.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(page),
        destroy,
      }),
    });
    const onProgress = vi.fn();

    await expect(extractTextFromFile(createPdfFile(), { onProgress })).resolves.toContain('Clause one\ncontinues here');
    expect(onProgress).toHaveBeenCalledWith({ current: 1, total: 1 });
    expect(pdfMocks.getDocument).toHaveBeenCalledWith(expect.objectContaining({
      cMapUrl: '/pdfjs/cmaps/',
      standardFontDataUrl: '/pdfjs/standard_fonts/',
      wasmUrl: '/pdfjs/wasm/',
    }));
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('explains when a PDF has no selectable text', async () => {
    const page = {
      getTextContent: vi.fn().mockResolvedValue({ items: [] }),
      cleanup: vi.fn(),
    };
    pdfMocks.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(page),
        destroy: vi.fn().mockResolvedValue(undefined),
      }),
    });
    await expect(extractTextFromFile(createPdfFile())).rejects.toThrow(/selectable text/i);
  });

  it('rejects PDFs whose extracted text exceeds the character limit', async () => {
    const page = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'a'.repeat(100_001), hasEOL: false }] }),
      cleanup: vi.fn(),
    };
    pdfMocks.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(page),
        destroy: vi.fn().mockResolvedValue(undefined),
      }),
    });
    await expect(extractTextFromFile(createPdfFile())).rejects.toThrow(/100,000 characters/i);
  });

  it('rejects PDFs above the page limit', async () => {
    pdfMocks.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 101,
        destroy: vi.fn().mockResolvedValue(undefined),
      }),
    });
    await expect(extractTextFromFile(createPdfFile())).rejects.toThrow(/100 pages/i);
  });

  it('handles PDF loading failures and destroys the worker task', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    pdfMocks.getDocument.mockReturnValue({
      promise: {
        then: (_, reject) => reject(new Error('Invalid PDF structure')),
      },
      destroy,
    });
    await expect(extractTextFromFile(createPdfFile())).rejects.toThrow(/invalid PDF structure/i);
    expect(destroy).toHaveBeenCalledOnce();
  });
});
