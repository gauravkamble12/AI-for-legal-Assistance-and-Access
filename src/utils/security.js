/**
 * Input Sanitization Utility
 * Prevents prompt injection and XSS attacks.
 */

// Max characters sent to the LLM per request for security & cost control
const MAX_INPUT_LENGTH = 50000;

// Simple rate limiting: max 10 requests per minute in the client
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

const requestLog = [];

/**
 * Sanitizes user-provided text to prevent prompt injection attacks.
 * Strips known injection patterns and enforces a max length.
 * @param {string} text - Raw user input
 * @returns {string} - Sanitized text
 */
export const sanitizeInput = (text) => {
  if (typeof text !== 'string') return '';

  return text
    .slice(0, MAX_INPUT_LENGTH) // Enforce length limit
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Strip non-printable control chars
    .replace(/(ignore (previous|above|all) instructions?)/gi, '[REDACTED]') // Block prompt injection
    .replace(/(system prompt|you are now|forget everything)/gi, '[REDACTED]')
    .trim();
};

/**
 * Checks if the current user has exceeded the rate limit.
 * @returns {boolean} - true if allowed, false if rate limited
 */
export const checkRateLimit = () => {
  const now = Date.now();
  // Remove entries older than the window
  while (requestLog.length > 0 && now - requestLog[0] > RATE_LIMIT_WINDOW_MS) {
    requestLog.shift();
  }
  if (requestLog.length >= RATE_LIMIT_MAX) {
    return false; // Rate limited
  }
  requestLog.push(now);
  return true;
};
