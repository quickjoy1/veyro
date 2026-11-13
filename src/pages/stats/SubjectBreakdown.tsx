import { BookOpen } from 'lucide-react';
import { memo, useMemo, useState } from 'react';

import { useLaps } from '@/store/appStore';
import { NO_SUBJECT, subjectTotals, type SubjectRow } from '@/utils/analytics';
import { formatFocus } from '@/utils/dailyGoal';

const RANGES = [
  { id: '7', label: '7 days', days: 7 },
  { id: '30', label: '30 days', days: 30 },
  { id: 'all', label: 'All time', days: null },
] as const;

const FALLBACK = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
const MAX_ROWS = 6;

/** Where your study time goes, by subject. */
const SubjectBreakdown = () => {
  const { laps } = useLaps();
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('30');

  const rows = useMemo<SubjectRow[]>(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? null;
    const all = subjectTotals(laps ?? [], new Date(), days);
    if (all.length <= MAX_ROWS) return all;
    const top = all.slice(0, MAX_ROWS - 1);
    const rest = all.slice(MAX_ROWS - 1);
    return [
      ...top,
      {
        name: `${rest.length} more`,
        color: null,
        seconds: rest.reduce((a, r) => a + r.seconds, 0),
        sessions: rest.reduce((a, r) => a + r.sessions, 0),
        share: rest.reduce((a, r) => a + r.share, 0),
      },
    ];
  }, [laps, range]);

  const max = rows[0]?.seconds || 1;
  const onlyUnassigned = rows.length === 1 && rows[0]?.name === NO_SUBJECT;

  return (
    <section className="flex h-full flex-col rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 sm:p-5" data-testid="subject-breakdown" aria-label="Time by subject">
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-2">
        <BookOpen size={16} className="text-[var(--accent-primary)]" />
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Time by subject</h2>
        <div role="tablist" aria-label="Range" className="ml-auto flex gap-0.5 rounded-lg bg-[var(--bg-secondary)] p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={range === r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                range === r.id ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No study time in this range yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row, i) => (
            <li key={row.name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium text-[var(--text-primary)]">{row.name}</span>
                <span className="whitespace-nowrap text-xs text-[var(--text-secondary)] tabular-nums">
                  {formatFocus(row.seconds)} · {row.share}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.max(3, (row.seconds / max) * 100)}%`,
                    background: row.name === NO_SUBJECT ? 'var(--text-secondary)' : (row.color ?? FALLBACK[i % FALLBACK.length]),
                    opacity: row.name === NO_SUBJECT ? 0.45 : 1,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {onlyUnassigned && (
        <p className="mt-3 text-xs text-[var(--text-secondary)]">Choose a subject when you start a session to see it split up here.</p>
      )}
    </section>
  );
};

export default memo(SubjectBreakdown);
