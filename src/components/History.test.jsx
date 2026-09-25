import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import History from './History';
import { createSessionId, saveSession } from '../utils/history';

const session = {
  id: createSessionId(),
  fileName: 'employment.txt',
  documentContent: 'Employment terms.',
  action: 'simplify',
  analysisResult: 'Plain-language analysis.',
  chatHistory: [],
  createdAt: '2026-01-01T12:00:00.000Z',
};

describe('History', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders an empty state when storage is empty', () => {
    render(<History onLoadSession={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'No saved sessions' })).toBeInTheDocument();
  });

  it('loads and deletes a saved session', () => {
    saveSession(session);
    const onLoadSession = vi.fn();
    render(<History onLoadSession={onLoadSession} />);

    fireEvent.click(screen.getByRole('button', { name: 'Load Session' }));
    expect(onLoadSession).toHaveBeenCalledWith(expect.objectContaining({ id: session.id }));

    fireEvent.click(screen.getByRole('button', { name: /delete history entry/i }));
    expect(screen.queryByText('employment.txt')).not.toBeInTheDocument();
  });

  it('requires confirmation before clearing all local history', () => {
    saveSession(session);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<History onLoadSession={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(screen.getByText('employment.txt')).toBeInTheDocument();
  });
});
