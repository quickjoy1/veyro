import { Sun } from 'lucide-react';
import { memo, useMemo } from 'react';

import { useLaps } from '@/store/appStore';
import { bestWindow, formatHour, formatWindow, secondsByHour } from '@/utils/analytics';
import { formatFocus } from '@/utils/dailyGoal';

const RANGE_DAYS = 90;
const MIN_SECONDS = 30 * 60;
const TICKS = [0, 6, 12, 18];

/** Which hours of the day you actually study, and the three-hour stretch that works best. */
const FocusHours = () => {
  const { laps } = useLaps();

  const { hours, window, total, sessions } = useMemo(() => {
    const since = Date.now() - RANGE_DAYS * 86_400_000;
    const recent = (laps ?? []).filter((l) => new Date(l.created_at).getTime() >= since);
    const byHour = secondsByHour(recent);
    const sum = byHour.reduce((a, b) => a + b, 0);
    return { hours: byHour, window: bestWindow(byHour, 3), total: sum, sessions: recent.length };
  }, [laps]);

  const max = Math.max(...hours, 1);
  const inWindow = (h: number) => (window ? (h - window.start + 24) % 24 < window.width : false);
  const enough = total >= MIN_SECONDS && window !== null;

  return (
    <section className="flex h-full flex-col rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 sm:p-5" data-testid="focus-hours" aria-label="Best focus hours">
      <div className="mb-3 flex items-center gap-2">
        <Sun size={16} className="text-[var(--accent-primary)]" />
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Best focus hours</h2>
        <span className="text-xs text-[var(--text-secondary)]">last {RANGE_DAYS} days</span>
      </div>

      {enough && window ? (
        <p className="mb-3 text-sm text-[var(--text-secondary)]" data-testid="focus-hours-insight">
          You study most between <b className="text-[var(--text-primary)]">{formatWindow(window.start, window.width)}</b>
          {' '}({window.share}% of your time, {formatFocus(window.seconds)}). {sessions} {sessions === 1 ? 'session' : 'sessions'} counted.
        </p>
      ) : (
        <p className="mb-3 text-sm text-[var(--text-secondary)]">Study for a little while and your best hours show up here.</p>
      )}

      <div className="flex min-h-0 flex-1 flex-col justify-end">
        <div className="flex min-h-24 flex-1 items-end gap-[3px]" role="img" aria-label="Study time for each hour of the day">
          {hours.map((seconds, h) => (
            <div key={h} className="flex h-full flex-1 items-end" title={`${formatHour(h)}: ${seconds > 0 ? formatFocus(seconds) : 'no study'}`}>
              <div
                className={`w-full rounded-t-[3px] transition-[height] duration-500 ${enough && inWindow(h) ? 'bg-[var(--accent-primary)]' : 'bg-accent-faint'}`}
                style={{ height: seconds > 0 ? `${Math.max(6, (seconds / max) * 100)}%` : '2px', opacity: seconds > 0 ? 1 : 0.35 }}
              />
            </div>
          ))}
        </div>
        <div className="relative mt-1 h-4 text-[10px] text-[var(--text-secondary)]" aria-hidden="true">
          {TICKS.map((h) => (
            <span key={h} className="absolute -translate-x-1/2 first:translate-x-0" style={{ left: `${(h / 24) * 100}%` }}>{formatHour(h)}</span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default memo(FocusHours);
