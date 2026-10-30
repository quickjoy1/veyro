import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Reminder, Tier } from "@/utils/reminderEngine";

export interface AppNotification {
  id: string;
  key: string;
  taskId: string;
  title: string;
  tier: Tier;
  message: string;
  createdAt: number;
  read: boolean;
}

const MAX_ITEMS = 300;
const MAX_AGE_MS = 14 * 24 * 3_600_000;

interface NotificationState {
  items: AppNotification[];
  addMany: (reminders: Reminder[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  markTasksRead: (taskIds: string[]) => void;
  remove: (id: string) => void;
  clearRead: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      items: [],
      addMany: (reminders) =>
        set((s) => {
          const have = new Set(s.items.map((i) => i.key));
          const now = Date.now();
          const added: AppNotification[] = reminders
            .filter((r) => !have.has(r.key))
            .map((r) => ({
              id: `${r.key}#${now}`,
              key: r.key,
              taskId: r.taskId,
              title: r.title,
              tier: r.tier,
              message: r.message,
              createdAt: now,
              read: false,
            }));
          if (added.length === 0) return s;
          const merged = [...added, ...s.items].filter((i) => now - i.createdAt < MAX_AGE_MS);
          return { items: merged.slice(0, MAX_ITEMS) };
        }),
      markRead: (id) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, read: true } : i)) })),
      markAllRead: () => set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) })),
      markTasksRead: (taskIds) =>
        set((s) => {
          const ids = new Set(taskIds);
          if (!s.items.some((i) => !i.read && ids.has(i.taskId))) return s;
          return { items: s.items.map((i) => (ids.has(i.taskId) ? { ...i, read: true } : i)) };
        }),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      // Unread items are kept: they also hold the "already reminded" records
      clearRead: () => set((s) => ({ items: s.items.filter((i) => !i.read) })),
    }),
    { name: "veyro_notifications", version: 1 }
  )
);

export const useUnreadCount = () => useNotificationStore((s) => s.items.filter((i) => !i.read).length);
