import { Check, Flame, Minus, Plus } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';

import { useLaps } from '@/store/appStore';
import { fetchLaps } from '@/store/LapActions';
import {
  clampGoalMinutes,
  currentStreak,
  dayKey,
  formatFocus,
  GOAL_STEP_MINUTES,
  GOAL_STORAGE_KEY,
  MIN_STREAK_SECONDS,
  readStoredGoalMinutes,
  secondsByDay,
} from '@/utils/dailyGoal';

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** One slim row under the timers: today's logged focus time against a goal, plus the study streak. */
const DailyGoal = () => {
  const { laps } = useLaps();
  const [goalMinutes, setGoalMinutes] = useState(readStoredGoalMinutes);
  const [now, setNow] = useState(() => new Date());

  // Sessions are only loaded once Analytics has been opened, so make sure they are here.
  useEffect(() => {
    void fetchLaps().catch(() => {});
  }, []);

  // New day, new ring.
  useEffect(() => {
    const id = window.setInterval(() => setNow((prev) => (dayKey(prev) === dayKey(new Date()) ? prev : new Date())), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const byDay = useMemo(() => secondsByDay(laps ?? []), [laps]);
  const todaySeconds = byDay.get(dayKey(now)) ?? 0;
  const streak = useMemo(() => currentStreak(byDay, now), [byDay, now]);

  const goalSeconds = goalMinutes * 60;
  const progress = Math.min(1, todaySeconds / goalSeconds);
  const percent = Math.round(progress * 100);
  const done = todaySeconds >= goalSeconds;

  const changeGoal = (delta: number) => {
    const next = clampGoalMinutes(goalMinutes + delta);
    setGoalMinutes(next);
    try {
      localStorage.setItem(GOAL_STORAGE_KEY, String(next));
    } catch {
      /* storage blocked: the goal just resets on reload */
    }
  };

  const stepBtn = 'flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <section
      aria-label="Daily focus goal"
      data-testid="daily-goal"
      className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 py-3 sm:px-5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative h-11 w-11 shrink-0" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Today's focus goal">
          <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
            <circle cx="22" cy="22" r={RADIUS} fill="none" strokeWidth="4" className="stroke-[var(--border-primary)]" />
            <circle
              cx="22"
              cy="22"
              r={RADIUS}
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
              className={`transition-[stroke-dashoffset] duration-700 ease-out ${done ? 'stroke-[var(--notion-green)]' : 'stroke-[var(--accent-primary)]'}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[var(--text-primary)]">
            {done ? <Check size={16} className="text-[var(--notion-green)]" /> : `${percent}%`}
          </div>
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate">
            <span className="text-base font-semibold text-[var(--text-primary)]">{formatFocus(todaySeconds)}</span>
            <span className="text-sm text-[var(--text-secondary)]"> of {formatFocus(goalSeconds)} today</span>
          </div>
          <div className="truncate text-xs text-[var(--text-secondary)]">
            {done ? 'Goal reached. Nice work.' : `${formatFocus(goalSeconds - todaySeconds)} to go`}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-1.5 text-sm font-medium ${streak > 0 ? 'text-orange-500' : 'text-[var(--text-secondary)]'}`}
          title={`Days in a row with at least ${MIN_STREAK_SECONDS / 60} minutes of focus`}
        >
          <Flame size={16} className={streak > 0 ? 'fill-orange-500/20' : ''} />
          {streak > 0 ? `${streak} day streak` : 'No streak yet'}
        </div>
        <div className="flex items-center rounded-lg border border-[var(--border-primary)] p-0.5" role="group" aria-label="Daily goal">
          <button type="button" className={stepBtn} onClick={() => changeGoal(-GOAL_STEP_MINUTES)} aria-label="Lower daily goal" disabled={goalMinutes <= 15}>
            <Minus size={14} />
          </button>
          <span className="min-w-[3.25rem] text-center text-xs font-medium tabular-nums text-[var(--text-secondary)]">Goal {formatFocus(goalSeconds)}</span>
          <button type="button" className={stepBtn} onClick={() => changeGoal(GOAL_STEP_MINUTES)} aria-label="Raise daily goal" disabled={goalMinutes >= 720}>
            <Plus size={14} />
          </button>
        </div>
      </div>
    </section>
  );
};

export default memo(DailyGoal);
