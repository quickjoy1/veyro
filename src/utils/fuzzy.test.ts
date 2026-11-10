import { describe, expect, it } from 'vitest';

import { fuzzy } from '@/utils/fuzzy';

describe('fuzzy', () => {
  it('needs every word to be present, in any order', () => {
    expect(fuzzy('optics sheet', 'Solve optics sheet')).not.toBeNull();
    expect(fuzzy('sheet optics', 'Solve optics sheet')).not.toBeNull();
    expect(fuzzy('optics exam', 'Solve optics sheet')).toBeNull();
  });

  it('does not match scattered letters', () => {
    expect(fuzzy('optic', 'Open settings (import changes from AI, backup...)')).toBeNull();
  });

  it('ranks word starts above mid-word matches and is case-insensitive', () => {
    const start = fuzzy('phys', 'Physics exam')!;
    const middle = fuzzy('sics', 'Physics exam')!;
    expect(start).toBeLessThan(middle);
    expect(fuzzy('PHYS', 'physics')).toBe(0);
  });

  it('matches everything for an empty query', () => {
    expect(fuzzy('   ', 'anything')).toBe(0);
  });
});
