import { CalendarClock, ChevronRight, Loader2, Plus, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTasksOnly, useTasksLoading, useWorkspace } from '@/store/appStore';
import { ALL_WORKSPACE_ID } from '@/hooks/useTaskBoard';
import { useAuth } from '@/hooks/useAuth';
import TaskForm from '@/pages/tasks/TaskForm';
import TaskViewModal from '@/modals/TaskViewModal';
import { getUpcomingHolidays, type RegionCode } from '@/data/holidaysAndEvents';

const UpcomingTasks = ({ limit = 8 }: { limit?: number }) => {
  const tasks = useTasksOnly();
  const tasksLoading = useTasksLoading();
  const { currentWorkspace: activeWorkspace } = useWorkspace();
  const { isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState<'tasks' | 'holidays'>('tasks');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [viewingTask, setViewingTask] = useState<any>(null);

  const { upcomingTasks, totalCount } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const filtered = (activeWorkspace && activeWorkspace.id !== ALL_WORKSPACE_ID
      ? tasks.filter(t => t.workspace_id === activeWorkspace.id && !t.completed)
      : tasks.filter(t => !t.completed)
    ).filter(t => {
      if (!t.deadline) return true;
      const deadline = new Date(t.deadline);
      deadline.setHours(0, 0, 0, 0);
      return deadline >= now;
    }).sort((a, b) => {
      const aDate = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bDate = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return aDate - bDate;
    });

    return { upcomingTasks: filtered.slice(0, limit), totalCount: filtered.length };
  }, [tasks, activeWorkspace, limit]);

  const [region, setRegion] = useState<RegionCode>(() => {
    try { return (localStorage.getItem('calendarHolidayRegion') as RegionCode) || 'all'; } catch { return 'all'; }
  });
  useEffect(() => {
    const onChange = (e: Event) => setRegion((e as CustomEvent<RegionCode>).detail);
    window.addEventListener('calendar-region-change', onChange);
    return () => window.removeEventListener('calendar-region-change', onChange);
  }, []);
  const upcomingHolidays = useMemo(() => {
    return getUpcomingHolidays(new Date(), 8, region);
  }, [region]);

  const handleTaskClick = (task: any) => {
    setViewingTask(task);
  };

  const handleAddTask = () => {
    if (!isLoggedIn) return;
    setShowTaskForm(true);
  };

  const formatDate = (deadline: string) => {
    const date = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  };

  const formatHolidayDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <div
        className="w-full dashboard-noise-card"
        style={{ padding: 'clamp(0.75rem, 0.6rem + 0.6vw, 1.25rem)' }}
      >
        {/* Header with Switcher Tabs */}
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="flex items-center bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'tasks'
                  ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <CalendarClock size={14} />
              <span>Tasks</span>
              <span className="text-[10px] opacity-70">({totalCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('holidays')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'holidays'
                  ? 'bg-amber-500/15 text-amber-400 shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sparkles size={14} />
              <span>Holidays</span>
              <span className="text-[10px] opacity-70">({upcomingHolidays.length})</span>
            </button>
          </div>

          {activeTab === 'tasks' && isLoggedIn && (
            <button
              onClick={handleAddTask}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition-colors text-xs font-semibold"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Add Task</span>
            </button>
          )}
        </div>

        {/* Tab 1: Upcoming Tasks */}
        {activeTab === 'tasks' && (
          <>
            {tasksLoading ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 size={16} className="text-[var(--accent-primary)] animate-spin" />
                <p className="text-xs text-[var(--text-secondary)]">
                  Loading tasks...
                </p>
              </div>
            ) : upcomingTasks.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] py-4 text-center">
                No upcoming tasks — you're all caught up!
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {upcomingTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className="group cursor-pointer flex items-center gap-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 hover:border-[var(--accent-primary)]/80 hover:bg-[var(--bg-tertiary)] transition-all duration-200 shadow-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] flex-shrink-0" />
                    <span
                      className="text-sm font-medium text-[var(--text-primary)] truncate flex-1"
                      title={task.title}
                    >
                      {task.title}
                    </span>
                    {task.deadline && (
                      <span className="text-[11px] font-medium text-[var(--text-secondary)] flex-shrink-0 px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)]/60">
                        {formatDate(task.deadline)}
                      </span>
                    )}
                    {task.assignment && (
                      <span
                        className="text-[11px] font-medium text-[var(--text-secondary)] flex-shrink-0 px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)]/60"
                      >
                        {task.assignment}
                      </span>
                    )}
                    <ChevronRight
                      size={14}
                      className="text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-0.5 transition-all flex-shrink-0"
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Tab 2: Upcoming Real-World Holidays */}
        {activeTab === 'holidays' && (
          <div className="flex flex-col gap-2">
            {upcomingHolidays.length === 0 && (
              <div className="text-xs text-center text-[var(--text-secondary)] py-6">No upcoming holidays for this region.</div>
            )}
            {upcomingHolidays.map((hol) => {
              const d = new Date(`${hol.dateStr}T00:00:00`);
              const pub = !!hol.isPublicHoliday;
              const tone = pub ? 'text-amber-500 bg-amber-500/10 border-amber-500/25' : 'text-violet-400 bg-violet-500/10 border-violet-500/25';
              return (
                <div
                  key={hol.id}
                  className="flex items-center gap-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3 py-2.5 shadow-sm hover:border-[var(--accent-primary)]/40 transition-colors"
                >
                  <div className={`flex flex-col items-center justify-center w-11 h-12 rounded-lg border shrink-0 ${tone}`}>
                    <span className="text-[9px] font-bold uppercase leading-none">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
                    <span className="text-lg font-bold leading-tight">{d.getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] truncate">
                      <span className="mr-1">{hol.icon || '🎉'}</span>{hol.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tone}`}>
                        {pub ? 'Public holiday' : 'Observance'}
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)]">{formatHolidayDate(hol.dateStr)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewingTask && (
        <TaskViewModal
          isOpen={!!viewingTask}
          onClose={() => setViewingTask(null)}
          task={viewingTask}
          onEdit={() => {
            setViewingTask(null);
            setShowTaskForm(true);
          }}
        />
      )}

      {showTaskForm && (
        <TaskForm
          initialTask={null}
          initialAssignment=""
          initialDeadline={new Date()}
          onClose={() => setShowTaskForm(false)}
        />
      )}
    </>
  );
};

export default UpcomingTasks;
