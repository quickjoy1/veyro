import { CalendarDays, Clock, Minus, Pencil, Plus, Trash2, X, Zap } from 'lucide-react';

import type { PlanAction, PlanItem, PlanPreview } from '@/utils/changeImport';
import { formatDateShort, getTimeRemainingString } from '@/utils/dateUtils';
import { formatRecurrence, formatTimeRange } from '@/utils/formatTimeRange';

/**
 * A plan line drawn like the real task card (see pages/tasks/TaskItem.tsx): date and time on top,
 * title below, difficulty/status chips, with the action (Add / Update / Delete) in the left column
 * where the complete button normally sits.
 */

const difficultyStyle = (difficulty?: string) => {
  switch (difficulty?.toLowerCase()) {
    case 'easy':
      return { text: 'text-[#00FF41]', chip: 'bg-green-500/15 text-green-500' };
    case 'hard':
      return { text: 'text-[#FF003C]', chip: 'bg-red-500/15 text-red-500' };
    case 'medium':
      return { text: 'text-[#00BFFF]', chip: 'bg-blue-500/15 text-blue-500' };
    default:
      return { text: 'text-[var(--text-secondary)]', chip: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]' };
  }
};

const STATUS_LABEL: Record<string, string> = { todo: 'To Do', in_progress: 'In Progress', on_hold: 'On Hold', completed: 'Completed' };

const ACTION: Record<PlanAction, { label: string; icon: typeof Plus; border: string; badge: string }> = {
  add: { label: 'Add', icon: Plus, border: 'border-green-500/50', badge: 'bg-green-500/15 text-green-500' },
  update: { label: 'Update', icon: Pencil, border: 'border-blue-500/50', badge: 'bg-blue-500/15 text-blue-500' },
  delete: { label: 'Delete', icon: Trash2, border: 'border-red-500/60', badge: 'bg-red-500/15 text-red-500' },
  skip: { label: 'Skip', icon: Minus, border: 'border-[var(--border-primary)]', badge: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]' },
  error: { label: 'Error', icon: X, border: 'border-red-500/60', badge: 'bg-red-500/15 text-red-500' },
};

const DateRow = ({ preview }: { preview: PlanPreview }) => {
  const time = formatTimeRange(preview.start, preview.end);
  if (preview.weekdays && preview.weekdays.length > 0) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm w-full">
        <span className="text-[var(--text-secondary)] flex items-center gap-1.5 min-w-0">
          <Zap size={14} className="flex-shrink-0 opacity-70" />
          <span className="truncate">{formatRecurrence(preview.weekdays)}</span>
        </span>
        {time && (
          <span className="text-[var(--text-secondary)] flex items-center gap-1 flex-shrink-0">
            <Clock size={14} className="opacity-60" />
            {time}
          </span>
        )}
      </div>
    );
  }
  if (preview.date) {
    const deadline = `${preview.date}T00:00:00`;
    const remaining = getTimeRemainingString(deadline);
    return (
      <div className="flex items-center justify-between gap-2 text-sm w-full">
        <span className="text-[var(--text-secondary)] flex items-center gap-1.5 min-w-0">
          <Clock size={14} className="flex-shrink-0" />
          <span className="truncate">{formatDateShort(deadline)}</span>
          {remaining && <span className="flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full bg-[var(--bg-secondary)]">{remaining}</span>}
        </span>
        {time && <span className="text-[var(--text-secondary)] flex-shrink-0">{time}</span>}
      </div>
    );
  }
  return <span className="text-[var(--text-secondary)] opacity-60 text-sm">No deadline</span>;
};

export const PlanPreviewCard = ({ item }: { item: PlanItem }) => {
  const action = ACTION[item.action];
  const Icon = action.icon;
  const preview = item.preview;
  const isDelete = item.action === 'delete';

  // Skips and errors have no card to draw: show the plain explanation in the same frame.
  if (!preview) {
    return (
      <li className={`flex items-start gap-2.5 rounded-lg border-2 bg-[var(--bg-primary)] p-3 text-sm ${action.border}`}>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${action.badge}`}>
          <Icon size={12} />
          {action.label}
        </span>
        <span className="min-w-0 break-words text-[var(--text-primary)]">
          <span className="text-[var(--text-secondary)]">#{item.opIndex} </span>
          {item.summary}
          {item.reason && <span className="block text-[var(--text-secondary)]">{item.reason}</span>}
        </span>
      </li>
    );
  }

  const diff = difficultyStyle(preview.difficulty);
  const isEvent = preview.kind === 'event';

  return (
    <li className={`flex gap-2.5 items-center rounded-lg border-2 bg-[var(--bg-primary)] p-3 ${action.border} ${isDelete ? 'opacity-80' : ''}`}>
      {/* Left column: what will happen (where the complete button sits on a real task card) */}
      <div className="flex flex-col items-center justify-center gap-1 self-stretch pr-2.5 mr-0.5 border-r-2 border-[var(--border-primary)] flex-shrink-0 w-14">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${action.badge}`}>
          <Icon size={16} strokeWidth={2.4} />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{action.label}</span>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        {!isEvent && preview.assignment && (
          <div className="text-[var(--accent-primary)] text-sm font-semibold capitalize">{preview.assignment}</div>
        )}

        <DateRow preview={preview} />

        <div className="flex items-center gap-1.5 min-w-0">
          {isEvent && <CalendarDays size={15} className="flex-shrink-0 text-[var(--accent-primary)]" aria-label="Event" />}
          <span
            className={`block font-medium text-base overflow-hidden text-ellipsis line-clamp-1 ${isDelete ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}
            title={preview.title}
          >
            {preview.title}
          </span>
          {isEvent && <span className="flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">Event</span>}
        </div>

        {!isEvent && (preview.difficulty || preview.status) && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {preview.difficulty && <span className={`px-1.5 py-0.5 rounded-full font-medium capitalize ${diff.chip}`}>{preview.difficulty}</span>}
            {preview.status && <span className="px-1.5 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)]">{STATUS_LABEL[preview.status] ?? preview.status}</span>}
            {preview.completed && <span className="px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-500">Completed</span>}
          </div>
        )}

        {preview.description && <p className="text-xs text-[var(--text-secondary)] line-clamp-2 break-words">{preview.description}</p>}

        {item.action === 'update' && preview.changes && preview.changes.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-blue-500">
            {preview.changes.map((change) => (
              <li key={change} className="break-words">
                {change}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
};

export default PlanPreviewCard;
