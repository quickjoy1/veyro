import { Bell, BellOff, BellRing, Check, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTasksOnly } from "@/store/appStore";
import { useNotificationStore, useUnreadCount } from "@/store/notificationStore";
import { useNavigation } from "@/navbar/NavigationContext";
import { formatDue, getUpcoming, type Tier } from "@/utils/reminderEngine";
import { getDesktopPermission, requestDesktopPermission, showDesktopNotification, type DesktopPermission } from "@/utils/desktopNotifications";

const TIER_STYLE: Record<Tier, string> = {
  overdue: "text-red-500 bg-red-500/10 border-red-500/30",
  due: "text-red-500 bg-red-500/10 border-red-500/30",
  "1h": "text-orange-500 bg-orange-500/10 border-orange-500/30",
  "3h": "text-orange-500 bg-orange-500/10 border-orange-500/30",
  "1d": "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
  "3d": "text-blue-500 bg-blue-500/10 border-blue-500/30",
};
const NEUTRAL = "text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-[var(--border-primary)]";

const timeAgo = (ms: number, now: number) => {
  const m = Math.max(0, Math.round((now - ms) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};

type Tab = "upcoming" | "history";

const NotificationsPanel = () => {
  const tasks = useTasksOnly();
  const items = useNotificationStore((s) => s.items);
  const { markRead, markAllRead, remove, clearRead } = useNotificationStore.getState();
  const unread = useUnreadCount();
  const { navigateTo } = useNavigation();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [now, setNow] = useState(() => Date.now());
  const [perm, setPerm] = useState<DesktopPermission>(getDesktopPermission());

  // Keep "in 2h" style labels fresh
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const upcoming = useMemo(() => getUpcoming(tasks, now), [tasks, now]);

  const enable = async () => setPerm(await requestDesktopPermission());
  const sendTest = () => showDesktopNotification("Veyro", { body: "Notifications are working." });

  const tabBtn = (id: Tab, label: string, badge?: number) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
        tab === id
          ? "border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
          : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      }`}
    >
      {label}
      {badge ? <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-red-500 text-white">{badge}</span> : null}
    </button>
  );

  return (
    <div className="w-full rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 flex flex-col gap-3" data-tour="session-notifications">
      <div className="flex flex-wrap items-center gap-2">
        <BellRing size={18} className="text-[var(--accent-primary)]" />
        <h2 className="font-semibold text-[var(--text-primary)] text-base sm:text-lg">Notifications</h2>
        <div className="flex gap-2 ml-2">
          {tabBtn("upcoming", "Upcoming", upcoming.filter((u) => u.dueMs < now).length || undefined)}
          {tabBtn("history", "History", unread || undefined)}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {perm === "granted" ? (
            <button type="button" onClick={sendTest} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)]">
              <Bell size={14} /> Send test
            </button>
          ) : perm === "unsupported" ? (
            <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1"><BellOff size={14} /> Desktop alerts not supported</span>
          ) : perm === "denied" ? (
            <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1"><BellOff size={14} /> Desktop alerts blocked in browser settings</span>
          ) : (
            <button type="button" onClick={enable} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-primary)] text-white hover:opacity-90">
              <Bell size={14} /> Enable desktop alerts
            </button>
          )}
        </div>
      </div>

      {tab === "upcoming" ? (
        upcoming.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] py-2">Nothing due in the next 7 days. Add a deadline to a task and it shows up here.</p>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
            {upcoming.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => navigateTo("tasks")}
                className="flex items-center gap-2.5 text-left bg-[var(--bg-secondary)] border-2 border-[var(--border-primary)] rounded-lg px-3 py-2 hover:border-[var(--accent-primary)] transition-colors"
              >
                <span className="text-sm text-[var(--text-primary)] truncate flex-1">{u.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${u.tier ? TIER_STYLE[u.tier] : NEUTRAL}`}>{formatDue(u.dueMs, now)}</span>
              </button>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="flex gap-2">
            <button type="button" onClick={markAllRead} disabled={!unread} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] disabled:opacity-40">
              <Check size={13} /> Mark all read
            </button>
            <button type="button" onClick={clearRead} disabled={items.every((i) => !i.read)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-red-500 disabled:opacity-40">
              <Trash2 size={13} /> Clear read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] py-2">No notifications yet. Reminders appear here 3 days, 1 day, 3 hours and 1 hour before a deadline, when it is due, and while it is overdue.</p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-center gap-2.5 border-2 rounded-lg px-3 py-2 transition-colors ${
                    n.read ? "border-[var(--border-primary)] bg-[var(--bg-secondary)] opacity-70" : "border-[var(--accent-primary)]/50 bg-[var(--bg-secondary)]"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${n.read ? "bg-transparent" : "bg-[var(--accent-primary)]"}`} />
                  <button type="button" onClick={() => { markRead(n.id); navigateTo("tasks"); }} className="flex-1 text-left min-w-0">
                    <span className="block text-sm text-[var(--text-primary)] truncate">{n.message}</span>
                    <span className="block text-xs text-[var(--text-secondary)]">{timeAgo(n.createdAt, now)}</span>
                  </button>
                  {!n.read && (
                    <button type="button" aria-label="Mark as read" onClick={() => markRead(n.id)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"><Check size={15} /></button>
                  )}
                  <button type="button" aria-label="Delete" onClick={() => remove(n.id)} className="p-1 text-[var(--text-secondary)] hover:text-red-500"><X size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NotificationsPanel;
