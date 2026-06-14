export function resolveDrlScore(summaryLike: any): number | null {
  if (!summaryLike) return null;
  const raw = summaryLike.total_score ?? summaryLike.score;
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
}
