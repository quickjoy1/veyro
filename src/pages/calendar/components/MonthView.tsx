import React from 'react';
import { Clock } from 'lucide-react';
import type { CalendarHoliday } from '@/data/holidaysAndEvents';

interface MonthViewProps {
  calendarDays: Array<{
    date: Date;
    currentMonth: boolean;
    isToday?: boolean;
    isSelected?: boolean;
  }>;
  hasTasksWithDeadline: (date: Date) => boolean;
  getTasksWithDeadline: (date: Date) => any[];
  getStudiedHoursForDate: (date: Date) => string;
  handleDateClick: (date: Date) => void;
  handleDateDoubleClick: (date: Date) => void;
  handleTouchEnd: (e: React.TouchEvent, date: Date) => void;
  onDayContextMenu: (e: React.MouseEvent, date: Date) => void;
  getPrimaryHoliday?: (date: Date) => CalendarHoliday | null;
  showHolidays?: boolean;
}

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MonthView = ({
  calendarDays,
  hasTasksWithDeadline,
  getTasksWithDeadline,
  getStudiedHoursForDate,
  handleDateClick,
  handleDateDoubleClick,
  handleTouchEnd,
  onDayContextMenu,
  getPrimaryHoliday,
  showHolidays = true,
}: MonthViewProps) => {
  return (
    <div className="w-full mt-2 relative flex-1 min-h-0 overflow-y-auto px-1 sm:px-2">
      <div className="w-full mx-auto flex flex-col">
        {/* Weekday headers */}
        <div className="mb-1.5 grid w-full grid-cols-7 gap-1.5 sm:gap-2">
          {weekdays.map((day, index) => (
            <div
              key={index}
              className={`flex h-7 items-center justify-center text-center text-[11px] font-bold uppercase tracking-[0.14em] ${
                index >= 5 ? 'text-[var(--accent-primary)]/70' : 'text-[var(--text-secondary)]'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid w-full grid-cols-7 gap-1.5 sm:gap-2">
          {calendarDays.map((dayObj, index) => {
            const dayTasks =
              dayObj.currentMonth && hasTasksWithDeadline(dayObj.date)
                ? getTasksWithDeadline(dayObj.date)
                : [];
            const taskCount = dayTasks.length;

            const studiedHours = dayObj.currentMonth
              ? getStudiedHoursForDate(dayObj.date)
              : '0';
            const hasStudied = studiedHours !== '0' && studiedHours !== '0.0';

            const isWeekend = dayObj.date.getDay() === 0 || dayObj.date.getDay() === 6;
            const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
            const overdueCount = dayObj.date < startOfToday ? dayTasks.filter((t: any) => !t.completed).length : 0;
            const isToday = !!dayObj.isToday && dayObj.currentMonth;
            const isSelected = !!dayObj.isSelected;

            const holiday = (showHolidays && dayObj.currentMonth && getPrimaryHoliday)
              ? getPrimaryHoliday(dayObj.date)
              : null;

            return (
              <div
                key={index}
                role="button"
                tabIndex={dayObj.currentMonth ? 0 : -1}
                aria-label={`${dayObj.date.toLocaleDateString()}${
                  holiday ? `, Holiday: ${holiday.name}` : ''
                }${hasStudied ? `, ${studiedHours}h studied` : ''}${
                  taskCount > 0 ? `, ${taskCount} tasks` : ''
                }`}
                aria-current={dayObj.isToday ? 'date' : undefined}
                onClick={() => handleDateClick(dayObj.date)}
                onDoubleClick={() =>
                  dayObj.currentMonth && handleDateDoubleClick(dayObj.date)
                }
                onTouchEnd={(e) =>
                  dayObj.currentMonth && handleTouchEnd(e, dayObj.date)
                }
                onContextMenu={(e) =>
                  dayObj.currentMonth && onDayContextMenu(e, dayObj.date)
                }
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  handleDateClick(dayObj.date);
                }}
                className={`
                  group select-none cursor-pointer
                  flex flex-col
                  w-full min-h-[76px] sm:min-h-[108px] md:min-h-[124px] overflow-hidden rounded-xl p-1.5 sm:p-2
                  border transition-all duration-200 relative
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50
                  ${
                    isSelected
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 ring-2 ring-[var(--accent-primary)]/40 shadow-lg'
                      : isToday
                      ? 'border-[var(--accent-primary)]/70 bg-[var(--accent-primary)]/5 hover:border-[var(--accent-primary)]'
                      : dayObj.currentMonth
                      ? `border-[var(--border-primary)] ${isWeekend ? 'bg-[var(--bg-tertiary)]/60' : 'bg-[var(--bg-secondary)]'} hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-tertiary)] hover:-translate-y-0.5 shadow-sm`
                      : 'border-[var(--border-primary)]/20 bg-transparent opacity-30 shadow-none'
                  }
                `}
              >
                {/* Day Header Row: Number + Holiday Icon + Studied Time */}
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1">
                    {/* Day number */}
                    <span
                      className={`text-xs sm:text-sm font-semibold flex items-center justify-center transition-transform ${
                        isToday
                          ? 'w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[var(--accent-primary)] text-white shadow-sm'
                          : isSelected
                          ? 'text-[var(--accent-primary)] font-bold'
                          : dayObj.currentMonth
                          ? 'text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {dayObj.date.getDate()}
                    </span>

                    {/* Mobile Holiday Icon */}
                    {holiday && (
                      <span className="sm:hidden text-xs" title={holiday.name}>
                        {holiday.icon || '🎉'}
                      </span>
                    )}
                  </div>

                  {overdueCount > 0 && (
                    <span title={`${overdueCount} overdue`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{overdueCount}
                    </span>
                  )}
                  {/* Studied time badge */}
                  {dayObj.currentMonth && hasStudied && (
                    <span
                      title={`Studied: ${studiedHours} hours`}
                      className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-1.5 py-0.5 rounded"
                    >
                      <Clock size={10} className="hidden sm:inline shrink-0" />
                      <span>{studiedHours}h</span>
                    </span>
                  )}
                </div>

                {/* Holiday strip (Desktop/Tablet) */}
                {holiday && (
                  <div
                    className={`hidden sm:flex items-start gap-1 text-[10px] leading-snug font-semibold pl-1.5 pr-1 py-0.5 rounded-r-md mb-1 border-l-[3px] ${
                      holiday.isPublicHoliday
                        ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500'
                        : 'text-violet-600 dark:text-violet-300 bg-violet-500/10 border-violet-400'
                    }`}
                    title={`${holiday.isPublicHoliday ? 'Public holiday' : 'Observance'}: ${holiday.name}`}
                  >
                    <span className="shrink-0">{holiday.icon || '🎉'}</span>
                    <span className="line-clamp-2 break-words">{holiday.name}</span>
                  </div>
                )}

                {/* Task list / indicators */}
                {taskCount > 0 && (
                  <div className="flex-1 flex flex-col gap-1 w-full mt-0.5 overflow-hidden">
                    {/* Desktop / tablet chips */}
                    <div className="hidden sm:flex flex-col gap-1 w-full">
                      {dayTasks.slice(0, holiday ? 1 : 2).map((task: any) => (
                        <div
                          key={task.id}
                          className={`text-[11px] pl-1.5 pr-1 py-0.5 rounded-r-md truncate flex items-center gap-1.5 border-l-[3px] transition-colors ${
                            task.completed
                              ? 'bg-[var(--bg-primary)]/50 text-[var(--text-secondary)] line-through border-emerald-500'
                              : overdueCount > 0
                              ? 'bg-red-500/10 text-[var(--text-primary)] border-red-500'
                              : 'bg-[var(--accent-primary)]/10 text-[var(--text-primary)] border-[var(--accent-primary)]'
                          }`}
                          title={task.title}
                        >
                          <span className="truncate">{task.title || 'Untitled task'}</span>
                        </div>
                      ))}

                      {taskCount > (holiday ? 1 : 2) && (
                        <span className="text-[10px] font-medium text-[var(--text-secondary)] pl-0.5">
                          +{taskCount - (holiday ? 1 : 2)} more
                        </span>
                      )}
                    </div>

                    {/* Mobile dots indicator */}
                    <div className="sm:hidden flex items-center gap-1 mt-auto pt-1">
                      {Array.from({ length: Math.min(taskCount, 3) }).map((_, i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]"
                        />
                      ))}
                      {taskCount > 3 && (
                        <span className="text-[10px] leading-none text-[var(--text-secondary)] font-medium">
                          +{taskCount - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Subtle hint for empty days */}
                {taskCount === 0 && !holiday && dayObj.currentMonth && (
                  <div className="flex-1 flex items-end justify-center pb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-[var(--text-secondary)]/60 font-medium">
                      Double-click to add
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-3 text-[11px] text-[var(--text-secondary)]">
          {showHolidays && (
            <>
              <span className="inline-flex items-center gap-1.5"><span className="w-1 h-3 rounded-sm bg-amber-500" />Public holiday</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-1 h-3 rounded-sm bg-violet-400" />Observance</span>
            </>
          )}
          <span className="inline-flex items-center gap-1.5"><span className="w-1 h-3 rounded-sm bg-[var(--accent-primary)]" />Task</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-1 h-3 rounded-sm bg-red-500" />Overdue</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-1 h-3 rounded-sm bg-emerald-500" />Done</span>
        </div>
      </div>
    </div>
  );
};

export default MonthView;