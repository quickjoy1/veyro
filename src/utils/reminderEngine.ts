/** Pure reminder logic (no React, no browser APIs) so it can be unit tested. */

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
/** Overdue tasks are re-announced once per slot while the app is open. */
export const OVERDUE_REPEAT_MS = 6 * HOUR;
/** More fresh reminders than this at once are folded into one summary. */
export const MAX_INDIVIDUAL = 3;

export type Tier = "3d" | "1d" | "3h" | "1h" | "due" | "overdue";

export interface ReminderTask {
  id: string;
  title: string;
  deadline?: string | null;
  status?: string | null;
  completed?: boolean;
}

export interface Reminder {
  key: string;
  taskId: string;
  title: string;
  tier: Tier;
  dueMs: number;
  message: string;
}

/** Date-only deadlines ("2026-10-20") count as due at the end of that day (local time). */
export const parseDeadline = (deadline?: string | null): number | null => {
  if (!deadline) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(deadline);
  const ms = new Date(dateOnly ? `${deadline}T23:59:00` : deadline).getTime();
  return Number.isNaN(ms) ? null : ms;
};

/** Which reminder step a task is at right now. Only the current step matters, so a burst can't replay old steps. */
export const getReminderTier = (dueMs: number, now: number): Tier | null => {
  const left = dueMs - now;
  if (left <= -HOUR) return "overdue";
  if (left <= 0) return "due";
  if (left <= HOUR) return "1h";
  if (left <= 3 * HOUR) return "3h";
  if (left <= DAY) return "1d";
  if (left <= 3 * DAY) return "3d";
  return null;
};

export const TIER_RANK: Record<Tier, number> = { overdue: 0, due: 1, "1h": 2, "3h": 3, "1d": 4, "3d": 5 };

const MESSAGES: Record<Tier, (t: string) => string> = {
  "3d": (t) => `Coming up in 3 days: ${t}`,
  "1d": (t) => `Due within 24 hours: ${t}`,
  "3h": (t) => `Due in about 3 hours: ${t}`,
  "1h": (t) => `Due within 1 hour: ${t}`,
  due: (t) => `Due now: ${t}`,
  overdue: (t) => `Overdue: ${t}`,
};

const isDone = (t: ReminderTask) => t.completed === true || t.status === "completed";

/** Reminders that should exist right now and have not been created yet, most urgent first. */
export const planReminders = (tasks: ReminderTask[], existingKeys: Set<string>, now: number): Reminder[] => {
  const out: Reminder[] = [];
  for (const task of tasks) {
    if (isDone(task)) continue;
    const dueMs = parseDeadline(task.deadline);
    if (dueMs === null) continue;
    const tier = getReminderTier(dueMs, now);
    if (!tier) continue;
    // Deadline is in the key so editing it re-arms the steps; overdue also keys on the time slot so it repeats
    const slot = tier === "overdue" ? `|${Math.floor(now / OVERDUE_REPEAT_MS)}` : "";
    const key = `${task.id}|${task.deadline}|${tier}${slot}`;
    if (existingKeys.has(key)) continue;
    out.push({ key, taskId: task.id, title: task.title, tier, dueMs, message: MESSAGES[tier](task.title) });
  }
  return out.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.dueMs - b.dueMs);
};

export interface Delivery {
  /** Shown one by one, spaced out. */
  individual: { key: string; message: string; tier: Tier }[];
  /** When many arrive together, everything is folded into this one message instead. */
  digest: { message: string; tier: Tier } | null;
}

export const planDelivery = (fresh: Reminder[]): Delivery => {
  if (fresh.length === 0) return { individual: [], digest: null };
  if (fresh.length <= MAX_INDIVIDUAL) {
    return { individual: fresh.map(({ key, message, tier }) => ({ key, message, tier })), digest: null };
  }
  const overdue = fresh.filter((r) => r.tier === "overdue").length;
  const now = fresh.filter((r) => r.tier === "due").length;
  const soon = fresh.length - overdue - now;
  const parts = [
    overdue && `${overdue} overdue`,
    now && `${now} due now`,
    soon && `${soon} coming up`,
  ].filter(Boolean);
  return {
    individual: [],
    digest: {
      message: `${fresh.length} tasks need attention: ${parts.join(", ")}. Open Session > Notifications.`,
      tier: fresh[0]!.tier,
    },
  };
};

/** "in 2h", "3d overdue" ... */
export const formatDue = (dueMs: number, now: number): string => {
  const diff = dueMs - now;
  const abs = Math.abs(diff);
  const text =
    abs < HOUR ? `${Math.max(1, Math.round(abs / MINUTE))}m` : abs < DAY ? `${Math.round(abs / HOUR)}h` : `${Math.round(abs / DAY)}d`;
  return diff < 0 ? `${text} overdue` : `in ${text}`;
};

export interface UpcomingItem {
  id: string;
  title: string;
  dueMs: number;
  tier: Tier | null;
}

/** Open tasks that are overdue or due within `withinDays`, soonest first. */
export const getUpcoming = (tasks: ReminderTask[], now: number, withinDays = 7): UpcomingItem[] =>
  tasks
    .filter((t) => !isDone(t))
    .map((t) => ({ id: t.id, title: t.title, dueMs: parseDeadline(t.deadline) }))
    .filter((t): t is { id: string; title: string; dueMs: number } => t.dueMs !== null && t.dueMs <= now + withinDays * DAY)
    .map((t) => ({ ...t, tier: getReminderTier(t.dueMs, now) }))
    .sort((a, b) => a.dueMs - b.dueMs);
