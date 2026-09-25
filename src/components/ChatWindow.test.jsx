import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ChatWindow from './ChatWindow';

describe('ChatWindow', () => {
  it('renders safe Markdown and labels user messages', () => {
    const { container } = render(
      <ChatWindow
        analysisResult={'## Result\n\n[Safe link](https://example.com)\n\n[Unsafe link](javascript:alert(1))\n\n[Protocol relative](//evil.example)'}
        chatHistory={[{ id: '1', role: 'user', content: '<script>alert(1)</script>' }]}
        isLoading={false}
        error="Controlled error"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Result' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Safe link' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('link', { name: 'Unsafe link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Protocol relative' })).not.toBeInTheDocument();
    expect(screen.getByRole('log')).toHaveAttribute('tabindex', '0');
    expect(container.textContent).toContain('<script>alert(1)</script>');
    expect(screen.getByRole('alert')).toHaveTextContent('Controlled error');
  });
});
