import { describe, it, expect, vi, beforeEach } from 'vitest';
import { activityApi, activityScheduleApi, activityCompletionRuleApi } from './activity-api';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('activityApi & activityScheduleApi & activityCompletionRuleApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('activityApi', () => {
    it('should fetch activities with correctly formatted url', async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify([{ _id: '60c72b2f9b1e8a001c8e4a50', name: 'Activity 1' }])),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const res = await activityApi.getAll({ semester_id: '60c72b2f9b1e8a001c8e4a52' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/activities?semester_id=60c72b2f9b1e8a001c8e4a52');
      expect(res[0].name).toBe('Activity 1');
    });

    it('should create an activity successfully', async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ _id: '60c72b2f9b1e8a001c8e4a51', name: 'New Activity' })),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const res = await activityApi.create({ name: 'New Activity', code: 'NA' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/activities');
      expect(options?.method).toBe('POST');
      expect(res.name).toBe('New Activity');
    });
  });

  describe('activityScheduleApi', () => {
    it('should fetch schedules with correctly formatted url', async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ items: [], total: 0 })),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const res = await activityScheduleApi.getAll();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/activity-schedules');
      expect(res.items).toEqual([]);
    });
  });

  describe('activityCompletionRuleApi', () => {
    it('should create a completion rule successfully', async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ _id: '60c72b2f9b1e8a001c8e4a53', minimum_attendance: 5 })),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const res = await activityCompletionRuleApi.create({
        club_id: '60c72b2f9b1e8a001c8e4a50',
        semester_id: '60c72b2f9b1e8a001c8e4a52',
        minimum_attendance: 5,
        criterion_ids: ['60c72b2f9b1e8a001c8e4a54'],
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/activity-completion-rules');
      expect(options?.method).toBe('POST');
      expect(res.minimum_attendance).toBe(5);
    });
  });
});
