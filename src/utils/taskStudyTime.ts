/** Pure helpers: how much time was studied per task, from study sessions (laps) and their task links. */

export interface LapLike {
  id: string;
  duration?: string | null;
  started_at?: string | null;
  created_at?: string | null;
  task_id?: string | null;
}

export interface SessionTaskLink {
  session_id: string;
  task_id: string;
}

export interface TaskStudyTotals {
  taskId: string;
  totalSeconds: number;
  todaySeconds: number;
  weekSeconds: number;
  sessions: number;
}

/** "HH:MM:SS" or "HH:MM" -> seconds (0 if invalid) */
export const parseHms = (hms?: string | null): number => {
  if (!hms || typeof hms !== "string") return 0;
  const parts = hms.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) {
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  }
  if (parts.length === 2) {
    // If first part >= 60, it's minutes:seconds; if < 60, in Veyro timers it is HH:MM or MM:SS
    // Standard timer strings in the app are HH:MM
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60;
  }
  if (parts.length === 1) {
    return parts[0] ?? 0;
  }
  return 0;
};

/** 4500 -> "1h 15m", 300 -> "5m", 20 -> "<1m", 0 -> "0m" */
export const formatStudied = (seconds: number): string => {
  if (seconds <= 0) return "0m";
  if (seconds < 60) return "<1m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Totals per task. A session counts for a task if it is linked through session_tasks or has task_id. */
export const computeTaskStudyTime = (
  laps: LapLike[],
  links: SessionTaskLink[],
  now: number = Date.now()
): Map<string, TaskStudyTotals> => {
  const tasksBySession = new Map<string, Set<string>>();
  const add = (sessionId: string, taskId: string) => {
    if (!tasksBySession.has(sessionId)) tasksBySession.set(sessionId, new Set());
    tasksBySession.get(sessionId)!.add(taskId);
  };
  links.forEach((l) => add(l.session_id, l.task_id));
  laps.forEach((l) => l.task_id && add(l.id, l.task_id));

  const today = startOfDay(now);
  const weekAgo = today - 6 * 24 * 3_600_000;
  const out = new Map<string, TaskStudyTotals>();

  for (const lap of laps) {
    const taskIds = tasksBySession.get(lap.id);
    if (!taskIds) continue;
    const seconds = parseHms(lap.duration);
    const when = new Date(lap.started_at || lap.created_at || now).getTime();
    for (const taskId of taskIds) {
      const t = out.get(taskId) ?? { taskId, totalSeconds: 0, todaySeconds: 0, weekSeconds: 0, sessions: 0 };
      t.totalSeconds += seconds;
      if (when >= today) t.todaySeconds += seconds;
      if (when >= weekAgo) t.weekSeconds += seconds;
      t.sessions += 1;
      out.set(taskId, t);
    }
  }
  return out;
};
