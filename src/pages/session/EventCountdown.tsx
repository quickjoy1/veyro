import { CalendarClock } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';

import { useAppStore, useWorkspace } from '@/store/appStore';
import { clockFromTimestamp, localYmd } from '@/utils/changeImport';
import { isEventTask } from '@/utils/eventTasks';
import { formatTimeRange } from '@/utils/formatTimeRange';

const MAX_SHOWN = 4;
const DAY_MS = 86_400_000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

interface Upcoming {
  id: string;
  title: string;
  date: string;
  days: number;
  time: string;
}

/** Whole calendar days from today to a local YYYY-MM-DD date. */
const daysUntil = (ymd: string, now: Date): number => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.round((new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getTime() - startOfDay(now)) / DAY_MS);
};

const tone = (days: number) => {
  if (days <= 0) return { ring: 'border-red-500/60', num: 'text-red-500', chip: 'bg-red-500/15 text-red-500' };
  if (days <= 7) return { ring: 'border-amber-500/60', num: 'text-amber-500', chip: 'bg-amber-500/15 text-amber-500' };
  return { ring: 'border-[var(--border-primary)]', num: 'text-[var(--accent-primary)]', chip: 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]' };
};

const label = (days: number) => (days === 0 ? 'Today' : `${days}`);

/**
 * "Days left" cards for upcoming events (board exams, tests, deadlines added as events).
 * Hidden when there is nothing coming up.
 */
const EventCountdown = () => {
  const allTasks = useAppStore((state) => state.tasks.tasks);
  const { currentWorkspace } = useWorkspace();

  // Re-evaluate "today" at midnight so the numbers do not go stale on a tab left open overnight.
  const [day, setDay] = useState(() => startOfDay(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setDay((prev) => (startOfDay(new Date()) !== prev ? startOfDay(new Date()) : prev)), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const upcoming = useMemo<Upcoming[]>(() => {
    const now = new Date(day);
    return allTasks
      .filter((t) => isEventTask(t) && !t.completed && t.recurrence_type !== 'weekly')
      .filter((t) => !currentWorkspace || currentWorkspace.id === 'all' || t.workspace_id === currentWorkspace.id)
      .map((t) => {
        const date = localYmd(t.deadline);
        if (!date) return null;
        const start = clockFromTimestamp(t.start_at, false);
        const end = clockFromTimestamp(t.end_at, false);
        return { id: String(t.id), title: t.title, date, days: daysUntil(date, now), time: formatTimeRange(start, end) };
      })
      .filter((e): e is Upcoming => e !== null && e.days >= 0)
      .sort((a, b) => a.days - b.days || a.time.localeCompare(b.time))
      .slice(0, MAX_SHOWN);
  }, [allTasks, currentWorkspace, day]);

  if (upcoming.length === 0) return null;

  return (
    <section aria-label="Upcoming events countdown" data-testid="event-countdown" className="rounded-xl border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock size={18} className="text-[var(--accent-primary)]" />
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Countdown</h3>
        <span className="text-xs text-[var(--text-secondary)]">your next events</span>
      </div>
      <ul className="stagger-children grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" role="list">
        {upcoming.map((event) => {
          const t = tone(event.days);
          const isWord = event.days === 0;
          return (
            <li key={event.id} className={`flex items-center gap-3 rounded-lg border-2 bg-[var(--bg-primary)] p-3 ${t.ring}`}>
              <div className="flex w-12 shrink-0 flex-col items-center leading-none">
                <span className={`font-heading font-bold ${t.num} ${isWord ? 'text-base' : 'text-3xl'}`}>{label(event.days)}</span>
                {!isWord && <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{event.days === 1 ? 'day left' : 'days left'}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[var(--text-primary)]" title={event.title}>
                  {event.title}
                </div>
                <div className="truncate text-xs text-[var(--text-secondary)]">
                  {new Date(`${event.date}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    ...(event.date.slice(0, 4) !== String(new Date().getFullYear()) ? { year: 'numeric' as const } : {}),
                  })}
                  {event.time ? ` · ${event.time}` : ''}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default memo(EventCountdown);
