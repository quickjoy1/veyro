import { describe, expect, it } from "vitest";
import {
  formatDue, getReminderTier, getUpcoming, parseDeadline, planDelivery, planReminders, HOUR, DAY, OVERDUE_REPEAT_MS,
} from "./reminderEngine";

const now = new Date("2026-10-19T10:00:00").getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const task = (id: string, due: number, extra = {}) => ({ id, title: `Task ${id}`, deadline: iso(due), ...extra });

describe("getReminderTier", () => {
  it.each([
    [4 * DAY, null], [2 * DAY, "3d"], [10 * HOUR, "1d"], [2 * HOUR, "3h"], [HOUR / 2, "1h"],
    [-10 * 60_000, "due"], [-2 * HOUR, "overdue"],
  ])("%s ms away -> %s", (offset, tier) => expect(getReminderTier(now + offset, now)).toBe(tier));
});

describe("parseDeadline", () => {
  it("handles empty/invalid", () => { expect(parseDeadline(null)).toBeNull(); expect(parseDeadline("x")).toBeNull(); });
  it("date-only means end of day", () => expect(new Date(parseDeadline("2026-10-19")!).getHours()).toBe(23));
});

describe("planReminders", () => {
  it("skips done tasks and far deadlines, sorts most urgent first", () => {
    const list = planReminders(
      [task("a", now + 2 * DAY), task("b", now - 5 * HOUR), task("c", now + 30 * DAY), task("d", now - 5 * HOUR, { completed: true })],
      new Set(), now);
    expect(list.map((r) => r.taskId)).toEqual(["b", "a"]);
  });
  it("does not repeat a reminder already created", () => {
    const first = planReminders([task("a", now + 2 * HOUR)], new Set(), now);
    expect(planReminders([task("a", now + 2 * HOUR)], new Set(first.map((r) => r.key)), now + 60_000)).toHaveLength(0);
  });
  it("moves on to the next step as the deadline gets closer", () => {
    const t = task("a", now + 2 * HOUR);
    const keys = new Set(planReminders([t], new Set(), now).map((r) => r.key));
    const later = planReminders([t], keys, now + 90 * 60_000);
    expect(later.map((r) => r.tier)).toEqual(["1h"]);
  });
  it("repeats overdue in a new time slot", () => {
    const t = task("a", now - 3 * HOUR);
    const keys = new Set(planReminders([t], new Set(), now).map((r) => r.key));
    expect(planReminders([t], keys, now + OVERDUE_REPEAT_MS)).toHaveLength(1);
  });
  it("re-arms when the deadline changes", () => {
    const keys = new Set(planReminders([task("a", now + 2 * HOUR)], new Set(), now).map((r) => r.key));
    expect(planReminders([task("a", now + 2.5 * HOUR)], keys, now)).toHaveLength(1);
  });
});

describe("planDelivery", () => {
  const mk = (n: number) => planReminders(Array.from({ length: n }, (_, i) => task(`t${i}`, now - 5 * HOUR - i)), new Set(), now);
  it("shows a few individually", () => expect(planDelivery(mk(3)).individual).toHaveLength(3));
  it("folds a pile-up into one summary", () => {
    const d = planDelivery(mk(8));
    expect(d.individual).toHaveLength(0);
    expect(d.digest?.message).toContain("8 tasks need attention: 8 overdue");
  });
  it("does nothing when empty", () => expect(planDelivery([])).toEqual({ individual: [], digest: null }));
});

describe("labels and upcoming", () => {
  it("formats times", () => {
    expect(formatDue(now + 2 * HOUR, now)).toBe("in 2h");
    expect(formatDue(now - 3 * DAY, now)).toBe("3d overdue");
    expect(formatDue(now + 5 * 60_000, now)).toBe("in 5m");
  });
  it("lists overdue and next-7-days tasks soonest first", () => {
    const u = getUpcoming([task("x", now + 3 * DAY), task("y", now - DAY), task("z", now + 20 * DAY)], now);
    expect(u.map((i) => i.id)).toEqual(["y", "x"]);
  });
});
