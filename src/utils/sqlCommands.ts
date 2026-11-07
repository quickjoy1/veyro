/**
 * Tiny SQL-like language for AI change imports.
 *
 *   INSERT INTO tasks (title, date, start_time) VALUES ('Dentist', '2026-11-12', '15:00');
 *   INSERT INTO events (title, date, start_time) VALUES ('Exam', '2026-11-20', '09:00');   -- calendar + reminders only
 *   UPDATE tasks SET date = '2026-11-14', completed = TRUE WHERE id = 'abc';
 *   DELETE FROM tasks WHERE title = 'Dentist' AND date = '2026-11-12';
 *   USE WORKSPACE 'Uni';
 *
 * This file only turns text into plain objects ({op: 'add_task', ...}). The constraints
 * (allowed columns, value formats, ranges) are enforced afterwards by the schemas in
 * changeImport.ts, so there is one source of truth for the rules.
 */

type Token =
  | { type: 'str'; value: string }
  | { type: 'num'; value: number }
  | { type: 'word'; value: string }
  | { type: 'sym'; value: string };

export interface RawStatement {
  /** 1-based statement number in the pasted text */
  index: number;
  raw?: Record<string, unknown> | undefined;
  error?: string | undefined;
}

export interface SqlParseResult {
  workspace?: string | undefined;
  statements: RawStatement[];
}

/** Statements -> tokens, split on ';'. Throws on an unterminated string. */
function tokenize(input: string): Token[][] {
  const statements: Token[][] = [];
  let current: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input.charAt(i);
    const next = input.charAt(i + 1);

    if (/\s/.test(ch)) { i += 1; continue; }
    if (ch === '-' && next === '-') { while (i < input.length && input.charAt(i) !== '\n') i += 1; continue; }
    if (ch === '#') { while (i < input.length && input.charAt(i) !== '\n') i += 1; continue; }
    if (ch === '/' && next === '*') {
      const end = input.indexOf('*/', i + 2);
      i = end === -1 ? input.length : end + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      let value = '';
      let j = i + 1;
      let closed = false;
      while (j < input.length) {
        const c = input.charAt(j);
        if (c === '\\' && j + 1 < input.length) { value += input.charAt(j + 1); j += 2; continue; }
        if (c === ch) {
          if (input.charAt(j + 1) === ch) { value += ch; j += 2; continue; } // '' -> '
          closed = true;
          j += 1;
          break;
        }
        value += c;
        j += 1;
      }
      if (!closed) throw new Error('A text value is missing its closing quote.');
      current.push({ type: 'str', value });
      i = j;
      continue;
    }
    if (ch === ';') {
      if (current.length > 0) statements.push(current);
      current = [];
      i += 1;
      continue;
    }
    if ('(),='.includes(ch)) { current.push({ type: 'sym', value: ch }); i += 1; continue; }
    const num = /^-?\d+(\.\d+)?/.exec(input.slice(i));
    if (num && (ch !== '-' || /\d/.test(next))) {
      current.push({ type: 'num', value: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(input.slice(i));
    if (word) { current.push({ type: 'word', value: word[0] }); i += word[0].length; continue; }
    throw new Error(`Unexpected character "${ch}".`);
  }
  if (current.length > 0) statements.push(current);
  return statements;
}

class Cursor {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  get done(): boolean { return this.pos >= this.tokens.length; }

  private describe(t: Token | undefined): string {
    if (!t) return 'the end of the statement';
    return t.type === 'str' ? `'${t.value}'` : String(t.value);
  }

  /** Consume a keyword (case-insensitive). */
  keyword(word: string): void {
    const t = this.tokens[this.pos];
    if (!t || t.type !== 'word' || t.value.toUpperCase() !== word) {
      throw new Error(`Expected ${word} but found ${this.describe(t)}.`);
    }
    this.pos += 1;
  }

  peekKeyword(word: string): boolean {
    const t = this.tokens[this.pos];
    return !!t && t.type === 'word' && t.value.toUpperCase() === word;
  }

  symbol(sym: string): void {
    const t = this.tokens[this.pos];
    if (!t || t.type !== 'sym' || t.value !== sym) throw new Error(`Expected "${sym}" but found ${this.describe(t)}.`);
    this.pos += 1;
  }

  peekSymbol(sym: string): boolean {
    const t = this.tokens[this.pos];
    return !!t && t.type === 'sym' && t.value === sym;
  }

  identifier(): string {
    const t = this.tokens[this.pos];
    if (!t || t.type !== 'word') throw new Error(`Expected a name but found ${this.describe(t)}.`);
    this.pos += 1;
    return t.value.toLowerCase();
  }

  value(): string | number | boolean | null {
    const t = this.tokens[this.pos];
    if (!t) throw new Error('Expected a value but the statement ended.');
    this.pos += 1;
    if (t.type === 'str' || t.type === 'num') return t.value;
    if (t.type === 'word') {
      const w = t.value.toUpperCase();
      if (w === 'NULL') return null;
      if (w === 'TRUE') return true;
      if (w === 'FALSE') return false;
    }
    throw new Error(`Expected a value (quoted text, number, TRUE, FALSE or NULL) but found ${this.describe(t)}. Put text in 'single quotes'.`);
  }

  end(): void {
    if (!this.done) throw new Error(`Unexpected ${this.describe(this.tokens[this.pos])} at the end of the statement.`);
  }
}

type Scalar = string | number | boolean | null;

/** repeat_weekly_on accepts 'mon,wed' (or a single number) in SQL; the schema wants a list. */
function coerceColumn(column: string, value: Scalar): unknown {
  if (column === 'repeat_weekly_on' && value !== null) {
    if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
    if (typeof value === 'number') return [value];
  }
  return value;
}

/** `tasks` are shown in the task lists; `events` only on the calendar and in reminders. */
function parseTable(cur: Cursor): 'task' | 'event' {
  const table = cur.identifier();
  if (table === 'tasks' || table === 'task') return 'task';
  if (table === 'events' || table === 'event') return 'event';
  throw new Error(`Unknown table "${table}". Use tasks or events.`);
}

/** Only events carry a target; plain tasks keep the original shape. */
const withTarget = (stmt: Record<string, unknown>, target: 'task' | 'event'): Record<string, unknown> =>
  target === 'event' ? { ...stmt, target } : stmt;

function parseWhere(cur: Cursor): Record<string, unknown> {
  cur.keyword('WHERE');
  const match: Record<string, unknown> = {};
  for (;;) {
    const column = cur.identifier();
    if (column !== 'id' && column !== 'title' && column !== 'date') {
      throw new Error(`WHERE can only use id, title or date (found "${column}").`);
    }
    cur.symbol('=');
    const value = cur.value();
    if (typeof value !== 'string') throw new Error(`WHERE ${column} = ... needs quoted text.`);
    if (column in match) throw new Error(`WHERE uses "${column}" twice.`);
    match[column] = value;
    if (cur.peekKeyword('AND')) { cur.keyword('AND'); continue; }
    return match;
  }
}

function parseInsert(cur: Cursor): Record<string, unknown>[] {
  cur.keyword('INTO');
  const target = parseTable(cur);
  cur.symbol('(');
  const columns: string[] = [cur.identifier()];
  while (cur.peekSymbol(',')) { cur.symbol(','); columns.push(cur.identifier()); }
  cur.symbol(')');
  cur.keyword('VALUES');

  const rows: Record<string, unknown>[] = [];
  for (;;) {
    cur.symbol('(');
    const values: Scalar[] = [cur.value()];
    while (cur.peekSymbol(',')) { cur.symbol(','); values.push(cur.value()); }
    cur.symbol(')');
    if (values.length !== columns.length) {
      throw new Error(`${columns.length} columns but a row has ${values.length} values.`);
    }
    const row: Record<string, unknown> = withTarget({ op: 'add_task' }, target);
    columns.forEach((col, i) => {
      if (col in row) throw new Error(`Column "${col}" is listed twice.`);
      row[col] = coerceColumn(col, values[i] ?? null);
    });
    rows.push(row);
    if (cur.peekSymbol(',')) { cur.symbol(','); continue; }
    break;
  }
  cur.end();
  return rows;
}

function parseUpdate(cur: Cursor): Record<string, unknown> {
  const target = parseTable(cur);
  cur.keyword('SET');
  const set: Record<string, unknown> = {};
  for (;;) {
    const column = cur.identifier();
    cur.symbol('=');
    if (column in set) throw new Error(`SET uses "${column}" twice.`);
    set[column] = coerceColumn(column, cur.value());
    if (cur.peekSymbol(',')) { cur.symbol(','); continue; }
    break;
  }
  if (!cur.peekKeyword('WHERE')) {
    throw new Error('UPDATE needs a WHERE (id or title). Veyro never updates everything at once.');
  }
  const match = parseWhere(cur);
  cur.end();
  return withTarget({ op: 'update_task', match, set }, target);
}

function parseDelete(cur: Cursor): Record<string, unknown> {
  cur.keyword('FROM');
  const target = parseTable(cur);
  if (!cur.peekKeyword('WHERE')) {
    throw new Error('DELETE needs a WHERE (id or title). Veyro never deletes everything at once.');
  }
  const match = parseWhere(cur);
  const stmt: Record<string, unknown> = withTarget({ op: 'delete_task', match }, target);
  if (cur.peekKeyword('LIMIT')) {
    cur.keyword('LIMIT');
    cur.keyword('ALL');
    stmt['all_matches'] = true;
  }
  cur.end();
  return stmt;
}

/** True when the text looks like SQL statements rather than JSON. */
export function looksLikeSql(text: string): boolean {
  // Must have the real shape (INSERT INTO, UPDATE x SET, DELETE FROM, USE WORKSPACE) so that an
  // ordinary sentence such as "Delete the dentist task" is not mistaken for a command.
  return /^\s*(?:(?:--|#)[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*(?:insert\s+into\b|update\s+\w+\s+set\b|delete\s+from\b|use\s+workspace\b)/i.test(text);
}

export function parseSqlCommands(text: string): SqlParseResult | { fatal: string } {
  let statements: Token[][];
  try {
    statements = tokenize(text);
  } catch (err) {
    return { fatal: err instanceof Error ? err.message : 'Could not read the text.' };
  }
  if (statements.length === 0) return { fatal: 'No statements found. Start with INSERT, UPDATE or DELETE.' };

  const out: SqlParseResult = { statements: [] };
  let index = 0;

  for (const tokens of statements) {
    const cur = new Cursor(tokens);
    try {
      const first = cur.identifier().toUpperCase();
      if (first === 'USE') {
        cur.keyword('WORKSPACE');
        const name = cur.value();
        cur.end();
        if (typeof name !== 'string' || !name.trim()) throw new Error("USE WORKSPACE needs a quoted name, like USE WORKSPACE 'Uni';");
        out.workspace = name;
      } else if (first === 'INSERT') {
        for (const raw of parseInsert(cur)) out.statements.push({ index: (index += 1), raw });
      } else if (first === 'UPDATE') {
        out.statements.push({ index: (index += 1), raw: parseUpdate(cur) });
      } else if (first === 'DELETE') {
        out.statements.push({ index: (index += 1), raw: parseDelete(cur) });
      } else {
        throw new Error(`Unknown command ${first}. Use INSERT, UPDATE, DELETE or USE WORKSPACE.`);
      }
    } catch (err) {
      out.statements.push({ index: (index += 1), error: err instanceof Error ? err.message : 'Could not read this statement.' });
    }
  }
  return out;
}
