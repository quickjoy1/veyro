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

  const MAX_UPCOMING = 5;
  const shown = upcoming.slice(0, MAX_UPCOMING);
  const hidden = upcoming.length - shown.length;
  const overdueCount = upcoming.filter((u) => u.dueMs < now).length;

  const tabBtn = (id: Tab, label: string, badge?: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-all ${
        tab === id
          ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      }`}
    >
      {label}
      {badge ? <span className="min-w-[1.125rem] px-1 rounded-full text-[11px] leading-[1.125rem] text-center font-semibold bg-red-500 text-white">{badge}</span> : null}
    </button>
  );

  const ghostBtn = "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--text-secondary)]";

  // The surrounding card is drawn by the page; this block is just the content.
  return (
    <section className="p-4 sm:p-5 flex flex-col gap-3" data-tour="session-notifications" aria-label="Notifications">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <BellRing size={16} className="text-[var(--accent-primary)]" />
        <h2 className="font-semibold text-[var(--text-primary)] text-base">Notifications</h2>
        <div role="tablist" aria-label="Notification views" className="flex gap-0.5 p-0.5 rounded-lg bg-[var(--bg-secondary)]">
          {tabBtn("upcoming", "Upcoming", overdueCount || undefined)}
          {tabBtn("history", "History", unread || undefined)}
        </div>
        <div className="ml-auto flex items-center">
          {perm === "granted" ? (
            <button type="button" onClick={sendTest} className={ghostBtn} title="Send a test notification">
              <Bell size={14} /> Test
            </button>
          ) : perm === "unsupported" ? (
            <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1" title="This browser does not support desktop alerts"><BellOff size={14} /> Not supported</span>
          ) : perm === "denied" ? (
            <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1" title="Desktop alerts are blocked in your browser's site settings"><BellOff size={14} /> Alerts blocked</span>
          ) : (
            <button type="button" onClick={enable} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity">
              <Bell size={14} /> Enable alerts
            </button>
          )}
        </div>
      </div>

      {tab === "upcoming" ? (
        upcoming.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] py-1">Nothing due in the next 7 days. Add a deadline to a task and it shows up here.</p>
        ) : (
          <ul className="flex flex-col -mx-2" role="list">
            {shown.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => navigateTo("tasks")}
                  className="w-full flex items-center gap-3 text-left rounded-lg px-2 py-2 hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <span className="text-sm text-[var(--text-primary)] truncate flex-1">{u.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${u.tier ? TIER_STYLE[u.tier] : NEUTRAL}`}>{formatDue(u.dueMs, now)}</span>
                </button>
              </li>
            ))}
            {hidden > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo("tasks")}
                  className="w-full text-left rounded-lg px-2 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  +{hidden} more in Tasks
                </button>
              </li>
            )}
          </ul>
        )
      ) : (
        <>
          <div className="flex gap-1">
            <button type="button" onClick={markAllRead} disabled={!unread} className={ghostBtn}>
              <Check size={13} /> Mark all read
            </button>
            <button type="button" onClick={clearRead} disabled={items.every((i) => !i.read)} className={`${ghostBtn} hover:!text-red-500`}>
              <Trash2 size={13} /> Clear read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] py-1">No notifications yet. Reminders appear here 3 days, 1 day, 3 hours and 1 hour before a deadline, when it is due, and while it is overdue.</p>
          ) : (
            <ul className="flex flex-col -mx-2 max-h-64 overflow-y-auto" role="list">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-[var(--bg-secondary)] transition-colors ${n.read ? "opacity-60" : ""}`}
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
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};

export default NotificationsPanel;
