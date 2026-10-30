/**
 * Minimal in-browser stand-in for the Supabase client, used when no Supabase keys are configured.
 * Data is stored in localStorage, and a built-in local user is always signed in, so the whole app
 * (tasks, workspaces, sessions, backup/restore) works offline with no account.
 * It implements only the query-builder features this app uses.
 */

const DB_KEY = "veyro_local_db";

export const LOCAL_USER = {
  id: "local-user",
  email: "local@veyro.local",
  user_metadata: { full_name: "Local User" },
  app_metadata: {},
  aud: "authenticated",
  created_at: new Date(0).toISOString(),
};

type Row = Record<string, any>;
type Db = Record<string, Row[]>;

const uuid = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

let cache: Db | null = null;

const load = (): Db => {
  if (cache) return cache;
  let db: Db = {};
  try {
    db = JSON.parse(localStorage.getItem(DB_KEY) || "{}") || {};
  } catch {
    db = {};
  }
  if (!db["profiles"]) {
    const now = new Date().toISOString();
    db["profiles"] = [{ id: LOCAL_USER.id, email: LOCAL_USER.email, username: "Local User", created_at: now }];
    db["workspaces"] = db["workspaces"] ?? [
      { id: uuid(), name: "My Workspace", description: "", icon: "Briefcase", user_id: LOCAL_USER.id, is_default: true, created_at: now },
    ];
  }
  cache = db;
  // Persist the defaults right away so the default workspace keeps the same id on the next page load
  if (!localStorage.getItem(DB_KEY)) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* storage blocked */ }
  }
  return db;
};

const save = () => {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error("[local db] could not save (storage full or blocked)", e);
  }
};

const table = (name: string): Row[] => {
  const db = load();
  if (!db[name]) db[name] = [];
  return db[name]!;
};

// ---------- filters ----------
type Pred = (row: Row) => boolean;

const same = (a: any, b: any) => a === b || (a != null && b != null && String(a) === String(b));
const cmp = (a: any, b: any) => (a == null || b == null ? NaN : a < b ? -1 : a > b ? 1 : 0);

const likeToRegex = (pattern: string, flags: string) =>
  new RegExp("^" + pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", flags);

const coerce = (v: string): any => (v === "null" ? null : v === "true" ? true : v === "false" ? false : v);

const makePred = (col: string, op: string, val: any): Pred => {
  switch (op) {
    case "eq": return (r) => same(r[col], val);
    case "neq": return (r) => !same(r[col], val);
    case "gt": return (r) => cmp(r[col], val) > 0;
    case "gte": return (r) => cmp(r[col], val) >= 0;
    case "lt": return (r) => cmp(r[col], val) < 0;
    case "lte": return (r) => cmp(r[col], val) <= 0;
    case "is": return (r) => (val === null ? r[col] == null : same(r[col], val));
    case "in": {
      const list: any[] = Array.isArray(val)
        ? val
        : String(val).replace(/^\(|\)$/g, "").split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
      return (r) => list.some((x) => same(r[col], x));
    }
    case "like": return (r) => typeof r[col] === "string" && likeToRegex(String(val), "").test(r[col]);
    case "ilike": return (r) => typeof r[col] === "string" && likeToRegex(String(val), "i").test(r[col]);
    case "cs":
    case "contains":
      return (r) => {
        const cell = r[col];
        const need: any[] = Array.isArray(val) ? val : typeof val === "string" ? val.replace(/^[{[]|[}\]]$/g, "").split(",") : [val];
        if (Array.isArray(cell)) return need.every((n) => cell.some((c) => same(c, n)));
        if (cell && typeof cell === "object" && val && typeof val === "object") {
          return Object.entries(val).every(([k, v]) => same(cell[k], v));
        }
        return false;
      };
    default:
      return () => true;
  }
};

/** Split "a.eq.1,b.in.(x,y)" on top-level commas only. */
const splitTopLevel = (s: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
};

const orPred = (expr: string): Pred => {
  const preds = splitTopLevel(expr).map((part) => {
    const [col = "", op = "eq", ...rest] = part.split(".");
    const raw = rest.join(".");
    return makePred(col, op, op === "in" ? raw : coerce(raw));
  });
  return (r) => preds.some((p) => p(r));
};

// ---------- query builder ----------
type Op = "select" | "insert" | "update" | "delete" | "upsert";

class Query implements PromiseLike<any> {
  private op: Op = "select";
  private payload: any = null;
  private preds: Pred[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private max: number | null = null;
  private from = 0;
  private mode: "many" | "single" | "maybe" = "many";
  private returning = false;
  private cols = "*";
  private countOnly = false;
  private wantCount = false;
  private conflict = ["id"];

  constructor(private name: string) {}

  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") this.cols = cols;
    this.returning = true;
    if (opts?.count) this.wantCount = true;
    if (opts?.head) this.countOnly = true;
    return this;
  }
  insert(rows: Row | Row[]) { this.op = "insert"; this.payload = rows; return this; }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = rows;
    if (opts?.onConflict) this.conflict = opts.onConflict.split(",").map((s) => s.trim());
    return this;
  }
  update(values: Row) { this.op = "update"; this.payload = values; return this; }
  delete() { this.op = "delete"; return this; }

  private add(col: string, op: string, val: any) { this.preds.push(makePred(col, op, val)); return this; }
  eq(c: string, v: any) { return this.add(c, "eq", v); }
  neq(c: string, v: any) { return this.add(c, "neq", v); }
  gt(c: string, v: any) { return this.add(c, "gt", v); }
  gte(c: string, v: any) { return this.add(c, "gte", v); }
  lt(c: string, v: any) { return this.add(c, "lt", v); }
  lte(c: string, v: any) { return this.add(c, "lte", v); }
  is(c: string, v: any) { return this.add(c, "is", v); }
  in(c: string, v: any[]) { return this.add(c, "in", v); }
  like(c: string, v: string) { return this.add(c, "like", v); }
  ilike(c: string, v: string) { return this.add(c, "ilike", v); }
  contains(c: string, v: any) { return this.add(c, "contains", v); }
  filter(c: string, op: string, v: any) { return this.add(c, op, v); }
  match(obj: Row) { Object.entries(obj).forEach(([k, v]) => this.add(k, "eq", v)); return this; }
  not(c: string, op: string, v: any) { const p = makePred(c, op, v); this.preds.push((r) => !p(r)); return this; }
  or(expr: string) { this.preds.push(orPred(expr)); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this.max = n; return this; }
  range(a: number, b: number) { this.from = a; this.max = b - a + 1; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  throwOnError() { return this; }
  returns() { return this; }

  private project(rows: Row[]): Row[] {
    if (this.cols === "*" || this.cols.includes("(") || this.cols.includes("*")) return rows.map((r) => ({ ...r }));
    const keep = this.cols.split(",").map((s) => s.trim()).filter(Boolean);
    return rows.map((r) => Object.fromEntries(keep.map((k) => [k, r[k]])));
  }

  private run(): { data: any; error: any; count?: number | null } {
    const rows = table(this.name);
    const matches = (r: Row) => this.preds.every((p) => p(r));
    let out: Row[] = [];
    const now = new Date().toISOString();

    if (this.op === "insert" || this.op === "upsert") {
      const list: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const item of list) {
        const row: Row = { ...item };
        if (this.op === "upsert") {
          const hit = rows.find((r) => this.conflict.every((k) => row[k] != null && same(r[k], row[k])));
          if (hit) { Object.assign(hit, row); out.push(hit); continue; }
        }
        if (row["id"] == null) row["id"] = uuid();
        if (row["created_at"] == null) row["created_at"] = now;
        rows.push(row);
        out.push(row);
      }
      save();
    } else if (this.op === "update") {
      out = rows.filter(matches);
      out.forEach((r) => Object.assign(r, this.payload));
      save();
    } else if (this.op === "delete") {
      out = rows.filter(matches);
      cache![this.name] = rows.filter((r) => !matches(r));
      save();
    } else {
      out = rows.filter(matches);
    }

    const total = out.length;
    if (this.orders.length) {
      out = [...out].sort((a, b) => {
        for (const { col, asc } of this.orders) {
          const c = cmp(a[col], b[col]);
          if (c) return asc ? c : -c;
        }
        return 0;
      });
    }
    if (this.max != null || this.from) out = out.slice(this.from, this.max != null ? this.from + this.max : undefined);

    const wantsRows = this.op === "select" || this.returning;
    const count = this.wantCount ? total : null;
    if (this.countOnly) return { data: null, error: null, count };
    if (!wantsRows) return { data: null, error: null, count };

    const data = this.project(out);
    if (this.mode === "single") {
      return data.length === 1
        ? { data: data[0], error: null, count }
        : { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }, count };
    }
    if (this.mode === "maybe") return { data: data[0] ?? null, error: null, count };
    return { data, error: null, count };
  }

  then<R1 = any, R2 = never>(
    onfulfilled?: ((v: any) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((e: any) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onfulfilled, onrejected);
  }
}

// ---------- client ----------
const session = { access_token: "local", refresh_token: "local", user: LOCAL_USER };

const channelStub = () => {
  const ch: any = {
    on: () => ch,
    subscribe: (cb?: (status: string) => void) => { cb?.("SUBSCRIBED"); return ch; },
    unsubscribe: async () => "ok",
  };
  return ch;
};

export const createLocalSupabase = () => ({
  from: (name: string) => new Query(name),
  rpc: async () => ({ data: null, error: null }),
  channel: channelStub,
  removeChannel: async () => "ok",
  getChannels: () => [],
  auth: {
    getUser: async () => ({ data: { user: LOCAL_USER }, error: null }),
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: (cb: (event: string, s: typeof session) => void) => {
      setTimeout(() => cb("INITIAL_SESSION", session), 0);
      return { data: { subscription: { unsubscribe() {} } } };
    },
    signInWithOAuth: async () => ({ data: {}, error: null }),
    signOut: async () => ({ error: null }),
  },
  storage: {
    from: (bucket: string = "avatars") => ({
      upload: async (path: string, file: Blob | File) => {
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          try {
            localStorage.setItem(`veyro_storage_${bucket}_${path}`, dataUrl);
          } catch {
            // Storage quota warning fallback
          }
          return { data: { path }, error: null };
        } catch (e: any) {
          return { data: null, error: { message: e.message || "Failed to process image" } };
        }
      },
      getPublicUrl: (path: string) => {
        const publicUrl = localStorage.getItem(`veyro_storage_${bucket}_${path}`) || "";
        return { data: { publicUrl } };
      },
      remove: async (paths: string[]) => {
        paths.forEach((p) => {
          try {
            localStorage.removeItem(`veyro_storage_${bucket}_${p}`);
          } catch {}
        });
        return { data: [], error: null };
      },
    }),
  },
  functions: { invoke: async () => ({ data: null, error: { message: "Not available in local mode" } }) },
});
