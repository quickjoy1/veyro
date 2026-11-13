import { CalendarDays } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { useLaps } from '@/store/appStore';
import { heatmapGrid, intensity } from '@/utils/analytics';
import { dayKey, formatFocus, readStoredGoalMinutes, secondsByDay } from '@/utils/dailyGoal';

const GAP = 3;
/** How much of the accent colour each level gets (level 0 is the plain surface). */
const MIX = [0, 28, 50, 75, 100] as const;
const WEEKDAY_LABELS: Record<number, string> = { 0: 'Mon', 2: 'Wed', 4: 'Fri' };

const levelColor = (level: number): string =>
  level === 0 ? 'var(--bg-secondary)' : `color-mix(in srgb, var(--accent-primary) ${MIX[level]}%, var(--bg-secondary))`;

interface Size {
  weeks: number;
  cell: number;
}

/** A full year where there is room for it, six months on smaller screens. */
const sizeFor = (width: number): Size => (width >= 1280 ? { weeks: 52, cell: 16 } : width >= 1024 ? { weeks: 52, cell: 14 } : { weeks: 26, cell: 14 });

const useHeatmapSize = (): Size => {
  const [size, setSize] = useState<Size>(() => sizeFor(window.innerWidth));
  useEffect(() => {
    const onResize = () => setSize((prev) => {
      const next = sizeFor(window.innerWidth);
      return next.weeks === prev.weeks && next.cell === prev.cell ? prev : next;
    });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
};

/** Study days as a grid, darker the closer a day got to the daily goal. */
const StudyHeatmap = () => {
  const { laps } = useLaps();
  const scroller = useRef<HTMLDivElement>(null);
  const { weeks: WEEKS, cell: CELL } = useHeatmapSize();
  const STEP = CELL + GAP;

  const { grid, goalSeconds, todayKey } = useMemo(() => {
    const now = new Date();
    return {
      grid: heatmapGrid(secondsByDay(laps ?? []), now, WEEKS),
      goalSeconds: readStoredGoalMinutes() * 60,
      todayKey: dayKey(now),
    };
  }, [laps, WEEKS]);

  // On narrow screens the newest weeks matter most, so start scrolled to the right.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [grid]);

  return (
    <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 sm:p-5" data-testid="study-heatmap" aria-label="Study activity">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <CalendarDays size={16} className="text-[var(--accent-primary)]" />
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Activity</h2>
        <span className="text-xs text-[var(--text-secondary)]">
          {grid.activeDays} active {grid.activeDays === 1 ? 'day' : 'days'} · {formatFocus(grid.totalSeconds)} {WEEKS === 52 ? 'in the last year' : `in ${WEEKS} weeks`}
        </span>
      </div>

      <div ref={scroller} className="overflow-x-auto px-0.5 pb-1">
        <div
          className="mx-auto w-fit"
          role="img"
          aria-label={`Study activity over the last ${WEEKS} weeks: ${grid.activeDays} active days`}
        >
          <div className="flex" style={{ gap: GAP }}>
            {/* weekday labels */}
            <div className="flex shrink-0 flex-col pr-1 pt-[18px] text-[10px] leading-none text-[var(--text-secondary)]" style={{ gap: GAP }} aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="flex items-center" style={{ height: CELL }}>{WEEKDAY_LABELS[i] ?? ''}</div>
              ))}
            </div>

            <div>
              {/* month labels */}
              <div className="relative h-[15px] text-[10px] leading-none text-[var(--text-secondary)]" style={{ width: grid.weeks.length * STEP - GAP }} aria-hidden="true">
                {grid.monthLabels.map((m) => (
                  <span key={`${m.week}-${m.label}`} className="absolute top-0" style={{ left: m.week * STEP }}>{m.label}</span>
                ))}
              </div>
              <div className="mt-[3px] flex" style={{ gap: GAP }}>
                {grid.weeks.map((week) => (
                  <div key={week[0]?.key} className="flex flex-col" style={{ gap: GAP }}>
                    {week.map((cell) => {
                      if (cell.future) return <div key={cell.key} style={{ width: CELL, height: CELL }} aria-hidden="true" />;
                      const level = intensity(cell.seconds, goalSeconds);
                      const label = cell.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
                      return (
                        <div
                          key={cell.key}
                          data-level={level}
                          title={`${label}: ${cell.seconds > 0 ? formatFocus(cell.seconds) : 'no study'}`}
                          className="rounded-[3px]"
                          style={{
                            width: CELL,
                            height: CELL,
                            background: levelColor(level),
                            boxShadow: cell.key === todayKey ? '0 0 0 1.5px var(--text-secondary)' : 'inset 0 0 0 1px color-mix(in srgb, var(--border-primary) 60%, transparent)',
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
        <span>Darker means closer to your {formatFocus(goalSeconds)} daily goal</span>
        <span className="ml-auto flex items-center gap-1" aria-hidden="true">
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="inline-block rounded-[3px]" style={{ width: 12, height: 12, background: levelColor(l), boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--border-primary) 60%, transparent)' }} />
          ))}
          More
        </span>
      </div>
    </section>
  );
};

export default memo(StudyHeatmap);
