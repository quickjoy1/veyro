export const getDifficultyColor = (difficulty?: string) => {
  switch (difficulty?.toLowerCase()) {
    case 'easy':
      return 'text-[#00FF41]';
    case 'medium':
      return 'text-[var(--accent-primary)]';
    case 'hard':
      return 'text-[#FF003C]';
    default:
      return 'text-neutral-400';
  }
};

export const difficultyOptions = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];


