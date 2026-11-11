import { describe, expect, it } from 'vitest';

import { paceHint, readinessFor, subjectScore } from '@/utils/examReadiness';

describe('subjectScore', () => {
  it('matches the subject word inside a long exam title', () => {
    expect(subjectScore('CBSE Class 12 Board: Physics (042)', 'Physics')).toBeGreaterThan(0);
    expect(subjectScore('Maths Unit Test', 'Maths')).toBeGreaterThan(0);
  });

  it('understands short forms and spellings', () => {
    expect(subjectScore('CBSE Class 12 Board: Mathematics (041)', 'Maths')).toBeGreaterThan(0);
    expect(subjectScore('CBSE Class 12 Board: Artificial Intelligence (843)', 'AI')).toBeGreaterThan(0);
    expect(subjectScore('CBSE Class 12 Board: Computer Science (083)', 'CS')).toBeGreaterThan(0);
    expect(subjectScore('Chemistry Viva', 'Chem')).toBeGreaterThan(0);
  });

  it('does not match on filler words or numbers', () => {
    expect(subjectScore('CBSE Class 12 Board: Physics (042)', 'Class 12 Chemistry')).toBe(0);
    expect(subjectScore('Maths Unit Test', 'Unit Test')).toBe(0);
    expect(subjectScore('English Mock', 'Physics')).toBe(0);
  });
});

describe('readinessFor', () => {
  const tasks = [
    { assignment: 'Physics', completed: true },
    { assignment: 'physics', completed: false },
    { assignment: 'Physics', completed: false },
    { assignment: 'Physics', completed: false },
    { assignment: 'Chemistry', completed: true },
    { assignment: '', completed: true },
    { assignment: null, completed: false },
  ];

  it('counts done and remaining tasks of the matching subject, ignoring case', () => {
    expect(readinessFor('CBSE Physics Exam', tasks)).toEqual({ subject: 'Physics', total: 4, done: 1, remaining: 3, percent: 25 });
  });

  it('returns null when nothing matches', () => {
    expect(readinessFor('Dentist visit', tasks)).toBeNull();
    expect(readinessFor('Physics Exam', [])).toBeNull();
  });
});

describe('paceHint', () => {
  it('describes how fast the rest has to go', () => {
    expect(paceHint(12, 98)).toBe('1 task every 8 days');
    expect(paceHint(3, 5)).toBe('1 task every 2 days');
    expect(paceHint(3, 1)).toBe('3 tasks a day');
    expect(paceHint(1, 1)).toBe('1 task a day');
    expect(paceHint(4, 0)).toBe('4 left today');
    expect(paceHint(0, 30)).toBe('All done');
  });
});
