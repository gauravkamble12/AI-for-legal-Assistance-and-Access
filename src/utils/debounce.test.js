import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls only once after the delay with the latest arguments', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 200);
    debounced('first');
    debounced('second');
    vi.advanceTimersByTime(199);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith('second');
  });

  it('cancels a pending callback', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 100);
    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();
  });

  it('can be reused after cancellation', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 50);
    debounced.cancel();
    debounced('value');
    vi.advanceTimersByTime(50);
    expect(callback).toHaveBeenCalledWith('value');
  });
});
