import { describe, expect, it } from "vitest";
import { computeTaskStudyTime, formatStudied, parseHms } from "./taskStudyTime";

const now = new Date("2026-10-19T15:00:00").getTime();
const at = (d: string) => new Date(d).toISOString();

describe("taskStudyTime", () => {
  it("parses and formats", () => {
    expect(parseHms("01:15:30")).toBe(4530);
    expect(parseHms("bad")).toBe(0);
    expect(formatStudied(4500)).toBe("1h 15m");
    expect(formatStudied(300)).toBe("5m");
    expect(formatStudied(20)).toBe("<1m");
    expect(formatStudied(0)).toBe("0m");
  });

  it("adds up sessions per task, split into today / week / all time", () => {
    const laps = [
      { id: "a", duration: "01:00:00", started_at: at("2026-10-19T09:00:00") },
      { id: "b", duration: "00:30:00", started_at: at("2026-10-17T09:00:00") },
      { id: "c", duration: "02:00:00", started_at: at("2026-09-01T09:00:00") },
      { id: "d", duration: "00:45:00", started_at: at("2026-10-19T10:00:00") },
    ];
    const links = [
      { session_id: "a", task_id: "t1" }, { session_id: "b", task_id: "t1" },
      { session_id: "c", task_id: "t1" }, { session_id: "d", task_id: "t2" },
    ];
    const r = computeTaskStudyTime(laps, links, now);
    expect(r.get("t1")).toMatchObject({ totalSeconds: 3600 + 1800 + 7200, todaySeconds: 3600, weekSeconds: 5400, sessions: 3 });
    expect(r.get("t2")?.totalSeconds).toBe(2700);
  });

  it("also counts laps that carry task_id, and ignores unlinked sessions", () => {
    const r = computeTaskStudyTime(
      [{ id: "x", duration: "00:10:00", task_id: "t9", started_at: at("2026-10-19T09:00:00") }, { id: "y", duration: "01:00:00" }],
      [], now);
    expect(r.get("t9")?.totalSeconds).toBe(600);
    expect(r.size).toBe(1);
  });
});
