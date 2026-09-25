export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_CHARS = 100_000;
export const MAX_QUESTION_CHARS = 2_000;
export const MAX_RESPONSE_CHARS = 60_000;
export const MAX_CHAT_MESSAGES = 20;
export const MAX_CHAT_CONTEXT_MESSAGES = 8;
export const MAX_CHAT_CONTEXT_MESSAGE_CHARS = 6_000;

const ALLOWED_TYPES = {
  '.txt': new Set(['', 'text/plain', 'application/octet-stream']),
  '.md': new Set(['', 'text/plain', 'text/markdown', 'application/octet-stream']),
  '.pdf': new Set(['', 'application/pdf', 'application/octet-stream']),
};

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const requestLog = [];

export const normalizeText = (text) => {
  if (typeof text !== 'string') return '';

  const printable = Array.from(text.normalize('NFKC'), (character) => {
    const code = character.charCodeAt(0);
    return code === 9 || code === 10 || (code >= 32 && code !== 127) ? character : '';
  }).join('');

  return printable
    .replace(/\r\n?/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
};

export const validateFile = (file) => {
  if (!file || typeof file.name !== 'string' || !Number.isFinite(file.size)) {
    return { valid: false, error: 'No valid file was selected.' };
  }

  const name = file.name.trim();
  const extensionIndex = name.lastIndexOf('.');
  const extension = extensionIndex > 0 ? name.slice(extensionIndex).toLowerCase() : '';
  const allowedTypes = ALLOWED_TYPES[extension];

  if (!allowedTypes) {
    return { valid: false, error: 'Unsupported file type. Choose a .txt, .md, or .pdf file.' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'The selected file is empty.' };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const size = (file.size / 1024 / 1024).toFixed(2);
    return { valid: false, error: `The selected file is ${size} MB. The maximum size is 5 MB.` };
  }

  const mimeType = typeof file.type === 'string' ? file.type.toLowerCase().split(';')[0] : '';
  if (!allowedTypes.has(mimeType)) {
    return { valid: false, error: 'The file content type does not match its extension.' };
  }

  return { valid: true, error: null };
};

export const checkRateLimit = () => {
  const now = Date.now();
  while (requestLog.length > 0 && now - requestLog[0] >= RATE_LIMIT_WINDOW_MS) {
    requestLog.shift();
  }

  if (requestLog.length >= RATE_LIMIT_MAX) return false;
  requestLog.push(now);
  return true;
};

export const resetRateLimit = () => {
  requestLog.length = 0;
};
