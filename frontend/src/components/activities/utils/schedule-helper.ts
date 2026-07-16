import { ActivitySchedule } from '@/api/activity-api';
import { format } from 'date-fns';

export interface ScheduleSummaryRow {
  weekdays: string[];
  dayIndices: number[];
  timeRange: string;
  location?: string;
}

const getIdentifierValue = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return '';
  const record = value as { _id?: unknown; $oid?: unknown };
  return getIdentifierValue(record._id ?? record.$oid);
};

/**
 * Calculates Monday at 00:00:00 of the week containing the given date.
 */
export const getStartOfWeek = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday (0) to Monday
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

/**
 * Builds schedule summary rows grouped by matching time ranges and sorted from Monday to Sunday.
 */
export const getClubScheduleSummary = (
  schedules: ActivitySchedule[],
  clubId: string
): ScheduleSummaryRow[] => {
  if (!schedules || schedules.length === 0) return [];

  // 1. Filter active schedules for this club
  const clubScheds = schedules.filter((s) => {
    const normalizedScheduleClubId = getIdentifierValue(s.activity_id);
    return normalizedScheduleClubId === getIdentifierValue(clubId)
      && (s.status === 'scheduled' || s.status === 'ongoing');
  });

  if (clubScheds.length === 0) return [];

  // Sort all club schedules by start_time ascending
  const sortedScheds = [...clubScheds].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  // 2. Identify the active weekly window
  const now = new Date();
  const currentWeekMonday = getStartOfWeek(now);
  const currentWeekSunday = new Date(currentWeekMonday);
  currentWeekSunday.setDate(currentWeekMonday.getDate() + 6);
  currentWeekSunday.setHours(23, 59, 59, 999);

  // Check if there are schedules in the current week
  let targetScheds = sortedScheds.filter((s) => {
    const time = new Date(s.start_time).getTime();
    return time >= currentWeekMonday.getTime() && time <= currentWeekSunday.getTime();
  });

  // Fallback: If current week has no schedules, find the first upcoming schedule after current week
  if (targetScheds.length === 0) {
    const firstFuture = sortedScheds.find((s) => {
      return new Date(s.start_time).getTime() > currentWeekSunday.getTime();
    });
    if (firstFuture) {
      const futureWeekMonday = getStartOfWeek(new Date(firstFuture.start_time));
      const futureWeekSunday = new Date(futureWeekMonday);
      futureWeekSunday.setDate(futureWeekMonday.getDate() + 6);
      futureWeekSunday.setHours(23, 59, 59, 999);

      targetScheds = sortedScheds.filter((s) => {
        const time = new Date(s.start_time).getTime();
        return time >= futureWeekMonday.getTime() && time <= futureWeekSunday.getTime();
      });
    }
  }

  if (targetScheds.length === 0) return [];

  // 3. Map to unique day & time range items
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const getDayIndex = (day: number) => (day === 0 ? 7 : day); // CN (Sunday) is 7, T2-T7 are 1-6

  // Unique map key: `${dayIndex}-${timeRange}`
  const uniqueItemsMap = new Map<string, { dayIndex: number; dayLabel: string; timeRange: string; location?: string }>();

  targetScheds.forEach((s) => {
    try {
      const start = new Date(s.start_time);
      const end = new Date(s.end_time);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return;
      }
      const day = start.getDay();
      const dayIndex = getDayIndex(day);
      const dayLabel = dayNames[day];
      const timeRange = `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
      const key = `${dayIndex}-${timeRange}`;

      if (!uniqueItemsMap.has(key)) {
        uniqueItemsMap.set(key, {
          dayIndex,
          dayLabel,
          timeRange,
          location: s.location,
        });
      }
    } catch (e) {
      // skip invalid time data
    }
  });

  const uniqueItems = Array.from(uniqueItemsMap.values());

  // 4. Group by timeRange
  const groupedByTime = new Map<string, { dayIndices: number[]; weekdays: string[]; location?: string }>();
  uniqueItems.forEach((item) => {
    const existing = groupedByTime.get(item.timeRange);
    if (existing) {
      if (!existing.dayIndices.includes(item.dayIndex)) {
        existing.dayIndices.push(item.dayIndex);
        existing.weekdays.push(item.dayLabel);
      }
      // If we don't have location yet but this item does, use it
      if (!existing.location && item.location) {
        existing.location = item.location;
      }
    } else {
      groupedByTime.set(item.timeRange, {
        dayIndices: [item.dayIndex],
        weekdays: [item.dayLabel],
        location: item.location,
      });
    }
  });

  // 5. Construct rows and sort weekdays & rows
  const rows: ScheduleSummaryRow[] = Array.from(groupedByTime.entries()).map(([timeRange, data]) => {
    // Sort weekdays by dayIndex
    const sortedDays = data.dayIndices
      .map((idx, i) => ({ idx, name: data.weekdays[i] }))
      .sort((a, b) => a.idx - b.idx);

    return {
      timeRange,
      dayIndices: sortedDays.map((d) => d.idx),
      weekdays: sortedDays.map((d) => d.name),
      location: data.location,
    };
  });

  // Sort rows: by minimum dayIndex first, then by timeRange (startTime)
  rows.sort((a, b) => {
    const minA = Math.min(...a.dayIndices);
    const minB = Math.min(...b.dayIndices);
    if (minA !== minB) {
      return minA - minB;
    }
    return a.timeRange.localeCompare(b.timeRange);
  });

  return rows;
};

export const themeMapping: Record<string, string> = {
  academic: 'academic',
  creative: 'art',
  art: 'art',
  sport: 'sports',
  sports: 'sports',
  technology: 'technology',
  volunteer: 'volunteer',
  other: 'other',
};

export const themeColors: Record<string, string> = {
  academic: '#3B82F6', // Blue
  sports: '#10B981',   // Emerald
  art: '#8B5CF6',      // Purple
  volunteer: '#F59E0B',// Amber
  technology: '#06B6D4',// Cyan
  other: '#64748B',    // Slate
  creative: '#8B5CF6',
};

export const hexToRgba = (hex: string, alpha: number): string => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getClubCardTheme = (club: { card_ui?: { theme?: string }; category: string }): string => {
  const resolved = club.category || 'other';
  return themeColors[resolved] ? resolved : 'other';
};

export const getClubAccentColor = (club: { card_ui?: { theme?: string; accent_color?: string }; category: string; background_config?: { accentColor?: string } }): string => {
  if (club.background_config?.accentColor) {
    return club.background_config.accentColor;
  }
  const resolvedTheme = getClubCardTheme(club);
  return themeColors[resolvedTheme] || '#3B82F6';
};

export interface BackgroundPreset {
  id: string;
  name: string;
  className: string;
  accentColor: string;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'minimal',
    name: 'Tối giản (Minimal)',
    className: 'bg-white border-slate-200/80',
    accentColor: '#64748B',
  },
  {
    id: 'gentle',
    name: 'Dịu dàng (Gentle)',
    className: 'bg-gradient-to-br from-rose-50/40 via-white to-sky-50/40 border-pink-100',
    accentColor: '#EC4899',
  },
  {
    id: 'technology',
    name: 'Công nghệ (Technology)',
    className: 'bg-gradient-to-br from-cyan-50/30 via-white to-blue-50/30 border-cyan-200/50',
    accentColor: '#06B6D4',
  },
  {
    id: 'dreamy',
    name: 'Mơ màng (Dreamy)',
    className: 'bg-gradient-to-br from-purple-50/50 via-pink-50/30 to-indigo-50/50 border-purple-200/40',
    accentColor: '#8B5CF6',
  },
  {
    id: 'academic',
    name: 'Học thuật (Academic)',
    className: 'bg-gradient-to-br from-blue-50/40 via-white to-slate-100/50 border-blue-200/40',
    accentColor: '#3B82F6',
  },
  {
    id: 'sport',
    name: 'Thể thao (Sport)',
    className: 'bg-gradient-to-br from-emerald-50/40 via-white to-amber-50/30 border-emerald-200/40',
    accentColor: '#10B981',
  }
];
