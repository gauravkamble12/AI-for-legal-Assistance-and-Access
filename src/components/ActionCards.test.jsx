import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ActionCards from './ActionCards';

describe('ActionCards', () => {
  it('exposes every analysis and chat option', () => {
    const onAction = vi.fn();
    const onChat = vi.fn();
    render(<ActionCards onAction={onAction} onChat={onChat} />);

    fireEvent.click(screen.getByRole('button', { name: /simplify document/i }));
    fireEvent.click(screen.getByRole('button', { name: /extract risks/i }));
    fireEvent.click(screen.getByRole('button', { name: /prepare lawyer questions/i }));
    fireEvent.click(screen.getByRole('button', { name: /ask a question/i }));

    expect(onAction).toHaveBeenNthCalledWith(1, 'simplify');
    expect(onAction).toHaveBeenNthCalledWith(2, 'risks');
    expect(onAction).toHaveBeenNthCalledWith(3, 'questions');
    expect(onChat).toHaveBeenCalledOnce();
  });
});
