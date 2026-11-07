# Veyro

**Make every day count.**

Veyro is an all-in-one productivity app: Pomodoro and study timers, Kanban tasks, calendar, stats, notes and habits.

Veyro is made to **run locally with no account, no keys and no hosting**.

## Features and changes

- **Works offline with no login.** Without Supabase keys the app uses a small built-in database stored in your browser and signs you in automatically as a local user (`src/utils/localSupabase.ts`). Tasks, workspaces and sessions all work.
- **Task status is saved.** In Progress and On Hold no longer jump back to To Do after a reload.
- **Due-task reminders and a Notifications tab.** Reminders go out 3 days, 1 day, 3 hours and 1 hour before a deadline, when it is due, and every 6 hours while overdue (only while the app is open in a tab). Popups are spaced 5 seconds apart, and a pile-up (for example after being away) becomes one summary popup. Everything is also saved in **Session > Notifications**, which has an *Upcoming* list (overdue and next 7 days) and a *History* list you can mark read or clear. Deadlines without a time count as due at the end of that day. Done tasks never remind.
- **Minimal clock face in full screen and floating windows.** Each timer (Pomodoro, Study, Countdown) has a full-screen button: white digits on black, dot separators, HOURS / MINUTES / SECONDS labels, an "In progress" pill and pill buttons. The normal three-in-a-row panels are unchanged. Esc leaves full screen.
- **Floating windows are just the time.** Pure black, no buttons; a pause/resume button fades in when you hover the window.
- **Separate floating window per timer.** Every timer has its own *Float this timer* button. A running timer keeps running when it moves into the window and when it is docked back. Browsers allow only one always-on-top (Picture-in-Picture) window at a time, so the first timer you float gets that; others open as small normal pop-up windows (allow pop-ups for the site).
- **Clock animations.** The full-screen clock and floating windows use the same digits, drop-in/drop-out animation and "In progress" pill as studiestimer.com (copied from its CSS). Only the digit that changes moves; the colon blinks while running. Reduced-motion users get a plain fade.
- **Study a task.** The Study timer's start window has an "Unfinished Tasks" tab listing all your open tasks (overdue first). Select one and press Start: the timer starts, the task moves to In Progress and the study time is saved against it. Or type a session title and press Start. No second window.
- **Lo-Fi Music in the Noise Generator.** A fourth sound with four sources: built-in generated lo-fi beats (works offline), a local audio file, web radio, and YouTube live streams. Click the sliders icon next to "Lo-Fi Music" to choose. Local mode also now supports profile picture upload.
- **Calendar and holidays refresh.** Merged the newest theme, calendar and holidays work from the test repo (region-filtered holidays, day info modal, Stats updates), then redesigned the calendar header (big month title, compact Export/Add Task, region chip), weekend tint and overdue markers in the month grid, and a new holidays list with date tiles.
- **Indian regional festivals.** Holiday regions now include Marathi, Punjabi, Gujarati, Bengali, Tamil, Telugu, Kannada and Malayali calendars, with pan-India festivals (Diwali, Holi, Ganesh Chaturthi, Eid, Baisakhi and more). Lunar dates are listed for 2026-2027 and may differ by a day. The Holidays tab follows the selected region.
- **Study time by task.** The Analytics page has a *Study time by task* card with today, last 7 days and all-time totals per task.
- **Import changes from AI (Settings > Data).** Copy the AI instructions, tell any AI what to add, change or delete, and paste its SQL-style answer (`INSERT INTO tasks (...) VALUES (...)`, `UPDATE tasks SET ... WHERE id = '...'`, `DELETE FROM tasks WHERE ...`). Veyro checks every statement against its rules (title length, real dates, 24-hour times, weekly repeats, allowed columns) and shows a plan before anything runs. Adds never delete or overwrite, importing the same text twice creates no duplicates, and tasks are only deleted by an explicit `DELETE` that you confirm (UPDATE/DELETE need a `WHERE` on id or title and refuse to touch several tasks by accident). JSON is accepted as a fallback.
- **Backup restore works.** Restore now saves workspaces, tasks and sessions, then reloads the page. Before, it only showed a success message.

## Run it locally

You need Node.js 20 or newer.

```bash
git clone https://github.com/quickjoy1/veyro.git
cd veyro
npm install --legacy-peer-deps
npm run dev
```

Open http://localhost:5173/app. Click anywhere once and allow notifications so reminders can pop up.

Notes for local mode:
- Reminders only fire while the app is open in a browser tab.
- Data lives in this browser only. Clearing site data deletes it, so use Settings to export a backup now and then.
- Google login, friends and sharing, and avatar upload need a real Supabase project and do not work in local mode.
- Optional: to use your own Supabase project, create a `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and restart.

## Keep your local folder in sync with this repo

**Easiest: start from a clone.** If your folder was not created with `git clone` (for example you unzipped a download), connect it to the repo once. This replaces tracked files with the repo version, but leaves `node_modules` and your `.env` alone:

```bash
cd path/to/your/veyro-folder
git init
git remote add origin https://github.com/quickjoy1/veyro.git
git fetch origin
git reset --hard origin/main
git branch --set-upstream-to=origin/main main
npm install --legacy-peer-deps
```

Back up anything you changed by hand before running `git reset --hard`.

**After that, to get new changes from GitHub into your folder:**

```bash
git pull
npm install --legacy-peer-deps   # only needed if package.json changed
```

If you want this to happen without typing, set up a scheduled task (Windows Task Scheduler, or cron on Mac/Linux) that runs `git -C path/to/folder pull` every so often. Git cannot pull on its own without something running it.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app at http://localhost:5173 |
| `npm test` | Run unit tests |
| `npm run type-check` | Check TypeScript types |
| `npm run build` | Production build |

## Credits

Veyro is built on [UniTracker](https://github.com/rickypcyt/unitracker) by [rickypcyt](https://github.com/rickypcyt), used under its open source license. Thanks to the original author for the foundation.
