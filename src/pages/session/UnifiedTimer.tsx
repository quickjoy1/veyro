import { Bell, BellOff, Clock, Flag, GripVertical, LogOut, Maximize2, Minimize2, MoreVertical, PictureInPicture2, RefreshCw, RefreshCwOff, Settings, Timer as TimerIcon, Trash2, Watch } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { openFloatWindow, type FloatHandle } from "@/utils/floatWindow";
import { motion } from "framer-motion";

import Countdown from "./Countdown";
import Pomodoro from "./Pomodoro";
import StudyTimer from "./StudyTimer";
import { useAppStore } from "@/store/appStore";

type TimerId = "study" | "pomodoro" | "countdown";

const TIMER_CONFIG: Record<TimerId, { label: string; icon: typeof Clock; panelClass: string; labelClass: string }> = {
  study: { label: "Study", icon: Clock, panelClass: "timer-panel-study", labelClass: "" },
  pomodoro: { label: "Pomodoro", icon: TimerIcon, panelClass: "timer-panel-pomo", labelClass: "timer-panel-label-pomo" },
  countdown: { label: "Countdown", icon: Watch, panelClass: "timer-panel-countdown", labelClass: "timer-panel-label-countdown" },
};

const UnifiedTimer = ({ isSynced, isRunning }: { isSynced?: boolean; isRunning?: boolean }) => {
  const [showPomodoro, setShowPomodoro] = useState(true);
  const [showCountdown, setShowCountdown] = useState(true);
  const [order, setOrder] = useState<TimerId[]>(["pomodoro", "study", "countdown"]);
  const [draggedId, setDraggedId] = useState<TimerId | null>(null);
  const [dragOverId, setDragOverId] = useState<TimerId | null>(null);
  const dragIdRef = useRef<TimerId | null>(null);
  const [studyMenuOpen, setStudyMenuOpen] = useState(false);

  // ── Full-screen clock (big colourful digits on black) ─────────────────────
  const [fsId, setFsId] = useState<TimerId | null>(null);
  const panelRefs = useRef<Partial<Record<TimerId, HTMLElement | null>>>({});

  const exitFullscreen = useCallback(() => {
    setFsId(null);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  const toggleFullscreen = (id: TimerId) => {
    if (fsId === id) {
      exitFullscreen();
      return;
    }
    setFsId(id);
    // Real browser full screen when available; the CSS overlay covers the page either way
    void panelRefs.current[id]?.requestFullscreen?.().catch(() => {});
  };

  useEffect(() => {
    if (!fsId) return;
    const onChange = () => { if (!document.fullscreenElement) setFsId(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") exitFullscreen(); };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [fsId, exitFullscreen]);

  // ── Floating windows: one per timer ───────────────────────────────────────
  // Each timer lives in a stable "holder" element that is only MOVED between its panel and its
  // floating window. The timer component stays mounted the whole time, so a running timer keeps
  // running (re-creating it in the new window is what used to restart it).
  const [floating, setFloating] = useState<Partial<Record<TimerId, FloatHandle>>>({});
  const [panelHosts, setPanelHosts] = useState<Partial<Record<TimerId, HTMLElement>>>({});
  const floatingRef = useRef(floating);
  floatingRef.current = floating;
  const panelHostsRef = useRef(panelHosts);
  panelHostsRef.current = panelHosts;
  const holders = useRef<Partial<Record<TimerId, HTMLDivElement>>>({});
  const disposers = useRef<Array<() => void>>([]);
  const hostCallbacksRef = useRef<Partial<Record<TimerId, (el: HTMLDivElement | null) => void>>>({});

  const getHolder = useCallback((id: TimerId) => {
    let holder = holders.current[id];
    if (!holder) {
      holder = document.createElement("div");
      holder.className = "timer-holder flex-1 min-h-0 flex flex-col";
      holder.style.position = "relative";
      holders.current[id] = holder;
    }
    return holder;
  }, []);

  // Close floating windows and stop animation observers when leaving the page
  useEffect(() => () => {
    Object.values(floatingRef.current).forEach(h => h?.win.close());
    disposers.current.forEach(d => d());
  }, []);

  const getHostRef = useCallback((id: TimerId) => {
    let cb = hostCallbacksRef.current[id];
    if (!cb) {
      cb = (el) => {
        setPanelHosts(prev => {
          const next = el ?? undefined;
          return prev[id] === next ? prev : { ...prev, [id]: next };
        });
      };
      hostCallbacksRef.current[id] = cb;
    }
    return cb;
  }, []);

  const openFloat = async (id: TimerId) => {
    const existing = floatingRef.current[id];
    if (existing) { existing.win.focus(); return; }
    if (fsId) exitFullscreen();
    // Document Picture-in-Picture allows one window at a time; further timers use normal pop-ups
    const docPipFree = !Object.values(floatingRef.current).some(h => h?.kind === "pip");
    const handle = await openFloatWindow({ id, label: TIMER_CONFIG[id].label, preferDocPip: docPipFree });
    if (!handle) {
      toast.error("Could not open a floating window. Allow pop-ups for this site and try again.");
      return;
    }
    const onGone = () => {
      handle.dispose();
      // Put the timer back on the page right away, before the window's document goes away
      const holder = holders.current[id];
      const back = panelHostsRef.current[id];
      if (holder && back && holder.parentElement !== back) back.appendChild(holder);
      setFloating(prev => {
        if (prev[id] !== handle) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    };
    handle.win.addEventListener("pagehide", onGone);
    setFloating(prev => ({ ...prev, [id]: handle }));
  };

  const dockFloat = (id: TimerId) => floatingRef.current[id]?.win.close();

  // Sync state from store
  const syncPomodoro = useAppStore(s => s.syncSettings.syncPomodoroWithTimer);
  const syncCountdown = useAppStore(s => s.syncSettings.syncCountdownWithTimer);
  const setSyncPomodoro = useAppStore(s => s.setSyncPomodoroWithTimer);
  const setSyncCountdown = useAppStore(s => s.setSyncCountdownWithTimer);

  // Alarm state from localStorage
  const [pomoAlarm, setPomoAlarm] = useState(() => localStorage.getItem("pomodoroAlarmEnabled") !== "false");
  const [countdownAlarm, setCountdownAlarm] = useState(() => localStorage.getItem("countdownAlarmEnabled") !== "false");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("unifiedTimerLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        setShowPomodoro(parsed.showPomodoro ?? true);
        setShowCountdown(parsed.showCountdown ?? false);
        if (Array.isArray(parsed.order)) {
          const DEFAULT_ORDER: TimerId[] = ["pomodoro", "study", "countdown"];
          const savedOrder = parsed.order as TimerId[];
          if (savedOrder.length === 3 && savedOrder[0] === "study" && savedOrder[1] === "pomodoro") {
            setOrder(DEFAULT_ORDER);
          } else {
            setOrder(savedOrder);
          }
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("unifiedTimerLayout", JSON.stringify({ showPomodoro, showCountdown, order }));
  }, [showPomodoro, showCountdown, order]);

  // Listen for alarm state changes from components
  useEffect(() => {
    const handleAlarmUpdate = () => {
      setPomoAlarm(localStorage.getItem("pomodoroAlarmEnabled") !== "false");
      setCountdownAlarm(localStorage.getItem("countdownAlarmEnabled") !== "false");
    };
    window.addEventListener("alarm-state-changed", handleAlarmUpdate);
    return () => window.removeEventListener("alarm-state-changed", handleAlarmUpdate);
  }, []);

  const togglePomoAlarm = () => {
    const newVal = !(localStorage.getItem("pomodoroAlarmEnabled") !== "false");
    localStorage.setItem("pomodoroAlarmEnabled", String(newVal));
    setPomoAlarm(newVal);
    window.dispatchEvent(new CustomEvent("alarm-state-changed"));
  };

  const toggleCountdownAlarm = () => {
    const newVal = !(localStorage.getItem("countdownAlarmEnabled") !== "false");
    localStorage.setItem("countdownAlarmEnabled", String(newVal));
    setCountdownAlarm(newVal);
    window.dispatchEvent(new CustomEvent("alarm-state-changed"));
  };

  const openPomoSettings = () => window.dispatchEvent(new CustomEvent("pomodoro-open-settings"));
  const openStudySettings = () => window.dispatchEvent(new CustomEvent("study-open-settings"));

  const visibleTimers = order.filter(id =>
    id === "study" || (id === "pomodoro" && showPomodoro) || (id === "countdown" && showCountdown)
  );

  // Move each timer's holder into its current home: the floating window if it has one, else its panel
  useEffect(() => {
    visibleTimers.forEach(id => {
      const holder = getHolder(id);
      const target = floating[id]?.host ?? panelHosts[id];
      if (target && holder.parentElement !== target) target.appendChild(holder);
    });
  });

  const handleDragStart = (id: TimerId) => {
    setDraggedId(id);
    dragIdRef.current = id;
  };

  const handleDragOver = (e: React.DragEvent, id: TimerId) => {
    e.preventDefault();
    if (dragIdRef.current && dragIdRef.current !== id) {
      setDragOverId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: TimerId) => {
    e.preventDefault();
    const sourceId = dragIdRef.current;
    if (!sourceId || sourceId === targetId) return;

    setOrder(prev => {
      const newOrder = [...prev];
      const sourceIdx = newOrder.indexOf(sourceId);
      const targetIdx = newOrder.indexOf(targetId);
      if (sourceIdx === -1 || targetIdx === -1) return prev;
      newOrder.splice(sourceIdx, 1);
      newOrder.splice(targetIdx, 0, sourceId);
      return newOrder;
    });

    setDraggedId(null);
    setDragOverId(null);
    dragIdRef.current = null;
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    dragIdRef.current = null;
  };

  const renderTimer = (id: TimerId) => {
    if (id === "study") return <StudyTimer {...(isSynced !== undefined ? { isSynced } : {})} hideHeader />;
    if (id === "pomodoro") return <Pomodoro hideHeader />;
    if (id === "countdown") return <Countdown {...(isSynced !== undefined ? { isSynced } : {})} {...(isRunning !== undefined ? { isRunning } : {})} hideHeader />;
    return null;
  };

  const renderActions = (id: TimerId) => {
    if (floating[id]) {
      return (
        <button
          onClick={() => dockFloat(id)}
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors"
          aria-label="Dock timer back" title="Dock this timer back"
        >
          <Minimize2 size={18} />
        </button>
      );
    }
    if (id === "study") {
      const menuItem = "w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors text-left";
      const itemIcon = "text-[var(--text-secondary)]";
      return (
        <div className="relative">
          <button
            onClick={() => setStudyMenuOpen(v => !v)}
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors"
            aria-label="Session menu" title="Session menu" aria-expanded={studyMenuOpen} aria-haspopup="menu"
          >
            <MoreVertical size={18} />
          </button>
          {studyMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setStudyMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full z-50 mt-1 w-44 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-lg" role="menu">
                <button
                  onClick={() => { window.dispatchEvent(new CustomEvent("study-add-lap")); setStudyMenuOpen(false); }}
                  className={menuItem} role="menuitem"
                >
                  <Flag size={15} className="text-[var(--accent-primary)]" /> Add lap note
                </button>
                <button
                  onClick={() => { openStudySettings(); setStudyMenuOpen(false); }}
                  className={menuItem} role="menuitem"
                >
                  <Settings size={15} className={itemIcon} /> Session options
                </button>
                <div className="my-1 border-t border-[var(--border-primary)]" />
                <button
                  onClick={() => { window.dispatchEvent(new CustomEvent("study-exit-session")); setStudyMenuOpen(false); }}
                  className={menuItem} role="menuitem"
                >
                  <LogOut size={15} className={itemIcon} /> Exit session
                </button>
                <button
                  onClick={() => { window.dispatchEvent(new CustomEvent("study-delete-session")); setStudyMenuOpen(false); }}
                  className={`${menuItem} !text-red-500`} role="menuitem"
                >
                  <Trash2 size={15} /> Delete session
                </button>
              </div>
            </>
          )}
        </div>
      );
    }
    if (id === "pomodoro") {
      return (
        <>
          <button type="button" onClick={() => setSyncPomodoro(!syncPomodoro)} className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors" aria-label="Toggle sync" title={syncPomodoro ? "Sync ON" : "Sync OFF"}>
            {syncPomodoro ? <RefreshCw size={18} className="text-red-500" /> : <RefreshCwOff size={18} className="text-[var(--text-secondary)]" />}
          </button>
          <button onClick={openPomoSettings} className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors" aria-label="Configure pomodoro" title="Options">
            <MoreVertical size={18} />
          </button>
          <button onClick={togglePomoAlarm} className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors" title={pomoAlarm ? "Disable alarm" : "Enable alarm"} aria-label="Toggle alarm">
            {pomoAlarm ? <Bell size={18} /> : <BellOff size={18} />}
          </button>
        </>
      );
    }
    if (id === "countdown") {
      return (
        <>
          <button type="button" onClick={() => setSyncCountdown(!syncCountdown)} className="p-1.5 rounded-md hover:bg-green-500/10 transition-colors" aria-label="Toggle sync" title={syncCountdown ? "Sync ON" : "Sync OFF"}>
            {syncCountdown ? <RefreshCw size={18} className="text-green-500" /> : <RefreshCwOff size={18} className="text-[var(--text-secondary)]" />}
          </button>
          <button onClick={toggleCountdownAlarm} className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors" title={countdownAlarm ? "Disable alarm" : "Enable alarm"} aria-label="Toggle alarm">
            {countdownAlarm ? <Bell size={18} /> : <BellOff size={18} />}
          </button>
        </>
      );
    }
    return null;
  };

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Timer Panels */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-2 w-full grid-cols-1 lg:grid-cols-[repeat(2,minmax(0,1fr))] xl:grid-cols-[repeat(3,minmax(0,1fr))] lg:[&>*:nth-child(3)]:col-span-2 lg:[&>*:nth-child(3)]:justify-self-center lg:[&>*:nth-child(3)]:max-w-[24rem] xl:[&>*:nth-child(3)]:col-span-1 xl:[&>*:nth-child(3)]:max-w-none"
      >
        {visibleTimers.map(id => {
          const config = TIMER_CONFIG[id];
          const Icon = config.icon;
          return (
            <motion.div
              variants={item}
              key={id}
              ref={(el: HTMLDivElement | null) => { panelRefs.current[id] = el; }}
              draggable={fsId === null}
              onDragStart={() => handleDragStart(id)}
              onDragOver={(e) => handleDragOver(e, id)}
              onDrop={(e) => handleDrop(e, id)}
              onDragEnd={handleDragEnd}
              className={`timer-panel w-full h-72 ${config.panelClass} ${
                fsId === id ? `timer-panel-fs timer-panel-fs-${id}` : ""
              } ${
                draggedId === id ? "timer-panel-dragging" : ""
              } ${
                dragOverId === id ? "timer-panel-drag-over" : ""
              }`}
            >
              <div className={`timer-panel-label ${config.labelClass}`}>
                <GripVertical size={16} className="opacity-40 cursor-grab" />
                <Icon size={18} />
                <span>{config.label}</span>
                <div className="flex items-center gap-0.5 ml-auto">
                  {!floating[id] && (
                    <button
                      onClick={() => openFloat(id)}
                      className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors"
                      aria-label="Float this timer" title="Float this timer in its own window"
                    >
                      <PictureInPicture2 size={18} />
                    </button>
                  )}
                  {!floating[id] && (
                    <button
                      onClick={() => toggleFullscreen(id)}
                      className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors"
                      aria-label={fsId === id ? "Exit full screen" : "Full screen clock"} title={fsId === id ? "Exit full screen (Esc)" : "Full screen clock"}
                    >
                      {fsId === id ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                  )}
                  {renderActions(id)}
                </div>
              </div>
              <div ref={getHostRef(id)} className={floating[id] ? "hidden" : "flex-1 min-h-0 flex flex-col"} />
              {floating[id] ? (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
                  <PictureInPicture2 size={18} />
                  <span>Floating</span>
                  <button
                    onClick={() => dockFloat(id)}
                    className="timer-ctrl-btn"
                    aria-label="Dock timer back" title="Dock this timer back"
                  >
                    <Minimize2 size={16} />
                  </button>
                </div>
              ) : null}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Each timer is rendered once, into its holder, and the holder is moved between panel and window */}
      {visibleTimers.map(id => createPortal(renderTimer(id), getHolder(id), id))}
    </div>
  );
};

export default UnifiedTimer;
