import { BookOpen } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTasksOnly } from "@/store/appStore";
import { fetchLaps } from "@/store/LapActions";
import { useTaskStudyTime } from "@/hooks/useTaskStudyTime";
import { formatStudied } from "@/utils/taskStudyTime";

/** Activity: how long you studied each task (today, last 7 days, all time). */
const TaskStudyTimeCard = () => {
  const tasks = useTasksOnly();
  const { totals, refresh } = useTaskStudyTime();

  useEffect(() => {
    void fetchLaps().catch(() => {});
    void refresh();
  }, [refresh]);

  const rows = useMemo(() => {
    const names = new Map(tasks.map((t) => [t.id, t.title]));
    return [...totals.values()]
      .map((t) => ({ ...t, title: names.get(t.taskId) ?? "Deleted task" }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [totals, tasks]);

  const max = rows[0]?.totalSeconds || 1;
  const sum = (key: "todaySeconds" | "weekSeconds" | "totalSeconds") => rows.reduce((a, r) => a + r[key], 0);

  return (
    <div className="w-full rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4" data-testid="task-study-time">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <BookOpen size={18} className="text-[var(--accent-primary)]" />
        <h2 className="font-semibold text-[var(--text-primary)] text-base sm:text-lg">Study time by task</h2>
        <div className="ml-auto flex gap-4 text-sm text-[var(--text-secondary)]">
          <span>Today <b className="text-[var(--text-primary)]">{formatStudied(sum("todaySeconds"))}</b></span>
          <span>7 days <b className="text-[var(--text-primary)]">{formatStudied(sum("weekSeconds"))}</b></span>
          <span>All <b className="text-[var(--text-primary)]">{formatStudied(sum("totalSeconds"))}</b></span>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">Nothing yet. On the Session page, pick a task in "Start Session" and your time shows up here.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.taskId}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-[var(--text-primary)] truncate">{r.title}</span>
                <span className="text-[var(--text-secondary)] whitespace-nowrap">
                  {formatStudied(r.totalSeconds)} · {r.sessions} session{r.sessions === 1 ? "" : "s"}
                  {r.todaySeconds > 0 ? ` · today ${formatStudied(r.todaySeconds)}` : ""}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden mt-1">
                <div className="h-full rounded-full bg-[var(--accent-primary)]" style={{ width: `${Math.max(3, (r.totalSeconds / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskStudyTimeCard;
