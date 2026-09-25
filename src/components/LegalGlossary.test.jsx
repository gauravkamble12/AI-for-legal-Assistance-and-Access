import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LegalGlossary from './LegalGlossary';

describe('LegalGlossary', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces search and filters by category', () => {
    const { unmount } = render(<LegalGlossary />);
    const search = screen.getByRole('searchbox', { name: /search glossary/i });

    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(22);
    fireEvent.change(search, { target: { value: 'escrow' } });
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(22);
    act(() => vi.advanceTimersByTime(150));
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Escrow' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Employment' }));
    expect(screen.queryByRole('heading', { name: 'Escrow' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Employment' })).toHaveAttribute('aria-pressed', 'true');
    unmount();
  });

  it('shows a no-results state and cancels pending search on unmount', () => {
    const { unmount } = render(<LegalGlossary />);
    fireEvent.change(screen.getByRole('searchbox', { name: /search glossary/i }), {
      target: { value: 'not-a-real-term' },
    });
    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByRole('heading', { name: 'No matching terms' })).toBeInTheDocument();
    unmount();
  });
});
