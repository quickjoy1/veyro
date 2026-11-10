import { Undo2 } from 'lucide-react';
import { toast } from 'react-toastify';

/**
 * Toast with an Undo button. `onUndo` runs at most once; the toast closes either way.
 */
export function showUndoToast(message: string, onUndo: () => void | Promise<void>): void {
  let used = false;
  toast(
    ({ closeToast }) => (
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 break-words text-sm">{message}</span>
        <button
          type="button"
          onClick={() => {
            if (used) return;
            used = true;
            closeToast?.();
            void onUndo();
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-current px-2 py-1 text-xs font-semibold hover:opacity-80"
        >
          <Undo2 size={12} /> Undo
        </button>
      </div>
    ),
    { autoClose: 5000, closeOnClick: false, pauseOnHover: true, toastId: `undo-${message}` },
  );
}
