import { showUndoToast } from '@/utils/undoToast';

/**
 * Offer an Undo for deleted tasks. "Delete all completed" deletes one task at a time, so deletions that
 * land within a short window are grouped into a single toast ("Deleted 5 tasks") with one Undo.
 */
let batch: Array<{ title?: string | null }> = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function offerRestore<T extends { title?: string | null }>(
  row: T,
  restore: (rows: T[]) => Promise<void> | void,
  windowMs = 250,
): void {
  batch.push(row);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const rows = batch as T[];
    batch = [];
    timer = null;
    const message = rows.length === 1 ? `Deleted "${rows[0]?.title ?? 'task'}"` : `Deleted ${rows.length} tasks`;
    showUndoToast(message, () => restore(rows));
  }, windowMs);
}
