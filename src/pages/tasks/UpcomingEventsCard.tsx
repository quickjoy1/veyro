import { CalendarDays, ChevronDown, Clock, Trash2, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';

import DeleteCompletedModal from '@/modals/DeleteTasksPop';
import { TaskService } from '@/services/TaskService';
import { useAppStore, useDeleteTaskSuccess, useWorkspace } from '@/store/appStore';
import { clockFromTimestamp, localYmd } from '@/utils/changeImport';
import { formatDateShort, getTimeRemainingString } from '@/utils/dateUtils';
import { isEventTask } from '@/utils/eventTasks';
import { formatRecurrence, formatTimeRange } from '@/utils/formatTimeRange';

const COLLAPSE_KEY = 'eventsCardCollapsed';
const VISIBLE_WHEN_FOLDED = 5;

interface EventRow {
  id: string;
  title: string;
  description: string;
  date: string | null;
  start: string | null;
  end: string | null;
  weekdays: number[] | null;
  sortKey: string;
}

const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Events (INSERT INTO events ...) are calendar and reminder items. They are kept out of the task
 * board and listed here instead, in their own card.
 */
const UpcomingEventsCard = () => {
  const allTasks = useAppStore((state) => state.tasks.tasks);
  const { currentWorkspace } = useWorkspace();
  const deleteTaskSuccess = useDeleteTaskSuccess();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [showAll, setShowAll] = useState(false);
  const [toDelete, setToDelete] = useState<EventRow | null>(null);

  const events = useMemo<EventRow[]>(() => {
    const today = todayYmd();
    const inWorkspace = (workspaceId?: string | null) =>
      !currentWorkspace || currentWorkspace.id === 'all' || workspaceId === currentWorkspace.id;

    return allTasks
      .filter((t) => isEventTask(t) && !t.completed && inWorkspace(t.workspace_id))
      .map((t): EventRow => {
        const weekdays = t.recurrence_type === 'weekly' && t.recurrence_weekdays?.length ? [...t.recurrence_weekdays].sort((a, b) => a - b) : null;
        const date = weekdays ? null : localYmd(t.deadline);
        const start = clockFromTimestamp(t.start_at, Boolean(weekdays));
        return {
          id: String(t.id),
          title: t.title,
          description: t.description ?? '',
          date,
          start,
          end: clockFromTimestamp(t.end_at, Boolean(weekdays)),
          weekdays,
          // dated events first (soonest first), repeating ones after them
          sortKey: weekdays ? `9999|${t.title}` : `${date ?? '9998'}|${start ?? '00:00'}`,
        };
      })
      .filter((e) => e.weekdays !== null || e.date === null || e.date >= today)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [allTasks, currentWorkspace]);

  if (events.length === 0) return null;

  const visible = showAll ? events : events.slice(0, VISIBLE_WHEN_FOLDED);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, String(!prev));
      } catch {
        // storage unavailable: the card just won't remember its state
      }
      return !prev;
    });
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    try {
      await TaskService.deleteTask(target.id);
      deleteTaskSuccess(target.id);
      window.dispatchEvent(new CustomEvent('refreshCalendar'));
      toast.success('Event deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the event');
    }
  };

  return (
    <section
      className="mb-4 rounded-lg border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3"
      aria-label="Events"
      data-testid="events-card"
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={!collapsed}
      >
        <CalendarDays size={18} className="text-[var(--accent-primary)]" />
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Events</h3>
        <span className="rounded-full bg-[var(--accent-primary)]/15 px-2 py-0.5 text-xs font-medium text-[var(--accent-primary)]">{events.length}</span>
        <span className="ml-1 text-xs text-[var(--text-secondary)]">on your calendar and in reminders</span>
        <ChevronDown size={18} className={`ml-auto text-[var(--text-secondary)] transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      </button>

      {!collapsed && (
        <>
          <ul className="mt-3 space-y-2" role="list">
            {visible.map((event) => {
              const deadline = event.date ? `${event.date}T00:00:00` : null;
              const remaining = deadline ? getTimeRemainingString(deadline) : '';
              const time = formatTimeRange(event.start, event.end);
              return (
                <li
                  key={event.id}
                  className="group flex items-center gap-2.5 rounded-lg border-2 border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 transition-colors hover:border-[var(--accent-primary)]/40"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                    <CalendarDays size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-sm text-[var(--text-secondary)]">
                      {event.weekdays ? (
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Zap size={14} className="flex-shrink-0 opacity-70" />
                          <span className="truncate">{formatRecurrence(event.weekdays)}</span>
                        </span>
                      ) : (
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Clock size={14} className="flex-shrink-0" />
                          <span className="truncate">{deadline ? formatDateShort(deadline) : 'No date'}</span>
                          {remaining && <span className="flex-shrink-0 rounded-full bg-[var(--bg-secondary)] px-1.5 py-0.5 text-xs font-medium">{remaining}</span>}
                        </span>
                      )}
                      {time && <span className="flex-shrink-0">{time}</span>}
                    </div>
                    <div className="truncate text-base font-medium text-[var(--text-primary)]" title={event.title}>
                      {event.title}
                    </div>
                    {event.description && <p className="line-clamp-1 text-xs text-[var(--text-secondary)]">{event.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setToDelete(event)}
                    className="flex-shrink-0 rounded-lg p-1.5 text-[var(--text-secondary)] opacity-60 transition-colors hover:bg-red-500/10 hover:text-red-500 hover:opacity-100 group-hover:opacity-100"
                    title="Delete event"
                    aria-label={`Delete event ${event.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
          {events.length > VISIBLE_WHEN_FOLDED && (
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className="mt-2 text-xs font-medium text-[var(--accent-primary)] hover:underline"
            >
              {showAll ? 'Show fewer' : `Show all ${events.length}`}
            </button>
          )}
        </>
      )}

      {toDelete && (
        <DeleteCompletedModal
          onClose={() => setToDelete(null)}
          onConfirm={confirmDelete}
          message={`Delete the event "${toDelete.title}"? It will also disappear from the calendar and reminders.`}
          confirmButtonText="Delete Event"
        />
      )}
    </section>
  );
};

export default UpcomingEventsCard;
