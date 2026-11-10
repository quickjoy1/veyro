import { BarChart3, BookOpen, Calendar, CalendarDays, CheckCircle2, Clock, CornerDownLeft, Notebook, Plus, Search, Settings } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useNavigation } from '@/navbar/NavigationContext';
import { useAppStore } from '@/store/appStore';
import { isEventTask } from '@/utils/eventTasks';
import { fuzzy } from '@/utils/fuzzy';

type Page = Parameters<ReturnType<typeof useNavigation>['navigateTo']>[0];

interface Command {
  id: string;
  title: string;
  hint?: string;
  group: 'Go to' | 'Actions' | 'Tasks & events';
  icon: ReactNode;
  run: () => void;
}

const isTypingTarget = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
};

const PAGE_KEYS: Record<string, Page> = { s: 'session', t: 'tasks', p: 'calendar', a: 'analytics', j: 'habits', n: 'notes' };

/**
 * Ctrl/Cmd+K (or "/") opens a command palette. Single-key shortcuts when not typing:
 *   g then s/t/p/a/j/n  -> go to Study/Tasks/Planning/Analytics/Journal/Notes
 *   n                   -> new task        ,        ?  -> open the palette
 */
const CommandPalette = () => {
  const { navigateTo, openSettings } = useNavigation();
  const allTasks = useAppStore((state) => state.tasks.tasks);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pendingG = useRef<number | undefined>(undefined);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  const quickAdd = useCallback(() => {
    navigateTo('tasks');
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('quickAddTask')), 300);
  }, [navigateTo]);

  // Global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target) || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]') && !open) return; // another modal is open

      if (e.key === '/' || e.key === '?') {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (pendingG.current !== undefined) {
        window.clearTimeout(pendingG.current);
        pendingG.current = undefined;
        const page = PAGE_KEYS[e.key.toLowerCase()];
        if (page) {
          e.preventDefault();
          navigateTo(page);
        }
        return;
      }
      if (e.key === 'g') {
        pendingG.current = window.setTimeout(() => (pendingG.current = undefined), 900);
      } else if (e.key === 'n') {
        e.preventDefault();
        quickAdd();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(pendingG.current);
    };
  }, [navigateTo, open, quickAdd]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const baseCommands = useMemo<Command[]>(() => {
    const go = (page: Page) => () => navigateTo(page);
    return [
      { id: 'go-session', title: 'Study', hint: 'G S', group: 'Go to', icon: <Clock size={16} />, run: go('session') },
      { id: 'go-tasks', title: 'Tasks', hint: 'G T', group: 'Go to', icon: <CheckCircle2 size={16} />, run: go('tasks') },
      { id: 'go-calendar', title: 'Planning (calendar)', hint: 'G P', group: 'Go to', icon: <Calendar size={16} />, run: go('calendar') },
      { id: 'go-analytics', title: 'Analytics', hint: 'G A', group: 'Go to', icon: <BarChart3 size={16} />, run: go('analytics') },
      { id: 'go-habits', title: 'Journal', hint: 'G J', group: 'Go to', icon: <Notebook size={16} />, run: go('habits') },
      { id: 'go-notes', title: 'Notes', hint: 'G N', group: 'Go to', icon: <BookOpen size={16} />, run: go('notes') },
      { id: 'act-add', title: 'Add a task', hint: 'N', group: 'Actions', icon: <Plus size={16} />, run: quickAdd },
      { id: 'act-settings', title: 'Open settings (import changes from AI, backup...)', group: 'Actions', icon: <Settings size={16} />, run: openSettings },
    ];
  }, [navigateTo, openSettings, quickAdd]);

  const results = useMemo<Command[]>(() => {
    const q = query.trim();
    if (!q) return baseCommands;

    const scored: Array<{ score: number; command: Command }> = [];
    for (const command of baseCommands) {
      const score = fuzzy(q, command.title);
      if (score !== null) scored.push({ score, command });
    }
    if (q.length >= 2) {
      for (const task of allTasks.slice(0, 2000)) {
        const haystack = `${task.title} ${task.assignment ?? ''}`;
        const score = fuzzy(q, haystack);
        if (score === null) continue;
        const event = isEventTask(task);
        scored.push({
          score: score + 100,
          command: {
            id: `task-${task.id}`,
            title: task.title,
            hint: event ? 'Event' : task.assignment || undefined,
            group: 'Tasks & events',
            icon: event ? <CalendarDays size={16} /> : <CheckCircle2 size={16} />,
            run: () => navigateTo(event ? 'calendar' : 'tasks'),
          },
        });
      }
    }
    return scored
      .sort((a, b) => a.score - b.score)
      .slice(0, 30)
      .map((entry) => entry.command);
  }, [allTasks, baseCommands, navigateTo, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, results]);

  const choose = (command: Command | undefined) => {
    if (!command) return;
    close();
    command.run();
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  if (!open) return null;

  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[100001] flex items-start justify-center bg-black/50 px-3 pt-[12vh] backdrop-blur-sm animate-fadeIn" onMouseDown={close} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="animate-modal-pop w-full max-w-xl overflow-hidden rounded-xl border-2 border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b-2 border-[var(--border-primary)] px-3">
          <Search size={18} className="shrink-0 text-[var(--text-secondary)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search pages, actions, tasks and events…"
            aria-label="Search commands"
            className="h-12 w-full bg-transparent text-base text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
          />
          <kbd className="hidden shrink-0 rounded border border-[var(--border-primary)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] sm:inline">Esc</kbd>
        </div>

        <ul ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-[var(--text-secondary)]">Nothing matches “{query}”.</li>}
          {results.map((command, i) => {
            const header = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            return (
              <li key={command.id} role="presentation">
                {header && <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{header}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  data-active={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(command)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    i === active ? 'bg-[var(--accent-primary)]/12 text-[var(--text-primary)]' : 'text-[var(--text-primary)]'
                  }`}
                >
                  <span className={i === active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}>{command.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{command.title}</span>
                  {command.hint && <span className="shrink-0 rounded bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]">{command.hint}</span>}
                  {i === active && <CornerDownLeft size={14} className="shrink-0 text-[var(--text-secondary)]" />}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between border-t-2 border-[var(--border-primary)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
          <span>↑ ↓ to move · Enter to open</span>
          <span>Shortcuts: G then S/T/P/A/J/N · N new task · / search</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
