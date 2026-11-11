import { describe, expect, it } from 'vitest';

import {
  clampGoalMinutes,
  currentStreak,
  dayKey,
  durationToSeconds,
  formatFocus,
  secondsByDay,
} from '@/utils/dailyGoal';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe('durationToSeconds', () => {
  it('reads HH:MM:SS, plain seconds and numbers', () => {
    expect(durationToSeconds('01:30:15')).toBe(5415);
    expect(durationToSeconds('300')).toBe(300);
    expect(durationToSeconds(90)).toBe(90);
  });

  it('treats junk as zero', () => {
    expect(durationToSeconds(null)).toBe(0);
    expect(durationToSeconds('')).toBe(0);
    expect(durationToSeconds('abc')).toBe(0);
    expect(durationToSeconds('1:2')).toBe(0);
    expect(durationToSeconds('-1:00:00')).toBe(0);
    expect(durationToSeconds(-5)).toBe(0);
  });
});

describe('secondsByDay', () => {
  it('adds up sessions on the same local day and skips bad dates', () => {
    const byDay = secondsByDay([
      { created_at: at(2026, 11, 10, 9).toISOString(), duration: '00:30:00' },
      { created_at: at(2026, 11, 10, 18).toISOString(), duration: '00:45:00' },
      { created_at: at(2026, 11, 9, 20).toISOString(), duration: '01:00:00' },
      { created_at: 'not a date', duration: '09:00:00' },
    ]);
    expect(byDay.get('2026-11-10')).toBe(75 * 60);
    expect(byDay.get('2026-11-09')).toBe(3600);
    expect(byDay.size).toBe(2);
  });
});

describe('currentStreak', () => {
  const day = (y: number, m: number, d: number, min: number): [string, number] => [dayKey(at(y, m, d)), min * 60];

  it('counts consecutive days ending today', () => {
    const byDay = new Map([day(2026, 11, 10, 30), day(2026, 11, 9, 20), day(2026, 11, 8, 15)]);
    expect(currentStreak(byDay, at(2026, 11, 10))).toBe(3);
  });

  it('does not break while today is still empty', () => {
    const byDay = new Map([day(2026, 11, 9, 30), day(2026, 11, 8, 30)]);
    expect(currentStreak(byDay, at(2026, 11, 10))).toBe(2);
  });

  it('breaks after a missed day', () => {
    const byDay = new Map([day(2026, 11, 10, 30), day(2026, 11, 8, 30)]);
    expect(currentStreak(byDay, at(2026, 11, 10))).toBe(1);
  });

  it('ignores days below the minimum and handles no data', () => {
    expect(currentStreak(new Map([day(2026, 11, 10, 5)]), at(2026, 11, 10))).toBe(0);
    expect(currentStreak(new Map(), at(2026, 11, 10))).toBe(0);
  });

  it('crosses month and year boundaries', () => {
    const byDay = new Map([day(2027, 1, 1, 30), day(2026, 12, 31, 30), day(2026, 12, 30, 30)]);
    expect(currentStreak(byDay, at(2027, 1, 1))).toBe(3);
  });
});

describe('clampGoalMinutes', () => {
  it('snaps to 15 minute steps within 15 minutes to 12 hours', () => {
    expect(clampGoalMinutes(100)).toBe(105);
    expect(clampGoalMinutes(0)).toBe(15);
    expect(clampGoalMinutes(5000)).toBe(720);
    expect(clampGoalMinutes(Number.NaN)).toBe(120);
  });
});

describe('formatFocus', () => {
  it('formats compactly', () => {
    expect(formatFocus(4800)).toBe('1h 20m');
    expect(formatFocus(2700)).toBe('45m');
    expect(formatFocus(7200)).toBe('2h');
    expect(formatFocus(0)).toBe('0m');
    expect(formatFocus(-10)).toBe('0m');
  });
});
