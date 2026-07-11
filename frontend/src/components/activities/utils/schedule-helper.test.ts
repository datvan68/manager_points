import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getClubScheduleSummary, getStartOfWeek, getClubCardTheme, getClubAccentColor, hexToRgba } from './schedule-helper';
import { ActivitySchedule } from '@/api/activity-api';

describe('schedule-helper', () => {
  const clubId = 'club-123';

  const makeSchedule = (
    id: string,
    start: string,
    end: string,
    location?: string,
    status = 'scheduled'
  ): ActivitySchedule => ({
    _id: id,
    club_id: clubId,
    title: 'Sinh hoạt định kỳ',
    schedule_type: 'weekly',
    start_time: start,
    end_time: end,
    location,
    status,
    semester_id: 'semester-1',
    created_by: 'user-1',
    createdAt: new Date().toISOString(),
  } as any);

  describe('getStartOfWeek', () => {
    it('should return Monday of the same week', () => {
      // 2026-07-07 is Tuesday
      const date = new Date('2026-07-07T12:00:00');
      const monday = getStartOfWeek(date);
      expect(monday.getFullYear()).toBe(2026);
      expect(monday.getMonth()).toBe(6); // July is 6 (0-indexed)
      expect(monday.getDate()).toBe(6); // July 6
    });

    it('should handle Sunday correctly by returning the preceding Monday', () => {
      // 2026-07-12 is Sunday
      const date = new Date('2026-07-12T15:00:00');
      const monday = getStartOfWeek(date);
      expect(monday.getFullYear()).toBe(2026);
      expect(monday.getMonth()).toBe(6);
      expect(monday.getDate()).toBe(6);
    });
  });

  describe('getClubScheduleSummary', () => {
    beforeEach(() => {
      // Mock system time to Tuesday, July 7, 2026 in local time
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-07T10:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return empty array if schedules are empty', () => {
      expect(getClubScheduleSummary([], clubId)).toEqual([]);
    });

    it('should filter active status scheduled or ongoing', () => {
      const s1 = makeSchedule('s1', '2026-07-06T08:00:00', '2026-07-06T10:00:00', 'Room A', 'completed');
      const s2 = makeSchedule('s2', '2026-07-08T08:00:00', '2026-07-08T10:00:00', 'Room B', 'cancelled');
      const s3 = makeSchedule('s3', '2026-07-08T14:00:00', '2026-07-08T16:00:00', 'Room C', 'ongoing');
      
      const summary = getClubScheduleSummary([s1, s2, s3], clubId);
      expect(summary).toHaveLength(1);
      expect(summary[0].timeRange).toBe('14:00 - 16:00');
      expect(summary[0].weekdays).toEqual(['T4']); // Wednesday
    });

    it('should group schedules with identical time range and sort days Monday-Sunday', () => {
      // Monday (T2): 08:00 - 10:00
      const s1 = makeSchedule('s1', '2026-07-06T08:00:00', '2026-07-06T10:00:00', 'Room A');
      // Wednesday (T4): 08:00 - 10:00
      const s2 = makeSchedule('s2', '2026-07-08T08:00:00', '2026-07-08T10:00:00', 'Room B');
      // Sunday (CN): 08:00 - 10:00
      const s3 = makeSchedule('s3', '2026-07-12T08:00:00', '2026-07-12T10:00:00', 'Room C');

      const summary = getClubScheduleSummary([s3, s1, s2], clubId);
      
      expect(summary).toHaveLength(1);
      expect(summary[0].timeRange).toBe('08:00 - 10:00');
      expect(summary[0].weekdays).toEqual(['T2', 'T4', 'CN']);
    });

    it('should split schedules with different time ranges and sort rows by min weekday', () => {
      // Wednesday (T4): 14:00 - 16:00
      const s1 = makeSchedule('s1', '2026-07-08T14:00:00', '2026-07-08T16:00:00', 'Room A');
      // Monday (T2): 08:00 - 10:00
      const s2 = makeSchedule('s2', '2026-07-06T08:00:00', '2026-07-06T10:00:00', 'Room B');

      const summary = getClubScheduleSummary([s1, s2], clubId);
      
      expect(summary).toHaveLength(2);
      expect(summary[0].timeRange).toBe('08:00 - 10:00');
      expect(summary[0].weekdays).toEqual(['T2']);
      expect(summary[1].timeRange).toBe('14:00 - 16:00');
      expect(summary[1].weekdays).toEqual(['T4']);
    });

    it('should de-duplicate duplicate weekday and time range combinations', () => {
      const s1 = makeSchedule('s1', '2026-07-06T08:00:00', '2026-07-06T10:00:00', 'Room A');
      const s2 = makeSchedule('s2', '2026-07-06T08:00:00', '2026-07-06T10:00:00', 'Room B'); // Same Monday, same time

      const summary = getClubScheduleSummary([s1, s2], clubId);
      expect(summary).toHaveLength(1);
      expect(summary[0].timeRange).toBe('08:00 - 10:00');
      expect(summary[0].weekdays).toEqual(['T2']);
    });

    it('should fallback to future week if current week has no active schedules', () => {
      // Tuesday next week (2026-07-14) 09:00 - 11:00
      const s1 = makeSchedule('s1', '2026-07-14T09:00:00', '2026-07-14T11:00:00', 'Room A');
      // Thursday next week (2026-07-16) 09:00 - 11:00
      const s2 = makeSchedule('s2', '2026-07-16T09:00:00', '2026-07-16T11:00:00', 'Room B');
      // Friday 2 weeks later (2026-07-24)
      const s3 = makeSchedule('s3', '2026-07-24T09:00:00', '2026-07-24T11:00:00', 'Room C');

      const summary = getClubScheduleSummary([s1, s2, s3], clubId);
      
      // Should group next week's Tuesday and Thursday, ignoring 2 weeks later
      expect(summary).toHaveLength(1);
      expect(summary[0].timeRange).toBe('09:00 - 11:00');
      expect(summary[0].weekdays).toEqual(['T3', 'T5']);
    });
  });

  describe('getClubCardTheme', () => {
    it('should return category if valid, ignoring card_ui configuration', () => {
      expect(getClubCardTheme({ category: 'academic' })).toBe('academic');
      expect(getClubCardTheme({ card_ui: { theme: 'sports' }, category: 'academic' } as any)).toBe('academic');
      expect(getClubCardTheme({ card_ui: { theme: 'default' }, category: 'sports' } as any)).toBe('sports');
    });

    it('should return other if category is invalid or missing', () => {
      expect(getClubCardTheme({ category: 'invalid-category' })).toBe('other');
      expect(getClubCardTheme({ category: '' })).toBe('other');
    });
  });

  describe('getClubAccentColor', () => {
    it('should ignore custom accent color in card_ui and return color based on category', () => {
      expect(getClubAccentColor({ card_ui: { accent_color: '#F43F5E' }, category: 'academic' } as any)).toBe('#3B82F6');
    });

    it('should return default color based on category', () => {
      expect(getClubAccentColor({ category: 'sports' })).toBe('#10B981'); // Emerald
      expect(getClubAccentColor({ category: 'academic' })).toBe('#3B82F6'); // Blue
      expect(getClubAccentColor({ category: 'invalid' })).toBe('#64748B'); // Slate
    });
  });

  describe('hexToRgba', () => {
    it('should convert hex format to rgba format', () => {
      expect(hexToRgba('#3B82F6', 0.25)).toBe('rgba(59, 130, 246, 0.25)');
      expect(hexToRgba('#10B981', 0.5)).toBe('rgba(16, 185, 129, 0.5)');
    });
  });
});
