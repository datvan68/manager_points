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

    it('should fetch activity timeline with correctly formatted url', async () => {
      const mockTimeline = {
        viewer_mode: 'student',
        timezone: 'Asia/Ho_Chi_Minh',
        items: [
          {
            _id: 's1',
            title: 'Schedule 1',
            start_time: '2026-07-06T10:00:00Z',
            end_time: '2026-07-06T12:00:00Z',
            is_today: false,
            is_active: false,
            my_attendance: null,
            status: 'scheduled',
          },
          {
            _id: 's2',
            title: 'Schedule 2',
            start_time: '2026-07-13T10:00:00Z',
            end_time: '2026-07-13T12:00:00Z',
            is_today: true,
            is_active: true,
            my_attendance: null,
            status: 'scheduled',
          }
        ]
      };
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify(mockTimeline)),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const res = await activityScheduleApi.getActivityTimeline('activity-123');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/activity-schedules/activity/activity-123/timeline');
      expect(url).not.toContain('/club/');
      expect(res).toEqual(mockTimeline);
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
