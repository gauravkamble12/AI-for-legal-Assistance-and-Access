import react from '@vitejs/plugin-react';
import { createReadStream, existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { MAX_ANALYZE_REQUEST_BYTES, handleAnalyzeRequest } from './server/analyze.js';

const readRequestBody = async (request) => {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_ANALYZE_REQUEST_BYTES) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
};

const PDF_ASSET_DIRECTORIES = new Set(['cmaps', 'standard_fonts', 'wasm']);
const PDF_ASSET_TYPES = {
  '.bcmap': 'application/octet-stream',
  '.js': 'text/javascript; charset=utf-8',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

const pdfAssets = () => {
  const packageRoot = fileURLToPath(new URL('./node_modules/pdfjs-dist/', import.meta.url));
  const packagePrefix = `${packageRoot}${sep}`;

  return {
    name: 'lexassist-pdf-assets',
    configureServer(server) {
      server.middlewares.use('/pdfjs', (request, response, next) => {
        try {
          const requestPath = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
            .replace(/^\/+/, '');
          const [directory, fileName, ...remaining] = requestPath.split('/');
          if (!PDF_ASSET_DIRECTORIES.has(directory) || !fileName || remaining.length > 0) {
            next();
            return;
          }

          const filePath = resolve(packageRoot, directory, fileName);
          if (!filePath.startsWith(packagePrefix) || !existsSync(filePath)) {
            next();
            return;
          }

          response.setHeader('Content-Type', PDF_ASSET_TYPES[extname(fileName)] || 'application/octet-stream');
          createReadStream(filePath).pipe(response);
        } catch {
          next();
        }
      });
    },
    generateBundle() {
      for (const directory of PDF_ASSET_DIRECTORIES) {
        const sourceDirectory = resolve(packageRoot, directory);
        for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
          if (entry.isFile()) {
            this.emitFile({
              type: 'asset',
              fileName: `pdfjs/${directory}/${entry.name}`,
              source: readFileSync(resolve(sourceDirectory, entry.name)),
            });
          }
        }
      }
    },
  };
};

const localAnalyzeApi = (apiKey) => ({
  name: 'lexassist-local-api',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/api/analyze', async (request, response) => {
      try {
        const body = await readRequestBody(request);
        const headers = new Headers();
        for (const name of ['content-type', 'content-length', 'host', 'origin']) {
          const value = request.headers[name];
          if (typeof value === 'string') headers.set(name, value);
        }

        const result = await handleAnalyzeRequest(new Request('http://localhost/api/analyze', {
          method: request.method,
          headers,
          body: request.method === 'GET' || request.method === 'HEAD' ? undefined : body,
        }), { apiKey });

        response.statusCode = result.status;
        result.headers.forEach((value, name) => response.setHeader(name, value));
        response.end(await result.text());
      } catch {
        response.statusCode = 500;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify({ error: 'The local API request could not be processed.' }));
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), pdfAssets(), localAnalyzeApi(env.GEMINI_API_KEY)],
    test: {
      environment: 'jsdom',
      environmentOptions: {
        jsdom: { url: 'http://localhost/' },
      },
      globals: true,
      setupFiles: ['./src/test/setup.js'],
      include: ['src/**/*.test.{js,jsx}', 'server/**/*.test.js'],
      clearMocks: true,
      restoreMocks: true,
      unstubGlobals: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: [
          'src/App.jsx',
          'src/gemini.js',
          'server/analyze.js',
          'src/utils/security.js',
          'src/utils/history.js',
          'src/utils/debounce.js',
          'src/utils/documents.js',
        ],
        thresholds: {
          lines: 80,
          functions: 80,
          statements: 80,
          branches: 75,
        },
      },
    },
  };
});
