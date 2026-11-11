/**
 * Exam readiness: link an upcoming event ("CBSE Class 12 Board: Physics (042)") to the tasks of the
 * matching subject ("Physics") and say how many are done and how fast the rest has to go.
 */

/** Words that say nothing about the subject. */
const NOISE = new Set([
  'class', 'board', 'exam', 'exams', 'test', 'tests', 'unit', 'paper', 'term', 'mock', 'final', 'finals',
  'viva', 'practical', 'cbse', 'of', 'and', 'the', 'core', 'general', 'revision', 'chapter', 'chapters',
]);

/** Common short forms students use for subjects. */
const ALIASES: Record<string, string[]> = {
  ai: ['artificial', 'intelligence'],
  cs: ['computer', 'science'],
  maths: ['mathematics'],
  math: ['mathematics'],
  phy: ['physics'],
  chem: ['chemistry'],
  bio: ['biology'],
  eng: ['english'],
  eco: ['economics'],
};

const words = (text: string): string[] => (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !/^\d+$/.test(w));

const stem = (w: string): string => (w.length >= 5 ? w.slice(0, 4) : w);

const sameWord = (a: string, b: string): boolean => a === b || (a.length >= 4 && b.length >= 4 && stem(a) === stem(b));

const subjectTokens = (subject: string): string[] => {
  const out: string[] = [];
  for (const w of words(subject)) {
    if (NOISE.has(w)) continue;
    out.push(w, ...(ALIASES[w] ?? []));
  }
  return out;
};

/** How many of the subject's words show up in the event title (0 = no match). */
export const subjectScore = (eventTitle: string, subject: string): number => {
  const title = words(eventTitle).filter((w) => !NOISE.has(w));
  if (title.length === 0) return 0;
  const tokens = subjectTokens(subject);
  let score = 0;
  for (const token of tokens) {
    if (title.some((t) => sameWord(t, token))) score++;
  }
  return score;
};

export interface TaskLike {
  assignment?: string | null;
  completed?: boolean | null;
}

export interface Readiness {
  subject: string;
  total: number;
  done: number;
  remaining: number;
  percent: number;
}

/** Picks the subject (task assignment) that best matches the event and counts its tasks. */
export const readinessFor = (eventTitle: string, tasks: readonly TaskLike[]): Readiness | null => {
  const groups = new Map<string, { subject: string; total: number; done: number }>();
  for (const task of tasks) {
    const subject = task.assignment?.trim();
    if (!subject) continue;
    const key = subject.toLowerCase();
    const group = groups.get(key) ?? { subject, total: 0, done: 0 };
    group.total++;
    if (task.completed) group.done++;
    groups.set(key, group);
  }

  let best: { subject: string; total: number; done: number } | null = null;
  let bestScore = 0;
  for (const group of groups.values()) {
    const score = subjectScore(eventTitle, group.subject);
    if (score > bestScore) {
      best = group;
      bestScore = score;
    }
  }
  if (!best) return null;
  const remaining = best.total - best.done;
  return { subject: best.subject, total: best.total, done: best.done, remaining, percent: Math.round((best.done / best.total) * 100) };
};

/** "1 task every 8 days", "2 tasks a day", "All done". */
export const paceHint = (remaining: number, daysLeft: number): string => {
  if (remaining <= 0) return 'All done';
  if (daysLeft <= 0) return `${remaining} left today`;
  const daysPerTask = daysLeft / remaining;
  if (daysPerTask >= 1.5) return `1 task every ${Math.round(daysPerTask)} days`;
  const perDay = Math.ceil(remaining / daysLeft);
  return `${perDay} task${perDay === 1 ? '' : 's'} a day`;
};
