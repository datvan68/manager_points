'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Clock, MapPin, ChevronLeft, ChevronRight,
  Search, Users, Trash2, AlertCircle, Calendar, CalendarDays,
  X, Grid, List, HelpCircle, Settings, RotateCw,
  Sunrise, Sun, Moon, RefreshCw, Copy, Plus, Filter
} from 'lucide-react';
import { activityScheduleApi, activityApi, ActivitySchedule, Activity } from '@/api/activity-api';
import { semesterApi, Semester } from '@/api/semester-api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { cn } from '@/lib/utils';

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
  scheduleId?: string; // ID of saved schedule initially (if dragged from old schedule)
  originalData?: ActivitySchedule;
}

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
    defaultStart: '18:30',
    defaultEnd: '20:30',
    icon: '🌙',
  },
};

const shiftShortLabels: Record<ShiftType, string> = {
  morning: 'AM',
  afternoon: 'PM',
  evening: 'EVE',
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
  gradientL: string;
}> = {
  blue: {
    card: 'bg-blue-500/10 border-blue-500/20 shadow-[0_2px_8px_rgba(59,130,246,0.06)]',
    title: 'text-blue-950 font-extrabold dark:text-blue-900',
    sub: 'text-blue-800/85',
    icon: 'text-blue-500',
    badge: 'bg-blue-500/10 text-blue-600',
    borderL: 'border-l-blue-500',
    gradientL: 'from-blue-500 to-indigo-600'
  },
  cyan: {
    card: 'bg-cyan-500/10 border-cyan-500/20 shadow-[0_2px_8px_rgba(6,182,212,0.06)]',
    title: 'text-cyan-950 font-extrabold',
    sub: 'text-cyan-800/85',
    icon: 'text-cyan-500',
    badge: 'bg-cyan-500/10 text-cyan-600',
    borderL: 'border-l-cyan-500',
    gradientL: 'from-cyan-400 to-blue-500'
  },
  emerald: {
    card: 'bg-emerald-500/10 border-emerald-500/20 shadow-[0_2px_8px_rgba(16,185,129,0.06)]',
    title: 'text-emerald-950 font-extrabold',
    sub: 'text-emerald-800/85',
    icon: 'text-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-600',
    borderL: 'border-l-emerald-500',
    gradientL: 'from-emerald-400 to-teal-600'
  },
  amber: {
    card: 'bg-amber-500/10 border-amber-500/20 shadow-[0_2px_8px_rgba(245,158,11,0.06)]',
    title: 'text-amber-950 font-extrabold',
    sub: 'text-amber-800/85',
    icon: 'text-amber-500',
    badge: 'bg-amber-500/10 text-amber-600',
    borderL: 'border-l-amber-500',
    gradientL: 'from-amber-400 to-orange-600'
  },
  rose: {
    card: 'bg-rose-500/10 border-rose-500/20 shadow-[0_2px_8px_rgba(244,63,94,0.06)]',
    title: 'text-rose-950 font-extrabold',
    sub: 'text-rose-800/85',
    icon: 'text-rose-500',
    badge: 'bg-rose-500/10 text-rose-600',
    borderL: 'border-l-rose-500',
    gradientL: 'from-rose-400 to-pink-600'
  },
  violet: {
    card: 'bg-violet-500/10 border-violet-500/20 shadow-[0_2px_8px_rgba(139,92,246,0.06)]',
    title: 'text-violet-950 font-extrabold',
    sub: 'text-violet-800/85',
    icon: 'text-violet-500',
    badge: 'bg-violet-500/10 text-violet-600',
    borderL: 'border-l-violet-500',
    gradientL: 'from-violet-400 to-purple-600'
  },
  slate: {
    card: 'bg-slate-500/10 border-slate-500/20 shadow-[0_2px_8px_rgba(100,116,139,0.06)]',
    title: 'text-slate-950 font-extrabold',
    sub: 'text-slate-800/85',
    icon: 'text-slate-500',
    badge: 'bg-slate-500/10 text-slate-600',
    borderL: 'border-l-slate-500',
    gradientL: 'from-slate-400 to-slate-600'
  }
};

const typeLabels: Record<string, string> = {
  regular: 'Sinh hoạt',
  event: 'Sự kiện',
  exam: 'Kiểm tra',
  meeting: 'Họp',
};

function getActivityAccentColor(item: any): AccentColor {
  if (item && typeof item === 'object' && 'schedule_type' in item) {
    const type = item.schedule_type;
    if (type === 'regular') return 'blue';
    if (type === 'event') return 'violet';
    if (type === 'exam') return 'rose';
    if (type === 'meeting') return 'amber';
  }

  let id = '';
  if (item.clubId) {
    id = item.clubId;
  } else if (item.activity_id) {
    const cid = item.activity_id;
    id = typeof cid === 'object' ? (cid._id || cid.code || cid.name || '') : cid;
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

const getMondayDateStr = (dateStrOrDate: string | Date): string => {
  const d = new Date(dateStrOrDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getTime() + diff * 24 * 60 * 60 * 1000);
  return monday.toISOString().split('T')[0];
};

const isDateInAnchorWeek = (dateStrOrDate: string | Date, anchorWeekMonday: string): boolean => {
  return getMondayDateStr(dateStrOrDate) === anchorWeekMonday;
};

const parseLocalDate = (value: string): Date | null => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (value: string): string => {
  const date = parseLocalDate(value);
  if (!date) return 'Chọn ngày';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
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
      className={cn("overflow-y-auto select-none cursor-grab active:cursor-grabbing custom-scrollbar", className)}
    >
      {children}
    </div>
  );
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

// Time picker
const CustomTimePicker = ({ value, onChange, size = 'md' }: { value: string; onChange: (val: string) => void; size?: 'sm' | 'md' }) => {
  const [hour, minute] = value.split(':');
  const hours = Array.from({ length: 15 }, (_, i) => String(i + 7).padStart(2, '0')); // 07 to 21
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')); // 00, 05, 10, ...

  const isSm = size === 'sm';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-center border border-slate-200 bg-white text-slate-850 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all cursor-pointer shadow-sm font-semibold",
            isSm ? "h-8 text-xs rounded-lg px-2 py-1" : "h-10 text-sm rounded-xl px-3 py-2"
          )}
        >
          <Clock className={cn("mr-2 text-slate-400 shrink-0", isSm ? "h-3.5 w-3.5" : "h-4 w-4")} />
          {value}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3 bg-white border border-slate-100 shadow-xl rounded-2xl" align="start">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Giờ</div>
            <ScrollContainer className="max-h-48 flex flex-col gap-1 pr-1">
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
                        ? "bg-blue-600 text-white"
                        : "text-slate-650 hover:bg-slate-100"
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
            <ScrollContainer className="max-h-48 flex flex-col gap-1 pr-1">
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
                        ? "bg-blue-600 text-white"
                        : "text-slate-650 hover:bg-slate-100"
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

function getNormalizedId(input: any): string {
  if (typeof input === 'string' && input.trim() !== '') {
    return input;
  }
  if (input && typeof input === 'object' && typeof input._id === 'string' && input._id.trim() !== '') {
    return input._id;
  }
  return '';
}

interface ActivityScheduleWorkspaceProps {
  initialActivityId?: string;
  openCreateOnLoad?: boolean;
  isAdminOrAdvisor?: boolean;
  activityType?: string;
}

export default function ActivityScheduleWorkspace({
  initialActivityId = '',
  openCreateOnLoad = false,
  isAdminOrAdvisor = true,
  activityType = '',
}: ActivityScheduleWorkspaceProps) {
  const canManage = isAdminOrAdvisor;
  const hasInitializedRef = useRef(false);

  // Core data states
  const [schedules, setSchedules] = useState<ActivitySchedule[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState(initialActivityId);
  const [loading, setLoading] = useState(true);

  // Pending schedules states
  const [pendingSchedules, setPendingSchedules] = useState<PendingSchedule[]>([]);
  const [activePendingSchedule, setActivePendingSchedule] = useState<PendingSchedule | null>(null);

  // Navigation & View states
  const [view, setView] = useState<'weekly' | 'daily'>('weekly');
  const [weekOffset, setWeekOffset] = useState(0);
  const [filterClubId, setFilterClubId] = useState('all');
  const [filterScheduleType, setFilterScheduleType] = useState('all');

  const getWeekOffsetForDate = (date: Date) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const day = today.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const currentMonday = new Date(today.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
    currentMonday.setHours(0,0,0,0);

    const targetDate = new Date(date);
    const targetDay = targetDate.getDay();
    const targetDiffToMonday = targetDay === 0 ? -6 : 1 - targetDay;
    const targetMonday = new Date(targetDate.getTime() + targetDiffToMonday * 24 * 60 * 60 * 1000);
    targetMonday.setHours(0,0,0,0);

    const diffTime = targetMonday.getTime() - currentMonday.getTime();
    const diffDays = Math.round(diffTime / (24 * 60 * 60 * 1000));
    return Math.round(diffDays / 7);
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    const offset = getWeekOffsetForDate(date);
    setWeekOffset(offset);
  };
  const [preRecurrenceWeekOffset, setPreRecurrenceWeekOffset] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ActivitySchedule | null>(null);
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
  const [modalPosition, setModalPosition] = useState<{ top: number; left: number } | null>(null);
  const [formScheduleId, setFormScheduleId] = useState<string | null>(null);
  const [formShift, setFormShift] = useState<ShiftType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

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
    untilType: 'semester',
  });

  const [recurrenceModalTarget, setRecurrenceModalTarget] = useState<'default' | 'form'>('default');

  // Advanced Recurrence Modal states
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [modalRecurrenceType, setModalRecurrenceType] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [modalUntilType, setModalUntilType] = useState<'semester' | 'weeks' | 'date' | 'none'>('semester');
  const [modalWeeksCount, setModalWeeksCount] = useState<number>(8);
  const [modalUntilDate, setModalUntilDate] = useState<string>('');
  const [modalRepeatStartDate, setModalRepeatStartDate] = useState<string>('');
  const [modalRepeatEndDate, setModalRepeatEndDate] = useState<string>('');

  const renderRecurrenceBadge = (schedule: ActivitySchedule, size: 'sm' | 'md' = 'md') => {
    const isAnchorInRecurrence = isDateInAnchorWeek(schedule.start_time, anchorWeekMonday) && defaultRecurrence.enabled;
    const isSavedRecurring = !isAnchorInRecurrence && !!schedule.recurrence_id;

    let badgeText = '';
    let badgeStyle = 'text-blue-600 bg-blue-50/70 border-blue-100/60';

    if (isAnchorInRecurrence) {
      badgeText = 'Lặp (Anchor)';
      badgeStyle = 'text-blue-600 bg-blue-50/70 border-blue-100/60';
    } else if (isSavedRecurring) {
      const isSource = schedule.recurrence?.source_week_start_date &&
        getMondayDateStr(schedule.start_time) === getMondayDateStr(schedule.recurrence.source_week_start_date);

      if (isSource) {
        badgeText = 'Nguồn lặp';
        badgeStyle = 'text-purple-600 bg-purple-50/70 border-purple-100/60';
      } else {
        badgeText = 'Buổi lặp';
        badgeStyle = 'text-amber-600 bg-amber-50/70 border-amber-100/60';
      }
    }

    if (!badgeText) return null;

    if (size === 'sm') {
      return (
        <div className={cn("inline-flex items-center gap-1 text-[7px] font-black rounded-full px-1.5 py-0.5 mt-1.5 w-fit shrink-0 border uppercase tracking-wider", badgeStyle)}>
          <RotateCw size={7} className="opacity-80" />
          <span>{badgeText}</span>
        </div>
      );
    }

    return (
      <span className={cn("inline-flex items-center gap-1 text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border", badgeStyle)}>
        <RotateCw size={8} className="opacity-80" />
        <span>{badgeText}</span>
      </span>
    );
  };

  useEffect(() => {
    loadInitialData();
  }, [activityType]);

  useEffect(() => {
    hasInitializedRef.current = false;
    if (selectedSemesterId) {
      loadSchedules();
    } else {
      setSchedules([]);
    }
  }, [selectedSemesterId]);

  useEffect(() => {
    if (!loading && !hasInitializedRef.current) {
      if (schedules.length === 0) return;
      const validSchedules = schedules.filter(
        s => s.status !== 'cancelled' && s.recurrence?.source_week_start_date
      );

      let targetSourceWeekDateStr: string | undefined;

      const activitySchedules = validSchedules.filter(
        s => getNormalizedId(s.activity_id) === selectedActivityId
      );

      if (activitySchedules.length > 0) {
        activitySchedules.sort((a, b) => {
          const dateA = new Date(a.recurrence!.source_week_start_date!);
          const dateB = new Date(b.recurrence!.source_week_start_date!);
          return dateA.getTime() - dateB.getTime();
        });
        targetSourceWeekDateStr = activitySchedules[0].recurrence!.source_week_start_date;
      } else if (validSchedules.length > 0) {
        validSchedules.sort((a, b) => {
          const dateA = new Date(a.recurrence!.source_week_start_date!);
          const dateB = new Date(b.recurrence!.source_week_start_date!);
          return dateA.getTime() - dateB.getTime();
        });
        targetSourceWeekDateStr = validSchedules[0].recurrence!.source_week_start_date;
      }

      if (targetSourceWeekDateStr) {
        const offset = getWeekOffsetFromDate(new Date(targetSourceWeekDateStr));
        setWeekOffset(offset);
      }
      hasInitializedRef.current = true;
    }
  }, [loading, schedules, activities, selectedActivityId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
        setActivePendingSchedule(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (showCreateModal && isSimplifiedModal) {
        setShowCreateModal(false);
        setActivePendingSchedule(null);
      }
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showCreateModal, isSimplifiedModal]);

  useEffect(() => {
    if (
      openCreateOnLoad &&
      !hasAutoOpened &&
      selectedActivityId &&
      selectedSemesterId &&
      activities.length > 0 &&
      semesters.length > 0
    ) {
      setHasAutoOpened(true);

      const actObj = activities.find(c => c._id === selectedActivityId);
      const defaultLoc = actObj?.classroom || 'Phòng sinh hoạt';

      setFormClubId(selectedActivityId);
      setFormTitle(`Sinh hoạt ${actObj?.name || ''}`);
      setFormDesc('');
      setFormLocation(defaultLoc);
      setFormType('regular');

      const today = new Date();
      setFormDate(today.toISOString().split('T')[0]);
      setFormStartTime('08:00');
      setFormEndTime('10:00');
      setFormMaxAttendees('');
      setFormScheduleId(null);
      setFormShift('morning');

      setIsSimplifiedModal(false);
      setShowCreateModal(true);
    }
  }, [openCreateOnLoad, hasAutoOpened, selectedActivityId, selectedSemesterId, activities, semesters]);

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
      const queryParams = activityType ? { activity_type: activityType } : {};
      const [actsData, semestersData] = await Promise.all([
        activityApi.getAll(queryParams).catch(() => []),
        semesterApi.getSemesters().catch(() => []),
      ]);

      setActivities(actsData);
      setSemesters(semestersData);

      const active = semestersData.find((s: Semester) => s.status === 'active');
      if (active) {
        setActiveSemester(active);
        setSelectedSemesterId(active._id);
      } else if (semestersData.length > 0) {
        setSelectedSemesterId(semestersData[0]._id);
      }

      if (initialActivityId) {
        setSelectedActivityId(initialActivityId);
      } else if (actsData.length > 0) {
        setSelectedActivityId(actsData[0]._id);
      }
    } catch (err) {
      toast.error('Không thể tải dữ liệu lịch trình');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 1000 };
      if (selectedSemesterId) {
        params.semester_id = selectedSemesterId;
      }
      const data = await activityScheduleApi.getAll(params);
      setSchedules(data.items || []);
    } catch {
      toast.error('Không thể cập nhật danh sách lịch');
    } finally {
      setLoading(false);
    }
  };

  const getWeekDates = (offset: number) => {
    const today = new Date();
    const day = today.getDay();
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

  const currentMondayStr = getMondayDateStr(mondayDate);
  const isSourceWeek = schedules.some(s =>
    s.status !== 'cancelled' &&
    s.recurrence_id &&
    s.recurrence?.source_week_start_date &&
    getMondayDateStr(s.recurrence.source_week_start_date) === currentMondayStr
  );

  const sourceActivities = activities.map(act => {
    const savedCount = schedules.filter(s => {
      if (s.status === 'cancelled') return false;
      const matchesAct = getNormalizedId(s.activity_id) === act._id;
      return matchesAct && doesScheduleOverlapRange(s.start_time, s.end_time, startOfWeek, endOfWeek);
    }).length;

    const pendingCount = pendingSchedules.filter(p => {
      const matchesAct = getNormalizedId(p.clubId) === act._id;
      return matchesAct && weekDateStrings.includes(p.dateStr);
    }).length;

    const scheduledCount = savedCount + pendingCount;
    const isScheduled = scheduledCount > 0;

    return {
      ...act,
      isScheduled,
      scheduledCount
    };
  });

  const filteredSourceActivities = sourceActivities.filter(act =>
    act.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    act.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, clubId: string) => {
    if (!canManage) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'club', clubId }));
  };

  const handleScheduleDragStart = (e: React.DragEvent, schedule: ActivitySchedule, originDateStr: string, originShift: ShiftType) => {
    if (!canManage) return;
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({
        type: 'schedule',
        scheduleId: schedule._id,
        clubId: getNormalizedId(schedule.activity_id),
        originDateStr,
        originShift,
      })
    );
  };

  const handlePendingDragStart = (e: React.DragEvent, tempId: string, originDateStr: string, originShift: ShiftType) => {
    if (!canManage) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'pending', tempId, originDateStr, originShift }));
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

      const formatTimeStr = (hour: number, min: number) => {
        return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      };

      let startTime = shiftDef.defaultStart;
      let endTime = shiftDef.defaultEnd;

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

      if (startMinutes >= shiftRangeStart && startMinutes <= shiftRangeEnd &&
          endMinutes >= shiftRangeStart && endMinutes <= shiftRangeEnd &&
          startMinutes <= endMinutes) {
        startTime = formatTimeStr(startHour, startMin);
        endTime = formatTimeStr(endHour, endMin);
      }

      const cid = getNormalizedId(existing.activity_id);
      const actObj = activities.find(c => c._id === cid);

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
          untilDate = untilObj.toISOString().split('T')[0];
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
        clubName: actObj?.name || 'Hoạt động',
        clubCode: actObj?.code || '',
        clubCategory: actObj?.category || '',
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
      const targetAct = activities.find(c => c._id === clubId);
      if (!targetAct) return;

      const newPending: PendingSchedule = {
        tempId: 'temp_' + Math.random().toString(36).substring(2, 9),
        clubId: clubId,
        clubName: targetAct.name,
        clubCode: targetAct.code,
        clubCategory: targetAct.category,
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

  const handleConfigurePending = (pending: PendingSchedule & { originalTempId?: string }, e?: React.MouseEvent) => {
    if (showCreateModal) return;

    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const modalWidth = 280;
      let left = rect.left;
      if (left + modalWidth > window.innerWidth) {
        left = rect.right - modalWidth;
      }
      let top = rect.bottom + 6;
      if (top + 220 > window.innerHeight) {
        top = rect.top - 220 - 6;
      }
      setModalPosition({ top, left: Math.max(12, left) });
    } else {
      setModalPosition(null);
    }

    const targetTempId = pending.originalTempId || pending.tempId;
    const originalPending = pendingSchedules.find(p => p.tempId === targetTempId) || pending;
    setActivePendingSchedule(originalPending);

    const actObj = activities.find(c => c._id === pending.clubId);

    setFormClubId(pending.clubId);
    setFormTitle(pending.originalData?.title || `Sinh hoạt ${pending.clubName}`);
    setFormDesc(pending.originalData?.description || '');

    let pendingLoc = 'Phòng sinh hoạt';
    if (pending.originalData?.location && pending.originalData.location.trim() !== '') {
      pendingLoc = pending.originalData.location;
    } else if (actObj?.classroom && actObj.classroom.trim() !== '') {
      pendingLoc = actObj.classroom;
    }
    setFormLocation(pendingLoc);
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

  const handleConfigureSaved = (schedule: ActivitySchedule, e?: React.MouseEvent) => {
    if (showCreateModal) return;

    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const modalWidth = 280;
      let left = rect.left;
      if (left + modalWidth > window.innerWidth) {
        left = rect.right - modalWidth;
      }
      let top = rect.bottom + 6;
      if (top + 220 > window.innerHeight) {
        top = rect.top - 220 - 6;
      }
      setModalPosition({ top, left: Math.max(12, left) });
    } else {
      setModalPosition(null);
    }

    setActivePendingSchedule(null);

    const cid = getNormalizedId(schedule.activity_id);
    const actObj = activities.find(c => c._id === cid);

    setFormClubId(cid);
    setFormTitle(schedule.title || `Sinh hoạt ${actObj?.name || ''}`);
    setFormDesc(schedule.description || '');

    let savedLoc = 'Phòng sinh hoạt';
    if (schedule.location && schedule.location.trim() !== '') {
      savedLoc = schedule.location;
    } else if (actObj?.classroom && actObj.classroom.trim() !== '') {
      savedLoc = actObj.classroom;
    }
    setFormLocation(savedLoc);
    setFormType(schedule.schedule_type || 'regular');

    const startObj = new Date(schedule.start_time);
    const endObj = new Date(schedule.end_time);
    setFormDate(startObj.toISOString().split('T')[0]);

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
        untilDate = new Date(schedule.recurrence.until).toISOString().split('T')[0];
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

  // Validation recurrence config
  const validateRecurrenceConfig = (
    config: RecurrenceConfig | null,
    startDateTime: Date,
    activeSemester: Semester | null
  ): { isValid: boolean; error?: string; effectiveEndDate?: Date } => {
    if (!config || !config.enabled) {
      return { isValid: true };
    }

    let repeatStart: Date;
    if (config.repeatStartDate) {
      repeatStart = new Date(config.repeatStartDate);
    } else {
      const startStr = startDateTime.toISOString().split('T')[0];
      repeatStart = new Date(getMondayDateStr(startStr));
    }
    repeatStart.setHours(0, 0, 0, 0);

    let repeatEnd: Date;
    if (config.repeatEndDate) {
      repeatEnd = new Date(config.repeatEndDate);
    } else {
      if (config.untilType === 'semester') {
        if (!activeSemester || !activeSemester.end_date) {
          return {
            isValid: false,
            error: 'Học kỳ chưa được cấu hình ngày kết thúc hoặc không có học kỳ hoạt động',
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
        return { isValid: true };
      }
    }

    repeatEnd.setHours(23, 59, 59, 999);

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

    return {
      isValid: true,
      effectiveEndDate: repeatEnd,
    };
  };

  const getFirstActivityStartDate = (): Date | null => {
    let earliestDate: Date | null = null;
    const currentMondayStr = mondayDate.toISOString().split('T')[0];

    const savedInAnchor = schedules.filter(s => {
      if (s.status === 'cancelled') return false;
      return isDateInAnchorWeek(s.start_time, currentMondayStr);
    });
    for (const s of savedInAnchor) {
      const d = new Date(s.start_time);
      if (!earliestDate || d < earliestDate) {
        earliestDate = d;
      }
    }

    const pendingInAnchor = pendingSchedules.filter(p => {
      return isDateInAnchorWeek(p.dateStr, currentMondayStr);
    });
    for (const p of pendingInAnchor) {
      const d = new Date(`${p.dateStr}T${p.startTime}`);
      if (!earliestDate || d < earliestDate) {
        earliestDate = d;
      }
    }

    return earliestDate;
  };

  const handleOpenRecurrenceModal = (target: 'default' | 'form', currentConfig: RecurrenceConfig | null) => {
    const currentMondayStr = mondayDate.toISOString().split('T')[0];
    const firstActivityDate = getFirstActivityStartDate();

    if (!firstActivityDate) {
      toast.error('Không có buổi sinh hoạt nào được xếp trong tuần hiện tại để thiết lập lặp lại.');
      return;
    }

    setRecurrenceModalTarget(target);

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

      if (repeatStart < startOfWeekDate) {
        toast.error('Ngày bắt đầu lặp lại không được trước tuần xếp lịch');
        return;
      }

      const firstActivityDate = getFirstActivityStartDate();
      if (!firstActivityDate) {
        toast.error('Không có buổi sinh hoạt nào được xếp trong tuần hiện tại để thiết lập lặp lại.');
        return;
      }

      const firstActivityDay = new Date(firstActivityDate);
      firstActivityDay.setHours(0, 0, 0, 0);

      if (repeatEnd < firstActivityDay) {
        toast.error('Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu buổi sinh hoạt đầu tiên');
        return;
      }

      if (repeatEnd < repeatStart) {
        toast.error('Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu lặp');
        return;
      }
    }

    if (recurrenceModalTarget === 'default') {
      const currentMondayStr = mondayDate.toISOString().split('T')[0];

      if (enabled) {
        setDefaultRecurrence(config);
        setAnchorWeekMonday(currentMondayStr);

        setPendingSchedules(prev => prev.map(p => {
          if (isDateInAnchorWeek(p.dateStr, currentMondayStr)) {
            return {
              ...p,
              recurrence: { ...config }
            };
          }
          return p;
        }));

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

              const clubIdNorm = getNormalizedId(s.activity_id);
              const semesterIdNorm = getNormalizedId(s.semester_id);
              if (!clubIdNorm || !semesterIdNorm) {
                toast.error('Mã hoạt động hoặc mã học kỳ không hợp lệ');
                return;
              }

              const payload = {
                activity_id: clubIdNorm,
                title: s.title,
                description: s.description,
                location: s.location,
                schedule_type: s.schedule_type,
                start_time: s.start_time,
                end_time: s.end_time,
                semester_id: semesterIdNorm,
                recurrence: recurrencePayload,
                max_attendees: s.max_attendees || undefined,
              };

              await activityScheduleApi.delete(s._id, !!s.recurrence_id);
              await activityScheduleApi.create(payload);
            }));

            toast.success(`Đã thiết lập chuỗi lặp ${config.type === 'weekly' ? 'hàng tuần' : config.type === 'biweekly' ? '2 tuần/lần' : 'hàng tháng'} thành công`);
          } catch (err: any) {
            toast.error(err?.message || 'Không thể thiết lập chuỗi lặp cho một số lịch đã lưu');
          }
        } else {
          toast.success(`Đã cấu hình chuỗi lặp ${config.type === 'weekly' ? 'hàng tuần' : config.type === 'biweekly' ? '2 tuần/lần' : 'hàng tháng'} cho tuần hiện tại`);
        }
      } else {
        setDefaultRecurrence(config);
        setAnchorWeekMonday(currentMondayStr);

        setPendingSchedules(prev => prev.map(p => {
          if (isDateInAnchorWeek(p.dateStr, currentMondayStr)) {
            return {
              ...p,
              recurrence: null
            };
          }
          return p;
        }));

        const savedRecurringInAnchor = schedules.filter(s => {
          if (s.status === 'cancelled' || !s.recurrence_id) return false;
          const d = new Date(s.start_time);
          const time = d.getTime();
          return time >= startOfWeek.getTime() && time <= endOfWeek.getTime();
        });

        if (savedRecurringInAnchor.length > 0) {
          try {
            await Promise.all(savedRecurringInAnchor.map(s => activityScheduleApi.cancelRecurrence(s._id)));
            toast.success('Đã hủy chuỗi lặp lại và giữ lại lịch tuần hiện tại');
          } catch (err: any) {
            toast.error(err?.message || 'Không thể hủy chuỗi lặp của lịch đã lưu');
          }
        } else {
          toast.success('Đã hủy chuỗi lặp cho tuần hiện tại');
        }
      }

      loadSchedules();
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

  const handleSavePending = async (pending: PendingSchedule) => {
    if (!selectedSemesterId) {
      toast.error('Không tìm thấy học kỳ hoạt động');
      return;
    }

    const startDateTime = new Date(`${pending.dateStr}T${pending.startTime}`);
    const endDateTime = new Date(`${pending.dateStr}T${pending.endTime}`);

    if (endDateTime <= startDateTime) {
      toast.error('Giờ kết thúc phải sau giờ bắt đầu');
      return;
    }

    const clubIdNorm = getNormalizedId(pending.clubId);
    const semesterIdNorm = getNormalizedId(selectedSemesterId);
    if (!clubIdNorm) {
      toast.error('Mã hoạt động không hợp lệ');
      return;
    }
    if (!semesterIdNorm) {
      toast.error('Mã học kỳ không hợp lệ');
      return;
    }

    setSubmitting(true);
    try {
      const activeSem = semesters.find(s => s._id === selectedSemesterId) || activeSemester;
      const validation = validateRecurrenceConfig(pending.recurrence, startDateTime, activeSem);
      if (!validation.isValid) {
        toast.error(validation.error || 'Cấu hình lặp không hợp lệ');
        setSubmitting(false);
        return;
      }

      let untilIso: string | undefined = undefined;
      if (validation.effectiveEndDate) {
        untilIso = validation.effectiveEndDate.toISOString();
      }

      const payload = {
        activity_id: clubIdNorm,
        title: pending.originalData?.title || `Sinh hoạt ${pending.clubName}`,
        description: pending.originalData?.description || '',
        location: pending.originalData?.location || 'Phòng sinh hoạt',
        schedule_type: pending.originalData?.schedule_type || 'regular',
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        semester_id: semesterIdNorm,
        max_attendees: pending.originalData?.max_attendees || undefined,
        recurrence: pending.recurrence?.enabled ? {
          type: pending.recurrence.type,
          until: untilIso,
          start: pending.recurrence.repeatStartDate ? new Date(pending.recurrence.repeatStartDate).toISOString() : startDateTime.toISOString(),
        } : undefined
      };

      if (pending.scheduleId) {
        const isRecurring = !!pending.originalData?.recurrence_id;
        if (isRecurring) {
          setPendingUpdatePayload({ scheduleId: pending.scheduleId, payload });
          setShowUpdateSeriesConfirmModal(true);
        } else {
          await activityScheduleApi.update(pending.scheduleId, payload);
          toast.success('Đã lưu thay đổi lịch sinh hoạt');
          setPendingSchedules(prev => prev.filter(p => p.tempId !== pending.tempId));
          loadSchedules();
        }
      } else {
        await activityScheduleApi.create(payload);
        toast.success(pending.recurrence?.enabled ? 'Thiết lập chuỗi lịch lặp thành công' : 'Đã lưu lịch sinh hoạt mới');
        setPendingSchedules(prev => prev.filter(p => p.tempId !== pending.tempId));
        loadSchedules();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi lưu lịch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmUpdateSeries = async (updateSeries: boolean) => {
    if (!pendingUpdatePayload) return;
    try {
      setSubmitting(true);
      const { scheduleId, payload } = pendingUpdatePayload;

      const clubIdNorm = getNormalizedId(payload.activity_id);
      const semesterIdNorm = getNormalizedId(payload.semester_id);
      if (!clubIdNorm || !semesterIdNorm) {
        toast.error('Mã hoạt động hoặc mã học kỳ không hợp lệ');
        setSubmitting(false);
        return;
      }

      const payloadWithScalarIds = {
        ...payload,
        activity_id: clubIdNorm,
        semester_id: semesterIdNorm,
      };

      if (updateSeries) {
        await activityScheduleApi.delete(scheduleId, true);
        await activityScheduleApi.create(payloadWithScalarIds);
        toast.success('Đã cập nhật toàn bộ chuỗi lịch lặp');
      } else {
        const singlePayload = { ...payloadWithScalarIds, recurrence: undefined };
        await activityScheduleApi.delete(scheduleId, false);
        await activityScheduleApi.create(singlePayload);
        toast.success('Chỉ cập nhật buổi sinh hoạt này');
      }

      setPendingSchedules(prev => prev.filter(p => p.scheduleId !== scheduleId));
      setShowUpdateSeriesConfirmModal(false);
      setPendingUpdatePayload(null);
      loadSchedules();
    } catch {
      toast.error('Không thể cập nhật lịch trình');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAllPending = async () => {
    if (pendingSchedules.length === 0) return;

    // Validate all pending schedules first before starting any API mutations
    for (const p of pendingSchedules) {
      const clubIdNorm = getNormalizedId(p.clubId);
      const semesterIdNorm = getNormalizedId(selectedSemesterId);
      if (!clubIdNorm) {
        toast.error('Mã hoạt động không hợp lệ');
        return;
      }
      if (!semesterIdNorm) {
        toast.error('Mã học kỳ không hợp lệ');
        return;
      }
    }

    try {
      setSubmitting(true);
      await Promise.all(pendingSchedules.map(async (p) => {
        const startDateTime = new Date(`${p.dateStr}T${p.startTime}`);
        const endDateTime = new Date(`${p.dateStr}T${p.endTime}`);

        let untilIso: string | undefined = undefined;
        if (p.recurrence?.enabled) {
          const activeSem = semesters.find(s => s._id === selectedSemesterId) || activeSemester;
          const validation = validateRecurrenceConfig(p.recurrence, startDateTime, activeSem);
          if (validation.effectiveEndDate) {
            untilIso = validation.effectiveEndDate.toISOString();
          }
        }

        const clubIdNorm = getNormalizedId(p.clubId);
        const semesterIdNorm = getNormalizedId(selectedSemesterId);

        const payload = {
          activity_id: clubIdNorm,
          title: p.originalData?.title || `Sinh hoạt ${p.clubName}`,
          description: p.originalData?.description || '',
          location: p.originalData?.location || 'Phòng sinh hoạt',
          schedule_type: p.originalData?.schedule_type || 'regular',
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          semester_id: semesterIdNorm,
          max_attendees: p.originalData?.max_attendees || undefined,
          recurrence: p.recurrence?.enabled ? {
            type: p.recurrence.type,
            until: untilIso,
            start: p.recurrence.repeatStartDate ? new Date(p.recurrence.repeatStartDate).toISOString() : startDateTime.toISOString(),
          } : undefined
        };

        if (p.scheduleId) {
          const isRecurring = !!p.originalData?.recurrence_id;
          if (isRecurring) {
            await activityScheduleApi.delete(p.scheduleId, false);
            await activityScheduleApi.create(payload);
          } else {
            await activityScheduleApi.update(p.scheduleId, payload);
          }
        } else {
          await activityScheduleApi.create(payload);
        }
      }));

      toast.success('Đã lưu toàn bộ lịch trình pending thành công');
      setPendingSchedules([]);
      loadSchedules();
    } catch {
      toast.error('Lỗi khi lưu một số lịch trình pending');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formLocation || !formDate || !formStartTime || !formEndTime) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    const startDateTime = new Date(`${formDate}T${formStartTime}`);
    const endDateTime = new Date(`${formDate}T${formEndTime}`);

    if (endDateTime <= startDateTime) {
      toast.error('Giờ kết thúc phải sau giờ bắt đầu');
      return;
    }

    const clubIdNorm = getNormalizedId(formClubId);
    const semesterIdNorm = getNormalizedId(selectedSemesterId);
    if (!clubIdNorm) {
      toast.error('Mã hoạt động không hợp lệ');
      return;
    }
    if (!semesterIdNorm) {
      toast.error('Mã học kỳ không hợp lệ');
      return;
    }

    setSubmitting(true);
    try {
      const activeSem = semesters.find(s => s._id === selectedSemesterId) || activeSemester;
      const validation = validateRecurrenceConfig(scheduleRecurrence, startDateTime, activeSem);
      if (!validation.isValid) {
        toast.error(validation.error || 'Cấu hình lặp không hợp lệ');
        setSubmitting(false);
        return;
      }

      let untilIso: string | undefined = undefined;
      if (validation.effectiveEndDate) {
        untilIso = validation.effectiveEndDate.toISOString();
      }

      let maxAttendeesVal = formMaxAttendees ? Number(formMaxAttendees) : undefined;
      if (isSimplifiedModal) {
        if (formScheduleId) {
          const existing = schedules.find(s => s._id === formScheduleId);
          if (existing && existing.max_attendees !== undefined) {
            maxAttendeesVal = existing.max_attendees;
          }
        } else if (activePendingSchedule) {
          const existing = activePendingSchedule.originalData;
          if (existing && existing.max_attendees !== undefined) {
            maxAttendeesVal = existing.max_attendees;
          }
        }
      }

      const payload = {
        activity_id: clubIdNorm,
        title: formTitle,
        description: formDesc,
        location: formLocation,
        schedule_type: formType,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        semester_id: semesterIdNorm,
        max_attendees: maxAttendeesVal,
        recurrence: scheduleRecurrence.enabled ? {
          type: scheduleRecurrence.type,
          until: untilIso,
          start: scheduleRecurrence.repeatStartDate ? new Date(scheduleRecurrence.repeatStartDate).toISOString() : startDateTime.toISOString(),
        } : undefined
      };

      if (formScheduleId) {
        const existing = schedules.find(s => s._id === formScheduleId);
        if (existing?.recurrence_id) {
          setPendingUpdatePayload({ scheduleId: formScheduleId, payload });
          setShowCreateModal(false);
          setShowUpdateSeriesConfirmModal(true);
        } else {
          await activityScheduleApi.update(formScheduleId, payload);
          toast.success('Cập nhật lịch thành công');
          setShowCreateModal(false);
          if (activePendingSchedule) {
            setPendingSchedules(prev => prev.filter(p => p.tempId !== activePendingSchedule.tempId));
          }
          loadSchedules();
        }
      } else {
        await activityScheduleApi.create(payload);
        toast.success('Thêm lịch trình mới thành công');
        setShowCreateModal(false);
        if (activePendingSchedule) {
          setPendingSchedules(prev => prev.filter(p => p.tempId !== activePendingSchedule.tempId));
        }
        loadSchedules();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Lỗi khi lưu lịch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCreateModal = (dayIndex?: number) => {
    if (!canManage) return;

    const targetDate = dayIndex !== undefined ? weekDates[dayIndex] : selectedDate;
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');

    const defaultAct = activities[0];
    const defaultLoc = defaultAct?.classroom || 'Phòng sinh hoạt';

    setFormClubId(defaultAct?._id || '');
    setFormTitle(defaultAct ? `Sinh hoạt ${defaultAct.name}` : '');
    setFormDesc('');
    setFormLocation(defaultLoc);
    setFormType('regular');
    setFormDate(`${yyyy}-${mm}-${dd}`);
    setFormStartTime('08:00');
    setFormEndTime('10:00');
    setScheduleRecurrence({
      enabled: false,
      type: 'weekly',
      untilType: 'none',
    });
    setFormMaxAttendees('');
    setFormScheduleId(null);
    setFormShift('morning');
    setIsSimplifiedModal(false);
    setShowCreateModal(true);
  };

  const handleDeleteConfirm = async (deleteSeries: boolean) => {
    if (!selectedSchedule) return;
    try {
      await activityScheduleApi.delete(selectedSchedule._id, deleteSeries);
      toast.success(deleteSeries ? 'Đã xóa toàn bộ chuỗi lịch thành công' : 'Đã xóa buổi sinh hoạt thành công');
      setSelectedSchedule(null);
      setShowDeleteModal(false);
      loadSchedules();
    } catch {
      toast.error('Lỗi khi xóa lịch trình');
    }
  };

  const handleCancelRecurrence = async (schedule: ActivitySchedule) => {
    setSelectedSchedule(schedule);
    setShowCancelRecurrenceConfirmModal(true);
  };

  const handleConfirmCancelRecurrence = async () => {
    if (!selectedSchedule) return;
    try {
      await activityScheduleApi.cancelRecurrence(selectedSchedule._id);
      toast.success('Đã hủy chuỗi lặp thành công');
      setShowCancelRecurrenceConfirmModal(false);
      setSelectedSchedule(null);
      loadSchedules();
    } catch {
      toast.error('Lỗi khi hủy chuỗi lặp');
    }
  };

  const isToday = (date: Date) => {
    return new Date().toDateString() === date.toDateString();
  };

  // Daily timeline view calculations
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

  const filteredDailySchedules = selectedDaySchedules.filter(s => {
    const matchesType = filterScheduleType === 'all' || s.schedule_type === filterScheduleType;
    let matchesClub = true;
    if (filterClubId !== 'all') {
      const clubId = typeof (s.activity_id) === 'object' ? (s.activity_id)?._id : (s.activity_id);
      matchesClub = clubId === filterClubId;
    }
    return matchesType && matchesClub;
  });

  const morningSchedules = filteredDailySchedules.filter(s => s.visibleStart.getHours() < 13);
  const afternoonSchedules = filteredDailySchedules.filter(s => s.visibleStart.getHours() >= 13 && s.visibleStart.getHours() < 18);
  const eveningSchedules = filteredDailySchedules.filter(s => s.visibleStart.getHours() >= 18);

  const renderDailyShiftColumn = (
    shift: ShiftType,
    label: string,
    range: string,
    shiftSchedules: any[],
    icon: React.ReactNode
  ) => {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 p-3 rounded-xl shadow-sm w-fit">
          {icon}
          <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">{label}</span>
          <span className="text-[10px] font-bold text-slate-400">{range}</span>
        </div>

        <div className="relative pl-6 space-y-4 border-l border-slate-200/80 ml-4 py-2">
          {shiftSchedules.length === 0 ? (
            <div className="relative p-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/20 text-center">
              <span className="absolute left-[-29px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-slate-200 bg-white" />
              <p className="text-xs font-semibold text-slate-400">Không có lịch hoạt động {label.toLowerCase()}</p>
            </div>
          ) : (
            shiftSchedules.map(schedule => {
              const start = schedule.visibleStart;
              const end = schedule.visibleEnd;
              const accent = getActivityAccentColor(schedule);
              const styles = accentStyles[accent];

              return (
                <div key={schedule._id} className="relative group animate-fadeIn">
                  <span className={cn("absolute left-[-32px] top-4 w-3.5 h-3.5 rounded-full border-2 bg-white", styles.icon.replace('text-', 'border-'))} />

                  <div
                    onDoubleClick={(e) => { if (!canManage) return; e.stopPropagation(); handleConfigureSaved(schedule, e); }}
                    className={cn(
                      "relative overflow-hidden pl-5 pr-4 py-4 bg-white hover:bg-slate-50/50 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex justify-between items-start border border-slate-100/80 w-full"
                    )}
                  >
                    {/* Glowing Left Gradient Stripe */}
                    <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b", styles.gradientL)} />

                    <div className="space-y-2 flex-1 min-w-0 pr-2">
                      <div className="flex items-center flex-wrap gap-2 text-[9px] font-bold text-slate-400">
                        <span className="px-2 py-0.5 rounded-full uppercase font-black tracking-wider text-[8px] border border-slate-200/50 bg-slate-50 text-slate-600">
                          {typeLabels[schedule.schedule_type] || schedule.schedule_type}
                        </span>
                        {renderRecurrenceBadge(schedule)}
                      </div>
                      <h3 className="text-sm font-extrabold tracking-tight text-slate-800 truncate" title={schedule.title}>{schedule.title}</h3>
                      <div className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Clock size={12} className={styles.icon} />
                          <span className="text-slate-600">
                            {start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 truncate" title={schedule.location || 'Phòng sinh hoạt'}>
                          <MapPin size={12} className={styles.icon} />
                          <span className="text-slate-600 truncate">
                            {schedule.location || 'Phòng sinh hoạt'}
                          </span>
                        </span>
                        {schedule.max_attendees && (
                          <span className="flex items-center gap-1.5">
                            <Users size={12} className={styles.icon} />
                            <span className="text-slate-600">Hạn mức: {schedule.max_attendees}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-between h-full min-h-[72px] flex-shrink-0">
                      {(() => {
                        const activityObj = schedule.activity_id;
                        const status = typeof activityObj === 'object' ? (activityObj?.participation_status || activityObj?.status || 'published') : 'published';
                        const labelText = status === 'published' || status === 'active' ? 'Hoạt động' : status === 'completed' ? 'Kết thúc' : 'Nháp/Khác';
                        const styleClass = status === 'published' || status === 'active'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/60'
                          : 'bg-slate-100 text-slate-500 border border-slate-200/50';
                        return (
                          <span className={cn("text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border", styleClass)}>
                            {labelText}
                          </span>
                        );
                      })()}
                      {canManage && (
                        <div className="flex items-center gap-1 mt-auto">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfigureSaved(schedule, e);
                            }}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-200/50"
                            title="Configure"
                          >
                            <Settings size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSchedule(schedule);
                              setShowDeleteModal(true);
                            }}
                            className="p-1.5 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-xl transition-all cursor-pointer border border-transparent hover:border-red-100"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Week Navigator & Toolbar */}
      <div className="flex flex-col xl:flex-row gap-2 items-start xl:items-center justify-between bg-white/30 backdrop-blur-sm p-2 rounded-xl border border-white/50">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-2.5 h-8 bg-white/75 rounded-lg border border-slate-200/50 shadow-sm shrink-0">
            <Calendar size={13} className="text-blue-500" />
            <h3 className="text-xs font-bold text-slate-700 font-sans">
              {getHeaderDateRangeString()}
            </h3>
          </div>

          {/* Week Context Widget */}
          {(() => {
            const isCurrentWeek = weekOffset === 0;
            const currentMondayStr = getMondayDateStr(mondayDate);

            const repeatedSchedulesInWeek = schedules.filter(s =>
              s.status !== 'cancelled' &&
              doesScheduleOverlapRange(s.start_time, s.end_time, startOfWeek, endOfWeek) &&
              !!s.recurrence_id
            );
            const containsRepeated = repeatedSchedulesInWeek.length > 0;

            const isSourceWeek = schedules.some(s =>
              s.status !== 'cancelled' &&
              s.recurrence_id &&
              s.recurrence?.source_week_start_date &&
              getMondayDateStr(s.recurrence.source_week_start_date) === currentMondayStr
            );

            let statusLabel = 'Tuần bình thường';
            let badgeColor = 'bg-slate-100 text-slate-600 border-slate-200/50';

            if (isCurrentWeek && isSourceWeek) {
              statusLabel = 'Tuần hiện tại & Tuần nguồn';
              badgeColor = 'bg-purple-600 text-white border-purple-700 shadow-sm shadow-purple-500/10 font-bold';
            } else if (isCurrentWeek) {
              statusLabel = 'Tuần hiện tại';
              badgeColor = 'bg-blue-500/10 text-blue-700 border-blue-500/20';
            } else if (isSourceWeek) {
              statusLabel = 'Tu\u1ea7n ngu\u1ed3n';
              badgeColor = 'bg-purple-600 text-white border-purple-700 shadow-sm shadow-purple-500/10 font-bold';
            } else if (false) {
              statusLabel = 'Tuần nguồn lặp';
              badgeColor = 'bg-purple-500/10 text-purple-700 border-purple-500/20';
            } else if (containsRepeated) {
              statusLabel = 'Tuần lặp lại';
              badgeColor = 'bg-amber-500/10 text-amber-700 border-amber-500/20';
            }

            const relevantRecurrence = repeatedSchedulesInWeek.find(s => !!s.recurrence_id && s.recurrence?.source_week_start_date);
            const sourceWeekRangeStr = relevantRecurrence?.recurrence?.source_week_start_date && relevantRecurrence?.recurrence?.source_week_end_date
              ? `${new Date(relevantRecurrence.recurrence.source_week_start_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} - ${new Date(relevantRecurrence.recurrence.source_week_end_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
              : null;

            return (
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold h-8">
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
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start sm:justify-end">
          {/* Week Nav controls */}
          <div className="flex p-0.5 bg-white/75 rounded-lg border border-slate-200 shadow-sm items-center gap-1 h-8 shrink-0">
            <button onClick={() => setWeekOffset(prev => prev - 1)} className="p-1 hover:bg-slate-105 rounded-md text-slate-655 transition-all cursor-pointer w-7 h-7 flex items-center justify-center">
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className="px-2 h-7 flex items-center text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent rounded-md transition-all cursor-pointer font-sans"
            >
              Hiện tại
            </button>

            {(() => {
              const repeatedSchedulesInWeek = schedules.filter(s =>
                s.status !== 'cancelled' &&
                doesScheduleOverlapRange(s.start_time, s.end_time, startOfWeek, endOfWeek) &&
                !!s.recurrence_id
              );
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
                  className="px-2 h-7 flex items-center text-xs font-bold text-blue-655 hover:bg-blue-50 disabled:opacity-50 disabled:hover:bg-transparent rounded-md transition-all border-l border-slate-200 pl-2 cursor-pointer"
                >
                  Về tuần nguồn
                </button>
              );
            })()}

            <button onClick={() => setWeekOffset(prev => prev + 1)} className="p-1 hover:bg-slate-105 rounded-md text-slate-655 transition-all cursor-pointer w-7 h-7 flex items-center justify-center">
              <ChevronRight size={13} />
            </button>
          </div>

          {/* View selector: Tuần vs Ngày */}
          <div className="flex p-0.5 bg-slate-200/50 rounded-lg shrink-0 h-8 items-center">
            <button
              onClick={() => setView('weekly')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 text-xs font-bold rounded-md cursor-pointer transition-all h-7",
                view === 'weekly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Grid size={13} /> Lịch Tuần
            </button>
            <button
              onClick={() => { setView('daily'); handleSelectDate(weekDates[0]); }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 text-xs font-bold rounded-md cursor-pointer transition-all h-7",
                view === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <List size={13} /> Lịch Ngày
            </button>
          </div>

          {/* Recurrence config */}
          {canManage && (
            <>
              <button
                type="button"
                onClick={handleSaveAllPending}
                disabled={pendingSchedules.length === 0 || submitting}
                className="flex items-center gap-1.5 px-3 h-8 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg cursor-pointer text-xs font-bold shadow-sm shrink-0 transition-all focus:visible border-0"
              >
                <Copy size={13} />
                <span>Lưu tất cả ({pendingSchedules.length})</span>
              </button>

              <button
                onClick={() => handleOpenRecurrenceModal('default', defaultRecurrence)}
                className="flex items-center gap-1.5 px-2.5 h-8 border border-slate-200 hover:bg-slate-50 bg-white/75 text-slate-655 rounded-lg cursor-pointer text-xs font-bold shadow-sm shrink-0 transition-all focus:visible"
                title="Cấu hình chuỗi lịch lặp lại cho tuần hiện tại"
              >
                <RotateCw size={13} className="text-slate-455" />
                <span>Cấu hình chuỗi lặp</span>
              </button>
            </>
          )}

          {/* Refresh button */}
          <button
            onClick={loadSchedules}
            className="w-8 h-8 border border-slate-200 hover:bg-slate-50 bg-white/75 rounded-lg flex items-center justify-center cursor-pointer shadow-sm shrink-0 transition-all text-slate-655 focus:visible"
            title="Làm mới lịch"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>


      {/* Main Workspace Layout */}
      {view === 'weekly' ? (
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Left Side: Activity Palette */}
          <div className="col-span-12 lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-4 space-y-4 shadow-sm flex flex-col h-[600px]">
            <div className="flex flex-col gap-1.5 shrink-0">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-sans">Kéo hoạt động xếp lịch</h4>
              <p className="text-[10px] text-slate-400 font-semibold">Tìm và kéo thẻ hoạt động vào ca lịch bên phải</p>
            </div>

            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Tìm hoạt động nguồn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredSourceActivities.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-10 font-bold">Không có hoạt động phù hợp</p>
              ) : (
                filteredSourceActivities.map((act) => (
                  <div
                    key={act._id}
                    draggable={canManage}
                    onDragStart={(e) => handleDragStart(e, act._id)}
                    className={cn(
                      "p-3 border rounded-xl bg-slate-50 transition-all select-none group relative",
                      canManage ? "cursor-grab active:cursor-grabbing border-slate-200 hover:border-blue-300 hover:shadow-sm" : "opacity-80 border-slate-100"
                    )}
                  >
                    <p className="text-xs font-extrabold text-slate-700 line-clamp-1 leading-snug">{act.name}</p>
                    <p className="text-[9px] font-bold font-mono text-slate-400 mt-1 uppercase tracking-wider">{act.code}</p>
                    {act.isScheduled && (
                      <span className="absolute bottom-2.5 right-3 text-[8px] font-black px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100 uppercase tracking-wide">
                        Đã xếp lịch
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Side: Weekly Scheduler Grid */}
          <div className={cn(
            "col-span-12 lg:col-span-10 bg-white rounded-2xl overflow-hidden flex flex-col h-[600px]",
            isSourceWeek
              ? "border-purple-300 ring-2 ring-purple-500/10 shadow-[0_4px_20px_rgba(139,92,246,0.08)] bg-purple-50/[0.005]"
              : "border border-slate-100 shadow-sm"
          )}>
            <div className="w-full flex-1 flex flex-col min-h-0">
              <div className="flex flex-col h-full">
                {/* Header Row */}
                <div className="grid border-b border-slate-100 bg-slate-50/50 shrink-0" style={{ gridTemplateColumns: '70px repeat(7, minmax(0, 1fr))' }}>
                  <div className="p-2 text-center border-r lg:border-r-0 border-slate-100 flex flex-col items-center justify-center gap-0.5">
                    {isSourceWeek ? (
                      <>
                        <RotateCw size={13} className="text-purple-600" />
                        <p className="text-[9px] font-black text-purple-600 uppercase tracking-wider font-sans">{"Ngu\u1ed3n"}</p>
                      </>
                    ) : (
                      <>
                        <Clock size={13} className="text-slate-400" />
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-sans">Ca</p>
                      </>
                    )}
                  </div>
                  {weekDates.map((date, idx) => {
                    const today = isToday(date);
                    return (
                      <div key={idx} className={cn("p-3 text-center border-r lg:border-r-0 border-slate-100 last:border-0", today && "bg-blue-500/[0.03]")}>
                        <p className={cn("text-xs font-black font-sans", today ? 'text-blue-600' : 'text-slate-700')}>
                          {idx === 6 ? 'Chủ Nhật' : `Thứ ${idx + 2}`}
                        </p>
                        <p className={cn("text-[10px] font-extrabold mt-0.5 font-sans", today ? 'text-blue-500' : 'text-slate-400')}>
                          {date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Grid Body */}
                <div className="flex-1 flex flex-col divide-y divide-slate-100 overflow-y-auto custom-scrollbar">
                  {(['morning', 'afternoon', 'evening'] as ShiftType[]).map((shift) => {
                    const shiftDef = SHIFT_DEFINITIONS[shift];
                    return (
                      <div key={shift} className="grid divide-x lg:divide-x-0 divide-slate-150 flex-1 min-h-[160px]" style={{ gridTemplateColumns: '70px repeat(7, minmax(0, 1fr))' }}>
                        {/* Left ca label */}
                        <div className="p-2 flex flex-col justify-center items-center text-center bg-slate-50/30 border-r lg:border-r-0 border-slate-100 gap-1 select-none shrink-0 overflow-hidden">
                          <span className="text-base" title={shiftDef.label}>{shiftDef.icon}</span>
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide font-sans">{shiftShortLabels[shift]}</span>
                          <span className="text-[8px] font-bold text-slate-400 font-mono leading-none">{shiftDef.range.replace(/\s+/g, '')}</span>
                        </div>

                        {/* Drop cells */}
                        {weekDates.map((dayDate, dayIdx) => {
                          const cellDateStr = weekDateStrings[dayIdx];
                          const cellSchedules = weekSchedules.filter(s => {
                            const start = new Date(s.start_time);
                            return start.toDateString() === dayDate.toDateString() && getShiftForDate(s.start_time) === shift;
                          });

                          // Filter cell pending schedules (including previews from recurrence)
                          const cellPendings = getCellPendingSchedules(
                            dayDate,
                            cellDateStr,
                            shift,
                            pendingSchedules,
                            activeSemester,
                            defaultRecurrence,
                            anchorWeekMonday
                          );

                          const isCompactCell = cellSchedules.length + cellPendings.length > 1;

                          return (
                            <div
                              key={dayIdx}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => handleDrop(e, dayIdx, shift)}
                              className={cn(
                                "p-1.5 flex flex-col space-y-1.5 overflow-y-auto min-h-[140px] transition-colors relative group/cell custom-scrollbar",
                                isToday(dayDate) && "bg-blue-500/[0.01]",
                                canManage && "hover:bg-slate-50/80"
                              )}
                            >
                              {cellSchedules.length === 0 && cellPendings.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center text-[9px] font-bold text-slate-300 py-6 select-none font-sans">
                                  Trống
                                </div>
                              ) : (
                                <>
                                  {/* Render pending schedules */}
                                  {cellPendings.map((p) => {
                                    const timeStr = `${p.startTime} - ${p.endTime}`;
                                    const isPreview = p.isPreview;
                                    const accent = getActivityAccentColor(p);
                                    const styles = accentStyles[accent];

                                    const pClubIdNorm = getNormalizedId(p.clubId);
                                    const pResolvedAct = activities.find(a => a._id === pClubIdNorm);
                                    const pResolvedName = pResolvedAct?.name || p.originalData?.title || `Sinh hoạt ${p.clubName}`;

                                    return (
                                      <div
                                        key={p.tempId}
                                        draggable={canManage && !isPreview}
                                        onDragStart={(e) => {
                                          if (isPreview) return;
                                          handlePendingDragStart(e, p.tempId, p.dateStr, p.shift);
                                        }}
                                        onDoubleClick={(e) => canManage && handleConfigurePending(p, e)}
                                        title={isCompactCell ? `${pResolvedName} | ${timeStr} | ${p.originalData?.location || 'Phòng sinh hoạt'}` : undefined}
                                        className={cn(
                                          isCompactCell ? "p-1 gap-0.5" : "p-1.5 flex flex-col justify-between",
                                          "border border-l-[3px] rounded-lg text-left relative group select-none shadow-sm hover:shadow-md transition-all",
                                          isPreview ? "border-dashed opacity-75" : "",
                                          canManage && !isPreview ? "cursor-grab active:cursor-grabbing" : "",
                                          styles.card,
                                          styles.borderL
                                        )}
                                      >
                                        <div>
                                          <p className={cn(
                                            isCompactCell ? "text-[9px] font-extrabold line-clamp-1 leading-tight pr-1" : "text-[10px] font-extrabold leading-snug line-clamp-2 pr-5 break-words",
                                            styles.title
                                          )}>{isCompactCell ? pResolvedName : (p.originalData?.title || `Sinh hoạt ${p.clubName}`)}</p>
                                          <div className={cn("flex flex-col gap-0.5 mt-0.5 text-[8px] font-bold", styles.sub)}>
                                            <div className="flex items-center gap-1 shrink-0 opacity-90">
                                              <Clock size={8} className={cn("shrink-0", styles.icon)} />
                                              <span>{timeStr}</span>
                                            </div>
                                            <div className="flex items-center gap-1 truncate opacity-90">
                                              <MapPin size={8} className={cn("shrink-0", styles.icon)} />
                                              <span className="truncate">{p.originalData?.location || 'Phòng sinh hoạt'}</span>
                                            </div>
                                          </div>
                                        </div>

                                        {!isCompactCell && (
                                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/50">
                                            <span className="text-[8px] font-black text-blue-600 bg-blue-100/60 px-1 py-0.2 rounded uppercase tracking-wider">
                                              {isPreview ? 'Xem trước' : 'Chưa lưu'}
                                            </span>

                                            {canManage && !isPreview && (
                                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                  onClick={(e) => handleConfigurePending(p, e)}
                                                  className="p-0.5 hover:bg-blue-100 text-blue-700 rounded"
                                                  title="Cấu hình"
                                                >
                                                  <Settings size={9} />
                                                </button>
                                                <button
                                                  onClick={() => handleSavePending(p)}
                                                  disabled={submitting}
                                                  className="p-0.5 hover:bg-blue-100 text-green-700 rounded font-black text-[9px]"
                                                  title="Lưu"
                                                >
                                                  Lưu
                                                </button>
                                                <button
                                                  onClick={() => handleRemovePending(p.tempId)}
                                                  className="p-0.5 hover:bg-blue-100 text-red-500 rounded"
                                                  title="Xóa pending"
                                                >
                                                  <Trash2 size={9} />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {/* Render saved schedules */}
                                  {cellSchedules.map((schedule) => {
                                    const start = new Date(schedule.start_time);
                                    const end = new Date(schedule.end_time);
                                    const timeStr = `${start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
                                    const accent = getActivityAccentColor(schedule);
                                    const styles = accentStyles[accent];

                                    const sClubIdNorm = getNormalizedId(schedule.activity_id);
                                    const sResolvedAct = activities.find(a => a._id === sClubIdNorm);
                                    const sResolvedName = sResolvedAct?.name || schedule.title;

                                    return (
                                      <div
                                        key={schedule._id}
                                        draggable={canManage}
                                        onDragStart={(e) => handleScheduleDragStart(e, schedule, cellDateStr, shift)}
                                        onDoubleClick={(e) => canManage && handleConfigureSaved(schedule, e)}
                                        title={isCompactCell ? `${sResolvedName} | ${timeStr} | ${schedule.location || 'Phòng sinh hoạt'}` : undefined}
                                        className={cn(
                                          isCompactCell ? "p-1 gap-0.5" : "p-1.5 flex flex-col justify-between",
                                          "border border-l-[3px] rounded-lg text-left relative group select-none shadow-sm hover:shadow-md transition-all",
                                          canManage ? "cursor-grab active:cursor-grabbing" : "",
                                          styles.card,
                                          styles.borderL
                                        )}
                                      >
                                        <div>
                                          <p className={cn(
                                            isCompactCell ? "text-[9px] font-extrabold line-clamp-1 leading-tight pr-1" : "text-[10px] font-extrabold leading-snug line-clamp-2 pr-5 break-words",
                                            styles.title
                                          )} title={schedule.title}>{isCompactCell ? sResolvedName : schedule.title}</p>
                                          <div className={cn("flex flex-col gap-0.5 mt-0.5 text-[8px] font-bold", styles.sub)}>
                                            <div className="flex items-center gap-1 shrink-0 opacity-90">
                                              <Clock size={8} className={cn("shrink-0", styles.icon)} />
                                              <span>{timeStr}</span>
                                            </div>
                                            <div className="flex items-center gap-1 truncate opacity-90">
                                              <MapPin size={8} className={cn("shrink-0", styles.icon)} />
                                              <span className="truncate">{schedule.location || 'Phòng sinh hoạt'}</span>
                                            </div>
                                          </div>
                                        </div>

                                        {!isCompactCell && (
                                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/50">
                                            {renderRecurrenceBadge(schedule, 'sm') || <span />}

                                            {canManage && (
                                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                  onClick={(e) => handleConfigureSaved(schedule, e)}
                                                  className="p-0.5 hover:bg-slate-100 text-slate-500 rounded"
                                                  title="Cấu hình"
                                                >
                                                  <Settings size={9} />
                                                </button>
                                                {schedule.recurrence_id && (
                                                  <button
                                                    onClick={() => handleCancelRecurrence(schedule)}
                                                    className="p-0.5 hover:bg-purple-50 text-purple-500 rounded"
                                                    title="Dừng lặp từ buổi này"
                                                  >
                                                    <AlertCircle size={9} />
                                                  </button>
                                                )}
                                                <button
                                                  onClick={() => {
                                                    setSelectedSchedule(schedule);
                                                    setShowDeleteModal(true);
                                                  }}
                                                  className="p-0.5 hover:bg-red-50 text-red-500 rounded"
                                                  title="Xóa"
                                                >
                                                  <Trash2 size={9} />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </>
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
        </div>
      ) : (
        /* Daily view */
        <div className="space-y-6 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          {/* Day Navigator */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase">
                {selectedDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
              </h3>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Date selection strip */}
              <div className="w-[320px] max-w-full grid grid-cols-7 gap-1">
                {weekDates.map((date, idx) => {
                  const isSelected = selectedDate.toDateString() === date.toDateString();
                  const isToday = new Date().toDateString() === date.toDateString();
                  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                  const hasEvents = schedules.some(s => s.status !== 'cancelled' && doesScheduleOccurOnDate(s, date));

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectDate(date)}
                      className={cn(
                        "flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer relative",
                        isSelected
                          ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                          : isToday
                          ? "bg-blue-500/10 border border-blue-500/40 text-blue-600 hover:bg-blue-500/20"
                          : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/30"
                      )}
                    >
                      <span className={cn(
                        "text-[9px] font-bold tracking-wider uppercase opacity-85",
                        isSelected ? "text-white/90" : "text-slate-400"
                      )}>
                        {idx === 6 ? 'SUN' : dayNames[idx + 1] === 'CN' ? 'SUN' : dayNames[idx + 1]}
                      </span>
                      <span className="text-sm font-black mt-0.5 leading-none">
                        {date.getDate()}
                      </span>
                      {hasEvents && (
                        <span className={cn(
                          "w-1 h-1 rounded-full absolute bottom-1.5",
                          isSelected ? "bg-white" : "bg-blue-500"
                        )} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Day navigation buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const prevDate = new Date(selectedDate);
                    prevDate.setDate(selectedDate.getDate() - 1);
                    handleSelectDate(prevDate);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-all border border-slate-200 bg-white cursor-pointer"
                  title="Ngày trước"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => handleSelectDate(new Date())}
                  className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-xl transition-all cursor-pointer border border-blue-100"
                >
                  Hôm nay
                </button>
                <button
                  onClick={() => {
                    const nextDate = new Date(selectedDate);
                    nextDate.setDate(selectedDate.getDate() + 1);
                    handleSelectDate(nextDate);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-all border border-slate-200 bg-white cursor-pointer"
                  title="Ngày sau"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-3 items-center border-b border-slate-100 pb-4">
            {/* Filter by Activity dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-700 cursor-pointer transition-all border border-slate-200/50">
              <Filter size={12} className="text-slate-400" />
              <select
                value={filterClubId}
                onChange={(e) => setFilterClubId(e.target.value)}
                className="bg-transparent border-none outline-none cursor-pointer pr-1 text-slate-700 font-bold text-xs"
              >
                <option value="all">Tất cả hoạt động</option>
                {activities.map(a => (
                  <option key={a._id} value={a._id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Schedule Type Filters */}
            {[
              { value: 'all', label: 'Tất cả', color: 'bg-blue-600' },
              { value: 'regular', label: 'Sinh hoạt', color: 'bg-blue-600' },
              { value: 'event', label: 'Sự kiện', color: 'bg-violet-600' },
              { value: 'exam', label: 'Kiểm tra', color: 'bg-rose-600' },
              { value: 'meeting', label: 'Họp', color: 'bg-amber-600' }
            ].map(type => {
              const isActive = filterScheduleType === type.value;
              return (
                <button
                  key={type.value}
                  onClick={() => setFilterScheduleType(type.value)}
                  className={cn(
                    "px-3.5 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer border border-slate-200/30",
                    isActive
                      ? `${type.color} text-white shadow-sm shadow-blue-500/10`
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                  )}
                >
                  {type.label}
                </button>
              );
            })}
          </div>

          {filteredDailySchedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-50/50 border border-slate-100 rounded-3xl text-center space-y-4 max-w-md mx-auto shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 shadow-inner">
                <CalendarDays size={32} className="opacity-80" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-slate-800">Hôm nay trống lịch</h4>
                <p className="text-xs text-slate-500 font-semibold max-w-xs">Không có hoạt động nào được tìm thấy theo bộ lọc này.</p>
              </div>
              {canManage && (
                <button
                  onClick={() => {
                    const dayIdx = weekDates.findIndex(d => d.toDateString() === selectedDate.toDateString());
                    handleOpenCreateModal(dayIdx !== -1 ? dayIdx : undefined);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/10 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={14} className="stroke-[2.5]" />
                  <span>Tạo lịch hoạt động</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Morning Shift */}
              {renderDailyShiftColumn('morning', 'Ca Sáng', '07:00 - 11:30', morningSchedules, <Sunrise className="h-5 w-5 text-amber-500" />)}
              {/* Afternoon Shift */}
              {renderDailyShiftColumn('afternoon', 'Ca Chiều', '13:00 - 17:30', afternoonSchedules, <Sun className="h-5 w-5 text-orange-500" />)}
              {/* Evening Shift */}
              {renderDailyShiftColumn('evening', 'Ca Tối', '18:00 - 21:00', eveningSchedules, <Moon className="h-5 w-5 text-indigo-500" />)}
            </div>
          )}
        </div>
      )}

      {/* Simplified / Detailed Create/Edit Modal Dialog */}
      {showCreateModal && (
        <div
          className={cn(
            isSimplifiedModal
              ? "fixed z-50 select-none animate-in fade-in zoom-in-95 duration-150"
              : "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-none"
          )}
          style={isSimplifiedModal && modalPosition ? { position: 'fixed', top: modalPosition.top, left: modalPosition.left, width: '280px' } : undefined}
        >
          <form
            onSubmit={handleCreateSubmit}
            role="dialog"
            aria-modal={isSimplifiedModal ? "false" : "true"}
            aria-labelledby="dialog-title"
            className={cn(
              "rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200",
              isSimplifiedModal
                ? "w-full border border-slate-200/80 ring-1 ring-slate-200/50 shadow-[0_20px_50px_rgba(0,0,0,0.12)] bg-white/95 backdrop-blur-md"
                : "bg-white w-full max-w-lg border border-slate-200 shadow-xl"
            )}
          >
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
              <h3 id="dialog-title" className="text-xs font-black text-slate-800 uppercase tracking-wider font-sans">
                {isSimplifiedModal ? 'C\u1ea5u h\u00ecnh bu\u1ed5i sinh ho\u1ea1t' : (formScheduleId ? 'Ch\u1ec9nh s\u1eeda l\u1ecbch tr\u00ecnh' : 'L\u00ean l\u1ecbch sinh ho\u1ea1t m\u1edbi')}
              </h3>
              {false && <>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider font-sans">
                {formScheduleId ? 'Cấu hình buổi sinh hoạt' : 'Lên lịch sinh hoạt mới'}
              </h3>
              </>}
              <button
                type="button"
                onClick={() => { setShowCreateModal(false); setActivePendingSchedule(null); }}
                className="text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors cursor-pointer rounded"
              >
                <X size={18} />
              </button>
            </div>

            <div className={cn(
              "max-h-[60vh] overflow-y-auto",
              isSimplifiedModal ? "p-3.5 space-y-3" : "p-6 space-y-4"
            )}>
              {!isSimplifiedModal && !formScheduleId && (
                <>
                  <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase px-1 font-sans">Tiêu đề buổi</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ví dụ: Sinh hoạt định kỳ tuần 12"
                  className="w-full h-10 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase px-1 font-sans">Mô tả nội dung</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Nội dung chi tiết sinh hoạt..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                  </div>
                </>
              )}

              <div className={cn("grid gap-4", isSimplifiedModal ? "grid-cols-1" : "grid-cols-2")}>
                <div className="flex flex-col gap-1">
                  <label className={cn("font-bold text-slate-500 uppercase px-1 font-sans", isSimplifiedModal ? "text-[9px]" : "text-[11px]")}>Địa điểm</label>
                  <input
                    type="text"
                    required
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Ví dụ: Phòng máy B.202"
                    className={cn(
                      "w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600",
                      isSimplifiedModal
                        ? "h-8 text-xs rounded-lg px-2.5 py-1.5"
                        : "h-10 px-3 py-2 rounded-xl text-sm"
                    )}
                  />
                </div>
                {!isSimplifiedModal && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase px-1 font-sans">Giới hạn người tham gia</label>
                    <input
                      type="number"
                      value={formMaxAttendees}
                      onChange={(e) => setFormMaxAttendees(e.target.value)}
                      placeholder="Không giới hạn"
                      className="w-full h-10 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                )}
              </div>

              <div className={cn("grid gap-4", isSimplifiedModal ? "grid-cols-2" : "grid-cols-3")}>
                {!isSimplifiedModal && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase px-1 font-sans">Ngày sinh hoạt</label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full h-10 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className={cn("font-bold text-slate-500 uppercase px-1 font-sans", isSimplifiedModal ? "text-[9px]" : "text-[11px]")}>Giờ bắt đầu</label>
                  <CustomTimePicker value={formStartTime} onChange={setFormStartTime} size={isSimplifiedModal ? 'sm' : 'md'} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={cn("font-bold text-slate-500 uppercase px-1 font-sans", isSimplifiedModal ? "text-[9px]" : "text-[11px]")}>Giờ kết thúc</label>
                  <CustomTimePicker value={formEndTime} onChange={setFormEndTime} size={isSimplifiedModal ? 'sm' : 'md'} />
                </div>
              </div>

              {/* Form Recurrence controls - Disabled when editing or in simplified modal */}
              {!isSimplifiedModal && !formScheduleId && (
                <div className="border border-slate-100 rounded-2xl p-4 space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 font-sans">Thiết lập lặp lại lịch sinh hoạt</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Tự động tạo nhiều buổi sinh hoạt định kỳ</p>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={scheduleRecurrence.enabled}
                        onChange={(e) => setScheduleRecurrence(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </div>
                  </div>

                  {scheduleRecurrence.enabled && (
                    <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-4 animate-in fade-in duration-200">
                      <div className="flex flex-col gap-1.5 w-full">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-1 font-sans">Chu kỳ lặp</label>
                        <select
                          value={scheduleRecurrence.type}
                          onChange={(e: any) => setScheduleRecurrence(prev => ({ ...prev, type: e.target.value }))}
                          className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold focus:outline-none appearance-none cursor-pointer"
                        >
                          <option value="weekly">Hàng tuần</option>
                          <option value="biweekly">2 tuần một lần</option>
                          <option value="monthly">Hàng tháng</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5 w-full">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-1 font-sans">Kết thúc lặp</label>
                        <select
                          value={scheduleRecurrence.untilType}
                          onChange={(e: any) => setScheduleRecurrence(prev => ({ ...prev, untilType: e.target.value }))}
                          className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold focus:outline-none appearance-none cursor-pointer"
                        >
                          <option value="semester">Đến hết học kỳ</option>
                          <option value="date">Đến ngày cụ thể</option>
                        </select>
                      </div>

                      {scheduleRecurrence.untilType === 'date' && (
                        <div className="col-span-2 flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase px-1 font-sans">Ngày kết thúc lặp</label>
                          <input
                            type="date"
                            required
                            value={scheduleRecurrence.untilDate || ''}
                            onChange={(e) => setScheduleRecurrence(prev => ({ ...prev, untilDate: e.target.value }))}
                            className="w-full h-10 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={cn("flex justify-end gap-3 border-t border-slate-100", isSimplifiedModal ? "px-3.5 py-2.5 bg-slate-50/50" : "px-6 py-4 bg-slate-50")}>
              <button
                type="button"
                onClick={() => { setShowCreateModal(false); setActivePendingSchedule(null); }}
                className={cn(
                  "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600",
                  isSimplifiedModal
                    ? "h-7 px-2.5 text-[10px] rounded-lg font-semibold"
                    : "h-9 px-4 text-xs font-bold rounded-xl"
                )}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-750 text-white shadow-md border-0 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600",
                  isSimplifiedModal
                    ? "h-7 px-3 text-[10px] rounded-lg font-bold"
                    : "h-9 px-5 text-xs font-black rounded-xl"
                )}
              >
                {formScheduleId ? 'Cập Nhật Lịch' : 'Xác Nhận'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Advanced Recurrence Configuration Modal Dialog */}
      {showRecurrenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-none">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider font-sans">Cấu hình chuỗi lịch lặp lại</h3>
              <button
                type="button"
                onClick={() => setShowRecurrenceModal(false)}
                className="text-slate-400 hover:text-slate-655 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase px-1 font-sans">Kiểu kết thúc lặp</label>
                <Select value={modalUntilType} onValueChange={(value) => setModalUntilType(value as typeof modalUntilType)}>
                  <SelectTrigger className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold focus-within:ring-blue-500/20">
                    <SelectValue placeholder="Chọn kiểu kết thúc" />
                  </SelectTrigger>
                  <SelectContent disablePortal className="max-w-none bg-white">
                    <SelectItem value="semester">Lặp theo học kỳ hoạt động</SelectItem>
                    <SelectItem value="weeks">Lặp theo số tuần cụ thể</SelectItem>
                    <SelectItem value="date">Lặp đến ngày tự chọn</SelectItem>
                    <SelectItem value="none">Hủy bỏ chuỗi lặp (Trở về một lần)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {modalUntilType !== 'none' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase px-1 font-sans">Chu kỳ lặp</label>
                      <Select value={modalRecurrenceType} onValueChange={(value) => setModalRecurrenceType(value as typeof modalRecurrenceType)}>
                        <SelectTrigger className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold focus-within:ring-blue-500/20">
                          <SelectValue placeholder="Chọn chu kỳ" />
                        </SelectTrigger>
                        <SelectContent disablePortal className="max-w-none bg-white">
                          <SelectItem value="weekly">Hàng tuần</SelectItem>
                          <SelectItem value="biweekly">2 tuần một lần</SelectItem>
                          <SelectItem value="monthly">Hàng tháng</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {modalUntilType === 'weeks' && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase px-1 font-sans">Số tuần lặp lại</label>
                        <input
                          type="number"
                          value={modalWeeksCount}
                          onChange={(e) => setModalWeeksCount(Number(e.target.value))}
                          className="h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase px-1 font-sans">Ngày bắt đầu lặp</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="h-10 px-3 border border-slate-200 rounded-xl bg-white text-left text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            {formatDisplayDate(modalRepeatStartDate)}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto border-0 bg-transparent p-0 shadow-none" align="start">
                          <CustomCalendar
                            startDate={parseLocalDate(modalRepeatStartDate)}
                            endDate={null}
                            onRangeSelect={() => undefined}
                            onRangeConfirm={(start) => setModalRepeatStartDate(formatLocalDate(start))}
                            onCancel={() => undefined}
                            onConfirm={() => undefined}
                            minDate={parseLocalDate(anchorWeekMonday) || undefined}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase px-1 font-sans">Ngày kết thúc lặp</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            disabled={modalUntilType === 'semester' || modalUntilType === 'weeks'}
                            className="h-10 px-3 border border-slate-200 rounded-xl bg-white text-left text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                          >
                            {formatDisplayDate(modalRepeatEndDate)}
                          </button>
                        </PopoverTrigger>
                        {modalUntilType === 'date' && (
                          <PopoverContent className="w-auto border-0 bg-transparent p-0 shadow-none" align="start">
                            <CustomCalendar
                              startDate={parseLocalDate(modalRepeatEndDate)}
                              endDate={null}
                              onRangeSelect={() => undefined}
                              onRangeConfirm={(start) => {
                                const selectedDate = formatLocalDate(start);
                                setModalRepeatEndDate(selectedDate);
                                setModalUntilDate(selectedDate);
                              }}
                              onCancel={() => undefined}
                              onConfirm={() => undefined}
                              minDate={parseLocalDate(modalRepeatStartDate) || undefined}
                            />
                          </PopoverContent>
                        )}
                      </Popover>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRecurrenceModal(false)}
                className="h-9 px-4 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-650"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleConfirmRecurrence}
                className="h-9 px-5 text-xs bg-blue-600 hover:bg-blue-750 text-white font-black rounded-xl shadow-md border-0"
              >
                Xác Nhận Cấu Hình
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      {showDeleteModal && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-none">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-3xl shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider font-sans">Xác nhận xóa lịch trình</h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Bạn có chắc muốn xóa buổi sinh hoạt &quot;{selectedSchedule.title}&quot;?
              {selectedSchedule.recurrence_id && ' Đây là một buổi nằm trong chuỗi lịch lặp định kỳ.'}
            </p>

            <div className="flex flex-col gap-2 pt-2">
              {selectedSchedule.recurrence_id ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleDeleteConfirm(true)}
                    className="w-full h-9 text-xs font-bold bg-red-650 hover:bg-red-750 text-white rounded-xl border-0 cursor-pointer"
                  >
                    Xóa TOÀN BỘ chuỗi lịch lặp
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteConfirm(false)}
                    className="w-full h-9 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-xl cursor-pointer"
                  >
                    Chỉ xóa buổi NÀY
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDeleteConfirm(false)}
                  className="w-full h-9 text-xs font-bold bg-red-650 hover:bg-red-750 text-white rounded-xl border-0 cursor-pointer"
                >
                  Xóa buổi sinh hoạt
                </button>
              )}
              <button
                type="button"
                onClick={() => { setSelectedSchedule(null); setShowDeleteModal(false); }}
                className="w-full h-9 text-xs font-bold text-slate-550 hover:bg-slate-100 rounded-xl border-0 bg-transparent cursor-pointer"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Series Option Confirmation Modal Dialog */}
      {showUpdateSeriesConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-none">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-3xl shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider font-sans">Lựa chọn cập nhật lịch</h3>
            <p className="text-xs text-slate-550 font-semibold leading-relaxed">
              Bạn đang cập nhật một lịch biểu nằm trong chuỗi lặp lại định kỳ. Vui lòng lựa chọn phạm vi áp dụng thay đổi.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleConfirmUpdateSeries(true)}
                className="w-full h-9 text-xs font-bold bg-blue-600 hover:bg-blue-750 text-white rounded-xl border-0 cursor-pointer"
              >
                Cập nhật TOÀN BỘ chuỗi lịch lặp
              </button>
              <button
                type="button"
                onClick={() => handleConfirmUpdateSeries(false)}
                className="w-full h-9 text-xs font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-xl cursor-pointer"
              >
                Chỉ cập nhật buổi sinh hoạt NÀY
              </button>
              <button
                type="button"
                onClick={() => { setShowUpdateSeriesConfirmModal(false); setPendingUpdatePayload(null); }}
                className="w-full h-9 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl border-0 bg-transparent cursor-pointer"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Recurrence Confirmation Modal Dialog */}
      {showCancelRecurrenceConfirmModal && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-none">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-3xl shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider font-sans">Hủy chuỗi lặp lại</h3>
            <p className="text-xs text-slate-550 font-semibold leading-relaxed">
              Bạn có chắc chắn muốn dừng toàn bộ các buổi lặp lại tiếp theo của chuỗi lịch &quot;{selectedSchedule.title}&quot; kể từ thời điểm này trở đi? Các buổi trong quá khứ và buổi hiện tại sẽ được giữ lại.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowCancelRecurrenceConfirmModal(false); setSelectedSchedule(null); }}
                className="h-9 px-4 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-600"
              >
                Không, giữ nguyên
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelRecurrence}
                className="h-9 px-5 text-xs bg-red-650 hover:bg-red-750 text-white font-black rounded-xl shadow-md border-0"
              >
                Xác Nhận Dừng Lặp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

