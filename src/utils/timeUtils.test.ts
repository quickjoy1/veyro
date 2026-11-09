import { describe, expect, it } from 'vitest';

import { storedTimeToClock } from '@/utils/timeUtils';

const pad = (n: number) => String(n).padStart(2, '0');

describe('storedTimeToClock', () => {
  it('shows a one-off task in the local time it was entered in', () => {
    // How useTaskSubmit stores it: the UTC instant of the user's local 10:00
    const local = new Date(2026, 10, 20, 10, 0);
    const stored = local.toISOString().replace('T', ' ').replace('Z', '+00');
    expect(storedTimeToClock(stored, false)).toBe('10:00');
    expect(storedTimeToClock(local.toISOString(), false)).toBe('10:00');
  });

  it('reads weekly tasks as-is (their clock is stored as UTC digits)', () => {
    expect(storedTimeToClock('2026-11-09 09:30:00+00', true)).toBe('09:30');
  });

  it('keeps plain HH:MM values and rejects junk', () => {
    expect(storedTimeToClock('9:05', false)).toBe('09:05');
    expect(storedTimeToClock('14:45:00', false)).toBe('14:45');
    expect(storedTimeToClock('', false)).toBeNull();
    expect(storedTimeToClock('nonsense', false)).toBeNull();
    expect(pad(1)).toBe('01');
  });
});
