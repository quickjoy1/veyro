import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const shown: Array<{ message: string; undo: () => void | Promise<void> }> = [];
vi.mock('@/utils/undoToast', () => ({
  showUndoToast: (message: string, undo: () => void | Promise<void>) => shown.push({ message, undo }),
}));

import { offerRestore } from '@/utils/restoreDeleted';

describe('offerRestore', () => {
  beforeEach(() => {
    shown.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('names a single deleted task', () => {
    offerRestore({ title: 'Optics sheet' }, () => {});
    vi.advanceTimersByTime(300);
    expect(shown.map((s) => s.message)).toEqual(['Deleted "Optics sheet"']);
  });

  it('groups deletions made together into one toast that restores them all', async () => {
    const restore = vi.fn();
    const a = { title: 'A' };
    const b = { title: 'B' };
    const c = { title: 'C' };
    offerRestore(a, restore);
    offerRestore(b, restore);
    vi.advanceTimersByTime(100);
    offerRestore(c, restore);
    vi.advanceTimersByTime(300);

    expect(shown.map((s) => s.message)).toEqual(['Deleted 3 tasks']);
    await shown[0]?.undo();
    expect(restore).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledWith([a, b, c]);
  });

  it('starts a fresh group after the window has passed', () => {
    offerRestore({ title: 'A' }, () => {});
    vi.advanceTimersByTime(300);
    offerRestore({ title: 'B' }, () => {});
    vi.advanceTimersByTime(300);
    expect(shown.map((s) => s.message)).toEqual(['Deleted "A"', 'Deleted "B"']);
  });
});
