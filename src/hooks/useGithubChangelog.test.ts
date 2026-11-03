import { describe, expect, it } from 'vitest';
import { groupCommitsByDay, type GithubCommitEntry } from '@/hooks/useGithubChangelog';

const commit = (sha: string, date: string): GithubCommitEntry => ({
  sha,
  title: `commit ${sha}`,
  body: '',
  date,
  url: `https://github.com/x/y/commit/${sha}`,
  author: 'a',
});

describe('groupCommitsByDay', () => {
  it('groups consecutive commits from the same day and keeps order', () => {
    const days = groupCommitsByDay([
      commit('a', '2026-11-03T10:00:00'),
      commit('b', '2026-11-03T08:00:00'),
      commit('c', '2026-11-01T12:00:00'),
    ]);
    expect(days).toHaveLength(2);
    expect(days[0]?.commits.map((c) => c.sha)).toEqual(['a', 'b']);
    expect(days[1]?.commits.map((c) => c.sha)).toEqual(['c']);
  });

  it('handles an invalid date without throwing', () => {
    const days = groupCommitsByDay([commit('a', 'nope')]);
    expect(days[0]?.day).toBe('Unknown date');
  });
});
