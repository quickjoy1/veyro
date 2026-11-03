import { useEffect, useState } from 'react';

// Live "What's New": read the latest commits straight from the public GitHub API.
// api.github.com allows browser (CORS) requests, so no backend is needed.
// Unauthenticated calls are limited to 60/hour per IP, so results are cached.

const REPO = (import.meta.env['VITE_GITHUB_REPO'] as string | undefined) || 'quickjoy1/veyro';
const BRANCH = 'main';
const PER_PAGE = 40;
const CACHE_KEY = 'veyroGithubChangelog:v1';
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface GithubCommitEntry {
  sha: string;
  title: string;
  body: string;
  date: string; // ISO
  url: string;
  author: string;
}

export interface GithubChangelogDay {
  day: string; // e.g. "November 3, 2026"
  commits: GithubCommitEntry[];
}

interface GithubApiCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author?: { name?: string; date?: string } | null;
  };
  author?: { login?: string } | null;
  parents?: unknown[];
}

interface CachePayload {
  fetchedAt: number;
  commits: GithubCommitEntry[];
}

const readCache = (): CachePayload | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    return Array.isArray(parsed.commits) ? parsed : null;
  } catch {
    return null;
  }
};

const writeCache = (commits: GithubCommitEntry[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), commits }));
  } catch {
    /* storage unavailable: just skip caching */
  }
};

const toEntry = (c: GithubApiCommit): GithubCommitEntry => {
  const [title = '', ...rest] = c.commit.message.split('\n');
  // Drop trailing attribution trailers (Co-Authored-By, Claude-Session, ...)
  const body = rest
    .filter((line) => !/^(co-authored-by|claude-session|signed-off-by):/i.test(line.trim()))
    .join('\n')
    .trim();
  return {
    sha: c.sha,
    title: title.trim(),
    body,
    date: c.commit.author?.date ?? '',
    url: c.html_url,
    author: c.author?.login ?? c.commit.author?.name ?? '',
  };
};

export const groupCommitsByDay = (commits: GithubCommitEntry[]): GithubChangelogDay[] => {
  const days: GithubChangelogDay[] = [];
  for (const commit of commits) {
    const d = new Date(commit.date);
    const day = Number.isNaN(d.getTime())
      ? 'Unknown date'
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const last = days[days.length - 1];
    if (last && last.day === day) last.commits.push(commit);
    else days.push({ day, commits: [commit] });
  }
  return days;
};

export const useGithubChangelog = (enabled = true) => {
  const cached = typeof window === 'undefined' ? null : readCache();
  const [commits, setCommits] = useState<GithubCommitEntry[]>(cached?.commits ?? []);
  const [loading, setLoading] = useState(enabled && !cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const fresh = readCache();
    if (fresh && Date.now() - fresh.fetchedAt < CACHE_TTL_MS) {
      setCommits(fresh.commits);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`https://api.github.com/repos/${REPO}/commits?sha=${BRANCH}&per_page=${PER_PAGE}`, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(res.status === 403 ? 'GitHub rate limit reached, try again later.' : `GitHub returned ${res.status}.`);
        }
        const data = (await res.json()) as GithubApiCommit[];
        // Skip merge commits: they only repeat what the real commits already say.
        const entries = data.filter((c) => (c.parents?.length ?? 0) < 2).map(toEntry);
        writeCache(entries);
        setCommits(entries);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Could not reach GitHub.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [enabled]);

  return { commits, days: groupCommitsByDay(commits), loading, error, repo: REPO };
};
