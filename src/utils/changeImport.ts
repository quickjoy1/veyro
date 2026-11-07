/**
 * AI change import.
 *
 * The user asks an AI for a "change set" (JSON), pastes it into Settings > Data,
 * reviews the plan, and applies it. Rules that this module guarantees:
 *
 *  - Adding never removes or overwrites anything. Re-importing the same JSON does not
 *    create duplicates (identical tasks are skipped).
 *  - Tasks are only deleted by an explicit `delete_task` operation, and `applyPlan`
 *    refuses to run deletes unless the caller confirms them.
 *  - Every update/delete targets tasks by exact id (or exact title), never "everything".
 *  - Nothing is applied while the plan has errors.
 *
 * This file is pure (no UI, no database) so all of it can be unit tested.
 */
import { z } from 'zod';
import { looksLikeSql, parseSqlCommands } from '@/utils/sqlCommands';

export const MAX_OPERATIONS = 200;
const DEFAULT_ASSIGNMENT = 'General';
const DEFAULT_DURATION_MIN = 60;

// ---------------------------------------------------------------------------
// Small date/time helpers (stored formats match what the task form writes)
// ---------------------------------------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, '0');

function isRealDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function parseHM(hm: string): { h: number; m: number } {
  const match = /^(\d{1,2}):(\d{2})/.exec(hm);
  return { h: Number(match?.[1] ?? 0), m: Number(match?.[2] ?? 0) };
}

const hmToMinutes = (hm: string) => {
  const { h, m } = parseHM(hm);
  return h * 60 + m;
};
const minutesToHM = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
const normalizeHM = (hm: string) => minutesToHM(hmToMinutes(hm));

/** "2026-11-07 08:30:00.000+00" - the format the task form stores in start_at/end_at */
function dbTimestamp(d: Date): string {
  return d.toISOString().replace('T', ' ').replace('Z', '+00');
}

/** A wall-clock time on a calendar day (user's local time zone) as the stored UTC instant. */
function localTimestamp(ymd: string, hm: string): string {
  const [y, mo, d] = ymd.split('-').map(Number);
  const { h, m } = parseHM(hm);
  return dbTimestamp(new Date(y ?? 0, (mo ?? 1) - 1, d ?? 1, h, m));
}

/** Weekly tasks keep their clock time as UTC on today's date (same as the task form). */
function recurringTimestamp(hm: string, now: Date): string {
  const { h, m } = parseHM(hm);
  return dbTimestamp(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), h, m)));
}

function normalizeTimestamp(ts: string): string {
  let n = ts.trim();
  if (n.includes(' ')) n = n.replace(' ', 'T');
  if (/([+-]\d{2})$/.test(n)) n = `${n}:00`;
  return n;
}

function timestampToMs(ts: string | null | undefined): number | null {
  if (!ts) return null;
  const ms = Date.parse(normalizeTimestamp(ts));
  return Number.isNaN(ms) ? null : ms;
}

/** HH:MM of a stored timestamp (or legacy "HH:MM[:SS]"). `utc` is for weekly tasks. */
function clockFromTimestamp(ts: string | null | undefined, utc: boolean): string | null {
  if (!ts) return null;
  const trimmed = ts.trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) return normalizeHM(trimmed);
  const ms = timestampToMs(trimmed);
  if (ms === null) return null;
  const d = new Date(ms);
  return utc
    ? `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
    : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function localYmd(deadline: string | null | undefined): string | null {
  if (!deadline) return null;
  // Date-only or date + time without a zone: the date part is what the user picked.
  if (/^\d{4}-\d{2}-\d{2}(T[\d:.]+)?$/.test(deadline)) return deadline.slice(0, 10);
  const ms = timestampToMs(deadline);
  if (ms === null) return null;
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// ---------------------------------------------------------------------------
// Weekdays
// ---------------------------------------------------------------------------

const WEEKDAY_NAMES = new Map<string, number>([
  ['sun', 0], ['sunday', 0],
  ['mon', 1], ['monday', 1],
  ['tue', 2], ['tues', 2], ['tuesday', 2],
  ['wed', 3], ['weds', 3], ['wednesday', 3],
  ['thu', 4], ['thur', 4], ['thurs', 4], ['thursday', 4],
  ['fri', 5], ['friday', 5],
  ['sat', 6], ['saturday', 6],
]);
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayToNumber(v: number | string): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 6 ? v : null;
  return WEEKDAY_NAMES.get(v.trim().toLowerCase()) ?? null;
}

function toWeekdays(list: (number | string)[]): number[] {
  const nums = list.map(weekdayToNumber).filter((n): n is number => n !== null);
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const titleSchema = z.string().trim().min(3, 'title must be at least 3 characters').max(100, 'title must be at most 100 characters');
const assignmentSchema = z.string().trim().min(1).max(100);
const descriptionSchema = z.string().max(500, 'description must be at most 500 characters');
const difficultySchema = z.enum(['easy', 'medium', 'hard']);
const statusSchema = z.enum(['todo', 'in_progress', 'on_hold']);
const dateSchema = z.string().refine(isRealDate, 'must be a real date written YYYY-MM-DD');
const timeSchema = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'must be 24-hour HH:MM, for example 14:30');
const weekdayListSchema = z
  .array(z.union([z.number(), z.string()]))
  .min(1, 'repeat_weekly_on needs at least one day')
  .max(7)
  .refine((list) => list.every((v) => weekdayToNumber(v) !== null), 'days must be mon..sun or 0 (Sunday) to 6 (Saturday)');

const matchSchema = z
  .strictObject({
    id: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    date: dateSchema.optional(),
  })
  .refine((m) => Boolean(m.id) || Boolean(m.title), 'match needs an "id" or a "title"');

const addOpSchema = z.strictObject({
  op: z.literal('add_task'),
  title: titleSchema,
  assignment: assignmentSchema.optional(),
  description: descriptionSchema.optional(),
  difficulty: difficultySchema.optional(),
  status: statusSchema.optional(),
  date: dateSchema.nullish(),
  start_time: timeSchema.nullish(),
  end_time: timeSchema.nullish(),
  repeat_weekly_on: weekdayListSchema.nullish(),
});

const setSchema = z
  .strictObject({
    title: titleSchema.optional(),
    assignment: assignmentSchema.optional(),
    description: descriptionSchema.optional(),
    difficulty: difficultySchema.optional(),
    status: statusSchema.optional(),
    date: dateSchema.nullable().optional(),
    start_time: timeSchema.nullable().optional(),
    end_time: timeSchema.nullable().optional(),
    repeat_weekly_on: weekdayListSchema.nullable().optional(),
    completed: z.boolean().optional(),
  })
  .refine((s) => Object.values(s).some((v) => v !== undefined), '"set" must change at least one field');

const updateOpSchema = z.strictObject({
  op: z.literal('update_task'),
  match: matchSchema,
  set: setSchema,
});

const deleteOpSchema = z.strictObject({
  op: z.literal('delete_task'),
  match: matchSchema,
  all_matches: z.boolean().optional(),
});

const envelopeSchema = z.object({
  version: z.number().optional(),
  workspace: z.string().trim().min(1).optional(),
  note: z.string().max(300).optional(),
  operations: z
    .array(z.unknown(), 'operations must be a list')
    .min(1, 'operations is empty')
    .max(MAX_OPERATIONS, `at most ${MAX_OPERATIONS} operations per import`),
});

export type AddOp = z.infer<typeof addOpSchema>;
export type UpdateOp = z.infer<typeof updateOpSchema>;
export type DeleteOp = z.infer<typeof deleteOpSchema>;
export type Operation = AddOp | UpdateOp | DeleteOp;

const OP_SCHEMAS = {
  add_task: addOpSchema,
  update_task: updateOpSchema,
  delete_task: deleteOpSchema,
} as const;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export interface ParsedOperation {
  /** 1-based position in the pasted JSON, shown to the user */
  index: number;
  operation?: Operation | undefined;
  error?: string | undefined;
}

export interface ParsedChangeSet {
  workspace?: string | undefined;
  note?: string | undefined;
  operations: ParsedOperation[];
}

export type ParseOutcome = { ok: true; changeSet: ParsedChangeSet } | { ok: false; error: string };

/** AI replies often wrap JSON in a ```json fence and chat text. Take what is inside the fence. */
export function extractJson(text: string): string {
  const fenced = /```[a-zA-Z]*\s*([\s\S]*?)```/.exec(text);
  return (fenced?.[1] ?? text).trim();
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const where = issue.path.map(String).join('.');
      return where ? `${where}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

/** Check one raw operation object against the constraint schemas. */
function validateRaw(raw: unknown, index: number): ParsedOperation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { index, error: 'must be an object like {"op": "add_task", ...}' };
  }
  const opName = (raw as Record<string, unknown>)['op'];
  if (typeof opName !== 'string' || !(opName in OP_SCHEMAS)) {
    return { index, error: `unknown op ${JSON.stringify(opName)}. Use add_task, update_task or delete_task.` };
  }
  const parsed = OP_SCHEMAS[opName as keyof typeof OP_SCHEMAS].safeParse(raw);
  if (!parsed.success) return { index, error: formatIssues(parsed.error) };
  return { index, operation: parsed.data as Operation };
}

/**
 * True when pasted text is a set of commands for Veyro (SQL-style, or JSON with "operations")
 * rather than a normal sentence for the AI task generator.
 */
export function looksLikeChangeCommands(text: string): boolean {
  const body = extractJson(text);
  return looksLikeSql(body) || /^\{[\s\S]*"operations"\s*:/.test(body);
}

/** SQL-like text (the main format) or JSON (fallback). */
export function parseChangeSet(text: string): ParseOutcome {
  const body = extractJson(text);
  if (!body) return { ok: false, error: 'Paste the commands from the AI first.' };
  if (!/^[[{]/.test(body)) {
    const sql = parseSqlCommands(body);
    if ('fatal' in sql) return { ok: false, error: sql.fatal };
    if (sql.statements.length > MAX_OPERATIONS) {
      return { ok: false, error: `At most ${MAX_OPERATIONS} changes per import (found ${sql.statements.length}).` };
    }
    return {
      ok: true,
      changeSet: {
        workspace: sql.workspace,
        operations: sql.statements.map((s) => (s.raw ? validateRaw(s.raw, s.index) : { index: s.index, error: s.error })),
      },
    };
  }
  return parseJsonChangeSet(text);
}

function parseJsonChangeSet(text: string): ParseOutcome {
  let data: unknown;
  try {
    data = JSON.parse(extractJson(text));
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'invalid JSON';
    return { ok: false, error: `That is not valid JSON (${reason}). Paste exactly what the AI returned.` };
  }

  if (Array.isArray(data)) data = { operations: data };
  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: 'Expected a JSON object like {"operations": [...]}.' };
  }

  const env = envelopeSchema.safeParse(data);
  if (!env.success) {
    const hasOps = 'operations' in (data as Record<string, unknown>);
    return {
      ok: false,
      error: hasOps ? formatIssues(env.error) : 'Missing the "operations" list. Expected {"operations": [...]}.',
    };
  }
  if (env.data.version !== undefined && env.data.version !== 1) {
    return { ok: false, error: `Unsupported version ${env.data.version}. This app understands version 1.` };
  }

  const operations: ParsedOperation[] = env.data.operations.map((raw, i) => validateRaw(raw, i + 1));

  return {
    ok: true,
    changeSet: { workspace: env.data.workspace, note: env.data.note, operations },
  };
}

// ---------------------------------------------------------------------------
// Scheduling (date + times + weekly repeat -> stored fields)
// ---------------------------------------------------------------------------

interface ScheduleInput {
  date: string | null;
  start: string | null;
  end: string | null;
  weekdays: number[] | null;
}

interface ScheduleFields {
  deadline: string | null;
  start_at: string | null;
  end_at: string | null;
  recurrence_type: 'weekly' | 'none';
  recurrence_weekdays: number[] | null;
}

/** Throws an Error with a plain-language message when the combination is not valid. */
function buildSchedule(input: ScheduleInput, now: Date): ScheduleFields {
  const { date, start, end, weekdays } = input;
  if (weekdays && date) {
    throw new Error('use either "date" or "repeat_weekly_on", not both (set the other to null to switch)');
  }
  if (end && !start) throw new Error('"end_time" needs a "start_time"');
  if (start && !date && !weekdays) throw new Error('"start_time" needs a "date" (or "repeat_weekly_on")');
  if (start && end && hmToMinutes(end) <= hmToMinutes(start)) {
    throw new Error('"end_time" must be later than "start_time" on the same day');
  }

  const startHM = start ? normalizeHM(start) : null;
  const endHM = startHM
    ? end
      ? normalizeHM(end)
      : minutesToHM(Math.min(hmToMinutes(startHM) + DEFAULT_DURATION_MIN, 23 * 60 + 59))
    : null;

  if (weekdays) {
    return {
      deadline: null,
      start_at: startHM ? recurringTimestamp(startHM, now) : null,
      end_at: endHM ? recurringTimestamp(endHM, now) : null,
      recurrence_type: 'weekly',
      recurrence_weekdays: weekdays,
    };
  }

  return {
    deadline: date ? `${date}T00:00:00` : null,
    start_at: date && startHM ? localTimestamp(date, startHM) : null,
    end_at: date && endHM ? localTimestamp(date, endHM) : null,
    recurrence_type: 'none',
    recurrence_weekdays: null,
  };
}

function describeSchedule(s: { date: string | null; start: string | null; end: string | null; weekdays: number[] | null }): string {
  const times = s.start ? ` ${normalizeHM(s.start)}${s.end ? `-${normalizeHM(s.end)}` : ''}` : '';
  if (s.weekdays) return `every ${s.weekdays.map((d) => WEEKDAY_LABELS[d]).join(', ')}${times}`;
  if (s.date) return `${s.date}${times}`;
  return 'no date';
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export interface ExistingTask {
  id: string | number;
  title: string;
  assignment?: string | null | undefined;
  description?: string | null | undefined;
  difficulty?: string | null | undefined;
  status?: string | null | undefined;
  deadline?: string | null | undefined;
  start_at?: string | null | undefined;
  end_at?: string | null | undefined;
  recurrence_type?: string | null | undefined;
  recurrence_weekdays?: number[] | null | undefined;
  workspace_id?: string | null | undefined;
  completed?: boolean | undefined;
}

export interface PlanContext {
  tasks: ExistingTask[];
  workspaces?: { id: string | number; name?: string | undefined }[] | undefined;
  currentWorkspaceId?: string | number | null | undefined;
  now?: Date | undefined;
}

export type PlanAction = 'add' | 'update' | 'delete' | 'skip' | 'error';

export interface PlanItem {
  /** which operation in the pasted JSON this comes from (1-based) */
  opIndex: number;
  action: PlanAction;
  summary: string;
  reason?: string | undefined;
  /** task that will be updated or deleted */
  taskId?: string | undefined;
  /** database fields to insert (add) or change (update) */
  fields?: Record<string, unknown> | undefined;
}

export interface ChangePlan {
  items: PlanItem[];
  counts: Record<PlanAction, number>;
  hasDeletes: boolean;
  /** problems that block the whole import (for example an unknown workspace) */
  globalErrors: string[];
  canApply: boolean;
  note?: string | undefined;
}

const normWorkspace = (id: string | number | null | undefined): string | null =>
  id === null || id === undefined || id === 'all' ? null : String(id);

const normTitle = (s: string) => s.trim().toLowerCase();

const isRecurringTask = (t: ExistingTask): boolean =>
  t.recurrence_type === 'weekly' && Array.isArray(t.recurrence_weekdays) && t.recurrence_weekdays.length > 0;

function existingClock(t: ExistingTask, which: 'start_at' | 'end_at'): string | null {
  return clockFromTimestamp(t[which], isRecurringTask(t));
}

/** One string per "same task": used to skip duplicates when the same JSON is imported twice. */
function dedupeKey(
  workspaceId: string | null,
  title: string,
  s: { weekdays: number[] | null; date: string | null; startAt: string | null },
): string {
  const head = `${workspaceId ?? ''}|${normTitle(title)}`;
  if (s.weekdays) return `${head}|weekly:${s.weekdays.join(',')}|${clockFromTimestamp(s.startAt, true) ?? ''}`;
  return `${head}|${s.date ?? ''}|${timestampToMs(s.startAt) ?? clockFromTimestamp(s.startAt, false) ?? ''}`;
}

function existingKey(t: ExistingTask): string {
  const weekdays = isRecurringTask(t) ? [...(t.recurrence_weekdays ?? [])].sort((a, b) => a - b) : null;
  return dedupeKey(normWorkspace(t.workspace_id), t.title, {
    weekdays,
    date: weekdays ? null : localYmd(t.deadline),
    startAt: t.start_at ?? null,
  });
}

function scheduleSignature(s: { weekdays: number[] | null; date: string | null; startAt: string | null; endAt: string | null }): string {
  const clock = (ts: string | null) => (s.weekdays ? clockFromTimestamp(ts, true) : timestampToMs(ts)) ?? '';
  return `${s.weekdays ? `w${s.weekdays.join(',')}` : `d${s.date ?? ''}`}|${clock(s.startAt)}|${clock(s.endAt)}`;
}

function findMatches(match: { id?: string | undefined; title?: string | undefined; date?: string | undefined }, tasks: ExistingTask[]): ExistingTask[] {
  return tasks.filter((t) => {
    if (match.id !== undefined && String(t.id) !== match.id) return false;
    if (match.title !== undefined && normTitle(t.title) !== normTitle(match.title)) return false;
    if (match.date !== undefined && localYmd(t.deadline) !== match.date) return false;
    return true;
  });
}

const quote = (title: string) => `"${title}"`;

function describeTask(t: ExistingTask): string {
  const weekdays = isRecurringTask(t) ? [...(t.recurrence_weekdays ?? [])].sort((a, b) => a - b) : null;
  const when = describeSchedule({
    date: weekdays ? null : localYmd(t.deadline),
    start: existingClock(t, 'start_at'),
    end: existingClock(t, 'end_at'),
    weekdays,
  });
  return `${quote(t.title)} (${when})`;
}

function describeMatch(m: { id?: string | undefined; title?: string | undefined; date?: string | undefined }): string {
  if (m.title) return `${quote(m.title)}${m.date ? ` on ${m.date}` : ''}`;
  return `id ${m.id}`;
}

interface PlanEnv {
  now: Date;
  tasks: ExistingTask[];
  workspaceId: string | null;
  seenKeys: Map<string, number>;
  claimedIds: Map<string, number>;
}

function planAdd(op: AddOp, opIndex: number, env: PlanEnv): PlanItem[] {
  const weekdays = op.repeat_weekly_on ? toWeekdays(op.repeat_weekly_on) : null;
  const input: ScheduleInput = {
    date: op.date ?? null,
    start: op.start_time ?? null,
    end: op.end_time ?? null,
    weekdays,
  };
  const label = quote(op.title);

  let schedule: ScheduleFields;
  try {
    schedule = buildSchedule(input, env.now);
  } catch (err) {
    return [{ opIndex, action: 'error', summary: `Add ${label}`, reason: err instanceof Error ? err.message : 'invalid schedule' }];
  }

  const summary = `Add ${label} - ${describeSchedule({ ...input, end: schedule.end_at ? clockFromTimestamp(schedule.end_at, Boolean(weekdays)) : null })}`;
  const key = dedupeKey(env.workspaceId, op.title, {
    weekdays,
    date: input.date,
    startAt: schedule.start_at,
  });

  const earlier = env.seenKeys.get(key);
  if (earlier !== undefined) {
    return [{ opIndex, action: 'skip', summary, reason: earlier === 0 ? 'Already in your tasks' : `Same as operation ${earlier}` }];
  }
  env.seenKeys.set(key, opIndex);

  return [
    {
      opIndex,
      action: 'add',
      summary,
      fields: {
        title: op.title,
        assignment: op.assignment ?? DEFAULT_ASSIGNMENT,
        description: op.description ?? '',
        difficulty: op.difficulty ?? 'medium',
        status: op.status ?? 'todo',
        workspace_id: env.workspaceId,
        ...schedule,
      },
    },
  ];
}

function planUpdate(op: UpdateOp, opIndex: number, env: PlanEnv): PlanItem[] {
  const target = describeMatch(op.match);
  const matches = findMatches(op.match, env.tasks);

  if (matches.length === 0) {
    return [{ opIndex, action: 'skip', summary: `Update ${target}`, reason: 'No task matches, nothing changed' }];
  }
  if (matches.length > 1) {
    return [
      {
        opIndex,
        action: 'error',
        summary: `Update ${target}`,
        reason: `${matches.length} tasks match (${matches.slice(0, 3).map(describeTask).join(', ')}). Use the task "id" so only one is changed.`,
      },
    ];
  }

  const task = matches[0] as ExistingTask;
  const taskId = String(task.id);
  const claimed = env.claimedIds.get(taskId);
  if (claimed !== undefined) {
    return [{ opIndex, action: 'skip', summary: `Update ${describeTask(task)}`, reason: `Operation ${claimed} already targets this task` }];
  }

  const s = op.set;
  const fields: Record<string, unknown> = {};
  const changes: string[] = [];

  if (s.title !== undefined && s.title !== task.title) {
    fields['title'] = s.title;
    changes.push(`title -> ${quote(s.title)}`);
  }
  if (s.assignment !== undefined && s.assignment !== (task.assignment ?? '')) {
    fields['assignment'] = s.assignment;
    changes.push(`assignment -> ${s.assignment}`);
  }
  if (s.description !== undefined && s.description !== (task.description ?? '')) {
    fields['description'] = s.description;
    changes.push('description changed');
  }
  if (s.difficulty !== undefined && s.difficulty !== task.difficulty) {
    fields['difficulty'] = s.difficulty;
    changes.push(`difficulty -> ${s.difficulty}`);
  }
  if (s.status !== undefined && s.status !== task.status) {
    fields['status'] = s.status;
    changes.push(`status -> ${s.status}`);
  }
  if (s.completed !== undefined && s.completed !== Boolean(task.completed)) {
    fields['completed'] = s.completed;
    fields['completed_at'] = s.completed ? env.now.toISOString() : null;
    changes.push(s.completed ? 'mark completed' : 'mark not completed');
  }

  const touchesSchedule =
    s.date !== undefined || s.start_time !== undefined || s.end_time !== undefined || s.repeat_weekly_on !== undefined;
  if (touchesSchedule) {
    const existingWeekdays = isRecurringTask(task) ? [...(task.recurrence_weekdays ?? [])].sort((a, b) => a - b) : null;
    const weekdays = s.repeat_weekly_on !== undefined ? (s.repeat_weekly_on ? toWeekdays(s.repeat_weekly_on) : null) : existingWeekdays;

    let date = s.date !== undefined ? s.date : existingWeekdays ? null : localYmd(task.deadline);
    if (weekdays && s.date === undefined) date = null;
    let start = s.start_time !== undefined ? s.start_time : existingClock(task, 'start_at');
    let end = s.end_time !== undefined ? s.end_time : existingClock(task, 'end_at');
    if (s.start_time === null && s.end_time === undefined) end = null;
    if (s.date === null && !weekdays) {
      if (s.start_time === undefined) start = null;
      if (s.end_time === undefined) end = null;
    }

    let schedule: ScheduleFields;
    try {
      schedule = buildSchedule({ date, start, end, weekdays }, env.now);
    } catch (err) {
      return [{ opIndex, action: 'error', summary: `Update ${describeTask(task)}`, reason: err instanceof Error ? err.message : 'invalid schedule' }];
    }

    const before = scheduleSignature({ weekdays: existingWeekdays, date: existingWeekdays ? null : localYmd(task.deadline), startAt: task.start_at ?? null, endAt: task.end_at ?? null });
    const after = scheduleSignature({ weekdays, date: weekdays ? null : date, startAt: schedule.start_at, endAt: schedule.end_at });
    if (before !== after) {
      Object.assign(fields, schedule);
      changes.push(
        `when -> ${describeSchedule({ date: weekdays ? null : date, start, end: schedule.end_at ? clockFromTimestamp(schedule.end_at, Boolean(weekdays)) : null, weekdays })}`,
      );
    }
  }

  if (changes.length === 0) {
    return [{ opIndex, action: 'skip', summary: `Update ${describeTask(task)}`, reason: 'Already up to date' }];
  }

  env.claimedIds.set(taskId, opIndex);
  return [{ opIndex, action: 'update', summary: `Update ${describeTask(task)}: ${changes.join(', ')}`, taskId, fields }];
}

function planDelete(op: DeleteOp, opIndex: number, env: PlanEnv): PlanItem[] {
  const target = describeMatch(op.match);
  const matches = findMatches(op.match, env.tasks);

  if (matches.length === 0) {
    return [{ opIndex, action: 'skip', summary: `Delete ${target}`, reason: 'No task matches, nothing deleted' }];
  }
  if (matches.length > 1 && !op.all_matches) {
    return [
      {
        opIndex,
        action: 'error',
        summary: `Delete ${target}`,
        reason: `${matches.length} tasks match (${matches.slice(0, 3).map(describeTask).join(', ')}). Use the task "id", or the AI must set "all_matches": true to delete every one.`,
      },
    ];
  }

  return matches.map((task): PlanItem => {
    const taskId = String(task.id);
    const claimed = env.claimedIds.get(taskId);
    if (claimed !== undefined) {
      return { opIndex, action: 'skip', summary: `Delete ${describeTask(task)}`, reason: `Operation ${claimed} already targets this task` };
    }
    env.claimedIds.set(taskId, opIndex);
    return { opIndex, action: 'delete', summary: `Delete ${describeTask(task)}`, taskId };
  });
}

export function buildPlan(changeSet: ParsedChangeSet, ctx: PlanContext): ChangePlan {
  const now = ctx.now ?? new Date();
  const globalErrors: string[] = [];

  let workspaceId = normWorkspace(ctx.currentWorkspaceId);
  if (changeSet.workspace) {
    const wanted = changeSet.workspace.trim().toLowerCase();
    const found = (ctx.workspaces ?? []).find((w) => String(w.id).toLowerCase() === wanted || (w.name ?? '').trim().toLowerCase() === wanted);
    if (found) workspaceId = normWorkspace(found.id);
    else globalErrors.push(`Workspace "${changeSet.workspace}" was not found. Use its exact name, or remove "workspace" to use the current one.`);
  }

  const seenKeys = new Map<string, number>();
  for (const t of ctx.tasks) seenKeys.set(existingKey(t), 0);
  const env: PlanEnv = { now, tasks: ctx.tasks, workspaceId, seenKeys, claimedIds: new Map() };

  const items: PlanItem[] = [];
  for (const parsed of changeSet.operations) {
    const op = parsed.operation;
    if (!op) {
      items.push({ opIndex: parsed.index, action: 'error', summary: `Operation ${parsed.index}`, reason: parsed.error ?? 'invalid operation' });
    } else if (op.op === 'add_task') {
      items.push(...planAdd(op, parsed.index, env));
    } else if (op.op === 'update_task') {
      items.push(...planUpdate(op, parsed.index, env));
    } else {
      items.push(...planDelete(op, parsed.index, env));
    }
  }

  const counts: Record<PlanAction, number> = { add: 0, update: 0, delete: 0, skip: 0, error: 0 };
  for (const item of items) counts[item.action] += 1;

  return {
    items,
    counts,
    hasDeletes: counts.delete > 0,
    globalErrors,
    canApply: globalErrors.length === 0 && counts.error === 0 && counts.add + counts.update + counts.delete > 0,
    note: changeSet.note,
  };
}

export type ReviewOutcome = { ok: true; plan: ChangePlan } | { ok: false; error: string };

/** Parse pasted text and build the plan in one step. */
export function reviewChangeText(text: string, ctx: PlanContext): ReviewOutcome {
  const parsed = parseChangeSet(text);
  if (!parsed.ok) return parsed;
  return { ok: true, plan: buildPlan(parsed.changeSet, ctx) };
}

/** Stable fingerprint of what a plan will do, to detect that tasks changed between review and apply. */
export function planSignature(plan: ChangePlan): string {
  return JSON.stringify(plan.items.map((i) => [i.opIndex, i.action, i.taskId ?? '', i.summary]));
}

// ---------------------------------------------------------------------------
// Applying
// ---------------------------------------------------------------------------

export interface TaskGateway {
  create(fields: Record<string, unknown>): Promise<unknown>;
  update(id: string, fields: Record<string, unknown>): Promise<unknown>;
  remove(id: string): Promise<void>;
}

export interface ApplyOptions {
  /** must be true when the plan contains deletes */
  confirmDeletes?: boolean | undefined;
  onProgress?: ((done: number, total: number) => void) | undefined;
}

export interface ApplyResult {
  added: number;
  updated: number;
  deleted: number;
  failures: { opIndex: number; message: string }[];
  /** true when deletes were left undone because an earlier step failed */
  deletesSkipped: boolean;
}

/**
 * Runs the plan: adds first, then updates, then deletes. Deletes only run when the caller
 * confirmed them and nothing before them failed, so a half-failed import never removes data.
 */
export async function applyPlan(plan: ChangePlan, gateway: TaskGateway, options: ApplyOptions = {}): Promise<ApplyResult> {
  if (!plan.canApply) throw new Error('This plan has errors and cannot be applied.');
  const deletes = plan.items.filter((i) => i.action === 'delete');
  if (deletes.length > 0 && !options.confirmDeletes) {
    throw new Error('This import deletes tasks. Confirm the deletion before applying.');
  }

  const adds = plan.items.filter((i) => i.action === 'add');
  const updates = plan.items.filter((i) => i.action === 'update');
  const total = adds.length + updates.length + deletes.length;
  const result: ApplyResult = { added: 0, updated: 0, deleted: 0, failures: [], deletesSkipped: false };
  let done = 0;

  const run = async (item: PlanItem, work: () => Promise<unknown>, onOk: () => void) => {
    try {
      await work();
      onOk();
    } catch (err) {
      result.failures.push({ opIndex: item.opIndex, message: err instanceof Error ? err.message : String(err) });
    }
    done += 1;
    options.onProgress?.(done, total);
  };

  for (const item of adds) {
    await run(item, () => gateway.create(item.fields ?? {}), () => (result.added += 1));
  }
  for (const item of updates) {
    const id = item.taskId;
    if (!id) continue;
    await run(item, () => gateway.update(id, item.fields ?? {}), () => (result.updated += 1));
  }

  if (deletes.length > 0 && result.failures.length > 0) {
    result.deletesSkipped = true;
    return result;
  }
  for (const item of deletes) {
    const id = item.taskId;
    if (!id) continue;
    await run(item, () => gateway.remove(id), () => (result.deleted += 1));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Instructions to paste into the AI
// ---------------------------------------------------------------------------

export interface AiInstructionOptions {
  now?: Date | undefined;
  timeZone?: string | undefined;
  workspaceNames?: string[] | undefined;
  tasks?: ExistingTask[] | undefined;
}

const MAX_TASKS_IN_PROMPT = 150;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function buildAiInstructions(options: AiInstructionOptions = {}): string {
  const now = options.now ?? new Date();
  const today = `${DAY_NAMES[now.getDay()]} ${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const zone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const lines: string[] = [
    'You are editing my Veyro planner. Reply with ONLY SQL-style statements in the syntax below (one ```sql block is fine), no other text. Veyro checks every statement and rejects anything that breaks the rules.',
    '',
    `Today is ${today} (time zone ${zone}). Turn words like "tomorrow" or "next Friday" into real YYYY-MM-DD dates.`,
    '',
    'SYNTAX (one table: tasks; end every statement with ;)',
    "INSERT INTO tasks (title, date, start_time, end_time, assignment, description, difficulty, status)",
    "  VALUES ('Dentist', '2026-11-12', '15:00', '16:00', 'Health', '', 'easy', 'todo');",
    "UPDATE tasks SET date = '2026-11-14', start_time = '10:00', completed = TRUE WHERE id = '<task id>';",
    "DELETE FROM tasks WHERE id = '<task id>';",
    '',
    'COLUMNS AND CONSTRAINTS',
    "- title: text, 3-100 characters (required for INSERT).",
    "- date: 'YYYY-MM-DD', a real calendar date, or NULL.",
    "- start_time, end_time: 24-hour 'HH:MM'. start_time needs a date. end_time must be later than start_time (default: 1 hour after).",
    "- repeat_weekly_on: 'mon,wed' for weekly repeats. Use it INSTEAD of date, never both.",
    "- assignment: subject/category text, 1-100 characters (default 'General'). description: up to 500 characters.",
    "- difficulty: 'easy' | 'medium' | 'hard'. status: 'todo' | 'in_progress' | 'on_hold'.",
    '- completed (UPDATE only): TRUE or FALSE.',
    "- Text goes in 'single quotes'; write an apostrophe inside text as ''. Several rows are allowed: VALUES (...), (...).",
    "- WHERE (UPDATE and DELETE) may only use id, title and date, joined with AND, and must include id or title. Prefer id.",
    '- If a WHERE matches several tasks, UPDATE and DELETE are refused. Add LIMIT ALL to a DELETE only if I asked to delete every match.',
    '',
    'RULES',
    '- INSERT never removes or changes anything. Only write DELETE if I clearly asked to delete or remove something.',
    '- Use only the columns above, do not invent new ones. At most 200 statements.',
    '- For UPDATE and DELETE, copy the exact id or title from the task list below. If a task is not in the list, do not guess.',
  ];

  if (options.workspaceNames && options.workspaceNames.length > 0) {
    lines.push(`- Optional first line: USE WORKSPACE '<name>'; with one of ${options.workspaceNames.map((n) => `'${n.replace(/'/g, "''")}'`).join(', ')} (default is the one I have open).`);
  }

  if (options.tasks) {
    const open = options.tasks.filter((t) => !t.completed);
    lines.push('', `MY CURRENT TASKS (${open.length} open)`);
    if (open.length === 0) lines.push('(none)');
    for (const t of open.slice(0, MAX_TASKS_IN_PROMPT)) lines.push(`- id=${t.id} | ${describeTask(t)}`);
    if (open.length > MAX_TASKS_IN_PROMPT) lines.push(`(+ ${open.length - MAX_TASKS_IN_PROMPT} more not shown)`);
  }

  lines.push('', 'MY REQUEST', '(write what you want here)');
  return lines.join('\n');
}
