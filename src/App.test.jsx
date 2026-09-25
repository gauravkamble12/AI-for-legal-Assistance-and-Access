import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { analyzeDocument } from './gemini';
import { extractTextFromFile } from './utils/documents';
import { HISTORY_KEY, saveSession } from './utils/history';

vi.mock('./gemini', () => ({ analyzeDocument: vi.fn() }));
vi.mock('./utils/documents', () => ({ extractTextFromFile: vi.fn() }));

describe('App workflows', () => {
  beforeEach(() => {
    localStorage.clear();
    analyzeDocument.mockReset();
    extractTextFromFile.mockReset();
    vi.restoreAllMocks();
  });

  it('runs an action and carries completed chat turns into later context', async () => {
    analyzeDocument
      .mockResolvedValueOnce('Risk result')
      .mockResolvedValueOnce('The notice period is 30 days.')
      .mockResolvedValueOnce('Thirty days from the notice date.');

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Load Sample Contract' }));
    fireEvent.click(screen.getByRole('button', { name: /extract risks/i }));
    expect(await screen.findByText('Risk result')).toBeInTheDocument();
    expect(analyzeDocument).toHaveBeenNthCalledWith(1, expect.objectContaining({ task: 'risks' }));

    const input = screen.getByRole('textbox', { name: /ask a question about this document/i });
    fireEvent.change(input, { target: { value: 'What is the notice period?' } });
    fireEvent.submit(input.closest('form'));
    expect(await screen.findByText('The notice period is 30 days.')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'When is that measured from?' } });
    fireEvent.submit(input.closest('form'));
    await waitFor(() => expect(analyzeDocument).toHaveBeenCalledTimes(3));
    expect(analyzeDocument).toHaveBeenNthCalledWith(3, expect.objectContaining({
      task: 'chat',
      question: 'When is that measured from?',
      history: expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'What is the notice period?' }),
        expect.objectContaining({ role: 'assistant', content: 'The notice period is 30 days.' }),
      ]),
    }));
  });

  it('allows chat directly after document upload', async () => {
    analyzeDocument.mockResolvedValueOnce('Answer based on the document.');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Load Sample Contract' }));
    fireEvent.click(screen.getByRole('button', { name: /ask a question about this document/i }));
    const input = screen.getByRole('textbox', { name: /ask a question about this document/i });
    fireEvent.change(input, { target: { value: 'What is my role?' } });
    fireEvent.submit(input.closest('form'));
    expect(await screen.findByText('Answer based on the document.')).toBeInTheDocument();
    expect(analyzeDocument).toHaveBeenCalledWith(expect.objectContaining({ task: 'chat' }));
  });

  it('discloses local storage consent and saved-session confirmation in the workspace', async () => {
    analyzeDocument.mockResolvedValueOnce('Analysis result');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Load Sample Contract' }));
    const consent = screen.getByRole('checkbox', { name: /save sessions on this device/i });
    fireEvent.click(consent);
    fireEvent.click(screen.getByRole('button', { name: /extract risks/i }));
    expect(await screen.findByText('Session saved on this device.')).toBeVisible();
    expect(consent).toBeChecked();
  });

  it('honors opt-out while an analysis request is still running', async () => {
    let resolveRequest;
    analyzeDocument.mockImplementation(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Load Sample Contract' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /save sessions on this device/i }));
    fireEvent.click(screen.getByRole('button', { name: /extract risks/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /save sessions on this device/i }));
    resolveRequest('Completed after opt-out');
    expect(await screen.findByText('Completed after opt-out')).toBeInTheDocument();
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  it('rejects invalid uploads before invoking the extractor', () => {
    const { container } = render(<App />);
    const input = container.querySelector('input[type="file"]');
    const file = new File(['content'], 'contract.exe', { type: 'application/octet-stream' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole('alert')).toHaveTextContent(/unsupported file type/i);
    expect(extractTextFromFile).not.toHaveBeenCalled();
  });

  it('uploads a file and clears the completed session', async () => {
    extractTextFromFile.mockResolvedValueOnce('Uploaded contract terms');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container } = render(<App />);
    const input = container.querySelector('input[type="file"]');
    const file = new File(['contract'], 'agreement.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText('Uploaded contract terms')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Document' }));
    expect(await screen.findByRole('button', { name: 'Browse Files' })).toBeEnabled();
  });

  it('supports drag-and-drop, completed actions, and returning to action choices', async () => {
    extractTextFromFile.mockResolvedValueOnce('Dropped contract terms');
    analyzeDocument.mockResolvedValueOnce('Completed analysis');
    const { container } = render(<App />);
    const file = new File(['contract'], 'dropped.txt', { type: 'text/plain' });
    fireEvent.drop(container.querySelector('.file-upload-zone'), {
      dataTransfer: { files: [file] },
    });
    expect(await screen.findByText('Dropped contract terms')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /extract risks/i }));
    expect(await screen.findByText('Completed analysis')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: /extract risks/i })).toBeInTheDocument();
  });

  it('restores a saved session and synchronizes the storage preference', async () => {
    saveSession({
      id: 'saved-session',
      fileName: 'saved.txt',
      documentContent: 'Saved contract terms',
      action: 'simplify',
      analysisResult: 'Saved analysis',
      chatHistory: [],
      createdAt: '2026-01-01T12:00:00.000Z',
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    expect(await screen.findByText('saved.txt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load Session' }));
    expect(await screen.findByText('Saved contract terms')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /save sessions on this device/i })).toBeChecked();
    expect(screen.getByText('Loaded a session saved on this device.')).toBeVisible();
  });

  it('restores a failed question for retry', async () => {
    analyzeDocument.mockRejectedValueOnce(new Error('Question failed safely.'));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Load Sample Contract' }));
    fireEvent.click(screen.getByRole('button', { name: /ask a question about this document/i }));
    const input = screen.getByRole('textbox', { name: /ask a question about this document/i });
    fireEvent.change(input, { target: { value: 'What is the term?' } });
    fireEvent.submit(input.closest('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Question failed safely.');
    expect(input).toHaveValue('What is the term?');
  });

  it('retains the current document when new-analysis confirmation is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Load Sample Contract' }));
    fireEvent.click(screen.getByRole('button', { name: /new analysis/i }));
    expect(screen.getByText('Sample_Contract.txt')).toBeInTheDocument();
  });

  it('rejects dropping multiple documents', () => {
    const { container } = render(<App />);
    fireEvent.drop(container.querySelector('.file-upload-zone'), {
      dataTransfer: { files: [new File(['one'], 'one.txt'), new File(['two'], 'two.txt')] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/one document/i);
  });

  it('aborts and ignores an action when the session is cleared', async () => {
    let requestSignal;
    analyzeDocument.mockImplementation(({ signal }) => new Promise((_, reject) => {
      requestSignal = signal;
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Load Sample Contract' }));
    fireEvent.click(screen.getByRole('button', { name: /simplify document/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear Document' }));

    expect(requestSignal?.aborted).toBe(true);
    expect(await screen.findByRole('button', { name: 'Browse Files' })).toBeEnabled();
  });

  it('exports a sanitized Markdown filename', async () => {
    analyzeDocument.mockResolvedValueOnce('Analysis result');
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function mockClick() {
      expect(this.download).toBe('LexAssist_Sample_Contract.md');
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Load Sample Contract' }));
    fireEvent.click(screen.getByRole('button', { name: /simplify document/i }));
    const exportButton = await screen.findByRole('button', { name: /download report/i });
    await act(async () => {
      fireEvent.click(exportButton);
    });
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:report'));
  });
});
