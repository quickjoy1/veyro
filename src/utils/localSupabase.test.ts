import { beforeEach, describe, expect, it } from "vitest";

const fresh = async () => {
  localStorage.clear();
  const { vi } = await import("vitest");
  vi.resetModules();
  const mod = await import("./localSupabase");
  return mod.createLocalSupabase() as any;
};

describe("local supabase stand-in", () => {
  let db: any;
  beforeEach(async () => { db = await fresh(); });

  it("signs in a local user", async () => {
    const { data } = await db.auth.getSession();
    expect(data.session.user.id).toBe("local-user");
  });

  it("inserts, reads, updates status and deletes tasks", async () => {
    const ins = await db.from("tasks").insert([{ title: "A", user_id: "local-user", status: "todo" }]).select().single();
    expect(ins.error).toBeNull();
    const id = ins.data.id;
    await db.from("tasks").update({ status: "in_progress" }).eq("id", id);
    const got = await db.from("tasks").select("*").eq("user_id", "local-user");
    expect(got.data[0].status).toBe("in_progress");
    await db.from("tasks").delete().eq("id", id);
    expect((await db.from("tasks").select("*")).data).toHaveLength(0);
  });

  it("upsert keeps ids (restore) and does not duplicate", async () => {
    const rows = [{ id: "t1", title: "One" }, { id: "t2", title: "Two" }];
    await db.from("tasks").upsert(rows, { onConflict: "id" });
    await db.from("tasks").upsert(rows, { onConflict: "id" });
    expect((await db.from("tasks").select("*")).data).toHaveLength(2);
  });

  it("persists across reloads and supports or/in filters", async () => {
    await db.from("tasks").insert([{ id: "a", user_id: "x" }, { id: "b", user_id: "y" }, { id: "c", user_id: "z" }]);
    const r = await db.from("tasks").select("id").or("user_id.eq.x,user_id.eq.z");
    expect(r.data.map((t: any) => t.id)).toEqual(["a", "c"]);
    const i = await db.from("tasks").select("id").in("id", ["b"]);
    expect(i.data).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem("veyro_local_db")!).tasks).toHaveLength(3);
  });

  it("starts with a default workspace", async () => {
    const w = await db.from("workspaces").select("*").eq("user_id", "local-user");
    expect(w.data.length).toBe(1);
  });
});
