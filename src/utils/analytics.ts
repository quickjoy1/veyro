/** Pure calculations behind the Analytics page, so they can be tested without a browser. */
import {
  dayKey,
  durationToSeconds,
  MIN_STREAK_SECONDS,
  type LapLike,
} from '@/utils/dailyGoal';

export interface SessionLike extends LapLike {
  started_at?: string | null;
  ended_at?: string | null;
  subject_name?: string | null;
  subject_color?: string | null;
  session_assignment?: string | null;
}

const DAY_MS = 86_400_000;

const parseKey = (key: string): Date => {
  const [y = 0, m = 1, d = 1] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Monday (00:00 local) of the week containing `d`. */
export const weekStart = (d: Date): Date => {
  const back = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
};

const sumDays = (byDay: ReadonlyMap<string, number>, from: Date, days: number): number => {
  let total = 0;
  for (let i = 0; i < days; i++) {
    total += byDay.get(dayKey(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i))) ?? 0;
  }
  return total;
};

/** Focus seconds from Monday up to and including today. */
export const weekToDate = (byDay: ReadonlyMap<string, number>, now: Date): number => {
  const start = weekStart(now);
  return sumDays(byDay, start, (now.getDay() + 6) % 7 + 1);
};

/** Same span (Monday up to the same weekday) one week earlier, for a fair comparison. */
export const lastWeekSameSpan = (byDay: ReadonlyMap<string, number>, now: Date): number => {
  const start = weekStart(now);
  const prev = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
  return sumDays(byDay, prev, (now.getDay() + 6) % 7 + 1);
};

/** Percent change, or null when there is nothing to compare with. */
export const trendPercent = (current: number, previous: number): number | null => {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
};

/** Longest run of consecutive days that each reach the minimum. */
export const bestStreak = (byDay: ReadonlyMap<string, number>, minSeconds: number = MIN_STREAK_SECONDS): number => {
  const days = [...byDay.entries()]
    .filter(([, seconds]) => seconds >= minSeconds)
    .map(([key]) => parseKey(key))
    .sort((a, b) => a.getTime() - b.getTime());
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const day of days) {
    run = prev && Math.round((day.getTime() - prev.getTime()) / DAY_MS) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
};

export interface HeatCell {
  key: string;
  date: Date;
  seconds: number;
  future: boolean;
}

export interface HeatmapGrid {
  /** Columns are weeks (oldest first), each with 7 cells from Monday to Sunday. */
  weeks: HeatCell[][];
  /** Month abbreviations placed above the first week that starts in that month. */
  monthLabels: Array<{ week: number; label: string }>;
  activeDays: number;
  totalSeconds: number;
}

export const heatmapGrid = (byDay: ReadonlyMap<string, number>, now: Date, weekCount = 26): HeatmapGrid => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonday = weekStart(today);
  const weeks: HeatCell[][] = [];
  const monthLabels: Array<{ week: number; label: string }> = [];
  let activeDays = 0;
  let totalSeconds = 0;
  let lastMonth = -1;

  for (let w = weekCount - 1; w >= 0; w--) {
    const monday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - w * 7);
    const column: HeatCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const key = dayKey(date);
      const future = date.getTime() > today.getTime();
      const seconds = future ? 0 : (byDay.get(key) ?? 0);
      if (seconds > 0) activeDays++;
      totalSeconds += seconds;
      column.push({ key, date, seconds, future });
    }
    const index = weeks.length;
    if (monday.getMonth() !== lastMonth) {
      // A month label over the very first column would be cut off, and the next one would crowd it.
      monthLabels.push({ week: index, label: monday.toLocaleDateString(undefined, { month: 'short' }) });
      lastMonth = monday.getMonth();
    }
    weeks.push(column);
  }
  // Drop a label that would sit right next to the following one.
  const spaced = monthLabels.filter((m, i) => !(i === 0 && monthLabels[1] && monthLabels[1].week - m.week < 3));
  return { weeks, monthLabels: spaced, activeDays, totalSeconds };
};

/** 0 = nothing, 4 = reached the daily goal. */
export const intensity = (seconds: number, goalSeconds: number): 0 | 1 | 2 | 3 | 4 => {
  if (seconds <= 0) return 0;
  const ratio = seconds / Math.max(1, goalSeconds);
  if (ratio >= 1) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
};

/** Start and end of a session. Sessions are saved when they end, so created_at is the end. */
export const sessionSpan = (lap: SessionLike): { start: Date; end: Date } | null => {
  const seconds = durationToSeconds(lap.duration);
  if (seconds <= 0) return null;
  const startedAt = lap.started_at ? new Date(lap.started_at) : null;
  if (startedAt && !Number.isNaN(startedAt.getTime())) {
    return { start: startedAt, end: new Date(startedAt.getTime() + seconds * 1000) };
  }
  const end = new Date(lap.created_at);
  if (Number.isNaN(end.getTime())) return null;
  return { start: new Date(end.getTime() - seconds * 1000), end };
};

/** Focus seconds per hour of the day (local time); a session is split across the hours it covers. */
export const secondsByHour = (laps: readonly SessionLike[]): number[] => {
  const hours = new Array<number>(24).fill(0);
  for (const lap of laps) {
    const span = sessionSpan(lap);
    if (!span) continue;
    let cursor = span.start.getTime();
    const end = span.end.getTime();
    while (cursor < end) {
      const at = new Date(cursor);
      const nextHour = new Date(at.getFullYear(), at.getMonth(), at.getDate(), at.getHours() + 1).getTime();
      const slice = Math.min(end, nextHour) - cursor;
      hours[at.getHours()] = (hours[at.getHours()] ?? 0) + slice / 1000;
      cursor += slice;
    }
  }
  return hours;
};

export interface FocusWindow {
  /** First hour of the window (0-23). */
  start: number;
  width: number;
  seconds: number;
  /** Share of all focus time that falls in this window, 0-100. */
  share: number;
}

/** The busiest run of `width` hours, wrapping past midnight. Null when there is no data. */
export const bestWindow = (hours: readonly number[], width = 3): FocusWindow | null => {
  const total = hours.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let best: FocusWindow | null = null;
  for (let start = 0; start < 24; start++) {
    let seconds = 0;
    for (let i = 0; i < width; i++) seconds += hours[(start + i) % 24] ?? 0;
    if (!best || seconds > best.seconds) best = { start, width, seconds, share: 0 };
  }
  return best ? { ...best, share: Math.round((best.seconds / total) * 100) } : null;
};

const hour12 = (h: number): { n: number; ap: 'AM' | 'PM' } => {
  const hh = ((h % 24) + 24) % 24;
  return { n: hh % 12 === 0 ? 12 : hh % 12, ap: hh < 12 ? 'AM' : 'PM' };
};

/** 18 -> "6 PM". */
export const formatHour = (h: number): string => {
  const { n, ap } = hour12(h);
  return `${n} ${ap}`;
};

/** (18, 3) -> "6-9 PM", (11, 3) -> "11 AM-2 PM". */
export const formatWindow = (start: number, width: number): string => {
  const a = hour12(start);
  const b = hour12(start + width);
  return a.ap === b.ap ? `${a.n}–${b.n} ${b.ap}` : `${a.n} ${a.ap}–${b.n} ${b.ap}`;
};

export interface SubjectRow {
  name: string;
  color: string | null;
  seconds: number;
  sessions: number;
  /** Share of the total, 0-100. */
  share: number;
}

export const NO_SUBJECT = 'No subject';

/** Focus time per subject over the last `rangeDays` days (all time when null), biggest first. */
export const subjectTotals = (laps: readonly SessionLike[], now: Date, rangeDays: number | null): SubjectRow[] => {
  const since = rangeDays === null ? null : new Date(now.getFullYear(), now.getMonth(), now.getDate() - (rangeDays - 1)).getTime();
  const rows = new Map<string, SubjectRow>();
  let total = 0;
  for (const lap of laps) {
    const at = new Date(lap.created_at).getTime();
    if (Number.isNaN(at) || (since !== null && at < since)) continue;
    const seconds = durationToSeconds(lap.duration);
    if (seconds <= 0) continue;
    const name = (lap.subject_name || lap.session_assignment || '').trim() || NO_SUBJECT;
    const key = name.toLowerCase();
    const row = rows.get(key) ?? { name, color: lap.subject_color ?? null, seconds: 0, sessions: 0, share: 0 };
    row.seconds += seconds;
    row.sessions += 1;
    if (!row.color && lap.subject_color) row.color = lap.subject_color;
    rows.set(key, row);
    total += seconds;
  }
  return [...rows.values()]
    .sort((a, b) => b.seconds - a.seconds)
    .map((r) => ({ ...r, share: total > 0 ? Math.round((r.seconds / total) * 100) : 0 }));
};
