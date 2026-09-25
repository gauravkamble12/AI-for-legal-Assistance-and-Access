import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  MAX_DOCUMENT_CHARS,
  normalizeText,
  validateFile,
} from './security';

export const MAX_PDF_PAGES = 100;
const PDF_ASSET_BASE_URL = `${import.meta.env.BASE_URL}pdfjs`;

const throwIfAborted = (signal) => {
  if (signal?.aborted) {
    throw new DOMException('The operation was cancelled.', 'AbortError');
  }
};

const readWithFileReader = (file, method, signal) => new Promise((resolve, reject) => {
  throwIfAborted(signal);

  const reader = new FileReader();
  const abort = () => {
    if (reader.readyState === FileReader.LOADING) reader.abort();
    reject(new DOMException('The operation was cancelled.', 'AbortError'));
  };

  reader.onload = () => {
    signal?.removeEventListener('abort', abort);
    resolve(reader.result);
  };
  reader.onerror = () => {
    signal?.removeEventListener('abort', abort);
    reject(new Error(`Could not read ${file.name}.`));
  };
  reader.onabort = () => {
    signal?.removeEventListener('abort', abort);
    reject(new DOMException('The operation was cancelled.', 'AbortError'));
  };
  signal?.addEventListener('abort', abort, { once: true });

  try {
    reader[method](file);
  } catch {
    signal?.removeEventListener('abort', abort);
    reject(new Error(`Could not read ${file.name}.`));
  }
});

const verifyPdfSignature = async (file) => {
  const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const signature = new TextDecoder().decode(bytes);
  if (signature !== '%PDF-') {
    throw new Error('The selected .pdf file is not a valid PDF.');
  }
};

const extractPdfText = async (file, signal, onProgress) => {
  throwIfAborted(signal);
  await verifyPdfSignature(file);
  const buffer = await readWithFileReader(file, 'readAsArrayBuffer', signal);
  throwIfAborted(signal);

  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    cMapUrl: `${PDF_ASSET_BASE_URL}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDF_ASSET_BASE_URL}/standard_fonts/`,
    wasmUrl: `${PDF_ASSET_BASE_URL}/wasm/`,
  });
  let pdf = null;

  try {
    pdf = await loadingTask.promise;
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new Error(`PDFs are limited to ${MAX_PDF_PAGES} pages.`);
    }

    const pages = [];
    let extractedCharacters = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      throwIfAborted(signal);
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item) => typeof item?.str === 'string')
        .map((item) => `${item.str}${item.hasEOL ? '\n' : ' '}`)
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      page.cleanup();

      extractedCharacters += pageText.length;
      if (extractedCharacters > MAX_DOCUMENT_CHARS) {
        throw new Error('Extracted text is limited to 100,000 characters.');
      }

      if (pageText) pages.push(`--- Page ${pageNumber} ---\n${pageText}`);
      onProgress?.({ current: pageNumber, total: pdf.numPages });
    }

    const text = normalizeText(pages.join('\n\n'));
    if (!text) {
      throw new Error('No selectable text was found. Scanned PDFs require OCR before upload.');
    }

    return text;
  } finally {
    await (pdf || loadingTask).destroy?.();
  }
};

export const extractTextFromFile = async (file, { signal, onProgress } = {}) => {
  const validation = validateFile(file);
  if (!validation.valid) throw new Error(validation.error);

  throwIfAborted(signal);
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

  if (extension === '.pdf') return extractPdfText(file, signal, onProgress);

  const rawText = await readWithFileReader(file, 'readAsText', signal);
  if (typeof rawText !== 'string' || rawText.includes('\u0000')) {
    throw new Error('The selected file appears to be binary.');
  }
  const text = normalizeText(rawText);
  if (!text) throw new Error('The selected file does not contain readable text.');
  if (text.length > MAX_DOCUMENT_CHARS) {
    throw new Error('Text files are limited to 100,000 characters.');
  }

  return text;
};
