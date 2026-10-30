import { useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { useTasksOnly } from "@/store/appStore";
import { useNotificationStore } from "@/store/notificationStore";
import { planDelivery, planReminders, type Tier } from "@/utils/reminderEngine";
import { getDesktopPermission, requestDesktopPermission, showDesktopNotification } from "@/utils/desktopNotifications";

const CHECK_EVERY_MS = 60_000;
/** Gap between two popups so they arrive as a calm flow instead of a burst. */
const SPACING_MS = 5_000;

export { parseDeadline, getReminderTier } from "@/utils/reminderEngine";

interface Popup {
  key: string;
  message: string;
  tier: Tier;
}

// One shared queue: popups leave one at a time, even if several checks add to it
const queue: Popup[] = [];
let draining = false;

const show = (p: Popup) => {
  const urgent = p.tier === "overdue" || p.tier === "due";
  if (document.visibilityState === "visible") {
    // User is looking at the app: an in-app toast is enough
    toast[urgent ? "error" : "warning"](p.message, { toastId: p.key, autoClose: 9000 });
  } else {
    // Tab in the background: use a system notification
    showDesktopNotification("Task reminder", { body: p.message, tag: p.key });
  }
};

const drain = () => {
  if (draining) return;
  draining = true;
  const step = () => {
    const next = queue.shift();
    if (!next) {
      draining = false;
      return;
    }
    show(next);
    window.setTimeout(step, SPACING_MS);
  };
  step();
};

/**
 * Watches task deadlines. Every reminder is saved to the notification list (Session > Notifications);
 * popups are spaced out, and a pile-up (e.g. after being away) becomes a single summary popup.
 * Runs while the app is open in a browser tab.
 */
export const useDueReminders = () => {
  const tasks = useTasksOnly();
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const run = useRef(() => {
    const store = useNotificationStore.getState();
    const current = tasksRef.current;
    const now = Date.now();

    const fresh = planReminders(current, new Set(store.items.map((i) => i.key)), now);
    if (fresh.length) {
      store.addMany(fresh);
      const { individual, digest } = planDelivery(fresh);
      queue.push(...individual);
      if (digest) queue.push({ key: `digest-${now}`, ...digest });
      drain();
    }

    // Tasks that were finished or deleted no longer need attention
    const openIds = new Set(current.filter((t) => !t.completed && t.status !== "completed").map((t) => t.id));
    if (current.length > 0) {
      const stale = store.items.filter((i) => !i.read && !openIds.has(i.taskId)).map((i) => i.taskId);
      if (stale.length) store.markTasksRead(stale);
    }
  });

  useEffect(() => {
    // Browsers only allow the permission prompt from a user gesture
    const askOnce = () => {
      if (getDesktopPermission() === "default") void requestDesktopPermission();
    };
    window.addEventListener("click", askOnce, { once: true });

    const id = window.setInterval(() => run.current(), CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && run.current();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("click", askOnce);
    };
  }, []);

  // Check shortly after tasks load or change (debounced so a bulk load counts as one change)
  useEffect(() => {
    const t = window.setTimeout(() => run.current(), 1500);
    return () => window.clearTimeout(t);
  }, [tasks]);
};
