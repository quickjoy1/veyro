/** Helpers for the "today's focus" goal ring and the study streak. Pure, so they are easy to test. */

export const DEFAULT_GOAL_MINUTES = 120;
export const MIN_GOAL_MINUTES = 15;
export const MAX_GOAL_MINUTES = 720;
export const GOAL_STEP_MINUTES = 15;
/** A day counts towards the streak once at least this much focus time was logged. */
export const MIN_STREAK_SECONDS = 10 * 60;

export interface LapLike {
  created_at: string;
  duration?: string | number | null;
}

/** "HH:MM:SS" (or plain seconds) to seconds. Anything unreadable counts as 0. */
export const durationToSeconds = (duration?: string | number | null): number => {
  if (duration === null || duration === undefined || duration === '') return 0;
  if (typeof duration === 'number') return Number.isFinite(duration) && duration > 0 ? duration : 0;
  if (/^\d+$/.test(duration)) return parseInt(duration, 10);
  const parts = duration.split(':').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) return 0;
  const [h = 0, m = 0, s = 0] = parts;
  return h * 3600 + m * 60 + s;
};

/** Local calendar day as YYYY-MM-DD. */
export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Seconds of focus per local day. */
export const secondsByDay = (laps: readonly LapLike[]): Map<string, number> => {
  const byDay = new Map<string, number>();
  for (const lap of laps) {
    const at = new Date(lap.created_at);
    if (Number.isNaN(at.getTime())) continue;
    const key = dayKey(at);
    byDay.set(key, (byDay.get(key) ?? 0) + durationToSeconds(lap.duration));
  }
  return byDay;
};

/**
 * Consecutive days with focus time, counting back from today. A day that has not
 * reached the minimum yet does not break the streak until it is over.
 */
export const currentStreak = (
  byDay: ReadonlyMap<string, number>,
  now: Date,
  minSeconds: number = MIN_STREAK_SECONDS,
): number => {
  let streak = 0;
  for (let back = 0; back < 3660; back++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const done = (byDay.get(dayKey(day)) ?? 0) >= minSeconds;
    if (done) streak++;
    else if (back > 0) break; // today may still be in progress
  }
  return streak;
};

/** Keeps a goal in range and on a 15 minute step. */
export const clampGoalMinutes = (minutes: number): number => {
  if (!Number.isFinite(minutes)) return DEFAULT_GOAL_MINUTES;
  const stepped = Math.round(minutes / GOAL_STEP_MINUTES) * GOAL_STEP_MINUTES;
  return Math.min(MAX_GOAL_MINUTES, Math.max(MIN_GOAL_MINUTES, stepped));
};

/** 4800 -> "1h 20m", 2700 -> "45m", 7200 -> "2h". */
export const formatFocus = (seconds: number): string => {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export const GOAL_STORAGE_KEY = 'dailyFocusGoalMinutes';

/** The goal the person set on the Study page (minutes), or the default. */
export const readStoredGoalMinutes = (): number => {
  try {
    const saved = localStorage.getItem(GOAL_STORAGE_KEY);
    return saved ? clampGoalMinutes(Number(saved)) : DEFAULT_GOAL_MINUTES;
  } catch {
    return DEFAULT_GOAL_MINUTES;
  }
};
