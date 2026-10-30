import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Download,
  Github,
  NotebookPen,
  Sparkles,
  Timer,
  WifiOff,
} from 'lucide-react';
import Pomodoro from '@/pages/session/Pomodoro';
import StudyTimer from '@/pages/session/StudyTimer';

const features = [
  {
    icon: Timer,
    title: 'Focus timer',
    desc: 'Custom work/break intervals with sound and notifications.',
    big: true,
  },
  {
    icon: CheckCircle2,
    title: 'Tasks',
    desc: 'Kanban with drag-and-drop, tags, deadlines, and calendar sync.',
  },
  {
    icon: Calendar,
    title: 'Calendar',
    desc: 'Tasks and sessions in one calendar with Google export.',
  },
  {
    icon: BarChart3,
    title: 'Stats',
    desc: 'Track hours, completion, and streaks in clear charts.',
    wide: true,
  },
  {
    icon: NotebookPen,
    title: 'Notes and habits',
    desc: 'Markdown notes for projects plus habit streaks.',
    wide: true,
  },
  {
    icon: Download,
    title: 'Export and backup',
    desc: 'Export CSV, PDF, JSON. Import from Notion, Todoist, Google.',
  },
];

const values = [
  {
    icon: Sparkles,
    title: 'Free',
    desc: 'No ads, subscriptions or paywalls.',
  },
  {
    icon: Github,
    title: 'Open source',
    desc: 'MIT licensed. Audit, fork, or contribute on GitHub.',
  },
  {
    icon: WifiOff,
    title: 'Offline-first',
    desc: 'Works fully offline. Syncs when you reconnect.',
  },
  {
    icon: Download,
    title: 'Your data stays yours',
    desc: 'Export anytime in CSV, PDF, or JSON. No lock-in.',
  },
];

// The one signature moment: a sun that climbs the arc once when the page loads.
const ARC_PATH = 'M -40 470 Q 720 -150 1480 470';
const SUN_AT = 0.7;

const SunriseArc = () => {
  const reduce =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Point on the quadratic curve at t = SUN_AT.
  const t = SUN_AT;
  const x = (1 - t) ** 2 * -40 + 2 * (1 - t) * t * 720 + t ** 2 * 1480;
  const y = (1 - t) ** 2 * 470 + 2 * (1 - t) * t * -150 + t ** 2 * 470;
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[520px] w-full"
      viewBox="0 0 1440 520"
      preserveAspectRatio="xMidYMin slice"
    >
      <defs>
        <radialGradient id="veyro-sun-glow">
          <stop offset="0" stopColor="var(--accent-sun)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--accent-sun)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={ARC_PATH} fill="none" stroke="var(--border-primary)" strokeWidth="1.5" strokeDasharray="2 9" strokeLinecap="round" />
      {reduce ? (
        <g transform={`translate(${x} ${y})`}>
          <circle r="120" fill="url(#veyro-sun-glow)" />
          <circle r="22" fill="var(--accent-sun)" />
        </g>
      ) : (
        <g>
          <circle r="120" fill="url(#veyro-sun-glow)" />
          <circle r="22" fill="var(--accent-sun)" />
          <animateMotion
            dur="2.8s"
            begin="0.2s"
            fill="freeze"
            path={ARC_PATH}
            keyPoints={`0;${SUN_AT}`}
            keyTimes="0;1"
            calcMode="spline"
            keySplines="0.2 0.7 0.2 1"
          />
        </g>
      )}
    </svg>
  );
};

// ─── Real Component Showcase ────────────────────────────────────────────────

const ShowcaseFrame = ({ title, children }: { title: string; children: ReactNode }) => {
  return (
    <div className="rounded-[20px] ring-1 ring-inset ring-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)]">
      <div className="flex items-center gap-2 px-4 h-9 border-b border-[var(--border-secondary)] bg-[var(--bg-tertiary)]">
        <span className="h-2 w-2 rounded-full bg-[var(--accent-sun)]" />
        <span className="text-xs text-[var(--text-secondary)] ml-2 font-mono">Veyro — {title}</span>
      </div>
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

// Resets onboarding flags so entering the app replays welcome → color → login
const startOnboarding = () => {
  try {
    ['hasSeenWelcomeModal', 'hasSeenThemeSelectionModal', 'hasSeenAccentColorModal', 'hasSeenLoginModal']
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
};

const LandingPage = () => {
  return (
    <>
      <Helmet>
        <title>Veyro - Make every day count. | Time & Task Management App</title>
        <meta
          name="description"
          content="Replace 6 apps with one. Pomodoro timer, tasks, calendar, analytics, notes, and habits — all in one free and open source app. Track your time across every area. No ads, no subscriptions."
        />
        <meta
          name="keywords"
          content="free productivity app, pomodoro timer, task manager, time tracker, focus timer, work tracker, kanban board, focus sessions, calendar, analytics, notes, habits"
        />
        <link rel="canonical" href="https://veyro.app/" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://veyro.app/" />
        <meta property="og:title" content="Veyro - Free Time & Task Management App" />
        <meta property="og:description" content="Replace 6 apps with one. Pomodoro timer, tasks, calendar, analytics, notes, and habits — all in one free and open source app." />
        <meta property="og:image" content="https://veyro.app/assets/og-image.png" />
        <meta property="og:site_name" content="Veyro" />
        <meta property="og:locale" content="en_US" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://veyro.app/" />
        <meta name="twitter:title" content="Veyro - Free Time & Task Management App" />
        <meta name="twitter:description" content="Replace 6 apps with one. Pomodoro timer, tasks, calendar, analytics, notes, and habits — all in one free and open source app." />
        <meta name="twitter:image" content="https://veyro.app/assets/og-image.png" />
        <meta name="twitter:site" content="@VeyroApp" />
      </Helmet>

      <style>{`
        @keyframes um-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-um-rise { animation: um-rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }

        /* Shiny button effect */
        .shiny-btn {
          position: relative;
          overflow: hidden;
        }
        .shiny-btn .shine-overlay {
          position: absolute;
          top: 0;
          left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(
            105deg,
            transparent 30%,
            rgba(255, 255, 255, 0.25) 50%,
            transparent 70%
          );
          transition: none;
          pointer-events: none;
        }
        .shiny-btn:hover .shine-overlay {
          animation: shine-sweep 0.9s ease-out;
        }
        @keyframes shine-sweep {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        .shiny-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.3);
          transition: box-shadow 0.4s ease;
          pointer-events: none;
        }
        .shiny-btn:hover::after {
          box-shadow: 0 0 20px 4px rgba(255, 255, 255, 0.1);
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-um-rise, .animate-ping, .shiny-btn .shine-overlay { animation: none !important; }
        }
      `}</style>

      <div
        className="h-screen overflow-y-auto overflow-x-hidden scroll-smooth bg-[var(--bg-primary)] text-[var(--text-primary)]"
      >
        {/* Nav */}
        <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--bg-primary)]/80 border-b border-[var(--border-secondary)]">
          <div className="max-w-7xl mx-auto px-fluid h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img src="/assets/logo.svg" alt="" className="h-8 w-8 rounded-[9px]" />
              <span className="font-heading text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                Veyro
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              <a
                href="https://github.com/quickjoy1/veyro"
                target="_blank"
                rel="noopener"
                className="px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all flex items-center gap-1.5"
              >
                <Github className="w-4 h-4" /> GitHub
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/app"
                className="hidden sm:block text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-3 py-2"
              >
                Log in
              </Link>
              <Link
                to="/app"
                onClick={startOnboarding}
                className="text-sm font-semibold px-4 py-2 rounded-full bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-deep)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] focus-visible:ring-[var(--accent-primary)]"
              >
                Start free
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative overflow-hidden">
          <SunriseArc />
          <div className="relative max-w-7xl mx-auto px-fluid pt-fluid-hero pb-28">
            <h1 className="font-heading font-semibold text-[var(--text-primary)] max-w-4xl text-[clamp(3rem,8.5vw,7rem)] leading-[0.95] mb-10 animate-um-rise">
              Make every day count.
            </h1>
            <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-14 items-start">
              <div className="animate-um-rise" style={{ animationDelay: '100ms' }}>
                <p className="text-fluid-lead text-[var(--text-secondary)] max-w-md mb-9">
                  Veyro keeps your focus timer, tasks, calendar and notes in one calm place, so you can see what today asked of you and what you gave it.
                </p>
                <div className="flex flex-col sm:flex-row items-start gap-3">
                  <Link
                    to="/app"
                    onClick={startOnboarding}
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[var(--accent-primary)] text-white font-semibold text-base hover:bg-[var(--accent-deep)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] focus-visible:ring-[var(--accent-primary)]"
                  >
                    Start your day
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <a
                    href="https://github.com/quickjoy1/veyro"
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full ring-1 ring-inset ring-[var(--border-primary)] font-semibold text-base hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <Github className="w-5 h-5" />
                    View on GitHub
                  </a>
                </div>
                <p className="mt-8 text-sm text-[var(--text-secondary)] max-w-sm">
                  Free and open source. Works offline. Export your data whenever you like.
                </p>
              </div>

              <div className="animate-um-rise" style={{ animationDelay: '220ms' }}>
                <ShowcaseFrame title="Focus timer">
                  <Pomodoro hideHeader />
                </ShowcaseFrame>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-fluid-section border-t border-[var(--border-secondary)]">
          <div className="max-w-7xl mx-auto px-fluid">
            <div className="mb-14 max-w-2xl">
              <h2 className="text-fluid-h2 font-heading font-semibold mb-4">
                Everything your day needs, working together
              </h2>
              <p className="text-fluid-lead text-[var(--text-secondary)]">
                A finished focus session lands on your calendar and in your stats. A task with a deadline shows up where you plan. Nothing to copy across.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f) => (
                <div
                  key={f.title}
                  className={`group rounded-[28px] ring-1 ring-inset ring-[var(--border-secondary)] bg-[var(--bg-secondary)] overflow-hidden flex flex-col hover:ring-[var(--border-primary)] transition-colors duration-200 ${
                    f.big ? 'md:col-span-2' : f.wide ? 'lg:col-span-2' : ''
                  }`}
                >
                  <dl className="p-6">
                    <div className="w-11 h-11 rounded-full bg-[var(--accent-primary)]/12 flex items-center justify-center mb-4">
                      <f.icon className="w-5 h-5 text-[var(--accent-primary)]" />
                    </div>
                    <dt className="text-fluid-h3 font-semibold mb-2">{f.title}</dt>
                    <dd className="text-sm text-[var(--text-secondary)] leading-relaxed">{f.desc}</dd>
                  </dl>
                  {f.big && (
                    <div className="mt-auto px-6 py-4 border-t border-[var(--border-secondary)] flex items-center gap-3 bg-[var(--bg-tertiary)]">
                      <svg width="34" height="34" viewBox="0 0 34 34" className="shrink-0">
                        <circle cx="17" cy="17" r="14" fill="none" stroke="var(--border-primary)" strokeOpacity="0.3" strokeWidth="3" />
                        <circle
                          cx="17" cy="17" r="14" fill="none"
                          stroke="var(--accent-sun)" strokeWidth="3" strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 14}
                          strokeDashoffset={2 * Math.PI * 14 * 0.32}
                          transform="rotate(-90 17 17)"
                        />
                      </svg>
                      <span className="text-sm text-[var(--text-secondary)] font-mono">
                        17:02 remaining
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live demo — Study Timer */}
        <section className="py-fluid-section border-t border-[var(--border-secondary)]">
          <div className="max-w-7xl mx-auto px-fluid">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="lg:order-2">
                <h2 className="text-fluid-h2 font-heading font-semibold mb-4">
                  Every session, logged for you
                </h2>
                <p className="text-fluid-lead text-[var(--text-secondary)]">
                  This is the real study timer from the app, so try it. Finished sessions land on your calendar and in your stats without any typing.
                </p>
              </div>
              <div className="lg:order-1">
                <ShowcaseFrame title="Study Timer">
                  <StudyTimer hideHeader />
                </ShowcaseFrame>
              </div>
            </div>
          </div>
        </section>

        {/* A day with Veyro: a real sequence, so it is drawn as one */}
        <section className="py-fluid-section border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]">
          <div className="max-w-7xl mx-auto px-fluid">
            <div className="mb-14 max-w-2xl">
              <h2 className="text-fluid-h2 font-heading font-semibold mb-4">
                One ordinary day, start to finish
              </h2>
              <p className="text-fluid-lead text-[var(--text-secondary)]">
                Veyro fits around the way you already work.
              </p>
            </div>
            <ol className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
              <span aria-hidden="true" className="hidden md:block absolute left-0 right-0 top-[7px] h-px bg-[var(--border-primary)]" />
              {[
                {
                  time: 'Morning',
                  icon: Calendar,
                  title: "Check what's due today",
                  desc: 'Open the calendar and plan your day in a minute.',
                },
                {
                  time: 'Afternoon',
                  icon: Timer,
                  title: 'Start a focus session',
                  desc: 'The timer logs each session to your calendar as you work.',
                },
                {
                  time: 'Evening',
                  icon: BarChart3,
                  title: 'See where your time went',
                  desc: 'Review tracked hours and pick what comes first tomorrow.',
                },
              ].map((step, i) => (
                <li key={step.time} className="relative pt-8">
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-0 h-[15px] w-[15px] rounded-full ring-4 ring-[var(--bg-secondary)] ${
                      i === 1 ? 'bg-[var(--accent-sun)]' : 'bg-[var(--accent-primary)]'
                    }`}
                  />
                  <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">{step.time}</p>
                  <h3 className="font-heading text-2xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-[var(--text-secondary)] leading-relaxed max-w-xs">{step.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Why Veyro */}
        <section className="py-fluid-section border-t border-[var(--border-secondary)]">
          <div className="max-w-7xl mx-auto px-fluid">
            <div className="mb-14 max-w-2xl">
              <h2 className="text-fluid-h2 font-heading font-semibold mb-4">
                Nothing hidden
              </h2>
              <p className="text-fluid-lead text-[var(--text-secondary)]">
                We don't sell your data, show ads or lock features. The code is public, so you can check.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {values.map((v) => (
                <div
                  key={v.title}
                  className="rounded-[20px] ring-1 ring-inset ring-[var(--border-secondary)] bg-[var(--bg-secondary)] p-6"
                >
                  <div className="w-11 h-11 rounded-full bg-[var(--accent-primary)]/12 flex items-center justify-center mb-4">
                    <v.icon className="w-5 h-5 text-[var(--accent-primary)]" />
                  </div>
                  <h3 className="text-fluid-h3 font-semibold mb-2">{v.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-fluid-section border-t border-[var(--border-secondary)]">
          <div className="max-w-7xl mx-auto px-fluid">
            <div className="relative overflow-hidden rounded-[36px] bg-[var(--accent-deep)] px-8 py-16 sm:px-16 sm:py-20 text-white">
              <span aria-hidden="true" className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[var(--accent-sun)] opacity-90" />
              <div className="relative max-w-xl">
                <h2 className="font-heading text-4xl sm:text-6xl font-semibold leading-[1.02] mb-5">
                  Start today. It takes thirty seconds.
                </h2>
                <p className="text-lg text-white/80 mb-9">
                  No account, no card and no setup. Free and open source.
                </p>
                <Link
                  to="/app"
                  onClick={startOnboarding}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#f6fbf8] text-[#07352b] font-semibold text-lg hover:bg-[#e3f2ea] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--accent-deep)] focus-visible:ring-white"
                >
                  Try Veyro free
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[var(--border-secondary)] py-12">
          <div className="max-w-7xl mx-auto px-fluid">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
              {/* Brand column */}
              <div className="col-span-2 md:col-span-1">
                <Link to="/" className="flex items-center gap-2.5 mb-4">
                  <img src="/assets/logo.svg" alt="" className="h-7 w-7 rounded-[8px]" />
                  <span className="font-heading text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                    Veyro
                  </span>
                </Link>
                <p className="text-sm text-[var(--text-secondary)] max-w-xs">
                  Free, open source time & task management. Your data, your tools, your workflow.
                </p>
                <div className="flex items-center gap-3 mt-4">
                  <a href="https://github.com/quickjoy1/veyro" target="_blank" rel="noopener" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                    <Github className="w-5 h-5" />
                  </a>
                </div>
              </div>

              {/* Product */}
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-3">Product</p>
                <ul className="space-y-2">
                  <li><Link to="/app" onClick={startOnboarding} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Get started</Link></li>
                </ul>
              </div>

              {/* Resources */}
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-3">Resources</p>
                <ul className="space-y-2">
                  <li><a href="https://github.com/quickjoy1/veyro" target="_blank" rel="noopener" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">GitHub</a></li>
                  <li><a href="https://github.com/quickjoy1/veyro/issues" target="_blank" rel="noopener" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Report a bug</a></li>
                  <li><a href="https://github.com/quickjoy1/veyro#readme" target="_blank" rel="noopener" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Documentation</a></li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-3">About</p>
                <ul className="space-y-2">
                  <li><span className="text-sm text-[var(--text-secondary)]">MIT Licensed</span></li>
                  <li><span className="text-sm text-[var(--text-secondary)]">No ads, no tracking</span></li>
                  <li><span className="text-sm text-[var(--text-secondary)]">© 2026 Veyro — Make every day count.</span></li>
                </ul>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
