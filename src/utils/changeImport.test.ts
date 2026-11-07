import { describe, expect, it, vi } from 'vitest';
import {
  applyPlan,
  buildAiInstructions,
  reviewChangeText,
  type ChangePlan,
  type ExistingTask,
  type TaskGateway,
} from './changeImport';
import { parseSqlCommands } from './sqlCommands';

const now = new Date(2026, 10, 7, 12, 0, 0); // Sat 7 Nov 2026, local time

const existing = (id: string, title: string, extra: Partial<ExistingTask> = {}): ExistingTask => ({
  id,
  title,
  deadline: '2026-11-12T00:00:00',
  completed: false,
  workspace_id: null,
  ...extra,
});

const review = (text: string, tasks: ExistingTask[] = []): ChangePlan => {
  const out = reviewChangeText(text, { tasks, now });
  if (!out.ok) throw new Error(out.error);
  return out.plan;
};

const fakeGateway = () => {
  const gateway: TaskGateway = {
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    remove: vi.fn(async () => undefined),
  };
  return gateway;
};

const clock = (ts: unknown, utc = false) => {
  const d = new Date(String(ts).replace(' ', 'T').replace(/\+00$/, '+00:00'));
  const h = utc ? d.getUTCHours() : d.getHours();
  const m = utc ? d.getUTCMinutes() : d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

describe('SQL parsing', () => {
  it('reads INSERT, UPDATE, DELETE, comments and quotes', () => {
    const r = parseSqlCommands(`
      -- note
      USE WORKSPACE 'Uni';
      insert into tasks (title, description) values ('It''s done', "x"); /* c */
      UPDATE tasks SET completed = TRUE WHERE id = 'a1';
      DELETE FROM tasks WHERE title = 'Old' LIMIT ALL;
    `);
    if ('fatal' in r) throw new Error(r.fatal);
    expect(r.workspace).toBe('Uni');
    expect(r.statements).toHaveLength(3);
    expect(r.statements[0]?.raw).toMatchObject({ op: 'add_task', title: "It's done", description: 'x' });
    expect(r.statements[1]?.raw).toMatchObject({ op: 'update_task', match: { id: 'a1' }, set: { completed: true } });
    expect(r.statements[2]?.raw).toMatchObject({ op: 'delete_task', all_matches: true });
  });

  it('accepts text wrapped in a ```sql fence with chat around it', () => {
    const plan = review("Sure!\n```sql\nINSERT INTO tasks (title) VALUES ('Read chapter');\n```\nDone.");
    expect(plan.counts.add).toBe(1);
  });

  it('refuses UPDATE or DELETE without WHERE, and unknown tables', () => {
    const plan = (t: string) => review(t, [existing('1', 'A task')]);
    expect(plan("UPDATE tasks SET title = 'Hello';").items[0]?.reason).toMatch(/needs a WHERE/);
    expect(plan('DELETE FROM tasks;').items[0]?.reason).toMatch(/needs a WHERE/);
    expect(plan("DROP TABLE tasks;").items[0]?.reason).toMatch(/Unknown command/);
    expect(plan("DELETE FROM users WHERE id = '1';").items[0]?.reason).toMatch(/Unknown table/);
    expect(plan("DELETE FROM tasks WHERE assignment = 'x';").items[0]?.reason).toMatch(/only use id, title or date/);
    expect(plan('DELETE FROM tasks;').counts.delete).toBe(0);
  });

  it('reports syntax errors per statement and still reads the others', () => {
    const plan = review("INSERT INTO tasks (title) VALUES ('Fine task'); INSERT INTO tasks (title VALUES ('x');");
    expect(plan.counts.add).toBe(1);
    expect(plan.counts.error).toBe(1);
    expect(plan.canApply).toBe(false);
  });

  it('still understands the JSON format', () => {
    const plan = review('{"operations":[{"op":"add_task","title":"From json"}]}');
    expect(plan.counts.add).toBe(1);
  });
});

describe('constraints', () => {
  const reason = (sql: string) => review(sql).items[0]?.reason ?? '';

  it('title length, dates, times, enums', () => {
    expect(reason("INSERT INTO tasks (title) VALUES ('ab');")).toMatch(/at least 3/);
    expect(reason("INSERT INTO tasks (title, date) VALUES ('Valid title', '2026-02-30');")).toMatch(/real date/);
    expect(reason("INSERT INTO tasks (title, date, start_time) VALUES ('Valid title', '2026-11-12', '25:00');")).toMatch(/HH:MM/);
    expect(reason("INSERT INTO tasks (title, difficulty) VALUES ('Valid title', 'brutal');")).toBeTruthy();
  });

  it('rejects unknown columns instead of silently ignoring them', () => {
    expect(reason("INSERT INTO tasks (title, deadline) VALUES ('Valid title', '2026-11-12');")).toMatch(/deadline/i);
  });

  it('cross-field rules', () => {
    expect(reason("INSERT INTO tasks (title, start_time) VALUES ('Valid title', '10:00');")).toMatch(/needs a "date"/);
    expect(reason("INSERT INTO tasks (title, date, start_time, end_time) VALUES ('Valid title', '2026-11-12', '10:00', '09:00');")).toMatch(/later than/);
    expect(reason("INSERT INTO tasks (title, date, repeat_weekly_on) VALUES ('Valid title', '2026-11-12', 'mon');")).toMatch(/not both/);
    expect(reason("INSERT INTO tasks (title, repeat_weekly_on) VALUES ('Valid title', 'funday');")).toMatch(/mon..sun/);
  });

  it('column/value count mismatch', () => {
    expect(reason("INSERT INTO tasks (title, date) VALUES ('Only title');")).toMatch(/2 columns but a row has 1/);
  });

  it('caps the number of statements', () => {
    const sql = Array.from({ length: 201 }, (_, i) => `INSERT INTO tasks (title) VALUES ('Task ${i}');`).join('\n');
    const out = reviewChangeText(sql, { tasks: [], now });
    expect(out.ok).toBe(false);
  });
});

describe('INSERT (adding)', () => {
  it('builds stored fields the calendar can read back', () => {
    const plan = review("INSERT INTO tasks (title, date, start_time, end_time, assignment) VALUES ('Dentist', '2026-11-12', '15:00', '16:00', 'Health');");
    const item = plan.items[0];
    expect(item?.action).toBe('add');
    const f = item?.fields as Record<string, unknown>;
    expect(f['deadline']).toBe('2026-11-12T00:00:00');
    expect(f['assignment']).toBe('Health');
    expect(f['recurrence_type']).toBe('none');
    expect(clock(f['start_at'])).toBe('15:00');
    expect(clock(f['end_at'])).toBe('16:00');
  });

  it('applies defaults and a 1 hour end time', () => {
    const f = review("INSERT INTO tasks (title, date, start_time) VALUES ('Quick call', '2026-11-12', '09:30');").items[0]?.fields as Record<string, unknown>;
    expect(f['assignment']).toBe('General');
    expect(f['difficulty']).toBe('medium');
    expect(f['status']).toBe('todo');
    expect(clock(f['end_at'])).toBe('10:30');
  });

  it('weekly repeats keep the clock time and drop the date', () => {
    const f = review("INSERT INTO tasks (title, start_time, end_time, repeat_weekly_on) VALUES ('Lecture', '09:00', '10:00', 'wed, Mon');").items[0]?.fields as Record<string, unknown>;
    expect(f['recurrence_type']).toBe('weekly');
    expect(f['recurrence_weekdays']).toEqual([1, 3]);
    expect(f['deadline']).toBeNull();
    expect(clock(f['start_at'], true)).toBe('09:00');
  });

  it('multi-row VALUES become several adds', () => {
    expect(review("INSERT INTO tasks (title) VALUES ('Task one'), ('Task two');").counts.add).toBe(2);
  });

  it('skips tasks that already exist and repeats inside the same paste', () => {
    const tasks = [existing('1', 'Dentist', { start_at: null })];
    const plan = review(
      `INSERT INTO tasks (title, date) VALUES ('dentist', '2026-11-12');
       INSERT INTO tasks (title, date) VALUES ('Gym', '2026-11-13');
       INSERT INTO tasks (title, date) VALUES ('Gym', '2026-11-13');`,
      tasks,
    );
    expect(plan.items.map((i) => i.action)).toEqual(['skip', 'add', 'skip']);
    expect(plan.counts.add).toBe(1);
  });

  it('importing the same text twice adds nothing the second time', () => {
    const sql = "INSERT INTO tasks (title, date, start_time) VALUES ('Dentist', '2026-11-12', '15:00');";
    const first = review(sql);
    const created = first.items[0]?.fields as Record<string, unknown>;
    const second = review(sql, [{ id: 'new', title: 'Dentist', ...created } as ExistingTask]);
    expect(second.counts.add).toBe(0);
    expect(second.counts.skip).toBe(1);
  });

  it('adds to the workspace named by USE WORKSPACE, and errors on an unknown one', () => {
    const ctx = { tasks: [], now, workspaces: [{ id: 'w1', name: 'Uni' }], currentWorkspaceId: 'w0' };
    const ok = reviewChangeText("USE WORKSPACE 'uni'; INSERT INTO tasks (title) VALUES ('Study notes');", ctx);
    expect(ok.ok && (ok.plan.items[0]?.fields as Record<string, unknown>)['workspace_id']).toBe('w1');
    const bad = reviewChangeText("USE WORKSPACE 'Nope'; INSERT INTO tasks (title) VALUES ('Study notes');", ctx);
    expect(bad.ok && bad.plan.canApply).toBe(false);
  });

  it('an add-only plan never touches existing tasks and never calls delete', async () => {
    const gateway = fakeGateway();
    const tasks = [existing('1', 'Keep me'), existing('2', 'Keep me too')];
    const plan = review("INSERT INTO tasks (title) VALUES ('Brand new task');", tasks);
    expect(plan.hasDeletes).toBe(false);
    const result = await applyPlan(plan, gateway);
    expect(result.added).toBe(1);
    expect(gateway.create).toHaveBeenCalledTimes(1);
    expect(gateway.remove).not.toHaveBeenCalled();
    expect(gateway.update).not.toHaveBeenCalled();
  });
});

describe('UPDATE', () => {
  const tasks = [existing('1', 'Dentist', { start_at: '2026-11-12 09:30:00.000+00', end_at: '2026-11-12 10:30:00.000+00' })];

  it('changing the date moves the scheduled time with it', () => {
    const plan = review("UPDATE tasks SET date = '2026-11-14' WHERE id = '1';", [
      existing('1', 'Dentist', { start_at: new Date(2026, 10, 12, 15, 0).toISOString(), end_at: new Date(2026, 10, 12, 16, 0).toISOString() }),
    ]);
    const item = plan.items[0];
    expect(item?.action).toBe('update');
    const f = item?.fields as Record<string, unknown>;
    expect(f['deadline']).toBe('2026-11-14T00:00:00');
    expect(clock(f['start_at'])).toBe('15:00');
    expect(new Date(String(f['start_at']).replace(' ', 'T').replace(/\+00$/, '+00:00')).getDate()).toBe(14);
  });

  it('marks completed and stamps completed_at', () => {
    const f = review("UPDATE tasks SET completed = TRUE WHERE title = 'Dentist';", tasks).items[0]?.fields as Record<string, unknown>;
    expect(f['completed']).toBe(true);
    expect(f['completed_at']).toBeTruthy();
  });

  it('is skipped when nothing would change or nothing matches', () => {
    expect(review("UPDATE tasks SET title = 'Dentist' WHERE id = '1';", tasks).items[0]?.action).toBe('skip');
    expect(review("UPDATE tasks SET title = 'Whatever' WHERE id = '999';", tasks).items[0]?.action).toBe('skip');
  });

  it('is an error when several tasks match, so the wrong one is never changed', () => {
    const two = [existing('1', 'Gym'), existing('2', 'Gym')];
    const plan = review("UPDATE tasks SET description = 'x' WHERE title = 'Gym';", two);
    expect(plan.items[0]?.action).toBe('error');
    expect(plan.canApply).toBe(false);
  });

  it('WHERE id and title must both agree when both are given', () => {
    expect(review("UPDATE tasks SET description = 'x' WHERE id = '1' AND title = 'Other';", tasks).items[0]?.action).toBe('skip');
  });
});

describe('DELETE (needs explicit command and confirmation)', () => {
  const tasks = [existing('1', 'Dentist'), existing('2', 'Gym'), existing('3', 'Gym', { deadline: '2026-11-20T00:00:00' })];

  it('plans exactly the matched task and applies only with confirmation', async () => {
    const plan = review("DELETE FROM tasks WHERE id = '1';", tasks);
    expect(plan.hasDeletes).toBe(true);
    expect(plan.items.map((i) => i.taskId)).toEqual(['1']);

    const gateway = fakeGateway();
    await expect(applyPlan(plan, gateway)).rejects.toThrow(/Confirm the deletion/);
    expect(gateway.remove).not.toHaveBeenCalled();

    const result = await applyPlan(plan, gateway, { confirmDeletes: true });
    expect(result.deleted).toBe(1);
    expect(gateway.remove).toHaveBeenCalledTimes(1);
    expect(gateway.remove).toHaveBeenCalledWith('1');
  });

  it('several matches are refused unless LIMIT ALL is written', () => {
    expect(review("DELETE FROM tasks WHERE title = 'Gym';", tasks).items[0]?.action).toBe('error');
    const all = review("DELETE FROM tasks WHERE title = 'Gym' LIMIT ALL;", tasks);
    expect(all.items.map((i) => i.taskId)).toEqual(['2', '3']);
  });

  it('date narrows the match', () => {
    const plan = review("DELETE FROM tasks WHERE title = 'Gym' AND date = '2026-11-20';", tasks);
    expect(plan.items.map((i) => i.taskId)).toEqual(['3']);
  });

  it('no match deletes nothing', () => {
    const plan = review("DELETE FROM tasks WHERE title = 'Missing';", tasks);
    expect(plan.items[0]?.action).toBe('skip');
    expect(plan.canApply).toBe(false);
  });

  it('adds and updates run before deletes, and a failure stops the deletes', async () => {
    const plan = review(
      "INSERT INTO tasks (title) VALUES ('New thing'); DELETE FROM tasks WHERE id = '1';",
      tasks,
    );
    const gateway = fakeGateway();
    (gateway.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('db down'));
    const result = await applyPlan(plan, gateway, { confirmDeletes: true });
    expect(result.failures).toHaveLength(1);
    expect(result.deletesSkipped).toBe(true);
    expect(gateway.remove).not.toHaveBeenCalled();
  });

  it('cannot apply a plan that has errors', async () => {
    const plan = review("INSERT INTO tasks (title) VALUES ('Fine one'); INSERT INTO tasks (title) VALUES ('x');");
    await expect(applyPlan(plan, fakeGateway())).rejects.toThrow(/errors/);
  });
});

describe('AI instructions', () => {
  it('teach the SQL syntax, today, and optionally the open tasks', () => {
    const text = buildAiInstructions({ now, timeZone: 'Asia/Calcutta', tasks: [existing('abc', 'Dentist'), existing('z', 'Done', { completed: true })] });
    expect(text).toContain('Saturday 2026-11-07');
    expect(text).toContain('INSERT INTO tasks');
    expect(text).toContain('DELETE FROM tasks');
    expect(text).toContain('id=abc');
    expect(text).not.toContain('id=z');
  });
});
