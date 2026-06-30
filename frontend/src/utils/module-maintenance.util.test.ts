import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getModuleIdByPath, getMaintenanceStatesWithCache } from './module-maintenance.util';
import { systemApi } from '@/api/system-api';

vi.mock('@/api/system-api', () => ({
  systemApi: {
    getModuleMaintenanceStates: vi.fn(),
  },
}));

describe('module-maintenance.util', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getModuleIdByPath', () => {
    it('should map standard paths to their module ids', () => {
      expect(getModuleIdByPath('/students/tasks')).toBe('events');
      expect(getModuleIdByPath('/tasks')).toBe('events');
      expect(getModuleIdByPath('/students/record')).toBe('attendance');
      expect(getModuleIdByPath('/students')).toBe('sv-profile');
      expect(getModuleIdByPath('/grading')).toBe('grading');
      expect(getModuleIdByPath('/grading/score')).toBe('grading');
      expect(getModuleIdByPath('/grading/categories')).toBe('grading');
      expect(getModuleIdByPath('/dormitory')).toBe('dormitory');
      expect(getModuleIdByPath('/club')).toBe('club');
    });

    it('should normalize trailing slashes', () => {
      expect(getModuleIdByPath('/students/tasks/')).toBe('events');
      expect(getModuleIdByPath('/grading/score/')).toBe('grading');
      expect(getModuleIdByPath('/club/')).toBe('club');
    });

    it('should strip query parameters and hash anchors', () => {
      expect(getModuleIdByPath('/students/tasks?taskId=123&test=1')).toBe('events');
      expect(getModuleIdByPath('/grading/score?taskId=456#anchor')).toBe('grading');
      expect(getModuleIdByPath('/club#section-1')).toBe('club');
      expect(getModuleIdByPath('/students/record/?date=today')).toBe('attendance');
    });

    it('should return null for unmatched paths', () => {
      expect(getModuleIdByPath('/unknown-path')).toBeNull();
      expect(getModuleIdByPath('')).toBeNull();
    });
  });

  describe('getMaintenanceStatesWithCache', () => {
    it('should call systemApi.getModuleMaintenanceStates and cache results', async () => {
      const mockStates = { events: true, grading: false };
      vi.mocked(systemApi.getModuleMaintenanceStates).mockResolvedValue({
        states: mockStates,
      });

      // First call
      const res1 = await getMaintenanceStatesWithCache();
      expect(res1).toEqual(mockStates);
      expect(systemApi.getModuleMaintenanceStates).toHaveBeenCalledTimes(1);

      // Second call (should hit cache)
      const res2 = await getMaintenanceStatesWithCache();
      expect(res2).toEqual(mockStates);
      expect(systemApi.getModuleMaintenanceStates).toHaveBeenCalledTimes(1);
    });

    it('should refetch after cache TTL expires', async () => {
      const mockStates1 = { events: true };
      const mockStates2 = { events: false };
      vi.mocked(systemApi.getModuleMaintenanceStates)
        .mockResolvedValueOnce({ states: mockStates1 })
        .mockResolvedValueOnce({ states: mockStates2 });

      // First call
      await getMaintenanceStatesWithCache();
      expect(systemApi.getModuleMaintenanceStates).toHaveBeenCalledTimes(1);

      // Advance time by 6 seconds (TTL is 5s)
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6000);

      // Second call (should refetch)
      const res = await getMaintenanceStatesWithCache();
      expect(res).toEqual(mockStates2);
      expect(systemApi.getModuleMaintenanceStates).toHaveBeenCalledTimes(2);

      vi.restoreAllMocks();
    });
  });
});
