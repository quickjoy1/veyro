import { ClipboardCopy, FileUp, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'react-toastify';

import ChangePlanReview from '@/components/ChangePlanReview';
import { useAppStore, useWorkspace } from '@/store/appStore';
import { buildAiInstructions, type ExistingTask } from '@/utils/changeImport';
import { readFileAsText } from '@/utils/dataImport';

const EXAMPLE = `INSERT INTO tasks (title, date, start_time, end_time, assignment)
VALUES ('Dentist', '2026-11-12', '15:00', '16:00', 'Health');`;

const btn = 'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 disabled:opacity-50';
const secondaryBtn = `${btn} border-2 border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/50`;
const primaryBtn = `${btn} bg-[var(--accent-primary)] text-white hover:opacity-90`;

/** Settings > Data: copy instructions for an AI, paste its commands, review and apply. */
const AiChangeImportPanel = () => {
  const tasks = useAppStore((state) => state.tasks.tasks) as unknown as ExistingTask[];
  const { workspaces } = useWorkspace();

  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const loadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setText(await readFileAsText(file));
    setSubmitted(null);
    if (fileRef.current) fileRef.current.value = '';
  };

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
          You can also paste the same text into the AI box of the task + button.
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
          setSubmitted(null);
        }}
        placeholder={EXAMPLE}
        spellCheck={false}
        rows={7}
        className="w-full rounded-xl border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)]/30 p-3 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none"
      />

      <button onClick={() => setSubmitted(text)} disabled={!text.trim()} className={primaryBtn}>
        Review plan
      </button>

      {submitted !== null && (
        <ChangePlanReview
          text={submitted}
          onApplied={() => {
            setText('');
            setSubmitted(null);
          }}
        />
      )}
    </div>
  );
};

export default AiChangeImportPanel;
