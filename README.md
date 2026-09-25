# LexAssist AI

LexAssist AI is a React application that helps non-lawyers review legal documents, identify potentially important clauses, generate questions for a qualified lawyer, and ask document-specific questions. It provides general information, not legal advice.

## Features

- Uploads `.txt`, `.md`, and text-based PDF files by picker or drag and drop
- Extracts selectable PDF text locally with a bundled PDF.js worker
- Produces plain-language summaries, clause/risk analysis, and lawyer-question checklists
- Supports contextual follow-up questions grounded in the uploaded document
- Exports analysis and conversations as Markdown
- Keeps history off by default and optionally stores up to 10 sessions in browser `localStorage`
- Includes a searchable local legal glossary
- Supports keyboard navigation, responsive layouts, reduced motion, and screen-reader status updates

## Technology

- React 19 and Vite
- Google Gemini 2.5 Flash through a Netlify serverless function
- PDF.js for local browser-side extraction
- React Markdown with raw HTML disabled and unsafe URL schemes removed
- Vitest and React Testing Library
- Oxlint and V8 coverage

## Security and Privacy

- `GEMINI_API_KEY` is read only by server-side code and is never bundled into browser JavaScript.
- API requests use a same-origin endpoint with server-side task, document, question, history, and body-size validation.
- Provider errors, prompts, and credentials are not logged or returned to the browser.
- PDF JavaScript executes from the application's own origin rather than a third-party CDN.
- Production responses use a restrictive Content Security Policy and other security headers.
- Uploads are limited to 5 MB, extracted text to 100,000 characters, PDFs to 100 pages, and questions to 2,000 characters.
- Document and question text is sent to Google Gemini when an AI action runs. Do not use the app for confidential, privileged, or regulated information unless your organization has approved that transfer.
- Local history is unencrypted. It is disabled by default and should be cleared on shared devices.

The former `VITE_GEMINI_API_KEY` value, if used, must be revoked and replaced because every Vite `VITE_*` value is public in the browser bundle.

## Local Setup

Requirements: Node.js 22.12 or newer and npm 10 or newer.

```bash
npm ci
```

Create a local `.env` file:

```env
GEMINI_API_KEY=your_google_gemini_api_key
```

Start Vite. The development server includes a local server-side `/api/analyze` middleware, so the key is not exposed to browser code.

```bash
npm run dev
```

## Quality Commands

```bash
npm run lint
npm test
npm run test:coverage
npm run build
npm run check
```

`npm run check` runs linting, coverage tests, and a production build.

## Netlify Deployment

1. Connect the repository to Netlify.
2. Set `GEMINI_API_KEY` in Netlify environment variables.
3. Deploy using the checked-in `netlify.toml`.
4. Verify `/api/analyze`, response headers, PDF extraction, and history behavior in a deploy preview.

Never define the Gemini key as a `VITE_*` variable or place it in client-side source.

## Project Structure

```text
src/
  components/       UI components
  utils/            file, history, security, and debounce utilities
  App.jsx           application state and workflows
  gemini.js         validated same-origin API client
server/
  analyze.js        serverless request validation and Gemini adapter
netlify/functions/
  analyze.mjs       Netlify function entry
```

## Legal Disclaimer

LexAssist AI can miss important terms and can misinterpret contracts. Always review the original document and consult a qualified lawyer before making a legal decision.
