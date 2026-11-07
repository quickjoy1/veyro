import { AlertTriangle, Check, ClipboardCopy, FileUp, HardDriveDownload, Loader2, Minus, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { TaskService } from '@/services/TaskService';
import { useAppStore, useWorkspace } from '@/store/appStore';
import { forceTaskRefresh } from '@/store/TaskActions';
import {
  applyPlan,
  buildAiInstructions,
  planSignature,
  reviewChangeText,
  type ChangePlan,
  type ExistingTask,
  type PlanAction,
  type TaskGateway,
} from '@/utils/changeImport';
import { downloadBackup } from '@/utils/backupRestore';
import { readFileAsText } from '@/utils/dataImport';

const gateway: TaskGateway = {
  create: (fields) => TaskService.createTask(fields),
  update: (id, fields) => TaskService.updateTask(id, fields),
  remove: (id) => TaskService.deleteTask(id),
};

const ACTION_STYLE: Record<PlanAction, { label: string; className: string; icon: typeof Plus }> = {
  add: { label: 'Add', className: 'text-green-600 dark:text-green-400 bg-green-500/10', icon: Plus },
  update: { label: 'Update', className: 'text-blue-600 dark:text-blue-400 bg-blue-500/10', icon: Pencil },
  delete: { label: 'Delete', className: 'text-red-600 dark:text-red-400 bg-red-500/10', icon: Trash2 },
  skip: { label: 'Skip', className: 'text-[var(--text-secondary)] bg-[var(--bg-secondary)]', icon: Minus },
  error: { label: 'Error', className: 'text-red-600 dark:text-red-400 bg-red-500/10', icon: X },
};

const EXAMPLE = `INSERT INTO tasks (title, date, start_time, end_time, assignment)
VALUES ('Dentist', '2026-11-12', '15:00', '16:00', 'Health');`;

const AiChangeImportPanel = () => {
  const tasks = useAppStore((state) => state.tasks.tasks) as unknown as ExistingTask[];
  const laps = useAppStore((state) => state.laps.laps);
  const { workspaces, currentWorkspace } = useWorkspace();

  const [text, setText] = useState('');
  const [plan, setPlan] = useState<ChangePlan | null>(null);
  const [reviewedSignature, setReviewedSignature] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [confirmDeletes, setConfirmDeletes] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const planContext = useMemo(
    () => ({
      tasks,
      workspaces: (workspaces ?? []) as { id: string | number; name?: string }[],
      currentWorkspaceId: currentWorkspace?.id as string | undefined,
    }),
    [tasks, workspaces, currentWorkspace],
  );

  const copy = async (withTasks: boolean) => {
    const prompt = buildAiInstructions({
      workspaceNames: (workspaces ?? []).map((w) => String((w as { name?: string }).name ?? '')).filter(Boolean),
      tasks: withTasks ? tasks : undefined,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success(withTasks ? 'Instructions and your tasks copied. Paste them into the AI.' : 'Instructions copied. Paste them into the AI.');
    } catch {
      toast.error('Could not copy. Allow clipboard access and try again.');
    }
  };

  const review = () => {
    setConfirmDeletes(false);
    const outcome = reviewChangeText(text, planContext);
    if (!outcome.ok) {
      setPlan(null);
      setParseError(outcome.error);
      return;
    }
    setParseError(null);
    setPlan(outcome.plan);
    setReviewedSignature(planSignature(outcome.plan));
  };

  const loadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setText(await readFileAsText(file));
    setPlan(null);
    setParseError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const apply = async () => {
    if (!plan) return;
    // Tasks may have changed since the review; make sure the user approved exactly what will run.
    const fresh = reviewChangeText(text, planContext);
    if (!fresh.ok || planSignature(fresh.plan) !== reviewedSignature) {
      toast.info('Your tasks changed since the review. Please review the plan again.');
      if (fresh.ok) {
        setPlan(fresh.plan);
        setReviewedSignature(planSignature(fresh.plan));
        setConfirmDeletes(false);
      }
      return;
    }

    setApplying(true);
    setProgress({ done: 0, total: fresh.plan.counts.add + fresh.plan.counts.update + fresh.plan.counts.delete });
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
        setText('');
        setPlan(null);
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

  const btn = 'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 disabled:opacity-50';
  const secondaryBtn = `${btn} border-2 border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/50`;
  const primaryBtn = `${btn} bg-[var(--accent-primary)] text-white hover:opacity-90`;

  const deleteBlocked = Boolean(plan?.hasDeletes) && !confirmDeletes;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-[var(--accent-primary)]" />
          <h4 className="text-sm font-bold text-[var(--text-primary)]">Import changes from AI</h4>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          Copy the instructions into any AI, tell it what to add or change, then paste its SQL-style answer here. You see a plan first.
          Adding never deletes or overwrites anything; tasks are only deleted by an explicit DELETE that you confirm.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => copy(false)} className={secondaryBtn}>
          <ClipboardCopy size={14} /> Copy AI instructions
        </button>
        <button onClick={() => copy(true)} className={secondaryBtn}>
          <ClipboardCopy size={14} /> Copy with my tasks
        </button>
        <button onClick={() => fileRef.current?.click()} className={secondaryBtn}>
          <FileUp size={14} /> Load .sql / .txt file
        </button>
        <input ref={fileRef} type="file" accept=".sql,.txt,.json" onChange={loadFile} className="hidden" />
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPlan(null);
          setParseError(null);
        }}
        placeholder={EXAMPLE}
        spellCheck={false}
        rows={7}
        className="w-full rounded-xl border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)]/30 p-3 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none"
      />

      <button onClick={review} disabled={!text.trim() || applying} className={primaryBtn}>
        Review plan
      </button>

      {parseError && (
        <div className="flex gap-2 rounded-xl border-2 border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {plan && (
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

          <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {plan.items.map((item, i) => {
              const style = ACTION_STYLE[item.action];
              const Icon = style.icon;
              return (
                <li key={`${item.opIndex}-${i}`} className="flex items-start gap-2 rounded-lg border border-[var(--border-primary)] p-2 text-xs">
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold ${style.className}`}>
                    <Icon size={11} />
                    {style.label}
                  </span>
                  <span className="min-w-0 break-words text-[var(--text-primary)]">
                    <span className="text-[var(--text-secondary)]">#{item.opIndex} </span>
                    {item.summary}
                    {item.reason && <span className="block text-[var(--text-secondary)]">{item.reason}</span>}
                  </span>
                </li>
              );
            })}
          </ul>

          {plan.hasDeletes && (
            <div className="space-y-2 rounded-xl border-2 border-red-500/40 bg-red-500/10 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
                <AlertTriangle size={14} />
                This import permanently deletes {plan.counts.delete} task{plan.counts.delete === 1 ? '' : 's'}.
              </div>
              <button onClick={() => downloadBackup(tasks as never, laps as never, (workspaces ?? []) as never)} className={secondaryBtn}>
                <HardDriveDownload size={14} /> Download a backup first
              </button>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-primary)]">
                <input type="checkbox" checked={confirmDeletes} onChange={(e) => setConfirmDeletes(e.target.checked)} />
                I checked the red Delete lines above and want them deleted.
              </label>
            </div>
          )}

          <button onClick={apply} disabled={!plan.canApply || applying || deleteBlocked} className={primaryBtn}>
            {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {applying && progress ? `Applying ${progress.done}/${progress.total}` : 'Apply changes'}
          </button>
          {!plan.canApply && plan.counts.error > 0 && (
            <p className="text-xs text-[var(--text-secondary)]">Fix the errors (ask the AI to correct them) and review again. Nothing is applied while there are errors.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AiChangeImportPanel;
