export const getCongratsStorageKey = (userId: string, summaryId: string, lockedAt?: string) =>
  `congrats_shown_${userId}_${summaryId}_${lockedAt || 'locked'}`;
