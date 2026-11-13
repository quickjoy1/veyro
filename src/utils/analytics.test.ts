import { describe, expect, it } from 'vitest';

import {
  bestStreak,
  bestWindow,
  formatHour,
  formatWindow,
  heatmapGrid,
  intensity,
  lastWeekSameSpan,
  secondsByHour,
  sessionSpan,
  subjectTotals,
  trendPercent,
  weekStart,
  weekToDate,
} from '@/utils/analytics';
import { dayKey } from '@/utils/dailyGoal';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const map = (entries: Array<[Date, number]>) => new Map(entries.map(([d, min]) => [dayKey(d), min * 60]));

describe('weeks', () => {
  it('starts weeks on Monday', () => {
    expect(dayKey(weekStart(at(2026, 11, 8)))).toBe('2026-11-02'); // Sunday
    expect(dayKey(weekStart(at(2026, 11, 9)))).toBe('2026-11-09'); // Monday
    expect(dayKey(weekStart(at(2026, 11, 13)))).toBe('2026-11-09'); // Friday
  });

  it('compares this week so far with the same span last week', () => {
    // Today is Wed 11 Nov 2026: Mon+Tue+Wed this week vs Mon+Tue+Wed last week
    const now = at(2026, 11, 11);
    const byDay = map([
      [at(2026, 11, 9), 60], [at(2026, 11, 10), 30], [at(2026, 11, 11), 30], // 2h
      [at(2026, 11, 2), 60], [at(2026, 11, 3), 30], [at(2026, 11, 4), 0],     // 1h30
      [at(2026, 11, 6), 600],                                                  // Friday last week: not in the span
    ]);
    expect(weekToDate(byDay, now)).toBe(120 * 60);
    expect(lastWeekSameSpan(byDay, now)).toBe(90 * 60);
  });

  it('computes the trend only when there is something to compare with', () => {
    expect(trendPercent(120, 90)).toBe(33);
    expect(trendPercent(45, 90)).toBe(-50);
    expect(trendPercent(10, 0)).toBeNull();
  });
});

describe('bestStreak', () => {
  it('finds the longest run of days at or above the minimum', () => {
    const byDay = map([
      [at(2026, 10, 1), 20], [at(2026, 10, 2), 20], [at(2026, 10, 3), 5], // broken by a short day
      [at(2026, 10, 10), 30], [at(2026, 10, 11), 30], [at(2026, 10, 12), 30], [at(2026, 10, 13), 30],
    ]);
    expect(bestStreak(byDay)).toBe(4);
    expect(bestStreak(new Map())).toBe(0);
  });

  it('counts across a month end', () => {
    const byDay = map([[at(2026, 10, 30), 20], [at(2026, 10, 31), 20], [at(2026, 11, 1), 20]]);
    expect(bestStreak(byDay)).toBe(3);
  });
});

describe('heatmapGrid', () => {
  const now = at(2026, 11, 11); // Wednesday

  it('builds Monday-first weeks ending with the current one', () => {
    const grid = heatmapGrid(map([[at(2026, 11, 9), 60]]), now, 4);
    expect(grid.weeks).toHaveLength(4);
    expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
    const last = grid.weeks[3]!;
    expect(last[0]!.key).toBe('2026-11-09');
    expect(last[0]!.seconds).toBe(3600);
    expect(last[2]!.key).toBe('2026-11-11'); // today
    expect(last[3]!.future).toBe(true);
    expect(last[2]!.future).toBe(false);
  });

  it('counts active days and total time, ignoring future days', () => {
    const grid = heatmapGrid(map([[at(2026, 11, 10), 30], [at(2026, 11, 11), 30], [at(2026, 11, 12), 99]]), now, 2);
    expect(grid.activeDays).toBe(2);
    expect(grid.totalSeconds).toBe(3600);
  });

  it('labels months', () => {
    const grid = heatmapGrid(new Map(), now, 12);
    expect(grid.monthLabels.length).toBeGreaterThanOrEqual(2);
  });
});

describe('intensity', () => {
  it('scales against the goal', () => {
    const goal = 120 * 60;
    expect(intensity(0, goal)).toBe(0);
    expect(intensity(10 * 60, goal)).toBe(1);
    expect(intensity(30 * 60, goal)).toBe(2);
    expect(intensity(60 * 60, goal)).toBe(3);
    expect(intensity(120 * 60, goal)).toBe(4);
    expect(intensity(300 * 60, goal)).toBe(4);
  });
});

describe('secondsByHour', () => {
  it('splits a session across the hours it covers', () => {
    const hours = secondsByHour([{ created_at: at(2026, 11, 10, 7, 40).toISOString(), started_at: at(2026, 11, 10, 6, 50).toISOString(), duration: '00:50:00' }]);
    expect(hours[6]).toBe(10 * 60);
    expect(hours[7]).toBe(40 * 60);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(50 * 60);
  });

  it('works backwards from the save time when there is no start time', () => {
    const lap = { created_at: at(2026, 11, 10, 19, 30).toISOString(), duration: '01:00:00' };
    expect(sessionSpan(lap)!.start.getHours()).toBe(18);
    const hours = secondsByHour([lap]);
    expect(hours[18]).toBe(1800);
    expect(hours[19]).toBe(1800);
  });

  it('handles midnight and ignores empty or broken sessions', () => {
    const hours = secondsByHour([
      { created_at: at(2026, 11, 11, 0, 30).toISOString(), started_at: at(2026, 11, 10, 23, 30).toISOString(), duration: '01:00:00' },
      { created_at: 'nope', duration: '01:00:00' },
      { created_at: at(2026, 11, 10).toISOString(), duration: '00:00:00' },
    ]);
    expect(hours[23]).toBe(1800);
    expect(hours[0]).toBe(1800);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(3600);
  });
});

describe('bestWindow and formatting', () => {
  it('finds the busiest three hours, including across midnight', () => {
    const hours = new Array<number>(24).fill(0);
    hours[18] = 3600; hours[19] = 7200; hours[20] = 3600; hours[7] = 600;
    const w = bestWindow(hours)!;
    expect(w.start).toBe(18);
    expect(w.share).toBe(96);

    const night = new Array<number>(24).fill(0);
    night[23] = 3600; night[0] = 3600; night[1] = 3600;
    expect(bestWindow(night)!.start).toBe(23);
    expect(bestWindow(new Array<number>(24).fill(0))).toBeNull();
  });

  it('writes hours the way people say them', () => {
    expect(formatHour(0)).toBe('12 AM');
    expect(formatHour(12)).toBe('12 PM');
    expect(formatHour(18)).toBe('6 PM');
    expect(formatWindow(18, 3)).toBe('6–9 PM');
    expect(formatWindow(11, 3)).toBe('11 AM–2 PM');
    expect(formatWindow(23, 3)).toBe('11 PM–2 AM');
  });
});

describe('subjectTotals', () => {
  const now = at(2026, 11, 11);
  const lap = (daysAgo: number, dur: string, subject?: string, color?: string) => ({
    created_at: at(2026, 11, 11 - daysAgo, 18).toISOString(),
    duration: dur,
    subject_name: subject ?? null,
    subject_color: color ?? null,
  });

  it('adds up time per subject, biggest first, with shares', () => {
    const rows = subjectTotals([lap(1, '01:00:00', 'Physics', '#3b82f6'), lap(2, '00:30:00', 'physics'), lap(3, '00:30:00', 'Maths'), lap(4, '01:00:00')], now, 30);
    expect(rows.map((r) => r.name)).toEqual(['Physics', 'No subject', 'Maths']);
    expect(rows[0]).toMatchObject({ seconds: 5400, sessions: 2, color: '#3b82f6', share: 50 });
    expect(rows.reduce((a, r) => a + r.share, 0)).toBeGreaterThanOrEqual(99);
  });

  it('limits to the range and supports all time', () => {
    const laps = [lap(1, '01:00:00', 'Physics'), lap(40, '02:00:00', 'Maths')];
    expect(subjectTotals(laps, now, 7).map((r) => r.name)).toEqual(['Physics']);
    expect(subjectTotals(laps, now, null).map((r) => r.name)).toEqual(['Maths', 'Physics']);
  });
});
