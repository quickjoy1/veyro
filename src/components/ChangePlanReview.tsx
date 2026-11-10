import { AlertTriangle, Check, HardDriveDownload, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import PlanPreviewCard from '@/components/PlanPreviewCard';
import { TaskService } from '@/services/TaskService';
import { useAppStore, useWorkspace } from '@/store/appStore';
import { forceTaskRefresh } from '@/store/TaskActions';
import {
  applyPlan,
  planSignature,
  reviewChangeText,
  type ChangePlan,
  type ExistingTask,
  type PlanContext,
  type TaskGateway,
} from '@/utils/changeImport';
import { downloadBackup } from '@/utils/backupRestore';

const gateway: TaskGateway = {
  create: (fields) => TaskService.createTask(fields),
  update: (id, fields) => TaskService.updateTask(id, fields),
  remove: (id) => TaskService.deleteTask(id),
};

const btn = 'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 disabled:opacity-50';
const secondaryBtn = `${btn} border-2 border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/50`;
const primaryBtn = `${btn} bg-[var(--accent-primary)] text-white hover:opacity-90`;

interface ChangePlanReviewProps {
  /** the pasted commands (SQL-style text or JSON) */
  text: string;
  /** called after the changes were applied without any failure */
  onApplied?: (() => void) | undefined;
}

/**
 * Shows the plan for pasted AI commands and applies it on click. Used by the Settings panel
 * and by the AI task form on the Tasks page, so both follow exactly the same safety rules.
 */
const ChangePlanReview = ({ text, onApplied }: ChangePlanReviewProps) => {
  const tasks = useAppStore((state) => state.tasks.tasks) as unknown as ExistingTask[];
  const laps = useAppStore((state) => state.laps.laps);
  const { workspaces, currentWorkspace } = useWorkspace();

  const contextRef = useRef<PlanContext>({ tasks });
  contextRef.current = {
    tasks,
    workspaces: (workspaces ?? []) as { id: string | number; name?: string }[],
    currentWorkspaceId: currentWorkspace?.id as string | undefined,
  };

  // The plan the user is looking at. It is rebuilt when the text changes, not when tasks change,
  // so "Apply" can tell whether the tasks moved under the user since they reviewed it.
  const [outcome, setOutcome] = useState(() => reviewChangeText(text, contextRef.current));
  const [confirmDeletes, setConfirmDeletes] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    setOutcome(reviewChangeText(text, contextRef.current));
    setConfirmDeletes(false);
  }, [text]);

  if (!outcome.ok) {
    return (
      <div className="flex gap-2 rounded-xl border-2 border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>{outcome.error}</span>
      </div>
    );
  }

  const plan: ChangePlan = outcome.plan;
  const deleteBlocked = plan.hasDeletes && !confirmDeletes;

  const apply = async () => {
    const fresh = reviewChangeText(text, contextRef.current);
    if (!fresh.ok || planSignature(fresh.plan) !== planSignature(plan)) {
      toast.info('Your tasks changed since the review. Please check the plan again.');
      setOutcome(fresh);
      setConfirmDeletes(false);
      return;
    }

    setApplying(true);
    setProgress({ done: 0, total: plan.counts.add + plan.counts.update + plan.counts.delete });
    try {
      const result = await applyPlan(fresh.plan, gateway, {
        confirmDeletes,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      await forceTaskRefresh(currentWorkspace?.id as string | undefined);
      window.dispatchEvent(new CustomEvent('refreshCalendar'));
      window.dispatchEvent(new CustomEvent('refreshStats'));

      const parts = [
        result.added ? `${result.added} added` : '',
        result.updated ? `${result.updated} updated` : '',
        result.deleted ? `${result.deleted} deleted` : '',
      ].filter(Boolean);
      if (result.failures.length === 0) {
        toast.success(parts.join(', ') || 'Nothing to change');
        onApplied?.();
      } else {
        const first = result.failures[0];
        toast.error(
          `${parts.join(', ') || 'Nothing applied'}. ${result.failures.length} failed (change ${first?.opIndex}: ${first?.message}).${result.deletesSkipped ? ' Deletes were not run.' : ''}`,
          { autoClose: 10000 },
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setApplying(false);
      setProgress(null);
      setConfirmDeletes(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-[var(--text-primary)]">
        Plan: {plan.counts.add} to add, {plan.counts.update} to update, {plan.counts.delete} to delete
        {plan.counts.skip ? `, ${plan.counts.skip} skipped` : ''}
        {plan.counts.error ? `, ${plan.counts.error} with errors` : ''}
      </div>

      {plan.globalErrors.map((message) => (
        <div key={message} className="rounded-lg border-2 border-red-500/30 bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">
          {message}
        </div>
      ))}

      <ul className="stagger-children max-h-[22rem] space-y-2 overflow-y-auto pr-1" role="list">
        {plan.items.map((item, i) => (
          <PlanPreviewCard key={`${item.opIndex}-${i}`} item={item} />
        ))}
      </ul>

      {plan.hasDeletes && (
        <div className="space-y-2 rounded-xl border-2 border-red-500/40 bg-red-500/10 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
            <AlertTriangle size={14} />
            This permanently deletes {plan.counts.delete} task{plan.counts.delete === 1 ? '' : 's'}.
          </div>
          <button type="button" onClick={() => downloadBackup(tasks as never, laps as never, (workspaces ?? []) as never)} className={secondaryBtn}>
            <HardDriveDownload size={14} /> Download a backup first
          </button>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-primary)]">
            <input type="checkbox" checked={confirmDeletes} onChange={(e) => setConfirmDeletes(e.target.checked)} />
            I checked the red Delete lines above and want them deleted.
          </label>
        </div>
      )}

      <button type="button" onClick={apply} disabled={!plan.canApply || applying || deleteBlocked} className={primaryBtn}>
        {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        {applying && progress ? `Applying ${progress.done}/${progress.total}` : 'Apply changes'}
      </button>
      {!plan.canApply && plan.counts.error > 0 && (
        <p className="text-xs text-[var(--text-secondary)]">Fix the errors (ask the AI to correct them) and try again. Nothing is applied while there are errors.</p>
      )}
    </div>
  );
};

export default ChangePlanReview;
