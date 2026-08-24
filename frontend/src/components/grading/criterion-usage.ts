import { Criterion } from '@/api/criteria-api';

export const CRITERION_USAGE_STORAGE_KEY_PREFIX = 'criterion-usage:';

export type CriterionUsage = Record<string, number>;

export function getCriterionUsageStorageKey(userId?: string | null): string | null {
  return userId ? `${CRITERION_USAGE_STORAGE_KEY_PREFIX}${userId}` : null;
}

export function readCriterionUsage(userId?: string | null): CriterionUsage {
  const key = getCriterionUsageStorageKey(userId);
  if (!key || typeof window === 'undefined') return {};

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.entries(parsed).reduce<CriterionUsage>((usage, [criterionId, count]) => {
      if (typeof criterionId === 'string' && Number.isInteger(count) && count >= 0) {
        usage[criterionId] = count;
      }
      return usage;
    }, {});
  } catch {
    return {};
  }
}

export function incrementCriterionUsage(userId: string | null | undefined, criterionId: string): CriterionUsage {
  const key = getCriterionUsageStorageKey(userId);
  if (!key || typeof window === 'undefined') return {};

  const usage = readCriterionUsage(userId);
  usage[criterionId] = (usage[criterionId] || 0) + 1;

  try {
    window.localStorage.setItem(key, JSON.stringify(usage));
  } catch {
    // Storage can be unavailable; the selection itself must still work.
  }

  return usage;
}

export function orderCriteriaByUsage(criteria: Criterion[], usage: CriterionUsage): {
  frequent: Criterion[];
  remaining: Criterion[];
} {
  const ranked = criteria
    .map((criterion, index) => ({ criterion, index, count: usage[criterion._id] || 0 }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count || a.index - b.index);
  const frequentIds = new Set(ranked.slice(0, 3).map(item => item.criterion._id));

  return {
    frequent: ranked.slice(0, 3).map(item => item.criterion),
    remaining: criteria.filter(criterion => !frequentIds.has(criterion._id)),
  };
}
