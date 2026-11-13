import { Calendar, Clock, Flame, Minus, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { memo, useMemo } from 'react';

import { useLaps } from '@/store/appStore';
import { bestStreak, lastWeekSameSpan, trendPercent, weekToDate } from '@/utils/analytics';
import { currentStreak, dayKey, formatFocus, readStoredGoalMinutes, secondsByDay } from '@/utils/dailyGoal';

interface CardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  children?: React.ReactNode;
  testId: string;
}

const Card = ({ icon, label, value, children, testId }: CardProps) => (
  <div data-testid={testId} className="flex min-w-0 flex-col gap-1 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
      {icon}
      {label}
    </div>
    <div className="truncate font-heading text-2xl font-bold leading-tight text-[var(--text-primary)] tabular-nums">{value}</div>
    <div className="min-h-[1.25rem] text-xs text-[var(--text-secondary)]">{children}</div>
  </div>
);

/** Four headline numbers: today against the goal, this week against last week, the streak, and the month. */
const AnalyticsOverview = () => {
  const { laps } = useLaps();

  const data = useMemo(() => {
    const now = new Date();
    const byDay = secondsByDay(laps ?? []);
    const today = byDay.get(dayKey(now)) ?? 0;
    const week = weekToDate(byDay, now);
    const previousWeek = lastWeekSameSpan(byDay, now);

    let month = 0;
    let activeDays = 0;
    for (let d = 1; d <= now.getDate(); d++) {
      const seconds = byDay.get(dayKey(new Date(now.getFullYear(), now.getMonth(), d))) ?? 0;
      month += seconds;
      if (seconds > 0) activeDays++;
    }

    return {
      today,
      week,
      trend: trendPercent(week, previousWeek),
      hadLastWeek: previousWeek > 0,
      streak: currentStreak(byDay, now),
      best: bestStreak(byDay),
      month,
      activeDays,
      goalSeconds: readStoredGoalMinutes() * 60,
    };
  }, [laps]);

  const goalPercent = Math.min(100, Math.round((data.today / data.goalSeconds) * 100));

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card testId="overview-today" icon={<Target size={14} className="text-[var(--accent-primary)]" />} label="Today" value={formatFocus(data.today)}>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${goalPercent >= 100 ? 'bg-[var(--notion-green)]' : 'bg-[var(--accent-primary)]'}`}
              style={{ width: `${goalPercent}%` }}
            />
          </div>
          <span className="whitespace-nowrap tabular-nums">{goalPercent}% of {formatFocus(data.goalSeconds)}</span>
        </div>
      </Card>

      <Card testId="overview-week" icon={<Clock size={14} className="text-[var(--accent-primary)]" />} label="This week" value={formatFocus(data.week)}>
        {data.trend === null ? (
          <span>{data.hadLastWeek ? '' : 'No data for last week yet'}</span>
        ) : data.trend === 0 ? (
          <span className="inline-flex items-center gap-1"><Minus size={12} /> Same as last week</span>
        ) : data.trend > 0 ? (
          <span className="inline-flex items-center gap-1 font-medium text-[var(--notion-green)]"><TrendingUp size={13} /> {data.trend}% vs last week</span>
        ) : (
          <span className="inline-flex items-center gap-1 font-medium text-[var(--notion-red)]"><TrendingDown size={13} /> {Math.abs(data.trend)}% vs last week</span>
        )}
      </Card>

      <Card
        testId="overview-streak"
        icon={<Flame size={14} className="text-orange-500" />}
        label="Streak"
        value={`${data.streak} ${data.streak === 1 ? 'day' : 'days'}`}
      >
        Best {data.best} {data.best === 1 ? 'day' : 'days'} · 10+ min a day
      </Card>

      <Card testId="overview-month" icon={<Calendar size={14} className="text-[var(--accent-primary)]" />} label="This month" value={formatFocus(data.month)}>
        {data.activeDays > 0
          ? `${data.activeDays} active ${data.activeDays === 1 ? 'day' : 'days'} · avg ${formatFocus(data.month / data.activeDays)}`
          : 'No sessions yet this month'}
      </Card>
    </div>
  );
};

export default memo(AnalyticsOverview);
