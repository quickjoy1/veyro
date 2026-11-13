import { CheckCircle2, Flame, Table2 } from 'lucide-react';
import { ReactElement, useEffect, useState } from 'react';
import { useLaps, useRegularTasks } from '@/store/appStore';

import { formatFocus } from '@/utils/dailyGoal';
import { supabase } from '@/utils/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import useDemoMode from '@/utils/useDemoMode';
import type { Lap } from '@/types/lap';
import type { Task } from '@/schemas/task';

interface StatData {
  todayMinutes: number;
  yesterdayMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
  yearMinutes: number;
  lastYearMinutes: number;
  sessionsToday: number;
  sessionsYesterday: number;
  sessionsWeek: number;
  sessionsMonth: number;
  sessionsYear: number;
  sessionsLastYear: number;
  longestStreak: number;
  pomodoros: number;
}

function durationToMinutes(duration: string | undefined): number {
  if (!duration || typeof duration !== 'string') return 0;
  const parts = duration.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0] || '0', 10);
    const m = parseInt(parts[1] || '0', 10);
    const s = parts[2] ? parseInt(parts[2], 10) : 0;
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m) + Math.round((isNaN(s) ? 0 : s) / 60);
  }
  const single = parseInt(parts[0] || '0', 10);
  return isNaN(single) ? 0 : single;
}

function useLapStats(laps: Lap[]) {
  // Obtener fechas en la zona horaria local
  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowLocal = new Date(todayLocal);
  tomorrowLocal.setDate(todayLocal.getDate() + 1);
  const yesterdayLocal = new Date(todayLocal);
  yesterdayLocal.setDate(todayLocal.getDate() - 1);

  // Calcular inicio de la semana (lunes)
  const weekStart = new Date(todayLocal);
  weekStart.setDate(todayLocal.getDate() - todayLocal.getDay() + (todayLocal.getDay() === 0 ? -6 : 1));

  // Obtener año y mes actual
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const stats = {
    todayMinutes: 0,
    yesterdayMinutes: 0,
    weekMinutes: 0,
    monthMinutes: 0,
    yearMinutes: 0,
    lastYearMinutes: 0,
    sessionsToday: 0,
    sessionsYesterday: 0,
    sessionsWeek: 0,
    sessionsMonth: 0,
    sessionsYear: 0,
    sessionsLastYear: 0,
  };

  laps.forEach(lap => {
    if (!lap.created_at) return;

    // Usar created_at como fecha principal
    const lapDate = new Date(lap.created_at);

    // Obtener la duración del campo duration (ya en formato HH:MM:SS)
    const minutes = durationToMinutes(lap.duration);
    const lapYear = lapDate.getFullYear();
    const lapMonth = lapDate.getMonth();

    // Verificar si la sesión es de hoy
    if (lapDate >= todayLocal && lapDate < tomorrowLocal) {
      stats.todayMinutes += minutes;
      stats.sessionsToday += 1;
    }

    // Verificar si la sesión es de ayer
    if (lapDate >= yesterdayLocal && lapDate < todayLocal) {
      stats.yesterdayMinutes += minutes;
      stats.sessionsYesterday += 1;
    }

    // Verificar si la sesión es de esta semana
    if (lapDate >= weekStart) {
      stats.weekMinutes += minutes;
      stats.sessionsWeek += 1;
    }

    // Verificar si la sesión es de este mes
    if (lapYear === currentYear && lapMonth === currentMonth) {
      stats.monthMinutes += minutes;
      stats.sessionsMonth += 1;
    }

    // Verificar si la sesión es de este año
    if (lapYear === currentYear) {
      stats.yearMinutes += minutes;
      stats.sessionsYear += 1;
    }

    // Verificar si la sesión es del año pasado
    if (lapYear === currentYear - 1) {
      stats.lastYearMinutes += minutes;
      stats.sessionsLastYear += 1;
    }
  });

  return stats;
}

function hasCompletedAt(task: Task): task is Task & { completed_at: string } {
  return typeof task.completed_at === 'string' && task.completed_at.length > 0;
}

function getLongestStreak(tasks: Task[]): number {
  const uniqueDays = Array.from(
    new Set(
      tasks
        .filter((t): t is Task & { completed_at: string } => t.completed && hasCompletedAt(t))
        .map(t => new Date(t.completed_at).setHours(0, 0, 0, 0))
    )
  ).sort((a, b) => a - b);

  if (uniqueDays.length === 0) return 0;
  let streak = 1, maxStreak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const current = uniqueDays[i];
    const previous = uniqueDays[i - 1];
    const diff = (current ?? 0) - (previous ?? 0);
    // 23 to 25 hours accommodates DST transitions
    if (diff >= 23 * 3600 * 1000 && diff <= 25 * 3600 * 1000) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 1;
    }
  }
  return maxStreak;
}

function usePomodorosAllTime(userId: string | undefined, laps: Lap[]): number {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!userId) {
      setTotal(0);
      return;
    }
    const fetchAllTime = async (): Promise<void> => {
      try {
        const { data, error } = await supabase
          .from('study_laps')
          .select('pomodoros_completed')
          .eq('user_id', userId);
        if (!error && data && data.length > 0) {
          const sum = data.reduce((acc: number, row: { pomodoros_completed?: number }) => acc + (row.pomodoros_completed || 0), 0);
          setTotal(sum);
          return;
        }
      } catch {
        // Fall back to local store laps below
      }
      const localSum = laps.reduce((acc, lap) => acc + (lap.pomodoros_completed || 0), 0);
      setTotal(localSum);
    };
    fetchAllTime();
  }, [userId, laps]);

  return total;
}

const timePeriods: { key: keyof Pick<StatData, 'todayMinutes' | 'yesterdayMinutes' | 'weekMinutes' | 'monthMinutes' | 'yearMinutes' | 'lastYearMinutes'>; label: string }[] = [
  { key: 'todayMinutes', label: 'Today' },
  { key: 'yesterdayMinutes', label: 'Yesterday' },
  { key: 'weekMinutes', label: 'This Week' },
  { key: 'monthMinutes', label: 'This Month' },
  { key: 'yearMinutes', label: 'This Year' },
  { key: 'lastYearMinutes', label: 'Last Year' },
];

const sessionPeriods: { key: keyof Pick<StatData, 'sessionsToday' | 'sessionsYesterday' | 'sessionsWeek' | 'sessionsMonth' | 'sessionsYear' | 'sessionsLastYear'>; label: string }[] = [
  { key: 'sessionsToday', label: 'Today' },
  { key: 'sessionsYesterday', label: 'Yesterday' },
  { key: 'sessionsWeek', label: 'This Week' },
  { key: 'sessionsMonth', label: 'This Month' },
  { key: 'sessionsYear', label: 'This Year' },
  { key: 'sessionsLastYear', label: 'Last Year' },
];

const Statistics = (): ReactElement => {
  const tasks = useRegularTasks();
  const { laps } = useLaps();
  const { user } = useAuth();
  const { isDemo, demoStats } = useDemoMode();
  const lapStats = useLapStats(laps);
  const longestStreak = getLongestStreak(tasks);

  // Pomodoros completados all time (de la base de datos o laps locales)
  const pomodorosAllTime = usePomodorosAllTime(user?.id, laps);

  const statData: StatData = {
    ...lapStats,
    longestStreak,
    pomodoros: pomodorosAllTime,
  };

  const statsData = isDemo ? demoStats : statData;

  return (
    <section
      className="stats-banner rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 sm:p-5"
      data-testid="all-numbers"
      aria-label="All study numbers"
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Table2 size={16} className="text-[var(--accent-primary)]" />
        <h2 className="text-base font-semibold text-[var(--text-primary)]">All numbers</h2>
        <span className="text-xs text-[var(--text-secondary)]">time and sessions by period</span>
      </div>

      <dl className="divide-y divide-[var(--border-primary)] border-y border-[var(--border-primary)] sm:hidden">
        {timePeriods.map(({ key, label }, i) => {
          const sessionKey = sessionPeriods[i]?.key;
          return (
            <div key={key} className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="text-xs font-medium text-[var(--text-secondary)]">{label}</dt>
              <dd className="text-sm text-[var(--text-secondary)] tabular-nums">
                <b className="font-semibold text-[var(--text-primary)]">{formatFocus(statsData[key] * 60)}</b>
                {sessionKey ? ` · ${statsData[sessionKey]} ${statsData[sessionKey] === 1 ? 'session' : 'sessions'}` : ''}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--text-secondary)]">
              <th className="w-24 pb-2 font-medium" scope="col"><span className="sr-only">Measure</span></th>
              {timePeriods.map(({ key, label }) => (
                <th key={key} className="pb-2 text-right font-medium" scope="col">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-primary)] border-t border-[var(--border-primary)]">
            <tr>
              <th className="py-2.5 text-left text-xs font-medium text-[var(--text-secondary)]" scope="row">Study time</th>
              {timePeriods.map(({ key }) => (
                <td key={key} className="py-2.5 text-right font-semibold tabular-nums text-[var(--text-primary)]">
                  {formatFocus(statsData[key] * 60)}
                </td>
              ))}
            </tr>
            <tr>
              <th className="py-2.5 text-left text-xs font-medium text-[var(--text-secondary)]" scope="row">Sessions</th>
              {sessionPeriods.map(({ key }) => (
                <td key={key} className="py-2.5 text-right font-semibold tabular-nums text-[var(--text-primary)]">{statsData[key]}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 size={14} className="text-red-500" />
          Pomodoros <b className="text-[var(--text-primary)] tabular-nums">{statsData.pomodoros ?? 0}</b>
        </span>
        <span className="inline-flex items-center gap-1.5" title="Most days in a row on which you completed at least one task">
          <Flame size={14} className="text-orange-500" />
          Task streak <b className="text-[var(--text-primary)] tabular-nums">{statsData.longestStreak} {statsData.longestStreak === 1 ? 'day' : 'days'}</b>
        </span>
      </div>
    </section>
  );
};


export default Statistics; 