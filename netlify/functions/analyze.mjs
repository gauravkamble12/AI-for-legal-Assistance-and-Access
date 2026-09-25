import { handleAnalyzeRequest } from '../../server/analyze.js';

export const config = {
  path: '/api/analyze',
};

export default async (request) => handleAnalyzeRequest(request, {
  apiKey: process.env.GEMINI_API_KEY,
});
