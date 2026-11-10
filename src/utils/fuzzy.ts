/** Every word of the query must appear in the text. Returns a score (lower is better) or null. */
export const fuzzy = (query: string, text: string): number | null => {
  const t = text.toLowerCase();
  let score = 0;
  for (const word of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    const at = t.indexOf(word);
    if (at === -1) return null;
    // words that start a word rank better than matches in the middle of one
    score += at === 0 || /[\s(\-/]/.test(t.charAt(at - 1)) ? at : at + 30;
  }
  return score;
};
