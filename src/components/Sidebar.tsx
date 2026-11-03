import { BarChart3, BookOpen, Calendar, CheckCircle2, Clock, Menu, Notebook, Settings, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigation } from '@/navbar/NavigationContext';

const navItems = [
  { page: 'session', label: 'Study', icon: Clock },
  { page: 'tasks', label: 'Tasks', icon: CheckCircle2 },
  { page: 'calendar', label: 'Planning', icon: Calendar },
  { page: 'analytics', label: 'Analytics', icon: BarChart3 },
  { page: 'habits', label: 'Journal', icon: Notebook },
  { page: 'notes', label: 'Notes', icon: BookOpen },
] as const;

// ─── Day progress ────────────────────────────────────────────────────────────
// A small sun that shows how much of today has passed. It ties the navigation
// to the idea behind the app: make every day count.

const getDayProgress = (now: Date) => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const elapsed = now.getTime() - start.getTime();
  const total = 24 * 60 * 60 * 1000;
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const leftMin = Math.max(0, Math.round((total - elapsed) / 60000));
  return { pct, leftLabel: `${Math.floor(leftMin / 60)}h ${leftMin % 60}m left` };
};

const useDayProgress = () => {
  const [state, setState] = useState(() => getDayProgress(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setState(getDayProgress(new Date())), 60000);
    return () => window.clearInterval(id);
  }, []);
  return state;
};

const RING_R = 12;
const RING_C = 2 * Math.PI * RING_R;

const DayProgress = () => {
  const { pct, leftLabel } = useDayProgress();
  const label = `${Math.round(pct)}% of today has passed, ${leftLabel}`;
  return (
    <div className="flex h-12 items-center gap-3 px-[11px]" title={label} aria-label={label} role="img">
      <svg width="30" height="30" viewBox="0 0 30 30" className="shrink-0" aria-hidden="true">
        <circle cx="15" cy="15" r={RING_R} fill="none" stroke="var(--border-primary)" strokeWidth="3" />
        <circle
          cx="15"
          cy="15"
          r={RING_R}
          fill="none"
          stroke="var(--accent-sun)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - pct / 100)}
          transform="rotate(-90 15 15)"
        />
      </svg>
      <div className="min-w-0 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/dock:opacity-100 group-focus-within/dock:opacity-100">
        <p className="text-sm font-semibold leading-tight text-[var(--text-primary)]">{Math.round(pct)}% of today</p>
        <p className="text-xs leading-tight text-[var(--text-secondary)]">{leftLabel}</p>
      </div>
    </div>
  );
};

// ─── Desktop dock ────────────────────────────────────────────────────────────

interface SidebarContentProps {
  activePage: string;
  navigateTo: (page: any) => void;
  openSettings: () => void;
}

const labelClass =
  'whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover/dock:opacity-100 group-focus-within/dock:opacity-100';

const SidebarContent = ({ activePage, navigateTo, openSettings }: SidebarContentProps) => {
  return (
    <>
      <div className="flex h-16 items-center gap-3 px-[11px]">
        <img
          src="/assets/logo.svg"
          alt=""
          className="h-9 w-9 shrink-0 select-none rounded-[10px] shadow-[0_4px_14px_-4px_var(--accent-primary)]"
        />
        <div className="min-w-0 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/dock:opacity-100 group-focus-within/dock:opacity-100">
          <p className="font-heading text-lg font-semibold leading-none text-[var(--text-primary)]">Veyro</p>
          <p className="mt-1 text-[11px] leading-none text-[var(--text-secondary)]">Make every day count.</p>
        </div>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-2 py-2">
        {navItems.map(({ page, label, icon: Icon }) => {
          const isActive = activePage === page;

          return (
            <button
              key={page}
              onClick={() => navigateTo(page)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              title={label}
              className={`relative flex h-11 w-full items-center gap-3 rounded-xl px-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                isActive
                  ? 'bg-[var(--accent-primary)] text-white shadow-[0_6px_18px_-6px_var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} className="shrink-0" />
              <span className={labelClass}>{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mx-3 border-t border-[var(--border-secondary)]" />
      <DayProgress />

      <div className="px-2 pb-2">
        <button
          onClick={openSettings}
          aria-label="Settings"
          title="Settings"
          className="flex h-11 w-full items-center gap-3 rounded-xl px-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
        >
          <Settings size={20} strokeWidth={1.75} className="shrink-0" />
          <span className={labelClass}>Settings</span>
        </button>
      </div>
    </>
  );
};

// ─── Mobile / tablet top bar ─────────────────────────────────────────────────

const TopBar = () => {
  const { activePage, navigateTo, openSettings } = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleNavigate = (page: any) => {
    navigateTo(page);
    setMenuOpen(false);
  };

  return (
    <div className="lg:hidden fixed top-0 inset-x-0 h-14 z-[10000] bg-[var(--bg-primary)] border-b border-[var(--border-secondary)] flex items-center px-3 gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <img src="/assets/logo.svg" alt="" className="h-8 w-8 select-none rounded-[9px]" />
        <span className="font-heading text-lg font-semibold text-[var(--text-primary)]">Veyro</span>
      </div>

      {/* md: centered section nav */}
      <nav aria-label="Main" className="hidden md:flex flex-1 items-center justify-center gap-1">
        {navItems.map(({ page, label, icon: Icon }) => (
          <button
            key={page}
            onClick={() => handleNavigate(page)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
              activePage === page
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title={label}
            aria-label={label}
            aria-current={activePage === page ? 'page' : undefined}
          >
            <Icon size={18} className="flex-shrink-0" />
            <span className="hidden min-[880px]:inline leading-none">{label}</span>
          </button>
        ))}
      </nav>

      <div className="ml-auto md:ml-0 flex items-center gap-1">
        <button
          onClick={openSettings}
          className="hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>

        {/* sm: hamburger -> menu */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="md:hidden flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen && (
        <>
          <div className="md:hidden fixed inset-x-0 bottom-0 top-14 z-[9999] bg-black/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="md:hidden absolute left-2 right-2 top-[calc(100%+8px)] z-[10001] rounded-3xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
            <nav aria-label="Main" className="grid grid-cols-2 gap-1.5">
              {navItems.map(({ page, label, icon: Icon }) => {
                const isActive = activePage === page;
                return (
                  <button
                    key={page}
                    onClick={() => handleNavigate(page)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    <Icon size={20} className="flex-shrink-0" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
            <button
              onClick={() => {
                openSettings();
                setMenuOpen(false);
              }}
              className="mt-1.5 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
            >
              <Settings size={20} className="flex-shrink-0" />
              <span>Settings</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const Sidebar = () => {
  const { activePage, navigateTo, openSettings } = useNavigation();

  return (
    <>
      <TopBar />
      {/* Collapsed to icons; expands over the page on hover or keyboard focus. */}
      <aside className="group/dock fixed bottom-3 left-3 top-3 z-40 hidden w-[60px] flex-col overflow-hidden rounded-[22px] border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-[0_10px_40px_-18px_rgba(0,0,0,0.45)] transition-[width,box-shadow] duration-300 ease-out hover:w-[232px] hover:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] focus-within:w-[232px] lg:flex motion-reduce:transition-none">
        <SidebarContent activePage={activePage} navigateTo={navigateTo} openSettings={openSettings} />
      </aside>
    </>
  );
};

export default Sidebar;
