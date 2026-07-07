'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Clock, MapPin, ChevronLeft, ChevronRight,
  Search, Users, Trash2, AlertCircle, CalendarRange, Calendar,
  X, Grid, List, Activity, HelpCircle, Settings, SlidersHorizontal,
  Sunrise, Sun, Moon, Clock3, Copy
} from 'lucide-react';
import { clubScheduleApi, clubApi, ClubSchedule, Club } from '@/api/club-api';
import { semesterApi, Semester } from '@/api/semester-api';
import { useAuth } from '@/providers/auth-provider';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';

const typeColors: Record<string, string> = {
  regular: 'bg-blue-500 border-blue-500 text-blue-600',
  event: 'bg-purple-500 border-purple-500 text-purple-600',
  exam: 'bg-red-500 border-red-500 text-red-600',
  meeting: 'bg-amber-500 border-amber-500 text-amber-600',
};

const typeLabels: Record<string, string> = {
  regular: 'Sinh hoạt',
  event: 'Sự kiện',
  exam: 'Kiểm tra',
  meeting: 'Họp',
};

type AccentColor = 'blue' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate';

const ACCENT_COLORS: AccentColor[] = ['blue', 'cyan', 'emerald', 'amber', 'rose', 'violet', 'slate'];

const accentStyles: Record<AccentColor, {
  card: string;
  title: string;
  sub: string;
  icon: string;
  badge: string;
  borderL: string;
}> = {
  blue: {
    card: 'bg-blue-500/10 border-blue-500/20 shadow-[0_2px_8px_rgba(59,130,246,0.06)]',
    title: 'text-blue-950 font-extrabold dark:text-blue-900',
    sub: 'text-blue-800/85',
    icon: 'text-blue-500',
    badge: 'bg-blue-500/10 text-blue-600',
    borderL: 'border-l-blue-500'
  },
  cyan: {
    card: 'bg-cyan-500/10 border-cyan-500/20 shadow-[0_2px_8px_rgba(6,182,212,0.06)]',
    title: 'text-cyan-950 font-extrabold',
    sub: 'text-cyan-800/85',
    icon: 'text-cyan-500',
    badge: 'bg-cyan-500/10 text-cyan-600',
    borderL: 'border-l-cyan-500'
  },
  emerald: {
    card: 'bg-emerald-500/10 border-emerald-500/20 shadow-[0_2px_8px_rgba(16,185,129,0.06)]',
    title: 'text-emerald-950 font-extrabold',
    sub: 'text-emerald-800/85',
    icon: 'text-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-600',
    borderL: 'border-l-emerald-500'
  },
  amber: {
    card: 'bg-amber-500/10 border-amber-500/20 shadow-[0_2px_8px_rgba(245,158,11,0.06)]',
    title: 'text-amber-950 font-extrabold',
    sub: 'text-amber-800/85',
    icon: 'text-amber-500',
    badge: 'bg-amber-500/10 text-amber-600',
    borderL: 'border-l-amber-500'
  },
  rose: {
    card: 'bg-rose-500/10 border-rose-500/20 shadow-[0_2px_8px_rgba(244,63,94,0.06)]',
    title: 'text-rose-950 font-extrabold',
    sub: 'text-rose-800/85',
    icon: 'text-rose-500',
    badge: 'bg-rose-500/10 text-rose-600',
    borderL: 'border-l-rose-500'
  },
  violet: {
    card: 'bg-violet-500/10 border-violet-500/20 shadow-[0_2px_8px_rgba(139,92,246,0.06)]',
    title: 'text-violet-950 font-extrabold',
    sub: 'text-violet-800/85',
    icon: 'text-violet-500',
    badge: 'bg-violet-500/10 text-violet-600',
    borderL: 'border-l-violet-500'
  },
  slate: {
    card: 'bg-slate-500/10 border-slate-500/20 shadow-[0_2px_8px_rgba(100,116,139,0.06)]',
    title: 'text-slate-950 font-extrabold',
    sub: 'text-slate-800/85',
    icon: 'text-slate-500',
    badge: 'bg-slate-500/10 text-slate-600',
    borderL: 'border-l-slate-500'
  }
};

function getClubAccentColor(item: any): AccentColor {
  // Nếu là lịch trình và có loại lịch trình, ưu tiên map màu tương ứng theo loại hoạt động
  if (item && typeof item === 'object' && 'schedule_type' in item) {
    const type = item.schedule_type;
    if (type === 'regular') return 'blue';
    if (type === 'event') return 'violet';
    if (type === 'exam') return 'rose';
    if (type === 'meeting') return 'amber';
  }

  // Đối với câu lạc bộ hoặc trường hợp khác, dùng giải thuật hash ổn định
  let id = '';
  if (item.clubId) {
    id = item.clubId;
  } else if (item.club_id) {
    id = typeof item.club_id === 'object' ? (item.club_id._id || item.club_id.code || item.club_id.name || '') : item.club_id;
  } else if (item._id) {
    id = item._id;
  } else if (item.id) {
    id = item.id;
  }

  if (!id) {
    id = item.clubCode || item.code || item.clubName || item.name || item.title || 'default';
  }

  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % ACCENT_COLORS.length;
  return ACCENT_COLORS[index];
}

// --- Shift Constants and Helpers ---
export type ShiftType = 'morning' | 'afternoon' | 'evening';

export interface RecurrenceConfig {
  enabled: boolean;
  type: 'weekly' | 'biweekly' | 'monthly';
  untilType: 'semester' | 'weeks' | 'date' | 'none';
  weeksCount?: number;
  untilDate?: string;
  repeatStartDate?: string;
  repeatEndDate?: string;
}

export interface PendingSchedule {
  tempId: string;
  clubId: string;
  clubName: string;
  clubCode: string;
  clubCategory: string;
  dateStr: string;
  shift: ShiftType;
  startTime: string;
  endTime: string;
  recurrence: RecurrenceConfig | null;
  scheduleId?: string; // ID của lịch đã lưu ban đầu (nếu kéo từ lịch cũ sang)
  originalData?: ClubSchedule;
}

const ScrollContainer = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const hasMovedRef = useRef(false);
  const startTouchYRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartY(e.pageY);
    setScrollTop(containerRef.current.scrollTop);
    hasMovedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const walk = (e.pageY - startY) * 1.5;
    if (Math.abs(walk) > 3) {
      hasMovedRef.current = true;
    }
    containerRef.current.scrollTop = scrollTop - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      onTouchStart={(e) => {
        if (e.touches.length > 0) {
          startTouchYRef.current = e.touches[0].pageY;
          hasMovedRef.current = false;
        }
      }}
      onTouchMove={(e) => {
        if (e.touches.length > 0) {
          const diff = Math.abs(e.touches[0].pageY - startTouchYRef.current);
          if (diff > 5) {
            hasMovedRef.current = true;
          }
        }
      }}
      onClickCapture={(e) => {
        if (hasMovedRef.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      className={cn("overflow-y-auto select-none cursor-grab active:cursor-grabbing", className)}
    >
      {children}
    </div>
  );
};

const CustomTimePicker = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
  const [hour, minute] = value.split(':');

  const hours = Array.from({ length: 15 }, (_, i) => String(i + 7).padStart(2, '0')); // 07 to 21
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')); // 00, 05, 10, ...

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full items-center justify-center rounded-xl border border-white/70 bg-white/60 backdrop-blur-md px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
        >
          <Clock className="mr-2 h-4 w-4 text-slate-400" />
          {value}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3 bg-white/75 backdrop-blur-md border border-white/60 shadow-xl rounded-2xl" align="start">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Giờ</div>
            <ScrollContainer className="max-h-48 flex flex-col gap-1 pr-1 scrollbar-hover">
              {hours.map((h) => {
                const isSelected = h === hour;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onChange(`${h}:${minute}`)}
                    className={cn(
                      "py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                      isSelected
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {h}
                  </button>
                );
              })}
            </ScrollContainer>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Phút</div>
            <ScrollContainer className="max-h-48 flex flex-col gap-1 pr-1 scrollbar-hover">
              {minutes.map((m) => {
                const isSelected = m === minute;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onChange(`${hour}:${m}`)}
                    className={cn(
                      "py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                      isSelected
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </ScrollContainer>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export interface ShiftDefinition {
  label: string;
  range: string;
  defaultStart: string;
  defaultEnd: string;
  icon: string;
}

export const SHIFT_DEFINITIONS: Record<ShiftType, ShiftDefinition> = {
  morning: {
    label: 'Ca Sáng',
    range: '07:00 - 11:30',
    defaultStart: '08:00',
    defaultEnd: '10:00',
    icon: '☀️',
  },
  afternoon: {
    label: 'Ca Chiều',
    range: '13:00 - 17:30',
    defaultStart: '14:00',
    defaultEnd: '16:00',
    icon: '🌇',
  },
  evening: {
    label: 'Ca Tối',
    range: '18:00 - 21:00',
    defaultStart: '18:00',
    defaultEnd: '20:00',
    icon: '🌙',
  },
};

function getShiftForDate(dateString: string | Date): ShiftType {
  const date = new Date(dateString);
  const hours = date.getHours();
  if (hours < 13) return 'morning';
  if (hours < 18) return 'afternoon';
  return 'evening';
}

function validateTimeInShift(start: string, end: string, shift: ShiftType): boolean {
  const parseTimeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const startMin = parseTimeToMinutes(start);
  const endMin = parseTimeToMinutes(end);

  let shiftStart = 0;
  let shiftEnd = 0;

  if (shift === 'morning') {
    shiftStart = 7 * 60;
    shiftEnd = 11 * 60 + 30;
  } else if (shift === 'afternoon') {
    shiftStart = 13 * 60;
    shiftEnd = 17 * 60 + 30;
  } else if (shift === 'evening') {
    shiftStart = 18 * 60;
    shiftEnd = 21 * 60;
  } else {
    return true;
  }

  return startMin >= shiftStart && endMin <= shiftEnd;
}

function doesScheduleOverlapRange(
  scheduleStart: string | Date,
  scheduleEnd: string | Date,
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  const start = new Date(scheduleStart);
  const end = new Date(scheduleEnd);
  return start <= rangeEnd && end >= rangeStart;
}

function doesScheduleOccurOnDate(
  schedule: { start_time: string; end_time: string },
  date: Date
): boolean {
  const start = new Date(schedule.start_time);
  const end = new Date(schedule.end_time);
  
  const dStart = new Date(date);
  dStart.setHours(0, 0, 0, 0);
  const dEnd = new Date(date);
  dEnd.setHours(23, 59, 59, 999);
  
  return start <= dEnd && end >= dStart;
}

function getVisibleScheduleTimesForDate(
  schedule: { start_time: string; end_time: string },
  date: Date
): { start: Date; end: Date } {
  const originalStart = new Date(schedule.start_time);
  const originalEnd = new Date(schedule.end_time);

  const start = new Date(date);
  start.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), originalStart.getMilliseconds());

  const end = new Date(date);
  end.setHours(originalEnd.getHours(), originalEnd.getMinutes(), originalEnd.getSeconds(), originalEnd.getMilliseconds());

  return { start, end };
}

function getSchedulesForDayAndShift(
  dayDate: Date,
  shift: ShiftType,
  schedulesList: ClubSchedule[]
): ClubSchedule[] {
  return schedulesList
    .filter(s => {
      if (!doesScheduleOccurOnDate(s, dayDate)) return false;
      const { start } = getVisibleScheduleTimesForDate(s, dayDate);
      return getShiftForDate(start) === shift;
    })
    .sort((a, b) => {
      const aTime = new Date(a.start_time).getTime();
      const bTime = new Date(b.start_time).getTime();
      return aTime - bTime;
    });
}

interface RecurrenceValidationResult {
  isValid: boolean;
  error?: string;
  effectiveEndDate?: Date;
  sessionCount?: number;
}

function validateRecurrenceConfig(
  config: RecurrenceConfig | null,
  startDateTime: Date,
  activeSemester: Semester | null
): RecurrenceValidationResult {
  if (!config || !config.enabled) {
    return { isValid: true, sessionCount: 1 };
  }

  let repeatStart: Date;
  if (config.repeatStartDate) {
    repeatStart = new Date(config.repeatStartDate);
  } else {
    // Default to the startDateTime's Monday
    const startStr = startDateTime.toISOString().split('T')[0];
    repeatStart = new Date(getMondayDateStr(startStr));
  }
  repeatStart.setHours(0, 0, 0, 0);

  let repeatEnd: Date;
  if (config.repeatEndDate) {
    repeatEnd = new Date(config.repeatEndDate);
  } else {
    // Fallback based on untilType
    if (config.untilType === 'semester') {
      if (!activeSemester || !activeSemester.end_date) {
        return {
          isValid: false,
          error: 'Học kỳ hiện tại chưa được cấu hình ngày kết thúc hoặc không có học kỳ hoạt động',
        };
      }
      repeatEnd = new Date(activeSemester.end_date);
    } else if (config.untilType === 'date') {
      if (!config.untilDate) {
        return {
          isValid: false,
          error: 'Vui lòng chọn ngày kết thúc cụ thể',
        };
      }
      repeatEnd = new Date(`${config.untilDate}T23:59:59`);
    } else if (config.untilType === 'weeks') {
      if (!config.weeksCount) {
        return {
          isValid: false,
          error: 'Vui lòng cấu hình số tuần lặp lại',
        };
      }
      const weeks = Number(config.weeksCount);
      repeatEnd = new Date(startDateTime.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
    } else {
      return { isValid: true, sessionCount: 1 };
    }
  }

  repeatEnd.setHours(23, 59, 59, 999);

  // Validate startDateTime is the first scheduled club session start date
  const startDay = new Date(startDateTime);
  startDay.setHours(0, 0, 0, 0);

  if (repeatEnd < startDay) {
    return {
      isValid: false,
      error: 'Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu buổi sinh hoạt đầu tiên',
    };
  }

  if (repeatEnd < repeatStart) {
    return {
      isValid: false,
      error: 'Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu lặp',
    };
  }

  // Count sessions
  let sessionCount = 0;
  let i = 0;
  const start = new Date(startDateTime);

  while (true) {
    let currentStart: Date;
    if (config.type === 'weekly') {
      currentStart = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    } else if (config.type === 'biweekly') {
      currentStart = new Date(start.getTime() + i * 14 * 24 * 60 * 60 * 1000);
    } else if (config.type === 'monthly') {
      currentStart = new Date(start);
      currentStart.setMonth(start.getMonth() + i);
    } else {
      currentStart = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    }

    currentStart.setHours(0, 0, 0, 0);
    if (currentStart > repeatEnd) {
      break;
    }

    if (currentStart >= repeatStart) {
      sessionCount++;
    }

    i++;
    if (i > 100) break;
  }

  return {
    isValid: true,
    effectiveEndDate: repeatEnd,
    sessionCount,
  };
}

const getMondayDateStr = (dateStrOrDate: string | Date): string => {
  const d = new Date(dateStrOrDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getTime() + diff * 24 * 60 * 60 * 1000);
  return monday.toISOString().split('T')[0];
};

const getWeekOffsetFromDate = (targetDate: Date) => {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const todayMonday = new Date(today.getTime() + diff * 24 * 60 * 60 * 1000);
  todayMonday.setHours(0, 0, 0, 0);

  const targetDay = targetDate.getDay();
  const targetDiff = targetDay === 0 ? -6 : 1 - targetDay;
  const targetMonday = new Date(targetDate.getTime() + targetDiff * 24 * 60 * 60 * 1000);
  targetMonday.setHours(0, 0, 0, 0);

  const diffTime = targetMonday.getTime() - todayMonday.getTime();
  const diffDays = Math.round(diffTime / (24 * 60 * 60 * 1000));
  return Math.round(diffDays / 7);
};

const isDateInAnchorWeek = (dateStrOrDate: string | Date, anchorWeekMonday: string): boolean => {
  return getMondayDateStr(dateStrOrDate) === anchorWeekMonday;
};

function isDateInRecurrence(
  dayDate: Date,
  p: PendingSchedule,
  activeSemester: Semester | null,
  defaultRecurrence: RecurrenceConfig
): boolean {
  if (!defaultRecurrence || !defaultRecurrence.enabled) return false;

  const anchorDate = new Date(p.dateStr);
  anchorDate.setHours(0, 0, 0, 0);

  const target = new Date(dayDate);
  target.setHours(0, 0, 0, 0);

  const anchorMondayStr = getMondayDateStr(p.dateStr);
  const targetMondayStr = getMondayDateStr(dayDate);

  if (targetMondayStr < anchorMondayStr) {
    return false;
  }
  if (targetMondayStr === anchorMondayStr) {
    return false;
  }

  let repeatStart: Date;
  if (defaultRecurrence.repeatStartDate) {
    repeatStart = new Date(defaultRecurrence.repeatStartDate);
  } else {
    repeatStart = new Date(anchorMondayStr);
  }
  repeatStart.setHours(0, 0, 0, 0);

  let repeatEnd: Date | null = null;
  if (defaultRecurrence.repeatEndDate) {
    repeatEnd = new Date(defaultRecurrence.repeatEndDate);
  } else {
    if (defaultRecurrence.untilType === 'semester') {
      if (activeSemester && activeSemester.end_date) {
        repeatEnd = new Date(activeSemester.end_date);
      } else {
        repeatEnd = new Date(anchorDate.getTime() + 10 * 7 * 24 * 60 * 60 * 1000);
      }
    } else if (defaultRecurrence.untilType === 'date') {
      if (defaultRecurrence.untilDate) {
        repeatEnd = new Date(`${defaultRecurrence.untilDate}T23:59:59`);
      }
    } else if (defaultRecurrence.untilType === 'weeks') {
      if (defaultRecurrence.weeksCount) {
        repeatEnd = new Date(anchorDate.getTime() + defaultRecurrence.weeksCount * 7 * 24 * 60 * 60 * 1000);
      }
    }
  }

  if (!repeatEnd) return false;
  repeatEnd.setHours(23, 59, 59, 999);

  if (target < repeatStart || target > repeatEnd) return false;

  let i = 0;
  while (true) {
    let current: Date;
    if (defaultRecurrence.type === 'weekly') {
      current = new Date(anchorDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    } else if (defaultRecurrence.type === 'biweekly') {
      current = new Date(anchorDate.getTime() + i * 14 * 24 * 60 * 60 * 1000);
    } else if (defaultRecurrence.type === 'monthly') {
      current = new Date(anchorDate);
      current.setMonth(anchorDate.getMonth() + i);
    } else {
      current = new Date(anchorDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    }

    current.setHours(0, 0, 0, 0);
    if (current > repeatEnd) {
      return false;
    }
    if (current.getTime() === target.getTime()) {
      return current >= repeatStart;
    }
    i++;
    if (i > 100) break;
  }

  return false;
}

function getCellPendingSchedules(
  dayDate: Date,
  cellDateStr: string,
  shift: ShiftType,
  pendingSchedules: PendingSchedule[],
  activeSemester: Semester | null,
  defaultRecurrence: RecurrenceConfig,
  anchorWeekMonday: string
): (PendingSchedule & { isPreview?: boolean; originalTempId?: string })[] {
  return pendingSchedules.flatMap(p => {
    if (p.dateStr === cellDateStr && p.shift === shift) {
      return [p];
    }
    const pInAnchor = isDateInAnchorWeek(p.dateStr, anchorWeekMonday);
    if (pInAnchor && p.shift === shift && isDateInRecurrence(dayDate, p, activeSemester, defaultRecurrence)) {
      return [{
        ...p,
        tempId: `${p.tempId}_preview_${cellDateStr}`,
        isPreview: true,
        originalTempId: p.tempId,
        dateStr: cellDateStr
      }];
    }
    return [];
  });
}

const getFirstActivityStartDate = (
  schedules: ClubSchedule[],
  pendingSchedules: PendingSchedule[],
  anchorWeekMonday: string
): Date | null => {
  let earliestDate: Date | null = null;

  const savedInAnchor = schedules.filter(s => {
    if (s.status === 'cancelled') return false;
    return isDateInAnchorWeek(s.start_time, anchorWeekMonday);
  });
  for (const s of savedInAnchor) {
    const d = new Date(s.start_time);
    if (!earliestDate || d < earliestDate) {
      earliestDate = d;
    }
  }

  const pendingInAnchor = pendingSchedules.filter(p => {
    return isDateInAnchorWeek(p.dateStr, anchorWeekMonday);
  });
  for (const p of pendingInAnchor) {
    const d = new Date(`${p.dateStr}T${p.startTime}`);
    if (!earliestDate || d < earliestDate) {
      earliestDate = d;
    }
  }

  return earliestDate;
};

const countRecurrenceSessions = (
  schedules: ClubSchedule[],
  pendingSchedules: PendingSchedule[],
  anchorWeekMonday: string,
  recurrenceType: 'weekly' | 'biweekly' | 'monthly',
  repeatStart: Date,
  repeatEnd: Date
): number => {
  const savedInAnchor = schedules.filter(s => {
    if (s.status === 'cancelled') return false;
    return isDateInAnchorWeek(s.start_time, anchorWeekMonday);
  });

  const pendingInAnchor = pendingSchedules.filter(p => {
    return isDateInAnchorWeek(p.dateStr, anchorWeekMonday);
  });

  let totalSessions = 0;

  const countForAnchor = (anchorDateStr: string) => {
    const anchorDate = new Date(anchorDateStr);
    anchorDate.setHours(0, 0, 0, 0);

    const anchorMonday = new Date(anchorWeekMonday);
    anchorMonday.setHours(0, 0, 0, 0);

    let count = 0;
    let i = 0;
    while (true) {
      let current: Date;
      if (recurrenceType === 'weekly') {
        current = new Date(anchorDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      } else if (recurrenceType === 'biweekly') {
        current = new Date(anchorDate.getTime() + i * 14 * 24 * 60 * 60 * 1000);
      } else if (recurrenceType === 'monthly') {
        current = new Date(anchorDate);
        current.setMonth(anchorDate.getMonth() + i);
      } else {
        current = new Date(anchorDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      }

      current.setHours(0, 0, 0, 0);
      if (current > repeatEnd) {
        break;
      }

      const currentMonday = new Date(getMondayDateStr(current));
      currentMonday.setHours(0, 0, 0, 0);

      // Previews are only for future weeks AND within repeat range
      if (currentMonday > anchorMonday && current >= repeatStart) {
        count++;
      }

      i++;
      if (i > 100) break;
    }
    return count;
  };

  for (const s of savedInAnchor) {
    const dateStr = s.start_time.split('T')[0];
    totalSessions += countForAnchor(dateStr);
  }

  for (const p of pendingInAnchor) {
    totalSessions += countForAnchor(p.dateStr);
  }

  return totalSessions;
};

export default function SchedulesOverview() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission('CLUB_SCHEDULE_MANAGE') || user?.role === 'admin';

  // Core data states
  const [schedules, setSchedules] = useState<ClubSchedule[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [loading, setLoading] = useState(true);

  // Pending schedules states
  const [pendingSchedules, setPendingSchedules] = useState<PendingSchedule[]>([]);
  const [activePendingSchedule, setActivePendingSchedule] = useState<PendingSchedule | null>(null);

  const handlePendingDragStart = (e: React.DragEvent, tempId: string, originDateStr: string, originShift: ShiftType) => {
    if (!canManage) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'pending', tempId, originDateStr, originShift }));
  };

  const handleConfigurePending = (pending: PendingSchedule & { originalTempId?: string }) => {
    if (showCreateModal) return;
    const targetTempId = pending.originalTempId || pending.tempId;
    const originalPending = pendingSchedules.find(p => p.tempId === targetTempId) || pending;
    setActivePendingSchedule(originalPending);
    
    const clubObj = clubs.find(c => c._id === pending.clubId);
    const defaultLoc = clubObj?.classroom || 'Phòng sinh hoạt CLB';
    
    setFormClubId(pending.clubId);
    setFormTitle(pending.originalData?.title || `Sinh hoạt CLB ${pending.clubName}`);
    setFormDesc(pending.originalData?.description || '');
    setFormLocation(pending.originalData?.location || defaultLoc);
    setFormType(pending.originalData?.schedule_type || 'regular');
    setFormDate(pending.dateStr);
    setFormStartTime(pending.startTime);
    setFormEndTime(pending.endTime);
    if (pending.recurrence) {
      setScheduleRecurrence(pending.recurrence);
    } else {
      setScheduleRecurrence({
        enabled: false,
        type: 'weekly',
        untilType: 'none',
      });
    }
    setFormMaxAttendees(pending.originalData?.max_attendees ? String(pending.originalData.max_attendees) : '');
    setFormScheduleId(pending.scheduleId || null);
    setFormShift(pending.shift);
    
    setIsSimplifiedModal(true);
    setShowCreateModal(true);
  };

  const handleConfigureSaved = (schedule: ClubSchedule) => {
    if (showCreateModal) return;
    setActivePendingSchedule(null);
    
    const cid = typeof schedule.club_id === 'string' ? schedule.club_id : schedule.club_id?._id || '';
    const clubObj = typeof schedule.club_id === 'object' ? schedule.club_id : clubs.find(c => c._id === cid);
    
    setFormClubId(cid);
    setFormTitle(schedule.title || `Sinh hoạt CLB ${clubObj?.name || ''}`);
    setFormDesc(schedule.description || '');
    setFormLocation(schedule.location || 'Phòng sinh hoạt CLB');
    setFormType(schedule.schedule_type || 'regular');

    const startObj = new Date(schedule.start_time);
    const endObj = new Date(schedule.end_time);
    const yyyy = startObj.getFullYear();
    const mm = String(startObj.getMonth() + 1).padStart(2, '0');
    const dd = String(startObj.getDate()).padStart(2, '0');
    setFormDate(`${yyyy}-${mm}-${dd}`);

    const startHour = String(startObj.getHours()).padStart(2, '0');
    const startMin = String(startObj.getMinutes()).padStart(2, '0');
    setFormStartTime(`${startHour}:${startMin}`);

    const endHour = String(endObj.getHours()).padStart(2, '0');
    const endMin = String(endObj.getMinutes()).padStart(2, '0');
    setFormEndTime(`${endHour}:${endMin}`);

    if (schedule.recurrence) {
      let untilType: 'semester' | 'weeks' | 'date' | 'none' = 'semester';
      let weeksCount = 8;
      let untilDate = '';
      if (schedule.recurrence.until) {
        untilType = 'date';
        const startVal = new Date(schedule.start_time).getTime();
        const untilVal = new Date(schedule.recurrence.until).getTime();
        const diffMs = untilVal - startVal;
        weeksCount = Math.max(1, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)));
        
        const untilObj = new Date(schedule.recurrence.until);
        const uY = untilObj.getFullYear();
        const uM = String(untilObj.getMonth() + 1).padStart(2, '0');
        const uD = String(untilObj.getDate()).padStart(2, '0');
        untilDate = `${uY}-${uM}-${uD}`;
      }
      setScheduleRecurrence({
        enabled: true,
        type: (schedule.recurrence.type as any) || 'weekly',
        untilType,
        weeksCount,
        untilDate,
      });
    } else {
      setScheduleRecurrence({
        enabled: false,
        type: 'weekly',
        untilType: 'none',
      });
    }
    setFormMaxAttendees(schedule.max_attendees ? String(schedule.max_attendees) : '');
    setFormScheduleId(schedule._id);

    const shift = getShiftForDate(schedule.start_time);
    setFormShift(shift);

    setIsSimplifiedModal(true);
    setShowCreateModal(true);
  };

  const handleRemovePending = (tempId: string) => {
    setPendingSchedules(prev => prev.filter(p => p.tempId !== tempId));
    toast.success('Đã xóa lịch pending');
  };

  // Navigation & View states
  const [view, setView] = useState<'weekly' | 'daily'>('weekly');
  const [weekOffset, setWeekOffset] = useState(0);
  const [preRecurrenceWeekOffset, setPreRecurrenceWeekOffset] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ClubSchedule | null>(null);
  const [showUpdateSeriesConfirmModal, setShowUpdateSeriesConfirmModal] = useState(false);
  const [showCancelRecurrenceConfirmModal, setShowCancelRecurrenceConfirmModal] = useState(false);
  const [pendingUpdatePayload, setPendingUpdatePayload] = useState<any>(null);


  // Form states
  const [formClubId, setFormClubId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formType, setFormType] = useState('regular');
  const [formDate, setFormDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formMaxAttendees, setFormMaxAttendees] = useState('');
  const [isSimplifiedModal, setIsSimplifiedModal] = useState(false);
  const [formScheduleId, setFormScheduleId] = useState<string | null>(null);
  const [formShift, setFormShift] = useState<ShiftType | null>(null);

  // Recurrence states
  const [defaultRecurrence, setDefaultRecurrence] = useState<RecurrenceConfig>({
    enabled: true,
    type: 'weekly',
    untilType: 'semester',
  });

  const [anchorWeekMonday, setAnchorWeekMonday] = useState<string>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today.getTime() + diff * 24 * 60 * 60 * 1000);
    return monday.toISOString().split('T')[0];
  });

  const [scheduleRecurrence, setScheduleRecurrence] = useState<RecurrenceConfig>({
    enabled: false,
    type: 'weekly',
    untilType: 'none',
  });

  const [recurrenceModalTarget, setRecurrenceModalTarget] = useState<'default' | 'form'>('default');
  const [isUntilCalendarOpen, setIsUntilCalendarOpen] = useState(false);

  // Advanced Recurrence Modal states
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [modalRecurrenceType, setModalRecurrenceType] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [modalUntilType, setModalUntilType] = useState<'semester' | 'weeks' | 'date' | 'none'>('semester');
  const [modalWeeksCount, setModalWeeksCount] = useState<number>(8);
  const [modalUntilDate, setModalUntilDate] = useState<string>('');
  const [modalRepeatStartDate, setModalRepeatStartDate] = useState<string>('');
  const [modalRepeatEndDate, setModalRepeatEndDate] = useState<string>('');
  const [isRangeCalendarOpen, setIsRangeCalendarOpen] = useState(false);


  const renderRecurrenceBadge = (schedule: ClubSchedule, size: 'sm' | 'md' = 'md') => {
    const isAnchorInRecurrence = isDateInAnchorWeek(schedule.start_time, anchorWeekMonday) && defaultRecurrence.enabled;
    const isSavedRecurring = !isAnchorInRecurrence && !!schedule.recurrence_id;
    
    let badgeText = '';
    let badgeStyle = 'text-blue-700 bg-blue-500/10 border-blue-500/20';

    if (isAnchorInRecurrence) {
      badgeText = 'Lặp (Anchor)';
      badgeStyle = 'text-blue-700 bg-blue-500/10 border-blue-500/20';
    } else if (isSavedRecurring) {
      const isSource = schedule.recurrence?.source_week_start_date && 
        getMondayDateStr(schedule.start_time) === getMondayDateStr(schedule.recurrence.source_week_start_date);
      
      if (isSource) {
        badgeText = 'Nguồn lặp';
        badgeStyle = 'text-purple-700 bg-purple-500/10 border-purple-500/20';
      } else {
        badgeText = 'Buổi lặp';
        badgeStyle = 'text-amber-700 bg-amber-500/10 border-amber-500/20';
      }
    }
    
    if (!badgeText) return null;
    
    if (size === 'sm') {
      return (
        <div className={cn("text-[7px] font-black rounded px-1 py-0.5 mt-1.5 w-fit shrink-0 border", badgeStyle)}>
          {badgeText}
        </div>
      );
    }
    
    return (
      <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded ml-2 uppercase tracking-wide border", badgeStyle)}>
        {badgeText}
      </span>
    );
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (showRecurrenceModal) {
      if (modalUntilType === 'semester') {
        setModalRepeatStartDate(anchorWeekMonday);
        if (activeSemester?.end_date) {
          setModalRepeatEndDate(activeSemester.end_date.split('T')[0]);
        }
      } else if (modalUntilType === 'weeks') {
        setModalRepeatStartDate(anchorWeekMonday);
        const start = new Date(anchorWeekMonday);
        const end = new Date(start.getTime() + modalWeeksCount * 7 * 24 * 60 * 60 * 1000);
        setModalRepeatEndDate(end.toISOString().split('T')[0]);
      }
    }
  }, [modalUntilType, modalWeeksCount, anchorWeekMonday, showRecurrenceModal, activeSemester]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [schedulesData, clubsData, semestersData] = await Promise.all([
        clubScheduleApi.getAll({ limit: 1000 }).catch(() => ({ items: [], total: 0 })),
        clubApi.getAll().catch(() => []),
        semesterApi.getSemesters().catch(() => []),
      ]);

      setSchedules(schedulesData?.items || []);
      setClubs(clubsData || []);
      setSemesters(semestersData || []);

      const active = semestersData.find((s: Semester) => s.status === 'active');
      if (active) {
        setActiveSemester(active);
      }
    } catch (err) {
      toast.error('Không thể tải dữ liệu lịch hoạt động');
    } finally {
      setLoading(false);
    }
  };

  const reloadSchedules = async () => {
    try {
      const data = await clubScheduleApi.getAll({ limit: 1000 });
      setSchedules(data?.items || []);
    } catch {
      toast.error('Không thể cập nhật danh sách lịch');
    }
  };

  // Helper: Get dates of the current week (Monday to Sunday) based on weekOffset
  const getWeekDates = (offset: number) => {
    const today = new Date();
    const day = today.getDay();
    // Monday is 1st day in our week. Sunday is last.
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today.getTime() + (diffToMonday + offset * 7) * 24 * 60 * 60 * 1000);

    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getTime() + i * 24 * 60 * 60 * 1000);
      week.push(d);
    }
    return week;
  };

  const weekDates = getWeekDates(weekOffset);
  const mondayDate = weekDates[0];
  const sundayDate = weekDates[6];

  // Format month range for header
  const getHeaderDateRangeString = () => {
    const startStr = mondayDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    const endStr = sundayDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const monthName = mondayDate.toLocaleDateString('vi-VN', { month: 'long' });
    return `${monthName}, Tuần ${weekOffset === 0 ? 'hiện tại' : weekOffset > 0 ? `+${weekOffset}` : weekOffset} (${startStr} - ${endStr})`;
  };

  const startOfWeek = new Date(mondayDate);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(sundayDate);
  endOfWeek.setHours(23, 59, 59, 999);

  // Filter schedules that fall in current week
  const pendingScheduleIds = pendingSchedules.map(p => p.scheduleId).filter(Boolean) as string[];
  const pendingRecurrenceIds = pendingSchedules
    .map(p => p.originalData?.recurrence_id)
    .filter(Boolean) as string[];

  const weekSchedules = schedules.filter(s => {
    if (pendingScheduleIds.includes(s._id)) return false;
    if (s.recurrence_id && pendingRecurrenceIds.includes(s.recurrence_id)) return false;
    
    return s.status !== 'cancelled' && 
      doesScheduleOverlapRange(s.start_time, s.end_time, startOfWeek, endOfWeek);
  });

  const weekDateStrings = weekDates.map(d => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const sourceClubs = clubs.map(club => {
    const savedCount = schedules.filter(s => {
      if (s.status === 'cancelled') return false;
      const matchesClub = (typeof s.club_id === 'string' ? s.club_id : s.club_id?._id) === club._id;
      return matchesClub && doesScheduleOverlapRange(s.start_time, s.end_time, startOfWeek, endOfWeek);
    }).length;

    const pendingCount = pendingSchedules.filter(p => {
      const matchesClub = p.clubId === club._id;
      return matchesClub && weekDateStrings.includes(p.dateStr);
    }).length;

    const scheduledCount = savedCount + pendingCount;
    const isScheduled = scheduledCount > 0;

    return {
      ...club,
      isScheduled,
      scheduledCount
    };
  });

  const filteredSourceClubs = sourceClubs.filter(club =>
    club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    club.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unscheduledClubs = [...filteredSourceClubs].sort((a, b) => {
    if (a.isScheduled !== b.isScheduled) {
      return a.isScheduled ? 1 : -1;
    }
    return a.name.localeCompare(b.name, 'vi');
  });

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, clubId: string) => {
    if (!canManage) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'club', clubId }));
  };

  const handleScheduleDragStart = (e: React.DragEvent, schedule: ClubSchedule, originDateStr: string, originShift: ShiftType) => {
    if (!canManage) return;
    const clubId = typeof schedule.club_id === 'string' ? schedule.club_id : schedule.club_id?._id;
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({
        type: 'schedule',
        scheduleId: schedule._id,
        clubId: clubId || '',
        originDateStr,
        originShift,
      })
    );
  };

  const handleDrop = (e: React.DragEvent, dayIndex: number, shift: ShiftType) => {
    e.preventDefault();
    if (!canManage) return;
    const rawData = e.dataTransfer.getData('text/plain');
    if (!rawData) return;

    let payload: {
      type: 'club' | 'schedule' | 'pending';
      clubId?: string;
      scheduleId?: string;
      tempId?: string;
      originDateStr?: string;
      originShift?: ShiftType;
    };
    try {
      payload = JSON.parse(rawData);
    } catch {
      payload = { type: 'club', clubId: rawData };
    }

    const targetDate = weekDates[dayIndex];
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const formattedDate = `${yyyy}-${mm}-${dd}`;

    const shiftDef = SHIFT_DEFINITIONS[shift];

    if (payload.type === 'pending') {
      if (payload.originDateStr === formattedDate && payload.originShift === shift) {
        return;
      }
      const tempId = payload.tempId;
      setPendingSchedules(prev => prev.map(p => {
        if (p.tempId === tempId) {
          return {
            ...p,
            dateStr: formattedDate,
            shift,
            startTime: shiftDef.defaultStart,
            endTime: shiftDef.defaultEnd
          };
        }
        return p;
      }));
      toast.success('Đã di chuyển lịch pending');
    } else if (payload.type === 'schedule') {
      if (payload.originDateStr === formattedDate && payload.originShift === shift) {
        return;
      }
      const existing = schedules.find(s => s._id === payload.scheduleId);
      if (!existing) return;

      const startObj = new Date(existing.start_time);
      const endObj = new Date(existing.end_time);
      
      const startHour = startObj.getHours();
      const startMin = startObj.getMinutes();
      const endHour = endObj.getHours();
      const endMin = endObj.getMinutes();

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      let shiftRangeStart = 0;
      let shiftRangeEnd = 0;
      if (shift === 'morning') {
        shiftRangeStart = 7 * 60;
        shiftRangeEnd = 11 * 60 + 30;
      } else if (shift === 'afternoon') {
        shiftRangeStart = 13 * 60;
        shiftRangeEnd = 17 * 60 + 30;
      } else {
        shiftRangeStart = 18 * 60;
        shiftRangeEnd = 21 * 60;
      }

      const formatTimeStr = (hour: number, min: number) => {
        return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      };

      let startTime = shiftDef.defaultStart;
      let endTime = shiftDef.defaultEnd;

      if (startMinutes >= shiftRangeStart && startMinutes <= shiftRangeEnd &&
          endMinutes >= shiftRangeStart && endMinutes <= shiftRangeEnd &&
          startMinutes <= endMinutes) {
        startTime = formatTimeStr(startHour, startMin);
        endTime = formatTimeStr(endHour, endMin);
      }

      const cid = typeof existing.club_id === 'string' ? existing.club_id : existing.club_id?._id || '';
      const clubObj = typeof existing.club_id === 'object' ? existing.club_id : clubs.find(c => c._id === cid);

      let recurrence: RecurrenceConfig | null = null;
      if (existing.recurrence) {
        let untilType: 'semester' | 'weeks' | 'date' | 'none' = 'semester';
        let weeksCount = 8;
        let untilDate = '';
        if (existing.recurrence.until) {
          untilType = 'date';
          const startVal = new Date(existing.start_time).getTime();
          const untilVal = new Date(existing.recurrence.until).getTime();
          const diffMs = untilVal - startVal;
          weeksCount = Math.max(1, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)));
          
          const untilObj = new Date(existing.recurrence.until);
          const uY = untilObj.getFullYear();
          const uM = String(untilObj.getMonth() + 1).padStart(2, '0');
          const uD = String(untilObj.getDate()).padStart(2, '0');
          untilDate = `${uY}-${uM}-${uD}`;
        }
        recurrence = {
          enabled: true,
          type: (existing.recurrence.type as any) || 'weekly',
          untilType,
          weeksCount,
          untilDate,
        };
      }

      const newPending: PendingSchedule = {
        tempId: 'temp_' + Math.random().toString(36).substring(2, 9),
        clubId: cid,
        clubName: clubObj?.name || 'Club',
        clubCode: clubObj?.code || '',
        clubCategory: clubObj?.category || '',
        dateStr: formattedDate,
        shift,
        startTime,
        endTime,
        recurrence,
        scheduleId: existing._id,
        originalData: existing
      };

      setPendingSchedules(prev => [...prev, newPending]);
      toast.success('Đã thêm lịch vào trạng thái pending');
    } else {
      const clubId = payload.clubId || '';
      const targetClub = clubs.find(c => c._id === clubId);
      if (!targetClub) return;

      const newPending: PendingSchedule = {
        tempId: 'temp_' + Math.random().toString(36).substring(2, 9),
        clubId: clubId,
        clubName: targetClub.name,
        clubCode: targetClub.code,
        clubCategory: targetClub.category,
        dateStr: formattedDate,
        shift,
        startTime: shiftDef.defaultStart,
        endTime: shiftDef.defaultEnd,
        recurrence: defaultRecurrence && defaultRecurrence.enabled ? { ...defaultRecurrence } : null
      };

      setPendingSchedules(prev => [...prev, newPending]);
      toast.success('Đã thêm lịch mới vào trạng thái pending');
    }
  };

  const handleOpenRecurrenceModal = (target: 'default' | 'form', currentConfig: RecurrenceConfig | null) => {
    const currentMondayStr = mondayDate.toISOString().split('T')[0];
    const firstActivityDate = getFirstActivityStartDate(schedules, pendingSchedules, currentMondayStr);
    
    if (!firstActivityDate) {
      toast.error('Không có buổi sinh hoạt nào được xếp trong tuần hiện tại để thiết lập lặp lại.');
      return;
    }

    setRecurrenceModalTarget(target);
    setIsUntilCalendarOpen(false);
    setIsRangeCalendarOpen(false);
    
    if (currentConfig && currentConfig.enabled) {
      setModalRecurrenceType(currentConfig.type);
      setModalUntilType('date');
      setModalWeeksCount(currentConfig.weeksCount || 8);
      setModalUntilDate(currentConfig.untilDate || currentConfig.repeatEndDate || '');
      setModalRepeatStartDate(currentConfig.repeatStartDate || currentMondayStr);
      setModalRepeatEndDate(currentConfig.repeatEndDate || '');
    } else {
      setModalRecurrenceType('weekly');
      setModalUntilType('date');
      setModalWeeksCount(8);
      setModalUntilDate('');
      setModalRepeatStartDate(currentMondayStr);
      
      let endD = '';
      if (activeSemester?.end_date) {
        endD = activeSemester.end_date.split('T')[0];
      } else {
        const fallbackEnd = new Date(firstActivityDate.getTime() + 8 * 7 * 24 * 60 * 60 * 1000);
        endD = fallbackEnd.toISOString().split('T')[0];
      }
      setModalRepeatEndDate(endD);
      setModalUntilDate(endD);
    }
    setPreRecurrenceWeekOffset(weekOffset);
    setShowRecurrenceModal(true);
  };

  const handleConfirmRecurrence = async () => {
    const enabled = modalUntilType !== 'none';
    const config: RecurrenceConfig = {
      enabled,
      type: enabled ? modalRecurrenceType : 'weekly',
      untilType: modalUntilType,
      weeksCount: enabled && modalUntilType === 'weeks' ? modalWeeksCount : undefined,
      untilDate: enabled && modalUntilType === 'date' ? modalUntilDate : undefined,
      repeatStartDate: enabled ? modalRepeatStartDate : undefined,
      repeatEndDate: enabled ? modalRepeatEndDate : undefined,
    };

    // Fast validation inside recurrence config modal
    if (enabled) {
      if (!modalRepeatStartDate) {
        toast.error('Vui lòng chọn ngày bắt đầu lặp');
        return;
      }
      if (!modalRepeatEndDate) {
        toast.error('Vui lòng chọn ngày kết thúc lặp');
        return;
      }

      const currentMondayStr = mondayDate.toISOString().split('T')[0];
      const startOfWeekDate = new Date(currentMondayStr);
      startOfWeekDate.setHours(0, 0, 0, 0);

      const repeatStart = new Date(modalRepeatStartDate);
      repeatStart.setHours(0, 0, 0, 0);

      const repeatEnd = new Date(modalRepeatEndDate);
      repeatEnd.setHours(23, 59, 59, 999);

      // Rule 6 & 9: repeat start date must be on or after arranged schedule week
      if (repeatStart < startOfWeekDate) {
        toast.error('Ngày bắt đầu lặp lại không được trước tuần xếp lịch');
        return;
      }

      // Find first scheduled club session start date in anchor week
      const firstActivityDate = getFirstActivityStartDate(schedules, pendingSchedules, currentMondayStr);
      if (!firstActivityDate) {
        toast.error('Không có buổi sinh hoạt nào được xếp trong tuần hiện tại để thiết lập lặp lại.');
        return;
      }

      const firstActivityDay = new Date(firstActivityDate);
      firstActivityDay.setHours(0, 0, 0, 0);

      // Rule 7 & 11: repeatEnd must be on or after the first activity start date
      if (repeatEnd < firstActivityDay) {
        toast.error('Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu buổi sinh hoạt đầu tiên');
        return;
      }

      // Rule 8: repeatEnd must be on or after repeatStart
      if (repeatEnd < repeatStart) {
        toast.error('Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu lặp');
        return;
      }

      // Rule 12: If range contains no valid future occurrence, alert and do not confirm
      const sessionCount = countRecurrenceSessions(
        schedules,
        pendingSchedules,
        currentMondayStr,
        config.type,
        repeatStart,
        repeatEnd
      );

      if (sessionCount === 0) {
        toast.error('Không thể tạo được buổi sinh hoạt nào trong khoảng thời gian này. Vui lòng kiểm tra lại ngày kết thúc lặp.');
        return;
      }
    }

    if (recurrenceModalTarget === 'default') {
      const currentMondayStr = mondayDate.toISOString().split('T')[0];
      
      if (enabled) {
        // Set board-level settings
        setDefaultRecurrence(config);
        setAnchorWeekMonday(currentMondayStr);

        // 1. Propagate to pending schedules in the anchor week
        setPendingSchedules(prev => prev.map(p => {
          if (isDateInAnchorWeek(p.dateStr, currentMondayStr)) {
            return {
              ...p,
              recurrence: { ...config }
            };
          }
          return p;
        }));

        // 2. Apply recurrence to all saved schedules in the anchor week
        const savedInAnchor = schedules.filter(s => {
          if (s.status === 'cancelled') return false;
          const d = new Date(s.start_time);
          const time = d.getTime();
          return time >= startOfWeek.getTime() && time <= endOfWeek.getTime();
        });

        if (savedInAnchor.length > 0) {
          try {
            await Promise.all(savedInAnchor.map(async (s) => {
              const startDateTime = new Date(s.start_time);
              const validation = validateRecurrenceConfig(config, startDateTime, activeSemester);
              if (!validation.isValid) return;
              
              let untilIso: string | undefined = undefined;
              if (validation.effectiveEndDate) {
                untilIso = validation.effectiveEndDate.toISOString();
              }
              
              const recurrencePayload = {
                type: config.type,
                until: untilIso,
                start: config.repeatStartDate ? new Date(config.repeatStartDate).toISOString() : undefined,
              };
              
              const payload = {
                club_id: typeof s.club_id === 'string' ? s.club_id : s.club_id?._id,
                title: s.title,
                description: s.description,
                location: s.location,
                schedule_type: s.schedule_type,
                start_time: s.start_time,
                end_time: s.end_time,
                semester_id: s.semester_id?._id || s.semester_id,
                recurrence: recurrencePayload,
                max_attendees: s.max_attendees || undefined,
              };

              // Delete old series if it was recurring, or single session if one-time
              await clubScheduleApi.delete(s._id, !!s.recurrence_id);
              // Create new series
              await clubScheduleApi.create(payload);
            }));
            
            toast.success(`Đã thiết lập chuỗi lặp ${config.type === 'weekly' ? 'hàng tuần' : config.type === 'biweekly' ? '2 tuần/lần' : 'hàng tháng'} thành công`);
          } catch (err: any) {
            toast.error(err?.message || 'Không thể thiết lập chuỗi lặp cho một số lịch đã lưu');
          }
        } else {
          toast.success(`Đã cấu hình chuỗi lặp ${config.type === 'weekly' ? 'hàng tuần' : config.type === 'biweekly' ? '2 tuần/lần' : 'hàng tháng'} cho tuần hiện tại`);
        }
      } else {
        // Recurrence disabled
        setDefaultRecurrence(config);
        setAnchorWeekMonday(currentMondayStr);

        // 1. Remove recurrence from pending schedules in the anchor week
        setPendingSchedules(prev => prev.map(p => {
          if (isDateInAnchorWeek(p.dateStr, currentMondayStr)) {
            return {
              ...p,
              recurrence: null
            };
          }
          return p;
        }));

        // 2. Call cancelRecurrence API for saved recurring schedules in the anchor week
        const savedRecurringInAnchor = schedules.filter(s => {
          if (s.status === 'cancelled' || !s.recurrence_id) return false;
          const d = new Date(s.start_time);
          const time = d.getTime();
          return time >= startOfWeek.getTime() && time <= endOfWeek.getTime();
        });

        if (savedRecurringInAnchor.length > 0) {
          try {
            await Promise.all(savedRecurringInAnchor.map(s => clubScheduleApi.cancelRecurrence(s._id)));
            toast.success('Đã hủy chuỗi lặp lại và giữ lại lịch tuần hiện tại');
          } catch (err: any) {
            toast.error(err?.message || 'Không thể hủy chuỗi lặp của lịch đã lưu');
          }
        } else {
          toast.success('Đã hủy chuỗi lặp cho tuần hiện tại');
        }
      }
      
      reloadSchedules();
    } else {
      setScheduleRecurrence(config);
      toast.success('Đã cấu hình chuỗi lặp cho lịch hiện tại');
    }
    setShowRecurrenceModal(false);
    if (preRecurrenceWeekOffset !== null) {
      setWeekOffset(preRecurrenceWeekOffset);
      setPreRecurrenceWeekOffset(null);
    }
  };

  const handleCancelAllRecurrence = async () => {
    try {
      const currentMondayStr = mondayDate.toISOString().split('T')[0];
      const startOfWeek = new Date(currentMondayStr);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
      endOfWeek.setHours(23, 59, 59, 999);

      // 1. Find all saved recurring schedules in the anchor week (having recurrence_id)
      const savedInAnchor = schedules.filter(s => {
        if (!s.recurrence_id) return false;
        const d = new Date(s.start_time);
        const time = d.getTime();
        return time >= startOfWeek.getTime() && time <= endOfWeek.getTime();
      });

      if (savedInAnchor.length > 0) {
        await Promise.all(savedInAnchor.map(async (s) => {
          await clubScheduleApi.cancelRecurrence(s._id);
        }));
      }

      // 2. Remove recurrence config from pending schedules in the anchor week
      setPendingSchedules(prev => prev.map(p => {
        if (isDateInAnchorWeek(p.dateStr, currentMondayStr)) {
          return {
            ...p,
            recurrence: null
          };
        }
        return p;
      }));

      // 3. Reset defaultRecurrence to disabled
      setDefaultRecurrence({
        enabled: false,
        type: 'weekly',
        untilType: 'none',
      });

      toast.success('Đã hủy toàn bộ lịch lặp thành công');
      setShowRecurrenceModal(false);
      if (preRecurrenceWeekOffset !== null) {
        setWeekOffset(preRecurrenceWeekOffset);
        setPreRecurrenceWeekOffset(null);
      }
      reloadSchedules();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể hủy toàn bộ lịch lặp');
    }
  };

  const handleOpenCreateModal = (dayIndex?: number, hourSlot?: number) => {
    if (!canManage) return;
    
    const targetDate = dayIndex !== undefined ? weekDates[dayIndex] : new Date();
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    
    const defaultClub = clubs[0];
    const defaultLoc = defaultClub?.classroom || 'Phòng sinh hoạt CLB';
    
    setFormClubId(defaultClub?._id || '');
    setFormTitle(defaultClub ? `Sinh hoạt CLB ${defaultClub.name}` : '');
    setFormDesc('');
    setFormLocation(defaultLoc);
    setFormType('regular');
    setFormDate(`${yyyy}-${mm}-${dd}`);
    setFormStartTime(hourSlot !== undefined ? String(hourSlot).padStart(2, '0') + ':00' : '08:00');
    setFormEndTime(hourSlot !== undefined ? String(hourSlot + 2).padStart(2, '0') + ':00' : '10:00');
    setScheduleRecurrence({
      enabled: false,
      type: 'weekly',
      untilType: 'none',
    });
    setFormMaxAttendees('');
    setFormScheduleId(null);
    setFormShift(null);
    setIsSimplifiedModal(false);
    setShowCreateModal(true);
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClubId || !formTitle || !formDate || !formStartTime || !formEndTime) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    const startDateTime = new Date(`${formDate}T${formStartTime}`);
    const endDateTime = new Date(`${formDate}T${formEndTime}`);

    if (endDateTime <= startDateTime) {
      toast.error('Thời gian kết thúc phải sau thời gian bắt đầu');
      return;
    }

    if (formShift) {
      if (!validateTimeInShift(formStartTime, formEndTime, formShift)) {
        const shiftRange = SHIFT_DEFINITIONS[formShift]?.range || '';
        toast.error(`Thời gian chọn phải nằm trong khung giờ của ca: ${shiftRange}`);
        return;
      }
    }

    // Determine recurrence configuration to save
    let recurrencePayload = undefined;
    
    // Only keep recurrence payload if editing an existing schedule
    const isEdit = !!(formScheduleId || activePendingSchedule?.scheduleId);
    
    if (isEdit) {
      const targetId = formScheduleId || activePendingSchedule?.scheduleId;
      const existing = schedules.find(s => s._id === targetId);
      if (existing && existing.recurrence) {
        recurrencePayload = {
          type: existing.recurrence.type,
          until: existing.recurrence.until,
          start: existing.recurrence.start
        };
      }
    }

    const payload = {
      club_id: formClubId,
      title: formTitle,
      description: formDesc,
      location: formLocation,
      schedule_type: formType,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      semester_id: activeSemester?._id || semesters[0]?._id,
      recurrence: recurrencePayload,
      max_attendees: formMaxAttendees ? parseInt(formMaxAttendees) : undefined,
    };

    const targetScheduleId = formScheduleId || activePendingSchedule?.scheduleId;
    const existing = targetScheduleId ? schedules.find(s => s._id === targetScheduleId) : null;

    if (existing && existing.recurrence_id) {
      setPendingUpdatePayload({
        payload,
        scheduleId: targetScheduleId,
        activePendingSchedule
      });
      setShowUpdateSeriesConfirmModal(true);
      return;
    }

    try {
      if (activePendingSchedule) {
        if (activePendingSchedule.scheduleId) {
          const singlePayload = { ...payload, recurrence: undefined };
          await clubScheduleApi.update(activePendingSchedule.scheduleId, singlePayload);
          toast.success('Đã cập nhật lịch sinh hoạt thành công');
        } else {
          await clubScheduleApi.create(payload);
          toast.success(recurrencePayload ? 'Đã xếp chuỗi lịch sinh hoạt thành công' : 'Đã xếp lịch sinh hoạt thành công');
        }
        setPendingSchedules(prev => prev.filter(p => p.tempId !== activePendingSchedule.tempId));
        setShowCreateModal(false);
        setActivePendingSchedule(null);
        reloadSchedules();
      } else {
        if (formScheduleId) {
          const singlePayload = { ...payload, recurrence: undefined };
          await clubScheduleApi.update(formScheduleId, singlePayload);
          toast.success('Đã cập nhật lịch sinh hoạt thành công');
        } else {
          await clubScheduleApi.create(payload);
          toast.success(recurrencePayload ? 'Đã xếp chuỗi lịch sinh hoạt thành công' : 'Đã xếp lịch sinh hoạt thành công');
        }
        setShowCreateModal(false);
        reloadSchedules();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tạo/cập nhật lịch hoạt động');
    }
  };

  const handleUpdateConfirm = async (updateSeries: boolean) => {
    if (!pendingUpdatePayload) return;
    const { payload, scheduleId, activePendingSchedule } = pendingUpdatePayload;

    try {
      if (updateSeries) {
        await clubScheduleApi.update(scheduleId, payload);
        toast.success('Đã cập nhật chuỗi lịch sinh hoạt thành công');
      } else {
        const singlePayload = { ...payload, recurrence: undefined };
        await clubScheduleApi.update(scheduleId, singlePayload);
        toast.success('Đã cập nhật buổi sinh hoạt thành công');
      }

      if (activePendingSchedule) {
        setPendingSchedules(prev => prev.filter(p => p.tempId !== activePendingSchedule.tempId));
      }

      setShowUpdateSeriesConfirmModal(false);
      setPendingUpdatePayload(null);
      setShowCreateModal(false);
      setActivePendingSchedule(null);
      reloadSchedules();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể cập nhật lịch hoạt động');
    }
  };

  const handleDeleteClick = (schedule: ClubSchedule) => {
    setSelectedSchedule(schedule);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (deleteSeries: boolean) => {
    if (!selectedSchedule) return;
    try {
      await clubScheduleApi.delete(selectedSchedule._id, deleteSeries);
      toast.success(deleteSeries ? 'Đã hủy toàn bộ chuỗi lịch' : 'Đã hủy buổi sinh hoạt thành công');
      setShowDeleteModal(false);
      setSelectedSchedule(null);
      reloadSchedules();
    } catch {
      toast.error('Không thể hủy lịch hoạt động');
    }
  };

  const handleCancelRecurrenceConfirm = async () => {
    if (!formScheduleId) return;
    try {
      await clubScheduleApi.cancelRecurrence(formScheduleId);
      toast.success('Đã hủy chuỗi lặp lại và giữ lại lịch tuần hiện tại');
      setShowCancelRecurrenceConfirmModal(false);
      setShowCreateModal(false);
      reloadSchedules();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể hủy chuỗi lặp lại');
    }
  };


  const [isExporting, setIsExporting] = useState(false);

  const handleExportWeeklySchedule = async () => {
    if (isExporting) return;
    setIsExporting(true);

    // Wait a brief moment to ensure fonts/layout are stable
    await new Promise((resolve) => setTimeout(resolve, 300));

    const element = document.getElementById('schedule-board-export');
    if (!element) {
      toast.error('Không tìm thấy vùng dữ liệu lịch tuần để xuất');
      setIsExporting(false);
      return;
    }

    try {
      const { toBlob } = await import('html-to-image');

      const blob = await toBlob(element, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        }
      });

      if (!blob) {
        throw new Error('Image generation returned empty blob');
      }

      const yyyy = mondayDate.getFullYear();
      const mm = String(mondayDate.getMonth() + 1).padStart(2, '0');
      const dd = String(mondayDate.getDate()).padStart(2, '0');
      const filename = `club-weekly-schedule-${yyyy}-${mm}-${dd}.png`;

      // Copy to clipboard or fallback to download
      if (navigator.clipboard && navigator.clipboard.write) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob
            })
          ]);
          toast.success('Đã sao chép hình ảnh lịch tuần vào bộ nhớ tạm');
        } catch (clipErr) {
          console.warn('Clipboard write failed, falling back to download:', clipErr);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.info('Đã tự động tải xuống hình ảnh lịch tuần (Trình duyệt không cho phép sao chép trực tiếp)');
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.info('Trình duyệt không hỗ trợ sao chép ảnh, đã tải xuống file PNG thay thế');
      }
    } catch (err) {
      console.error('Lỗi khi xuất ảnh lịch tuần:', err);
      toast.error('Không thể xuất ảnh lịch tuần. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  // Timeline view calculations
  const selectedDaySchedules = schedules
    .filter(s => {
      if (pendingScheduleIds.includes(s._id)) return false;
      if (s.recurrence_id && pendingRecurrenceIds.includes(s.recurrence_id)) return false;
      return s.status !== 'cancelled' && doesScheduleOccurOnDate(s, selectedDate);
    })
    .map(s => {
      const { start, end } = getVisibleScheduleTimesForDate(s, selectedDate);
      return {
        ...s,
        visibleStart: start,
        visibleEnd: end
      };
    })
    .sort((a, b) => {
      const timeDiff = a.visibleStart.getTime() - b.visibleStart.getTime();
      if (timeDiff !== 0) return timeDiff;
      const endTimeDiff = a.visibleEnd.getTime() - b.visibleEnd.getTime();
      if (endTimeDiff !== 0) return endTimeDiff;
      return a.title.localeCompare(b.title);
    });

  const morningSchedules = selectedDaySchedules.filter(s => s.visibleStart.getHours() < 13);
  const afternoonSchedules = selectedDaySchedules.filter(s => s.visibleStart.getHours() >= 13 && s.visibleStart.getHours() < 18);
  const eveningSchedules = selectedDaySchedules.filter(s => s.visibleStart.getHours() >= 18);



  return (
    <div className="p-6 space-y-6 animate-fadeIn">
      {/* Hidden schedule board for image export */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <div id="schedule-board-export" className="bg-white p-6 rounded-2xl border border-slate-200 w-[1200px] flex flex-col gap-4 text-slate-800">
          {/* Title & Date Range */}
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <CalendarRange size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 tracking-tight">Lịch biểu hoạt động CLB</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{getHeaderDateRangeString()}</p>
            </div>
          </div>

          {/* The grid board */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden flex flex-col bg-white">
            {/* Board Header */}
            <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: '120px repeat(7, 1fr)' }}>
              <div className="p-3 text-center border-r border-slate-200 flex items-center justify-center gap-1.5">
                <Clock3 className="h-4 w-4 text-slate-500" />
                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Ca hoạt động</p>
              </div>
              {weekDates.map((date, idx) => {
                const isToday = new Date().toDateString() === date.toDateString();
                return (
                  <div key={idx} className={`p-3 text-center border-r border-slate-200 last:border-0 ${isToday ? 'bg-blue-50/50' : ''}`}>
                    <p className={`text-xs font-extrabold ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                      {idx === 6 ? 'CN' : `Thứ ${idx + 2}`}
                    </p>
                    <p className={`text-[10px] font-bold mt-0.5 ${isToday ? 'text-blue-500' : 'text-slate-400'}`}>
                      {date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Board Body */}
            <div className="flex flex-col divide-y divide-slate-200 bg-white">
              {(['morning', 'afternoon', 'evening'] as ShiftType[]).map((shift) => {
                const shiftDef = SHIFT_DEFINITIONS[shift];
                return (
                  <div key={shift} className="grid divide-x divide-slate-200" style={{ gridTemplateColumns: '120px repeat(7, 1fr)' }}>
                    <div className="p-3 flex flex-col justify-center items-center text-center bg-slate-50 border-r border-slate-200 gap-1 select-none">
                      <span>
                        {shift === 'morning' && <Sunrise className="h-5 w-5 text-amber-500" />}
                        {shift === 'afternoon' && <Sun className="h-5 w-5 text-orange-500" />}
                        {shift === 'evening' && <Moon className="h-5 w-5 text-blue-600" />}
                      </span>
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wide">{shiftDef.label}</span>
                      <span className="text-[10px] font-bold text-slate-400/80">{shiftDef.range}</span>
                    </div>

                    {weekDates.map((dayDate, dayIdx) => {
                      const isToday = new Date().toDateString() === dayDate.toDateString();
                      const shiftSchedules = getSchedulesForDayAndShift(dayDate, shift, weekSchedules);

                      const yyyy = dayDate.getFullYear();
                      const mm = String(dayDate.getMonth() + 1).padStart(2, '0');
                      const dd = String(dayDate.getDate()).padStart(2, '0');
                      const cellDateStr = `${yyyy}-${mm}-${dd}`;

                      const cellPendingSchedules = getCellPendingSchedules(
                        dayDate,
                        cellDateStr,
                        shift,
                        pendingSchedules,
                        activeSemester,
                        defaultRecurrence,
                        anchorWeekMonday
                      );

                      return (
                        <div
                          key={dayIdx}
                          className={`p-2 min-h-[140px] bg-white border border-slate-100 flex flex-col gap-1.5 ${isToday ? 'bg-blue-50/10' : ''}`}
                        >
                          {shiftSchedules.length === 0 && cellPendingSchedules.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-[9px] font-semibold text-slate-300 text-center py-6 select-none">
                              Trống
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {shiftSchedules.map((schedule) => {
                                const { start, end } = getVisibleScheduleTimesForDate(schedule, dayDate);
                                const timeStr = `${start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
                                const accent = getClubAccentColor(schedule);
                                const styles = accentStyles[accent];

                                return (
                                  <div
                                    key={schedule._id}
                                    className={cn(
                                      "p-2 backdrop-blur-md rounded-lg shadow-sm flex flex-col justify-between overflow-hidden border border-l-[4px] relative text-left transition-all",
                                      styles.card,
                                      styles.borderL
                                    )}
                                  >
                                    <div className="min-h-0 flex-1 overflow-hidden select-none">
                                      <p className={cn("text-[10px] font-extrabold leading-tight line-clamp-2 break-words", styles.title)} title={schedule.title}>
                                        {schedule.title}
                                      </p>
                                      <div className={cn("flex flex-col gap-0.5 mt-1.5 text-[8px] font-bold", styles.sub)}>
                                        <div className="flex items-center gap-1 shrink-0 opacity-90">
                                          <Clock size={8} className={cn("shrink-0", styles.icon)} />
                                          <span>{timeStr}</span>
                                        </div>
                                        {(schedule.location || (typeof schedule.club_id === 'object' && schedule.club_id?.classroom)) && (
                                          <div className="flex items-center gap-1 truncate opacity-90" title={schedule.location || (typeof schedule.club_id === 'object' ? schedule.club_id?.classroom : '')}>
                                            <MapPin size={8} className={cn("shrink-0", styles.icon)} />
                                            <span className="truncate">{schedule.location || (typeof schedule.club_id === 'object' ? schedule.club_id?.classroom : '')}</span>
                                          </div>
                                        )}
                                      </div>
                                      {renderRecurrenceBadge(schedule, 'sm')}
                                    </div>
                                  </div>
                                );
                              })}

                              {cellPendingSchedules.map((pending) => {
                                return (
                                  <div
                                    key={pending.tempId}
                                    className="p-2 bg-amber-500/15 backdrop-blur-md border border-amber-500/35 border-l-[4px] border-l-amber-600 rounded-lg shadow-sm flex flex-col justify-between overflow-hidden relative text-left transition-all"
                                  >
                                    <div className="min-h-0 flex-1 overflow-hidden select-none">
                                      <p className="text-[10px] font-black text-amber-950 leading-tight line-clamp-2 break-words" title={pending.originalData?.title || pending.clubName}>
                                        {pending.originalData?.title || pending.clubName}
                                      </p>
                                      <div className="flex flex-col gap-0.5 mt-1.5 text-[8px] text-amber-900/90 font-extrabold">
                                        <div className="flex items-center gap-1 shrink-0">
                                          <Clock size={8} className="text-amber-600 shrink-0" />
                                          <span className="truncate">
                                            {pending.startTime} - {pending.endTime}
                                          </span>
                                        </div>
                                        {pending.originalData?.location && (
                                          <div className="flex items-center gap-1 truncate opacity-90" title={pending.originalData.location}>
                                            <MapPin size={8} className="text-amber-600 shrink-0" />
                                            <span className="truncate">{pending.originalData.location}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-[7px] font-black text-amber-700 bg-amber-500/20 rounded px-1 py-0.5 mt-1.5 w-fit shrink-0">
                                        {pending.isPreview 
                                          ? 'Preview lặp' 
                                          : isDateInAnchorWeek(pending.dateStr, anchorWeekMonday) && defaultRecurrence.enabled
                                            ? 'Chưa lưu (Lặp)'
                                            : 'Chưa lưu'}
                                      </div>
                                    </div>

                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {/* Header controls matching Figma header style */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/50 backdrop-blur-md border border-white/60 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <CalendarRange size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight">Lịch biểu hoạt động CLB</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{getHeaderDateRangeString()}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Week Context Widget */}
          {(() => {
            const isCurrentWeek = weekOffset === 0;
            const currentMondayStr = getMondayDateStr(mondayDate);
            
            // Check if viewed week has any recurring schedule items
            const repeatedSchedulesInWeek = weekSchedules.filter(s => !!s.recurrence_id);
            const containsRepeated = repeatedSchedulesInWeek.length > 0;
            
            // Check if viewed week is the source week for any recurrence series
            const isSourceWeek = schedules.some(s => 
              s.recurrence_id && 
              s.recurrence?.source_week_start_date && 
              getMondayDateStr(s.recurrence.source_week_start_date) === currentMondayStr
            );

            let statusLabel = 'Tuần bình thường';
            let badgeColor = 'bg-slate-100 text-slate-600 border-slate-200/50';
            
            if (isCurrentWeek && isSourceWeek) {
              statusLabel = 'Tuần hiện tại & Tuần nguồn';
              badgeColor = 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
            } else if (isCurrentWeek) {
              statusLabel = 'Tuần hiện tại';
              badgeColor = 'bg-blue-500/10 text-blue-700 border-blue-500/20';
            } else if (isSourceWeek) {
              statusLabel = 'Tuần nguồn lặp';
              badgeColor = 'bg-purple-500/10 text-purple-700 border-purple-500/20';
            } else if (containsRepeated) {
              statusLabel = 'Tuần lặp lại';
              badgeColor = 'bg-amber-500/10 text-amber-700 border-amber-500/20';
            }

            // Find relevant recurrence shown in the current viewed week to display its source week range
            const relevantRecurrence = repeatedSchedulesInWeek.find(s => !!s.recurrence_id && s.recurrence?.source_week_start_date);
            const sourceWeekRangeStr = relevantRecurrence?.recurrence?.source_week_start_date
              ? `${new Date(relevantRecurrence.recurrence.source_week_start_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} - ${new Date(relevantRecurrence.recurrence.source_week_end_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
              : null;

            return (
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className={cn("px-2.5 py-0.5 rounded-full border text-[10px] uppercase font-black tracking-wide", badgeColor)}>
                  {statusLabel}
                </span>
                {sourceWeekRangeStr && (
                  <span className="text-slate-400 font-bold border-l border-slate-200/80 pl-2">
                    Nguồn: {sourceWeekRangeStr}
                  </span>
                )}
                {preRecurrenceWeekOffset !== null && weekOffset !== preRecurrenceWeekOffset && (
                  <button
                    type="button"
                    onClick={() => setWeekOffset(preRecurrenceWeekOffset)}
                    className="ml-1 px-2 py-0.5 bg-amber-500 text-white hover:bg-amber-600 text-[10px] font-black rounded-lg transition-all cursor-pointer animate-pulse"
                  >
                    Quay lại tuần ban đầu
                  </button>
                )}
              </div>
            );
          })()}

          {/* Week Nav controls */}
          <div className="flex p-1 bg-white/80 rounded-xl border border-slate-200/60 shadow-sm items-center gap-1">
            <button onClick={() => setWeekOffset(prev => prev - 1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-all cursor-pointer">
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent rounded-lg transition-all cursor-pointer"
            >
              Về tuần hiện tại
            </button>

            {(() => {
              const repeatedSchedulesInWeek = weekSchedules.filter(s => !!s.recurrence_id);
              const relevantRecurrence = repeatedSchedulesInWeek.find(s => !!s.recurrence_id && s.recurrence?.source_week_start_date);
              if (!relevantRecurrence) return null;

              const isAlreadySource = getMondayDateStr(relevantRecurrence.recurrence?.source_week_start_date) === getMondayDateStr(mondayDate);

              const handleGoToSource = () => {
                if (relevantRecurrence.recurrence?.source_week_start_date) {
                  const targetDate = new Date(relevantRecurrence.recurrence.source_week_start_date);
                  setWeekOffset(getWeekOffsetFromDate(targetDate));
                }
              };

              return (
                <button
                  onClick={handleGoToSource}
                  disabled={isAlreadySource}
                  className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:hover:bg-transparent rounded-lg transition-all border-l border-slate-200 pl-2 cursor-pointer"
                >
                  Về tuần nguồn
                </button>
              );
            })()}

            <button onClick={() => setWeekOffset(prev => prev + 1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-all cursor-pointer">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* View selector: Tuần vs Ngày */}
          <div className="flex p-1 bg-white/80 rounded-xl border border-slate-200/60 shadow-sm">
            <button onClick={() => setView('weekly')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${view === 'weekly' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Grid size={14} /> Lịch Tuần
            </button>
            <button onClick={() => { setView('daily'); setSelectedDate(weekDates[0]); }} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${view === 'daily' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <List size={14} /> Lịch Ngày
            </button>
          </div>

          <button
            onClick={handleExportWeeklySchedule}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 h-10 bg-white hover:bg-slate-50 border border-slate-200/60 text-slate-700 hover:text-slate-800 disabled:opacity-50 text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all shrink-0"
            title="Sao chép hình ảnh lịch tuần"
          >
            {isExporting ? (
              <span className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin shrink-0" />
            ) : (
              <Copy size={14} className="shrink-0 text-slate-500" />
            )}
            <span>Sao chép lịch tuần</span>
          </button>

          {canManage && (
            <button 
              onClick={() => handleOpenRecurrenceModal('default', defaultRecurrence)} 
              aria-label="Open advanced schedule settings"
              title="Cấu hình lặp lại mặc định"
              className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/10 hover:shadow-lg transition-all cursor-pointer"
            >
              <SlidersHorizontal size={18} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-20 bg-white/40 rounded-xl animate-pulse" />
          <div className="h-[400px] bg-white/40 rounded-xl animate-pulse" />
        </div>
      ) : view === 'weekly' ? (
        /* Weekly shift board view with Left sidebar (Unscheduled Bucket) */
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Left panel: Unscheduled Bucket */}
          <div className="w-full lg:w-[280px] shrink-0 bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm flex flex-col max-h-[700px] overflow-hidden">
            <div className="p-4 border-b border-white/50 flex justify-between items-center bg-white/30">
              <h2 className="text-sm font-bold text-blue-900 flex items-center gap-1.5">
                <Activity size={16} className="text-blue-500" /> Câu lạc bộ
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
                {unscheduledClubs.length}
              </span>
            </div>
            
            <div className="p-3 border-b border-white/40">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm CLB..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white/50 border border-slate-200/50 rounded-xl text-xs focus:outline-none focus:border-blue-500/70"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {unscheduledClubs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-medium">
                  Tần suất xếp lịch đã đủ tuần này
                </div>
              ) : (
                unscheduledClubs.map(club => {
                  const accent = 'blue';
                  const styles = accentStyles[accent];
                  return (
                    <div
                      key={club._id}
                      draggable={canManage}
                      onDragStart={(e) => handleDragStart(e, club._id)}
                      className={cn(
                        "p-3 border border-l-[4px] rounded-xl shadow-sm hover:shadow-md transition-all group text-left backdrop-blur-sm",
                        canManage ? "cursor-grab active:cursor-grabbing" : "",
                        styles.borderL,
                        club.isScheduled
                          ? "opacity-50 bg-slate-100/50 border-slate-200/40"
                          : cn("bg-white/60 border-slate-200/60", styles.card)
                      )}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col gap-1">
                          <p className={cn("text-xs font-bold transition-colors leading-tight", club.isScheduled ? "text-slate-500" : styles.title)}>{club.name}</p>
                          {club.isScheduled && (
                            <span className="w-fit text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-600">
                              Đã xếp lịch ({club.scheduledCount})
                            </span>
                          )}
                        </div>
                        <span className={cn("text-[9px] font-black tracking-wider uppercase shrink-0", club.isScheduled ? "text-slate-400" : styles.icon)}>{club.code}</span>
                      </div>
                      <div className={cn("flex items-center gap-2 text-[10px] mt-2 font-medium", club.isScheduled ? "text-slate-400" : styles.sub)}>
                        <span className="flex items-center gap-0.5"><Clock size={10} /> 2 tiếng/tuần</span>
                        <span>·</span>
                        <span className="capitalize">{club.category}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Area: Shift-Based Board */}
          <div className="flex-1 bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto w-full">
              <div className="min-w-[1000px] flex flex-col">
                {/* Board Header */}
                <div className="grid border-b border-slate-200/60 bg-white/60" style={{ gridTemplateColumns: '120px repeat(7, 1fr)' }}>
                  <div className="p-3 text-center border-r border-slate-200/40 flex items-center justify-center gap-1.5">
                    <Clock3 className="h-4 w-4 text-slate-500" />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Ca hoạt động</p>
                  </div>
                  {weekDates.map((date, idx) => {
                    const isToday = new Date().toDateString() === date.toDateString();
                    return (
                      <div key={idx} className={`p-3 text-center border-r border-slate-200/40 last:border-0 ${isToday ? 'bg-blue-500/5' : ''}`}>
                        <p className={`text-xs font-extrabold ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                          {idx === 6 ? 'CN' : `Thứ ${idx + 2}`}
                        </p>
                        <p className={`text-[10px] font-bold mt-0.5 ${isToday ? 'text-blue-500' : 'text-slate-400'}`}>
                          {date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Board Body */}
                <div id="schedule-grid-body" className="flex flex-col divide-y divide-slate-200/40 max-h-[700px] overflow-y-auto bg-slate-50/30">
                  {(['morning', 'afternoon', 'evening'] as ShiftType[]).map((shift) => {
                    const shiftDef = SHIFT_DEFINITIONS[shift];
                    return (
                      <div key={shift} className="grid divide-x divide-slate-200/40" style={{ gridTemplateColumns: '120px repeat(7, 1fr)' }}>
                        <div className="p-3 flex flex-col justify-center items-center text-center bg-white/50 border-r border-slate-200/40 select-none gap-1">
                          <span>
                            {shift === 'morning' && <Sunrise className="h-5 w-5 text-amber-500" />}
                            {shift === 'afternoon' && <Sun className="h-5 w-5 text-orange-500" />}
                            {shift === 'evening' && <Moon className="h-5 w-5 text-blue-600" />}
                          </span>
                          <span className="text-xs font-black text-slate-700 uppercase tracking-wide">{shiftDef.label}</span>
                          <span className="text-[10px] font-bold text-slate-400/80">{shiftDef.range}</span>
                        </div>

                        {weekDates.map((dayDate, dayIdx) => {
                          const isToday = new Date().toDateString() === dayDate.toDateString();
                          const shiftSchedules = getSchedulesForDayAndShift(dayDate, shift, weekSchedules);

                          const yyyy = dayDate.getFullYear();
                          const mm = String(dayDate.getMonth() + 1).padStart(2, '0');
                          const dd = String(dayDate.getDate()).padStart(2, '0');
                          const cellDateStr = `${yyyy}-${mm}-${dd}`;

                          const cellPendingSchedules = getCellPendingSchedules(
                            dayDate,
                            cellDateStr,
                            shift,
                            pendingSchedules,
                            activeSemester,
                            defaultRecurrence,
                            anchorWeekMonday
                          );

                          return (
                            <div
                              key={dayIdx}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => handleDrop(e, dayIdx, shift)}
                              className={`p-2 min-h-[160px] bg-white/40 hover:bg-blue-500/[0.02] border border-dashed border-slate-200/60 rounded-xl transition-colors flex flex-col space-y-1.5 ${isToday ? 'bg-blue-50/5' : ''}`}
                            >
                              <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-[220px]">
                                {shiftSchedules.length === 0 && cellPendingSchedules.length === 0 ? (
                                  <div className="flex-1 flex items-center justify-center text-[9px] font-semibold text-slate-300 text-center py-6 select-none">
                                    Trống
                                  </div>
                                ) : (
                                  <>
                                    {shiftSchedules.map((schedule) => {
                                      const { start, end } = getVisibleScheduleTimesForDate(schedule, dayDate);
                                      const timeStr = `${start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
                                      const accent = getClubAccentColor(schedule);
                                      const styles = accentStyles[accent];

                                      return (
                                        <div
                                          key={schedule._id}
                                          draggable={canManage}
                                          onDragStart={(e) => handleScheduleDragStart(e, schedule, cellDateStr, shift)}
                                          onDoubleClick={(e) => { if (!canManage) return; e.stopPropagation(); handleConfigureSaved(schedule); }}
                                          className={cn(
                                            "p-2 backdrop-blur-md rounded-lg shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden border border-l-[4px] relative group transition-all text-left",
                                            canManage ? 'cursor-grab active:cursor-grabbing' : '',
                                            styles.card,
                                            styles.borderL
                                          )}
                                        >
                                          <div className="min-h-0 flex-1 overflow-hidden select-none">
                                            <p className={cn("text-[10px] font-extrabold leading-tight line-clamp-2 break-words pr-5", styles.title)} title={schedule.title}>
                                              {schedule.title}
                                            </p>
                                            <div className={cn("flex flex-col gap-0.5 mt-1.5 text-[8px] font-bold", styles.sub)}>
                                              <div className="flex items-center gap-1 shrink-0 opacity-90">
                                                <Clock size={8} className={cn("shrink-0", styles.icon)} />
                                                <span>{timeStr}</span>
                                              </div>
                                              {(schedule.location || (typeof schedule.club_id === 'object' && schedule.club_id?.classroom)) && (
                                                <div className="flex items-center gap-1 truncate opacity-90" title={schedule.location || (typeof schedule.club_id === 'object' ? schedule.club_id?.classroom : '')}>
                                                  <MapPin size={8} className={cn("shrink-0", styles.icon)} />
                                                  <span className="truncate">{schedule.location || (typeof schedule.club_id === 'object' ? schedule.club_id?.classroom : '')}</span>
                                                </div>
                                              )}
                                            </div>
                                            {renderRecurrenceBadge(schedule, 'sm')}
                                          </div>
                                          {canManage && (
                                            <div className="absolute right-1 top-1.5 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleConfigureSaved(schedule);
                                                }}
                                                title="Configure"
                                                className="p-0.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded transition-all cursor-pointer"
                                              >
                                                <Settings size={9} />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteClick(schedule);
                                                }}
                                                title="Delete"
                                                className="p-0.5 bg-white border border-slate-200 hover:bg-red-50 text-red-500 rounded transition-all cursor-pointer"
                                              >
                                                <Trash2 size={9} />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}

                                    {cellPendingSchedules.map((pending) => {
                                      const isPreview = pending.isPreview;
                                      return (
                                        <div
                                          key={pending.tempId}
                                          draggable={canManage && !isPreview}
                                          onDragStart={(e) => {
                                            if (isPreview) return;
                                            handlePendingDragStart(e, pending.tempId, pending.dateStr, pending.shift);
                                          }}
                                          onDoubleClick={(e) => { if (!canManage) return; e.stopPropagation(); handleConfigurePending(pending); }}
                                          className={cn(
                                            "p-2 backdrop-blur-md rounded-lg shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden relative group transition-all text-left",
                                            isPreview
                                              ? "bg-amber-500/5 border border-dashed border-amber-500/25 border-l-[4px] border-l-amber-500/50"
                                              : "bg-amber-500/15 border border-amber-500/35 border-l-[4px] border-l-amber-600",
                                            canManage && !isPreview ? 'cursor-grab active:cursor-grabbing' : ''
                                          )}
                                        >
                                          <div className="min-h-0 flex-1 overflow-hidden select-none">
                                            <p className="text-[10px] font-black text-amber-950 leading-tight line-clamp-2 break-words pr-8" title={pending.originalData?.title || pending.clubName}>
                                              {pending.originalData?.title || pending.clubName}
                                            </p>
                                            <div className="flex flex-col gap-0.5 mt-1.5 text-[8px] text-amber-900/90 font-extrabold">
                                              <div className="flex items-center gap-1 shrink-0">
                                                <Clock size={8} className="text-amber-600 shrink-0" />
                                                <span className="truncate">
                                                  {pending.startTime} - {pending.endTime}
                                                </span>
                                              </div>
                                              {pending.originalData?.location && (
                                                <div className="flex items-center gap-1 truncate opacity-90" title={pending.originalData.location}>
                                                  <MapPin size={8} className="text-amber-600 shrink-0" />
                                                  <span className="truncate">{pending.originalData.location}</span>
                                                </div>
                                              )}
                                            </div>
                                            <div className="text-[7px] font-black text-amber-700 bg-amber-500/20 rounded px-1 py-0.5 mt-1.5 w-fit shrink-0">
                                              {isPreview 
                                                ? 'Preview lặp' 
                                                : isDateInAnchorWeek(pending.dateStr, anchorWeekMonday) && defaultRecurrence.enabled
                                                  ? 'Chưa lưu (Lặp)'
                                                  : 'Chưa lưu'}
                                            </div>
                                          </div>

                                          {canManage && (
                                            <div className="absolute right-1 top-1.5 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleConfigurePending(pending);
                                                }}
                                                title="Configure"
                                                className="p-0.5 bg-white border border-amber-200 hover:bg-amber-100 text-amber-700 rounded transition-all cursor-pointer"
                                              >
                                                <Settings size={9} />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleRemovePending(pending.originalTempId || pending.tempId);
                                                }}
                                                title="Remove"
                                                className="p-0.5 bg-white border border-amber-200 hover:bg-red-50 text-red-500 rounded transition-all cursor-pointer"
                                              >
                                                <X size={9} />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Daily shift timeline view */
        <div className="space-y-6">
          {/* Day selection header navigation bar */}
          <div className="flex justify-between items-center bg-white/50 backdrop-blur-md border border-white/60 p-2 rounded-2xl shadow-sm overflow-x-auto">
            <div className="flex gap-2 w-full justify-between md:justify-start">
              {weekDates.map((date, idx) => {
                const isSelected = selectedDate.toDateString() === date.toDateString();
                const isToday = new Date().toDateString() === date.toDateString();
                const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(date)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl min-w-[56px] transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                        : isToday
                        ? 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20'
                        : 'bg-white/40 text-slate-600 hover:bg-white/80'
                    }`}
                  >
                    <span className="text-[10px] font-bold tracking-wider uppercase opacity-80">
                      {idx === 6 ? 'SUN' : dayNames[idx + 1] === 'CN' ? 'SUN' : dayNames[idx + 1]}
                    </span>
                    <span className="text-lg font-black mt-1">
                      {date.getDate()}
                    </span>
                    {isSelected && (
                      <span className="w-4 h-0.5 bg-white rounded-full mt-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timeline lists grouped by Shift */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Morning Shift */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md border border-white/70 p-3 rounded-xl shadow-sm w-fit">
                <Sunrise className="h-5 w-5 text-amber-500" />
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Ca Sáng</span>
                <span className="text-[10px] font-bold text-slate-400">07:00 - 11:30</span>
              </div>

              <div className="relative pl-6 space-y-4 border-l border-slate-200/80 ml-4 py-2">
                {morningSchedules.length === 0 ? (
                  <div className="relative p-6 border border-dashed border-slate-300 rounded-2xl bg-white/20 text-center">
                    <span className="absolute left-[-29px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-slate-300 bg-white" />
                    <p className="text-xs font-semibold text-slate-400">Không có lịch hoạt động ca sáng</p>
                  </div>
                ) : (
                  morningSchedules.map(schedule => {
                    const start = schedule.visibleStart;
                    const end = schedule.visibleEnd;
                    const accent = getClubAccentColor(schedule);
                    const styles = accentStyles[accent];

                    return (
                      <div key={schedule._id} className="relative group">
                        {/* Timeline Node dot */}
                        <span className={cn("absolute left-[-32px] top-4 w-3.5 h-3.5 rounded-full border-2 bg-white", styles.icon.replace('text-', 'border-'))} />
                        
                        {/* Event Card */}
                        <div
                          onDoubleClick={(e) => { if (!canManage) return; e.stopPropagation(); handleConfigureSaved(schedule); }}
                          className={cn(
                            "p-4 backdrop-blur-md rounded-2xl shadow-sm hover:shadow-md transition-all flex justify-between items-start border border-l-4",
                            styles.card,
                            styles.borderL
                          )}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className={cn("text-sm font-extrabold", styles.title)}>{schedule.title}</h3>
                              <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                                {typeLabels[schedule.schedule_type]}
                              </span>
                              {renderRecurrenceBadge(schedule)}
                            </div>
                            <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold", styles.sub)}>
                              <span className="flex items-center gap-1"><Clock size={11} className={styles.icon} /> {start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="flex items-center gap-1">
                                <MapPin size={11} className={styles.icon} />{' '}
                                {schedule.location ||
                                  (typeof schedule.club_id === 'object'
                                    ? schedule.club_id?.classroom
                                    : '')}
                              </span>
                              {schedule.max_attendees && <span className="flex items-center gap-1"><Users size={11} className={styles.icon} /> Hạn mức: {schedule.max_attendees}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded", styles.badge)}>Upcoming</span>
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfigureSaved(schedule);
                                  }}
                                  className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                                  title="Configure"
                                >
                                  <Settings size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(schedule);
                                  }}
                                  className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Afternoon Shift */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md border border-white/70 p-3 rounded-xl shadow-sm w-fit">
                <Sun className="h-5 w-5 text-orange-500" />
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Ca Chiều</span>
                <span className="text-[10px] font-bold text-slate-400">13:00 - 17:30</span>
              </div>

              <div className="relative pl-6 space-y-4 border-l border-slate-200/80 ml-4 py-2">
                {afternoonSchedules.length === 0 ? (
                  <div className="relative p-6 border border-dashed border-slate-300 rounded-2xl bg-white/20 text-center">
                    <span className="absolute left-[-29px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-slate-300 bg-white" />
                    <p className="text-xs font-semibold text-slate-400">Nghỉ ngơi / Open Time</p>
                  </div>
                ) : (
                  afternoonSchedules.map(schedule => {
                    const start = schedule.visibleStart;
                    const end = schedule.visibleEnd;
                    const accent = getClubAccentColor(schedule);
                    const styles = accentStyles[accent];

                    return (
                      <div key={schedule._id} className="relative group">
                        {/* Timeline Node dot */}
                        <span className={cn("absolute left-[-32px] top-4 w-3.5 h-3.5 rounded-full border-2 bg-white", styles.icon.replace('text-', 'border-'))} />
                        
                        {/* Event Card */}
                        <div
                          onDoubleClick={(e) => { if (!canManage) return; e.stopPropagation(); handleConfigureSaved(schedule); }}
                          className={cn(
                            "p-4 backdrop-blur-md rounded-2xl shadow-sm hover:shadow-md transition-all flex justify-between items-start border border-l-4",
                            styles.card,
                            styles.borderL
                          )}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className={cn("text-sm font-extrabold", styles.title)}>{schedule.title}</h3>
                              <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                                {typeLabels[schedule.schedule_type]}
                              </span>
                              {renderRecurrenceBadge(schedule)}
                            </div>
                            <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold", styles.sub)}>
                              <span className="flex items-center gap-1"><Clock size={11} className={styles.icon} /> {start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="flex items-center gap-1">
                                <MapPin size={11} className={styles.icon} />{' '}
                                {schedule.location ||
                                  (typeof schedule.club_id === 'object'
                                    ? schedule.club_id?.classroom
                                    : '')}
                              </span>
                              {schedule.max_attendees && <span className="flex items-center gap-1"><Users size={11} className={styles.icon} /> Hạn mức: {schedule.max_attendees}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded", styles.badge)}>Upcoming</span>
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfigureSaved(schedule);
                                  }}
                                  className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                                  title="Configure"
                                >
                                  <Settings size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(schedule);
                                  }}
                                  className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Evening Shift */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md border border-white/70 p-3 rounded-xl shadow-sm w-fit">
                <Moon className="h-5 w-5 text-blue-600" />
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Ca Tối</span>
                <span className="text-[10px] font-bold text-slate-400">18:00 - 21:00</span>
              </div>

              <div className="relative pl-6 space-y-4 border-l border-slate-200/80 ml-4 py-2">
                {eveningSchedules.length === 0 ? (
                  <div className="relative p-6 border border-dashed border-slate-300 rounded-2xl bg-white/20 text-center">
                    <span className="absolute left-[-29px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-slate-300 bg-white" />
                    <p className="text-xs font-semibold text-slate-400">Không có lịch hoạt động ca tối</p>
                  </div>
                ) : (
                  eveningSchedules.map(schedule => {
                    const start = schedule.visibleStart;
                    const end = schedule.visibleEnd;
                    const accent = getClubAccentColor(schedule);
                    const styles = accentStyles[accent];

                    return (
                      <div key={schedule._id} className="relative group">
                        {/* Timeline Node dot */}
                        <span className={cn("absolute left-[-32px] top-4 w-3.5 h-3.5 rounded-full border-2 bg-white", styles.icon.replace('text-', 'border-'))} />
                        
                        {/* Event Card */}
                        <div
                          onDoubleClick={(e) => { if (!canManage) return; e.stopPropagation(); handleConfigureSaved(schedule); }}
                          className={cn(
                            "p-4 backdrop-blur-md rounded-2xl shadow-sm hover:shadow-md transition-all flex justify-between items-start border border-l-4",
                            styles.card,
                            styles.borderL
                          )}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className={cn("text-sm font-extrabold", styles.title)}>{schedule.title}</h3>
                              <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                                {typeLabels[schedule.schedule_type]}
                              </span>
                              {renderRecurrenceBadge(schedule)}
                            </div>
                            <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold", styles.sub)}>
                              <span className="flex items-center gap-1"><Clock size={11} className={styles.icon} /> {start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="flex items-center gap-1">
                                <MapPin size={11} className={styles.icon} />{' '}
                                {schedule.location ||
                                  (typeof schedule.club_id === 'object'
                                    ? schedule.club_id?.classroom
                                    : '')}
                              </span>
                              {schedule.max_attendees && <span className="flex items-center gap-1"><Users size={11} className={styles.icon} /> Hạn mức: {schedule.max_attendees}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded", styles.badge)}>Upcoming</span>
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfigureSaved(schedule);
                                  }}
                                  className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                                  title="Configure"
                                >
                                  <Settings size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(schedule);
                                  }}
                                  className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Advanced Recurrence Modal */}
      {showRecurrenceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                <SlidersHorizontal className="text-blue-500" size={18} />
                Cấu hình chuỗi lịch lặp lại
              </h3>
              <button 
                onClick={() => {
                  setShowRecurrenceModal(false);
                  if (preRecurrenceWeekOffset !== null) {
                    setWeekOffset(preRecurrenceWeekOffset);
                    setPreRecurrenceWeekOffset(null);
                  }
                }} 
                className="p-1 hover:bg-slate-200/80 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Chế độ lặp
                </label>
                <Select
                  value={modalUntilType === 'none' ? 'none' : modalRecurrenceType}
                  onValueChange={(val: any) => {
                    if (val === 'none') {
                      setModalUntilType('none');
                    } else {
                      setModalRecurrenceType(val);
                      setModalUntilType('date');
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn chế độ lặp..." />
                  </SelectTrigger>
                  <SelectContent disablePortal={true}>
                    <SelectItem value="none">Một lần (Không lặp)</SelectItem>
                    <SelectItem value="weekly">Hàng tuần</SelectItem>
                    <SelectItem value="biweekly">2 tuần/lần</SelectItem>
                    <SelectItem value="monthly">Hàng tháng</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {modalUntilType !== 'none' && (
                <div className="flex flex-col gap-1 pt-1 animate-fadeIn">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Khoảng thời gian lặp
                  </label>
                  <Popover open={isRangeCalendarOpen} onOpenChange={setIsRangeCalendarOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:border-blue-500 transition-all text-left flex items-center justify-between cursor-pointer h-10"
                      >
                        <span>
                          {modalRepeatStartDate
                            ? `${new Date(modalRepeatStartDate).toLocaleDateString('vi-VN')} - ${modalRepeatEndDate ? new Date(modalRepeatEndDate).toLocaleDateString('vi-VN') : 'Mặc định cuối tháng'}`
                            : 'Chọn khoảng thời gian lặp'}
                        </span>
                        <Calendar size={14} className="text-slate-400" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-auto p-0 z-[100] bg-transparent border-none shadow-none overflow-hidden" 
                      align="start"
                      side="bottom"
                      sideOffset={6}
                    >
                      <CustomCalendar
                        startDate={modalRepeatStartDate ? new Date(modalRepeatStartDate) : null}
                        endDate={modalRepeatEndDate ? new Date(modalRepeatEndDate) : null}
                        minDate={new Date(anchorWeekMonday)}
                        onRangeSelect={(start, end) => {
                          // Required prop, can leave empty
                        }}
                        onRangeConfirm={(start, end) => {
                          const yStart = start.getFullYear();
                          const mStart = String(start.getMonth() + 1).padStart(2, '0');
                          const dStart = String(start.getDate()).padStart(2, '0');
                          setModalRepeatStartDate(`${yStart}-${mStart}-${dStart}`);

                          let targetEnd = end;
                          if (!targetEnd) {
                            // Default end date: last day of the selected start date's month
                            targetEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
                          }
                          
                          const yEnd = targetEnd.getFullYear();
                          const mEnd = String(targetEnd.getMonth() + 1).padStart(2, '0');
                          const dEnd = String(targetEnd.getDate()).padStart(2, '0');
                          
                          setModalRepeatEndDate(`${yEnd}-${mEnd}-${dEnd}`);
                          setModalUntilDate(`${yEnd}-${mEnd}-${dEnd}`);
                        }}
                        onCancel={() => {
                          setIsRangeCalendarOpen(false);
                        }}
                        onConfirm={() => setIsRangeCalendarOpen(false)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              {defaultRecurrence.enabled && (
                <button
                  type="button"
                  onClick={handleCancelAllRecurrence}
                  className="mr-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  Hủy chuỗi lặp
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowRecurrenceModal(false);
                  if (preRecurrenceWeekOffset !== null) {
                    setWeekOffset(preRecurrenceWeekOffset);
                    setPreRecurrenceWeekOffset(null);
                  }
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmRecurrence}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduling Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setActivePendingSchedule(null);
        }
      }}>
        <DialogContent className="max-w-lg w-full overflow-hidden p-0 gap-0 bg-white border border-slate-100 rounded-2xl shadow-xl">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 flex flex-row items-center justify-between bg-slate-50">
            <DialogTitle className="font-extrabold text-slate-800 flex items-center gap-2 text-base">
              <CalendarRange className="text-blue-500" size={18} />
              {formScheduleId ? 'Cập nhật lịch hoạt động CLB' : 'Xếp lịch hoạt động CLB'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSchedule} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {isSimplifiedModal ? (
              <>
                <div className="bg-blue-50/70 border border-blue-100 p-4 rounded-2xl space-y-2">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Câu lạc bộ</p>
                    <p className="text-sm font-extrabold text-slate-800">
                      {(() => {
                        const currentClub = clubs.find(c => c._id === formClubId);
                        return currentClub ? `${currentClub.name} (${currentClub.code})` : 'Câu lạc bộ';
                      })()}
                    </p>
                  </div>
                  <div className="h-px bg-slate-200/60 my-2" />
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ngày hoạt động</p>
                    <p className="text-sm font-bold text-slate-700">
                      {formDate ? new Date(formDate).toLocaleDateString('vi-VN', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      }) : ''}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Giờ bắt đầu</label>
                    <CustomTimePicker
                      value={formStartTime}
                      onChange={(val) => setFormStartTime(val)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Giờ kết thúc</label>
                    <CustomTimePicker
                      value={formEndTime}
                      onChange={(val) => setFormEndTime(val)}
                    />
                  </div>
                </div>

                {(() => {
                  const targetScheduleId = formScheduleId || activePendingSchedule?.scheduleId;
                  const existing = targetScheduleId ? schedules.find(s => s._id === targetScheduleId) : null;
                  if (!existing || !existing.recurrence_id) return null;

                  const isSource = existing.recurrence?.source_week_start_date && 
                    getMondayDateStr(existing.start_time) === getMondayDateStr(existing.recurrence.source_week_start_date);
                  
                  const sourceStart = existing.recurrence?.source_week_start_date 
                    ? new Date(existing.recurrence.source_week_start_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '';
                  const sourceEnd = existing.recurrence?.source_week_end_date 
                    ? new Date(existing.recurrence.source_week_end_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '';

                  return (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-xs space-y-1 my-3 text-amber-900 font-semibold border-dashed text-left">
                      <div>
                        <span className="font-black text-amber-950">Trạng thái lặp:</span> {isSource ? 'Buổi nguồn lặp (Source Week)' : 'Buổi lặp lại (Repeated Week)'}
                      </div>
                      {sourceStart && (
                        <div>
                          <span className="font-black text-amber-950">Tuần nguồn lặp:</span> {sourceStart} - {sourceEnd}
                        </div>
                      )}
                      <div>
                        <span className="font-black text-amber-950">Tuần đang sửa:</span> {mondayDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {sundayDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-amber-700 italic font-bold mt-1.5 leading-relaxed">
                        * Việc chỉnh sửa sẽ được áp dụng cho toàn bộ các buổi hoạt động lặp lại liên kết trong chuỗi này.
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setShowCreateModal(false); setActivePendingSchedule(null); }}
                    className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                  >
                    {formScheduleId ? 'Xác nhận cập nhật' : 'Xác nhận xếp lịch'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Câu lạc bộ</label>
                    <Select
                      value={formClubId}
                      onValueChange={(val) => {
                        setFormClubId(val);
                        const club = clubs.find(c => c._id === val);
                        if (club) {
                          setFormTitle(`Sinh hoạt CLB ${club.name}`);
                          const isDefaultLoc = !formLocation || formLocation === 'Phòng sinh hoạt CLB' || clubs.some(c => c.classroom === formLocation);
                          if (isDefaultLoc && club.classroom) {
                            setFormLocation(club.classroom);
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn câu lạc bộ..." />
                      </SelectTrigger>
                      <SelectContent disablePortal={true}>
                        {clubs.map(c => (
                          <SelectItem key={c._id} value={c._id}>
                            {c.name} ({c.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Tiêu đề buổi hoạt động</label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Nhập tiêu đề sinh hoạt..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Địa điểm</label>
                    <input
                      type="text"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="Văn phòng CLB, Sân vận động..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Loại hoạt động</label>
                    <Select
                      value={formType}
                      onValueChange={(val) => setFormType(val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn loại..." />
                      </SelectTrigger>
                      <SelectContent disablePortal={true}>
                        <SelectItem value="regular">Sinh hoạt</SelectItem>
                        <SelectItem value="event">Sự kiện</SelectItem>
                        <SelectItem value="exam">Kiểm tra</SelectItem>
                        <SelectItem value="meeting">Họp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Hạn mức tham gia</label>
                    <input
                      type="number"
                      value={formMaxAttendees}
                      onChange={(e) => setFormMaxAttendees(e.target.value)}
                      placeholder="Không giới hạn"
                      min="1"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Ngày bắt đầu</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Giờ bắt đầu</label>
                      <CustomTimePicker
                        value={formStartTime}
                        onChange={(val) => setFormStartTime(val)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Giờ kết thúc</label>
                      <CustomTimePicker
                        value={formEndTime}
                        onChange={(val) => setFormEndTime(val)}
                      />
                    </div>
                  </div>



                  <div className="col-span-2">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Mô tả chi tiết</label>
                    <textarea
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      placeholder="Mô tả nội dung buổi sinh hoạt..."
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {(() => {
                  const targetScheduleId = formScheduleId || activePendingSchedule?.scheduleId;
                  const existing = targetScheduleId ? schedules.find(s => s._id === targetScheduleId) : null;
                  if (!existing || !existing.recurrence_id) return null;

                  const isSource = existing.recurrence?.source_week_start_date && 
                    getMondayDateStr(existing.start_time) === getMondayDateStr(existing.recurrence.source_week_start_date);
                  
                  const sourceStart = existing.recurrence?.source_week_start_date 
                    ? new Date(existing.recurrence.source_week_start_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '';
                  const sourceEnd = existing.recurrence?.source_week_end_date 
                    ? new Date(existing.recurrence.source_week_end_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '';

                  return (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-xs space-y-1 my-3 text-amber-900 font-semibold border-dashed text-left">
                      <div>
                        <span className="font-black text-amber-950">Trạng thái lặp:</span> {isSource ? 'Buổi nguồn lặp (Source Week)' : 'Buổi lặp lại (Repeated Week)'}
                      </div>
                      {sourceStart && (
                        <div>
                          <span className="font-black text-amber-950">Tuần nguồn lặp:</span> {sourceStart} - {sourceEnd}
                        </div>
                      )}
                      <div>
                        <span className="font-black text-amber-950">Tuần đang sửa:</span> {mondayDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {sundayDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-amber-700 italic font-bold mt-1.5 leading-relaxed">
                        * Việc chỉnh sửa sẽ được áp dụng cho toàn bộ các buổi hoạt động lặp lại liên kết trong chuỗi này.
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setShowCreateModal(false); setActivePendingSchedule(null); }}
                    className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                  >
                    {formScheduleId ? 'Xác nhận cập nhật' : 'Xác nhận xếp lịch'}
                  </button>
                </div>
              </>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Update Series Confirm Modal */}
      {showUpdateSeriesConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-blue-600">
              <HelpCircle size={24} />
              <h3 className="font-extrabold text-slate-800 text-base">Cập nhật lịch định kỳ</h3>
            </div>
            
            <p className="text-slate-500 text-xs mt-3 font-medium leading-relaxed text-left">
              Buổi sinh hoạt này thuộc một chuỗi lịch định kỳ. Thay đổi này sẽ được áp dụng cho toàn bộ các buổi hoạt động lặp lại liên kết trong chuỗi lặp này.
            </p>

            {(() => {
              const targetId = pendingUpdatePayload?.scheduleId;
              const existing = targetId ? schedules.find(s => s._id === targetId) : null;
              const sourceStart = existing?.recurrence?.source_week_start_date 
                ? new Date(existing.recurrence.source_week_start_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : '';
              const sourceEnd = existing?.recurrence?.source_week_end_date 
                ? new Date(existing.recurrence.source_week_end_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : '';
              
              const currentStart = mondayDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
              const currentEnd = sundayDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

              return (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl space-y-2 text-[11px] text-slate-600 font-medium text-left border border-slate-200/50 border-dashed">
                  {sourceStart && (
                    <div>
                      <span className="font-black text-slate-700">Tuần nguồn lặp:</span> {sourceStart} - {sourceEnd}
                    </div>
                  )}
                  <div>
                    <span className="font-black text-slate-700">Tuần đang sửa:</span> {currentStart} - {currentEnd}
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-col gap-2 mt-6">
              <button
                type="button"
                onClick={() => handleUpdateConfirm(true)}
                className="w-full py-2 bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Xác nhận cập nhật chuỗi lặp
              </button>
              <button
                type="button"
                onClick={() => { setShowUpdateSeriesConfirmModal(false); setPendingUpdatePayload(null); }}
                className="w-full py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-all mt-1 cursor-pointer"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Cancel Confirm Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-500">
              <AlertCircle size={24} />
              <h3 className="font-extrabold text-slate-800 text-base">Hủy buổi sinh hoạt</h3>
            </div>
            
            <p className="text-slate-500 text-xs mt-3 font-medium leading-relaxed">
              Bạn có chắc chắn muốn hủy lịch sinh hoạt <strong className="text-slate-700">{selectedSchedule?.title}</strong>? Hành động này sẽ gửi thông báo và hủy mọi đăng ký hiện tại.
            </p>

            {selectedSchedule?.recurrence_id && (
              <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100 text-[10px] text-amber-700 font-semibold flex items-start gap-1.5">
                <HelpCircle size={14} className="shrink-0 mt-0.5" />
                Đây là một phần của chuỗi lịch sinh hoạt định kỳ. Bạn có thể chọn hủy chỉ buổi sinh hoạt này hoặc toàn bộ chuỗi sự kiện.
              </div>
            )}

            <div className="flex flex-col gap-2 mt-6">
              <button
                onClick={() => handleDeleteConfirm(false)}
                className="w-full py-2 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Chỉ hủy buổi sinh hoạt này
              </button>
              {selectedSchedule?.recurrence_id && (
                <button
                  onClick={() => handleDeleteConfirm(true)}
                  className="w-full py-2 bg-red-600 text-white hover:bg-red-700 text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Hủy toàn bộ chuỗi lịch sinh hoạt
                </button>
              )}
              <button
                onClick={() => { setShowDeleteModal(false); setSelectedSchedule(null); }}
                className="w-full py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-all mt-1 cursor-pointer"
              >
                Đóng / Không hủy
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Cancel Recurrence Confirm Modal */}
      {showCancelRecurrenceConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-500">
              <AlertCircle size={24} />
              <h3 className="font-extrabold text-slate-800 text-base">Hủy chuỗi lặp lại</h3>
            </div>
            
            <p className="text-slate-500 text-xs mt-3 font-medium leading-relaxed">
              Bạn có chắc chắn muốn hủy lặp cho lịch này? Lịch của tuần hiện tại sẽ được giữ lại làm lịch một lần, còn các buổi lặp ở các tuần khác sẽ bị hủy.
            </p>

            <div className="flex flex-col gap-2 mt-6">
              <button
                type="button"
                onClick={handleCancelRecurrenceConfirm}
                className="w-full py-2 bg-red-600 text-white hover:bg-red-700 text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Xác nhận hủy chuỗi lặp
              </button>
              <button
                type="button"
                onClick={() => setShowCancelRecurrenceConfirmModal(false)}
                className="w-full py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-all mt-1 cursor-pointer"
              >
                Bỏ qua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

