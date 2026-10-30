import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react';
import CalendarExport from '@/components/CalendarExport';
import type { Task } from '@/types/taskStorage';
import { REGION_OPTIONS, type RegionCode } from '@/data/holidaysAndEvents';
import { useState } from 'react';

type ViewType = 'month' | 'week' | 'day';

interface CalendarHeaderProps {
  view: ViewType;
  currentDate: Date;
  selectedDate: Date;
  onViewChange: (view: ViewType) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  goToToday: () => void;
  tasks?: Task[] | undefined;
  onAddTask?: () => void;
  showHolidays?: boolean;
  onToggleHolidays?: () => void;
  holidayRegion?: RegionCode;
  onRegionChange?: (region: RegionCode) => void;
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const isCurrentWeek = (date: Date) => {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return date >= weekStart && date <= weekEnd;
};

const CalendarHeader = ({
  view,
  currentDate,
  selectedDate,
  onViewChange,
  goToPreviousMonth,
  goToNextMonth,
  goToPreviousWeek,
  goToNextWeek,
  goToPreviousDay,
  goToNextDay,
  goToToday,
  tasks,
  onAddTask,
  showHolidays = true,
  onToggleHolidays,
  holidayRegion = 'all',
  onRegionChange,
}: CalendarHeaderProps) => {
  const [showRegionMenu, setShowRegionMenu] = useState(false);

  const renderTitle = () => {
    if (view === 'day') {
      const isCurrentDay = new Date().toDateString() === selectedDate.toDateString();
      const weekdayLong = selectedDate.toLocaleDateString('en', { weekday: 'long' });
      const weekdayShort = selectedDate.toLocaleDateString('en', { weekday: 'short' });
      const dayOfMonth = selectedDate.getDate();
      const monthName = monthNames[selectedDate.getMonth()]?.slice(0, 3);

      return (
        <div className="flex items-center gap-2">
          <span className={`text-base sm:text-lg font-bold tracking-tight ${
            isCurrentDay ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
          }`}>
            <span className="sm:hidden">{`${weekdayShort}, ${monthName} ${dayOfMonth}`}</span>
            <span className="hidden sm:inline">{`${weekdayLong}, ${monthName} ${dayOfMonth}, ${selectedDate.getFullYear()}`}</span>
          </span>
          {isCurrentDay && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] uppercase tracking-wide">
              Today
            </span>
          )}
        </div>
      );
    }

    if (view === 'week') {
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);

      const oneJan = new Date(startOfWeek.getFullYear(), 0, 1);
      const numberOfDays = Math.floor((startOfWeek.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((startOfWeek.getDay() + 1 + numberOfDays) / 7);
      const isCurrentWeekVisible = isCurrentWeek(startOfWeek);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      const startMonth = monthNames[startOfWeek.getMonth()]?.slice(0, 3);
      const endMonth = monthNames[endOfWeek.getMonth()]?.slice(0, 3);

      return (
        <div className="flex items-center gap-2">
          <span className={`text-base sm:text-lg font-bold tracking-tight ${
            isCurrentWeekVisible ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
          }`}>
            Week {weekNumber}
          </span>
          <span className="text-xs text-[var(--text-secondary)] font-normal hidden sm:inline">
            ({startMonth} {startOfWeek.getDate()} – {endMonth} {endOfWeek.getDate()})
          </span>
          {isCurrentWeekVisible && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] uppercase tracking-wide">
              Current
            </span>
          )}
        </div>
      );
    }

    // Month view
    const monthIndex = currentDate.getMonth();
    const monthName = monthNames[monthIndex] || '';
    const isCurrentMonth =
      currentDate.getMonth() === new Date().getMonth() &&
      currentDate.getFullYear() === new Date().getFullYear();

    return (
      <div className="flex items-center gap-2">
        <span className={`text-xl sm:text-2xl font-bold tracking-tight ${
          isCurrentMonth ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
        }`}>
          {monthName} <span className="font-semibold text-[var(--text-secondary)]">{currentDate.getFullYear()}</span>
        </span>
        {isCurrentMonth && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] uppercase tracking-wide">
            This Month
          </span>
        )}
      </div>
    );
  };

  const handlePrev = view === 'day' ? goToPreviousDay : (view === 'week' ? goToPreviousWeek : goToPreviousMonth);
  const handleNext = view === 'day' ? goToNextDay : (view === 'week' ? goToNextWeek : goToNextMonth);

  const currentRegion = REGION_OPTIONS.find((r) => r.code === holidayRegion) || REGION_OPTIONS[0];

  return (
    <div className="flex flex-col w-full gap-3 py-3 px-3 sm:px-4 border-b border-[var(--border-primary)]/50 bg-[var(--bg-secondary)]/30 rounded-t-xl">
      {/* Row 1: title + navigation, quick actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <div className="min-w-0">{renderTitle()}</div>
          <div className="flex items-center gap-0.5 bg-[var(--bg-secondary)] p-0.5 rounded-lg border border-[var(--border-primary)]/60">
            <button onClick={handlePrev} className="p-1.5 hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-md transition-colors" aria-label="Previous" title="Previous">
              <ChevronLeft size={16} />
            </button>
            <button onClick={goToToday} className="px-2.5 py-1 text-xs font-semibold rounded-md text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent-primary)] transition-colors">
              Today
            </button>
            <button onClick={handleNext} className="p-1.5 hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-md transition-colors" aria-label="Next" title="Next">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tasks && <CalendarExport tasks={tasks} className="w-auto" />}
          {onAddTask && (
            <button type="button" onClick={onAddTask} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold whitespace-nowrap rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-90 active:scale-95 transition-all shadow-sm" title="Create Task">
              <Plus size={14} strokeWidth={2.5} />
              <span>Add Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: holidays filter + view switcher */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Holidays & Real-World Events Toggle */}
        {onToggleHolidays && (
          <div className="relative">
            <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-primary)]/80 rounded-lg p-0.5">
              <button
                type="button"
                onClick={onToggleHolidays}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  showHolidays
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Toggle Real-World Events and Holidays"
              >
                <Sparkles size={13} className={showHolidays ? 'text-amber-400' : 'text-[var(--text-secondary)]'} />
                <span>Holidays</span>
              </button>

              {showHolidays && onRegionChange && (
                <button
                  type="button"
                  onClick={() => setShowRegionMenu(!showRegionMenu)}
                  className="px-2 py-1.5 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-1"
                  title="Filter Holidays by Region"
                >
                  <span>{currentRegion?.flag}</span>
                  <span className="hidden sm:inline">{currentRegion?.code === 'all' ? 'All regions' : currentRegion?.label.split(' (')[0]}</span>
                </button>
              )}
            </div>

            {/* Region dropdown */}
            {showRegionMenu && onRegionChange && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowRegionMenu(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 w-64 max-h-[26rem] overflow-y-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-1 shadow-xl">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Holiday Region
                  </div>
                  {REGION_OPTIONS.map((reg) => (
                    <button
                      key={reg.code}
                      onClick={() => {
                        onRegionChange(reg.code);
                        setShowRegionMenu(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                        holidayRegion === reg.code
                          ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-semibold'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      <span>{reg.flag}</span>
                      <span>{reg.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Segmented View Switcher */}
        <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-primary)]/80 p-0.5 rounded-lg text-xs font-medium">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md transition-all ${
              view === 'month'
                ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-semibold shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
            }`}
            onClick={() => onViewChange('month')}
          >
            Month
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md transition-all ${
              view === 'week'
                ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-semibold shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
            }`}
            onClick={() => onViewChange('week')}
          >
            Week
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md transition-all ${
              view === 'day'
                ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-semibold shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
            }`}
            onClick={() => onViewChange('day')}
          >
            Day
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default CalendarHeader;