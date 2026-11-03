import { ExternalLink, Loader2 } from 'lucide-react';
import { useGithubChangelog } from '@/hooks/useGithubChangelog';

interface GithubChangelogProps {
  /** Rendered when GitHub can't be reached and nothing is cached. */
  fallback: React.ReactNode;
}

const GithubChangelog = ({ fallback }: GithubChangelogProps) => {
  const { commits, days, loading, error, repo } = useGithubChangelog();

  if (loading && commits.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--text-secondary)]" role="status">
        <Loader2 size={16} className="animate-spin" />
        Loading latest changes from GitHub…
      </div>
    );
  }

  if (commits.length === 0) {
    return <>{fallback}</>;
  }

  return (
    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <span>Live from GitHub{error ? ' (showing saved copy)' : ''}</span>
        <a
          href={`https://github.com/${repo}/commits/main`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]"
        >
          {repo} <ExternalLink size={12} />
        </a>
      </div>

      {days.map(({ day, commits: dayCommits }) => (
        <div key={day} className="border border-[var(--border-primary)] rounded-lg p-4 bg-[var(--bg-secondary)]/30">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{day}</h4>
          <ul className="space-y-3">
            {dayCommits.map((c) => (
              <li key={c.sha} className="text-sm">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                >
                  {c.title}
                </a>
                {c.body && (
                  <p className="mt-1 whitespace-pre-line text-[var(--text-secondary)]">{c.body}</p>
                )}
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  <code>{c.sha.slice(0, 7)}</code>
                  {c.author ? ` · ${c.author}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default GithubChangelog;
