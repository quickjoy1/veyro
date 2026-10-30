import "./mobile-calendar.css";
import { handleDateDoubleClick, handleTouchEnd } from "./utils/calendarUtils";
import CalendarHeader from "./components/CalendarHeader";
import DayContextMenu from "./components/DayContextMenu";
import DayInfoModal from "./DayInfoModal";
import DayView from "./components/DayView";
import LoginPromptModal from "@/modals/LoginPromptModal";
import MonthView from "./components/MonthView";
import type { Task } from "@/types/taskStorage";
import TaskForm from "@/pages/tasks/TaskForm";
import TaskViewModal from "@/modals/TaskViewModal";
import WeekView from "./components/WeekView";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useCalendarData } from "./hooks/useCalendarData";
import { useCalendarKeyboard } from "./hooks/useCalendarKeyboard";
import { useCalendarNavigation } from "./hooks/useCalendarNavigation";
import { useCalendarState } from "./hooks/useCalendarState";
import { useDeleteTaskSuccess } from "@/store/appStore";
import { TaskService } from "@/services/TaskService";
import { toggleTaskStatus } from "@/store/TaskActions";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Landmark,
  Plus,
} from "lucide-react";
import {
  fetchLiveWorldEvents,
  type RealWorldEvent,
  type RegionCode,
} from "@/data/holidaysAndEvents";

interface CalendarProps {
  view?: 'month' | 'week' | 'day';
  onViewChange?: (view: 'month' | 'week' | 'day') => void;
  tasks?: Task[]; // Optional filtered tasks
}

type ViewType = 'month' | 'week' | 'day';

const Calendar = ({
  view = 'month' as ViewType,
  onViewChange,
  tasks: filteredTasks
}: CalendarProps) => {
  const { isLoggedIn } = useAuth();

  // Holidays & Real-World Events state
  const [showHolidays, setShowHolidays] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('calendarShowHolidays');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [holidayRegion, setHolidayRegion] = useState<RegionCode>(() => {
    try {
      return (localStorage.getItem('calendarHolidayRegion') as RegionCode) || 'all';
    } catch {
      return 'all';
    }
  });

  const [worldEvents, setWorldEvents] = useState<RealWorldEvent[]>([]);
  const [loadingWorldEvents, setLoadingWorldEvents] = useState(false);
  const [showWorldEventsPanel, setShowWorldEventsPanel] = useState(true);

  const handleToggleHolidays = () => {
    setShowHolidays(prev => {
      const next = !prev;
      try { localStorage.setItem('calendarShowHolidays', String(next)); } catch {}
      return next;
    });
  };

  const handleRegionChange = (newRegion: RegionCode) => {
    setHolidayRegion(newRegion);
    try { localStorage.setItem('calendarHolidayRegion', newRegion); } catch {}
    window.dispatchEvent(new CustomEvent('calendar-region-change', { detail: newRegion }));
  };

  // State management
  const {
    currentDate,
    setCurrentDate,
    selectedDate,
    setSelectedDate,
    focusedDate,
    setFocusedDate,
    showTaskForm,
    setShowTaskForm,
    isLoginPromptOpen,
    setIsLoginPromptOpen,
    lastTap,
    setLastTap,
    selectedTask,
    setSelectedTask,
    viewingTask,
    setViewingTask
  } = useCalendarState();

  // Data management
  const {
    getTasksForDayAndHour,
    getTasksWithDeadline,
    getStudiedHoursForDate,
    hasTasksWithDeadline,
    calendarDays,
    getDayHolidays,
    getDayPrimaryHoliday,
    getDayWorldEvents,
  } = useCalendarData({
    currentDate,
    selectedDate,
    region: holidayRegion,
    ...(filteredTasks && {
      tasks: filteredTasks
    })
  });

  // Fetch real-world events when selected date changes
  useEffect(() => {
    let isCancelled = false;
    setLoadingWorldEvents(true);

    fetchLiveWorldEvents(selectedDate)
      .then((events) => {
        if (!isCancelled) {
          setWorldEvents(events);
          setLoadingWorldEvents(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setWorldEvents(getDayWorldEvents(selectedDate));
          setLoadingWorldEvents(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedDate, getDayWorldEvents]);

  // Navigation functions
  const {
    goToPreviousMonth,
    goToNextMonth,
    goToPreviousWeek,
    goToNextWeek,
    goToPreviousDay,
    goToNextDay,
    goToToday,
    handleDateClick
  } = useCalendarNavigation({
    currentDate,
    setCurrentDate,
    selectedDate,
    setSelectedDate,
    focusedDate,
    setFocusedDate
  });

  // Keyboard navigation
  useCalendarKeyboard({
    focusedDate,
    currentDate,
    setFocusedDate,
    setSelectedDate,
    setCurrentDate,
    handleDateDoubleClick: date => handleDateDoubleClick(date, isLoggedIn, setSelectedDate, setIsLoginPromptOpen, setShowTaskForm)
  });

  const handleEditTask = (task: Task) => {
    setViewingTask(null);
    setSelectedTask(task);
    setShowTaskForm(true);
  };

  const handleHeaderAddTask = () => {
    if (!isLoggedIn) {
      setIsLoginPromptOpen(true);
      return;
    }
    setSelectedTask(null);
    setShowTaskForm(true);
  };

  // Right-click context menu on days / time slots
  const [dayContextMenu, setDayContextMenu] = useState<{
    x: number;
    y: number;
    date: Date;
    hour?: number;
  } | null>(null);

  const openDayContextMenu = (e: React.MouseEvent, date: Date, hour?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDayContextMenu({ x: e.clientX, y: e.clientY, date: new Date(date), hour });
  };

  const handleCreateEvent = () => {
    if (!dayContextMenu) return;
    const { date, hour } = dayContextMenu;
    setDayContextMenu(null);
    setSelectedTask(null);
    if (hour === undefined) {
      handleDateDoubleClick(new Date(date), isLoggedIn, setSelectedDate, setIsLoginPromptOpen, setShowTaskForm);
      return;
    }
    if (!isLoggedIn) return setIsLoginPromptOpen(true);
    const newDate = new Date(date);
    newDate.setHours(hour, 0, 0, 0);
    setSelectedDate(newDate);
    setFocusedDate(newDate);
    sessionStorage.setItem('calendarTaskHour', hour.toString());
    setShowTaskForm(true);
  };

  const isPastMenuDay = (() => {
    if (!dayContextMenu || dayContextMenu.hour !== undefined) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const menuDay = new Date(dayContextMenu.date);
    menuDay.setHours(0, 0, 0, 0);
    return menuDay < today;
  })();

  // Day Info modal state
  const [viewingDayInfo, setViewingDayInfo] = useState<Date | null>(null);

  const deleteTaskSuccess = useDeleteTaskSuccess();
  const handleDeleteTask = async (task: Task) => {
    deleteTaskSuccess(task.id);
    setViewingTask(null);
    try {
      await TaskService.deleteTask(task.id);
      window.dispatchEvent(new CustomEvent("refreshTaskList"));
      window.dispatchEvent(new CustomEvent("refreshCalendar"));
    } catch (err) {
      console.error("Failed to delete task from storage:", err);
    }
  };

  const handleToggleTask = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    try {
      await toggleTaskStatus(task.id, !task.completed);
    } catch (err) {
      console.error("Failed to toggle task completion:", err);
    }
  };

  const selectedDayTasks = getTasksWithDeadline(selectedDate);
  const selectedDayStudiedHours = getStudiedHoursForDate(selectedDate);
  const hasSelectedStudied = selectedDayStudiedHours !== '0' && selectedDayStudiedHours !== '0.0';
  const completedCount = selectedDayTasks.filter((t) => t.completed).length;

  const selectedDayHolidays = showHolidays ? getDayHolidays(selectedDate) : [];

  return (
    <div className="w-full h-full flex flex-col">
      <div className={`p-0 relative w-full transition-all duration-300 calendar-view flex flex-col h-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-sm ${view === 'month' ? '' : 'flex-1'}`}>
        {/* Calendar Header with navigation, segmented switcher, holidays toggle, and quick actions */}
        <CalendarHeader
          view={view}
          currentDate={currentDate}
          selectedDate={selectedDate}
          onViewChange={onViewChange || (() => {})}
          goToPreviousMonth={goToPreviousMonth}
          goToNextMonth={goToNextMonth}
          goToPreviousWeek={goToPreviousWeek}
          goToNextWeek={goToNextWeek}
          goToPreviousDay={goToPreviousDay}
          goToNextDay={goToNextDay}
          goToToday={goToToday}
          tasks={filteredTasks || []}
          onAddTask={handleHeaderAddTask}
          showHolidays={showHolidays}
          onToggleHolidays={handleToggleHolidays}
          holidayRegion={holidayRegion}
          onRegionChange={handleRegionChange}
        />

        {/* View Content */}
        <div className={`flex-1 relative p-2 sm:p-3 ${view === 'month' ? '' : 'min-h-[600px]'}`}>
          {view === 'week' ? (
            <WeekView
              currentDate={currentDate}
              isLoggedIn={isLoggedIn}
              getTasksWithDeadline={getTasksWithDeadline}
              setSelectedDate={setSelectedDate}
              setFocusedDate={setFocusedDate}
              setShowTaskForm={setShowTaskForm}
              setIsLoginPromptOpen={setIsLoginPromptOpen}
              setSelectedTask={setSelectedTask}
              setViewingTask={setViewingTask}
              handleEditTask={handleEditTask}
              onDayContextMenu={openDayContextMenu}
              onTaskContextMenu={(e, task) => {
                e.preventDefault();
                setViewingTask(task);
              }}
            />
          ) : view === 'day' ? (
            <DayView
              selectedDate={selectedDate}
              isLoggedIn={isLoggedIn}
              getTasksForDayAndHour={getTasksForDayAndHour}
              setSelectedDate={setSelectedDate}
              setShowTaskForm={setShowTaskForm}
              setIsLoginPromptOpen={setIsLoginPromptOpen}
              onDayContextMenu={openDayContextMenu}
              setViewingTask={setViewingTask}
              setSelectedTask={setSelectedTask}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <MonthView
                calendarDays={calendarDays}
                hasTasksWithDeadline={hasTasksWithDeadline}
                getTasksWithDeadline={getTasksWithDeadline}
                getStudiedHoursForDate={getStudiedHoursForDate}
                handleDateClick={handleDateClick}
                handleDateDoubleClick={date => handleDateDoubleClick(date, isLoggedIn, setSelectedDate, setIsLoginPromptOpen, setShowTaskForm)}
                handleTouchEnd={(e, date) => handleTouchEnd(e, date, lastTap, setLastTap, date => handleDateDoubleClick(date, isLoggedIn, setSelectedDate, setIsLoginPromptOpen, setShowTaskForm))}
                onDayContextMenu={openDayContextMenu}
                getPrimaryHoliday={getDayPrimaryHoliday}
                showHolidays={showHolidays}
              />

              {/* Selected Day Agenda & Real-World Events Bar */}
              <div className="mt-2 border-t border-[var(--border-primary)]/60 pt-3 px-1 sm:px-2">
                {/* Header row */}
                <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CalendarIcon size={16} className="text-[var(--accent-primary)]" />
                    <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                      {selectedDate.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                    </h3>
                    <span className="text-xs text-[var(--text-secondary)] font-medium">
                      ({completedCount}/{selectedDayTasks.length} tasks done)
                    </span>
                    {hasSelectedStudied && (
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-2 py-0.5 rounded-full font-medium">
                        <Clock size={11} />
                        <span>{selectedDayStudiedHours}h focus</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (!isLoggedIn) return setIsLoginPromptOpen(true);
                        setSelectedTask(null);
                        setShowTaskForm(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition-colors"
                    >
                      <Plus size={14} />
                      <span>Add Task for Day</span>
                    </button>
                  </div>
                </div>

                {/* Holiday Banner for Selected Date */}
                {selectedDayHolidays.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {selectedDayHolidays.map((hol) => (
                      <div
                        key={hol.id}
                        className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200"
                      >
                        <span className="text-base shrink-0">{hol.icon || '🎉'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-amber-300 truncate">
                              {hol.name}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                              {hol.isPublicHoliday ? 'Public Holiday' : 'Observance'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tasks for the Selected Day */}
                {selectedDayTasks.length === 0 ? (
                  <div className="py-3 px-4 text-center rounded-lg border border-dashed border-[var(--border-primary)]/70 bg-[var(--bg-primary)]/40 mb-3">
                    <p className="text-xs text-[var(--text-secondary)]">
                      No personal tasks scheduled for this day
                    </p>
                    <button
                      onClick={() => {
                        if (!isLoggedIn) return setIsLoginPromptOpen(true);
                        setSelectedTask(null);
                        setShowTaskForm(true);
                      }}
                      className="mt-1 text-xs text-[var(--accent-primary)] hover:underline font-semibold"
                    >
                      + Schedule task
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                    {selectedDayTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => setViewingTask(task)}
                        className={`group cursor-pointer flex items-center gap-2.5 p-2 rounded-lg border transition-all ${
                          task.completed
                            ? 'bg-[var(--bg-primary)]/50 border-[var(--border-primary)]/40 opacity-70'
                            : 'bg-[var(--bg-primary)] border-[var(--border-primary)] hover:border-[var(--accent-primary)]/60 hover:bg-[var(--bg-tertiary)]/60'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => handleToggleTask(e, task)}
                          className="shrink-0 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-0.5"
                          title={task.completed ? "Mark incomplete" : "Mark complete"}
                        >
                          {task.completed ? (
                            <CheckCircle2 size={16} className="text-emerald-500" />
                          ) : (
                            <Circle size={16} />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs sm:text-sm font-medium truncate ${
                              task.completed
                                ? 'line-through text-[var(--text-secondary)]'
                                : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.assignment && (
                            <p className="text-[11px] text-[var(--text-secondary)] truncate">
                              {task.assignment}
                            </p>
                          )}
                        </div>

                        {task.difficulty && (
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            task.difficulty.toLowerCase() === 'hard'
                              ? 'text-red-400 bg-red-500/10'
                              : task.difficulty.toLowerCase() === 'medium'
                              ? 'text-blue-400 bg-blue-500/10'
                              : 'text-emerald-400 bg-emerald-500/10'
                          }`}>
                            {task.difficulty}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Real-World Events: Today in History & World Events */}
                {showHolidays && (
                  <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowWorldEventsPanel(!showWorldEventsPanel)}
                      className="w-full flex items-center justify-between p-2.5 hover:bg-[var(--bg-tertiary)]/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Landmark size={15} className="text-[var(--accent-primary)]" />
                        <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
                          Real-World Events & History on this Day
                        </span>
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          ({selectedDate.toLocaleDateString('en', { month: 'short', day: 'numeric' })})
                        </span>
                      </div>
                      <div className="text-[var(--text-secondary)]">
                        {showWorldEventsPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>

                    {showWorldEventsPanel && (
                      <div className="p-3 pt-0 border-t border-[var(--border-primary)]/40 space-y-2 mt-1">
                        {loadingWorldEvents ? (
                          <p className="text-xs text-[var(--text-secondary)] py-2">
                            Loading world events...
                          </p>
                        ) : worldEvents.length === 0 ? (
                          <p className="text-xs text-[var(--text-secondary)] py-2">
                            No notable historical events recorded for this exact day.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {worldEvents.map((ev, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)]/50 p-2 rounded-lg border border-[var(--border-primary)]/40"
                              >
                                {ev.year && (
                                  <span className="font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                                    {ev.year}
                                  </span>
                                )}
                                <span className="text-[var(--text-primary)] leading-relaxed">
                                  {ev.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        {showTaskForm && (
          <TaskForm
            initialTask={selectedTask}
            initialAssignment=""
            initialDeadline={selectedDate}
            onClose={() => {
              setShowTaskForm(false);
              setSelectedTask(null);
            }}
            onTaskCreated={(newTaskId: string) => {
              if (newTaskId) {
                window.dispatchEvent(new CustomEvent("refreshTaskList"));
                window.dispatchEvent(new CustomEvent("refreshCalendar"));
              }
              setShowTaskForm(false);
              setSelectedTask(null);
            }}
          />
        )}

        <LoginPromptModal isOpen={isLoginPromptOpen} onClose={() => setIsLoginPromptOpen(false)} />

        {/* Day context menu (right-click) */}
        {dayContextMenu && (
          <DayContextMenu
            x={dayContextMenu.x}
            y={dayContextMenu.y}
            date={dayContextMenu.date}
            hour={dayContextMenu.hour}
            disabled={isPastMenuDay}
            onClose={() => setDayContextMenu(null)}
            onCreateEvent={handleCreateEvent}
            onViewDayInfo={() => setViewingDayInfo(dayContextMenu.date)}
          />
        )}

        {/* Day Info / Study Details Modal */}
        {viewingDayInfo && (
          <DayInfoModal
            isOpen={!!viewingDayInfo}
            onClose={() => setViewingDayInfo(null)}
            date={viewingDayInfo}
            tasks={getTasksWithDeadline(viewingDayInfo)}
            studiedHours={getStudiedHoursForDate(viewingDayInfo)}
            holidays={getDayHolidays(viewingDayInfo)}
            worldEvents={getDayWorldEvents(viewingDayInfo)}
          />
        )}

        {/* Task View Modal */}
        {viewingTask && (
          <TaskViewModal
            isOpen={!!viewingTask}
            onClose={() => setViewingTask(null)}
            task={{
              ...viewingTask,
              deadline: viewingTask.deadline ?? undefined,
              due_date: viewingTask.due_date ?? undefined,
            }}
            onEdit={handleEditTask}
            onDelete={handleDeleteTask}
          />
        )}
      </div>
    </div>
  );
};

export default Calendar;