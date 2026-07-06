'use client';

import React, { useEffect, useState } from 'react';
import {
  Calendar, Clock, MapPin, Plus, ChevronLeft, ChevronRight,
  Search, Users, Trash2, Check, AlertCircle, CalendarRange,
  X, Grid, List, Activity, HelpCircle, Settings, SlidersHorizontal
} from 'lucide-react';
import { clubScheduleApi, clubApi, ClubSchedule, Club } from '@/api/club-api';
import { semesterApi, Semester } from '@/api/semester-api';
import { useAuth } from '@/providers/auth-provider';
import { toast } from 'sonner';

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

// --- Timetable constants ---
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 18;
const PIXELS_PER_HOUR = 60;
const SNAP_MINUTES = 15;
const MIN_DURATION_MINUTES = 30;

const GRID_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const GRID_HEIGHT = (GRID_MINUTES / 60) * PIXELS_PER_HOUR;
const HOUR_SEPARATOR_CLASS = 'border-slate-200/30';

function getMinutesFromDayStart(value: string | Date): number {
  const date = new Date(value);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return (hours - DAY_START_HOUR) * 60 + minutes;
}

function getSchedulePixelLayout(
  startTime: string | Date,
  endTime: string | Date
): { top: number; height: number } {
  const startMinutes = getMinutesFromDayStart(startTime);
  const endMinutes = getMinutesFromDayStart(endTime);
  const clampedStart = clampMinutesToGrid(startMinutes);
  const clampedEnd = clampMinutesToGrid(endMinutes);

  const top = (clampedStart / 60) * PIXELS_PER_HOUR;
  const height = ((clampedEnd - clampedStart) / 60) * PIXELS_PER_HOUR;

  return { top, height };
}

function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function clampMinutesToGrid(minutes: number): number {
  return Math.max(0, Math.min(GRID_MINUTES, minutes));
}

function getMinutesFromPointer(
  clientY: number,
  gridRect: DOMRect,
  scrollTop: number
): number {
  const relativeY = clientY - gridRect.top + scrollTop;
  const minutes = (relativeY / PIXELS_PER_HOUR) * 60;
  return clampMinutesToGrid(snapMinutes(minutes));
}

function getDayIndexFromPointer(
  clientX: number,
  daysRect: DOMRect
): number {
  const relativeX = clientX - daysRect.left;
  const colWidth = daysRect.width / 7;
  const dayIdx = Math.floor(relativeX / colWidth);
  return Math.max(0, Math.min(6, dayIdx));
}

function buildDateTimeFromDayAndMinutes(
  day: Date,
  minutesFromGridStart: number
): Date {
  const date = new Date(day);
  const hours = Math.floor(minutesFromGridStart / 60) + DAY_START_HOUR;
  const minutes = minutesFromGridStart % 60;
  date.setHours(hours, minutes, 0, 0);
  return date;
}

interface ScheduleLayout {
  top: number;
  height: number;
  left: number; // percentage
  width: number; // percentage
  startDayIndex: number;
  endDayIndex: number;
}

function getScheduleLayout(
  startTime: string,
  endTime: string,
  visibleWeekDates: Date[]
): ScheduleLayout | null {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const weekStart = new Date(visibleWeekDates[0]);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(visibleWeekDates[6]);
  weekEnd.setHours(23, 59, 59, 999);

  if (end < weekStart || start > weekEnd) {
    return null;
  }

  const actualStart = start < weekStart ? new Date(weekStart) : start;
  const actualEnd = end > weekEnd ? new Date(weekEnd) : end;

  const getDayIdx = (d: Date) => {
    return visibleWeekDates.findIndex(wd => wd.toDateString() === d.toDateString());
  };

  let startDayIdx = getDayIdx(actualStart);
  let endDayIdx = getDayIdx(actualEnd);

  if (startDayIdx === -1) startDayIdx = 0;
  if (endDayIdx === -1) endDayIdx = 6;

  const { top, height } = getSchedulePixelLayout(actualStart, actualEnd);

  const left = (startDayIdx / 7) * 100;
  const width = ((endDayIdx - startDayIdx + 1) / 7) * 100;

  return {
    top,
    height,
    left,
    width,
    startDayIndex: startDayIdx,
    endDayIndex: endDayIdx,
  };
}

export interface DraftSchedule {
  id: string;
  club_id: string;
  title: string;
  description?: string;
  location?: string;
  schedule_type: string;
  start_time: string; // ISO string
  end_time: string; // ISO string
  semester_id?: string;
  recurrence?: {
    type: 'weekly' | 'biweekly' | 'monthly';
    untilType: 'semester' | 'custom' | 'none';
    weeksCount?: number;
    untilDate?: string;
  } | null;
  max_attendees?: number;
}

export default function SchedulesOverview() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission('CLUB_SCHEDULE_MANAGE') || user?.role === 'admin';

  // Core data states
  const [schedules, setSchedules] = useState<ClubSchedule[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [loading, setLoading] = useState(true);

  // Navigation & View states
  const [view, setView] = useState<'weekly' | 'daily'>('weekly');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ClubSchedule | null>(null);

  // Form states
  const [formClubId, setFormClubId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formType, setFormType] = useState('regular');
  const [formDate, setFormDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formRecurrenceType, setFormRecurrenceType] = useState<'none' | 'semester' | 'custom'>('none');
  const [formRecurrenceWeeks, setFormRecurrenceWeeks] = useState(8);
  const [formMaxAttendees, setFormMaxAttendees] = useState('');

  // Draft states
  const [draftSchedules, setDraftSchedules] = useState<DraftSchedule[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [defaultRecurrence, setDefaultRecurrence] = useState<{
    type: 'weekly' | 'biweekly' | 'monthly';
    untilType: 'semester' | 'custom' | 'none';
    weeksCount?: number;
    untilDate?: string;
  } | null>({
    type: 'weekly',
    untilType: 'semester',
  });
  const [movingSchedule, setMovingSchedule] = useState<{
    id: string;
    start_time: string;
    end_time: string;
  } | null>(null);

  // Advanced Recurrence Modal states
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [modalRecurrenceType, setModalRecurrenceType] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [modalUntilType, setModalUntilType] = useState<'semester' | 'custom' | 'none'>('semester');
  const [modalWeeksCount, setModalWeeksCount] = useState<number>(8);
  const [modalUntilDate, setModalUntilDate] = useState<string>('');


  useEffect(() => {
    loadInitialData();
  }, []);

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

  // Filter schedules that fall in current week
  const weekSchedules = schedules.filter(s => {
    const sDate = new Date(s.start_time);
    const startOfWeek = new Date(mondayDate);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(sundayDate);
    endOfWeek.setHours(23, 59, 59, 999);
    return sDate >= startOfWeek && sDate <= endOfWeek && s.status !== 'cancelled';
  });

  // Filter draft schedules that fall in current week
  const weekDraftSchedules = draftSchedules.filter(s => {
    const sDate = new Date(s.start_time);
    const startOfWeek = new Date(mondayDate);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(sundayDate);
    endOfWeek.setHours(23, 59, 59, 999);
    return sDate >= startOfWeek && sDate <= endOfWeek;
  });

  // Unscheduled Bucket: Clubs that don't have schedules in the current week
  const unscheduledClubs = clubs.filter(club => {
    const hasWeekSchedule = schedules.some(s => {
      if (s.status === 'cancelled') return false;
      const sDate = new Date(s.start_time);
      const startOfWeek = new Date(mondayDate);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(sundayDate);
      endOfWeek.setHours(23, 59, 59, 999);
      const matchesClub = (typeof s.club_id === 'string' ? s.club_id : s.club_id?._id) === club._id;
      return matchesClub && sDate >= startOfWeek && sDate <= endOfWeek;
    }) || draftSchedules.some(d => {
      const sDate = new Date(d.start_time);
      const startOfWeek = new Date(mondayDate);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(sundayDate);
      endOfWeek.setHours(23, 59, 59, 999);
      const matchesClub = d.club_id === club._id;
      return matchesClub && sDate >= startOfWeek && sDate <= endOfWeek;
    });
    return !hasWeekSchedule;
  }).filter(club =>
    club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    club.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, clubId: string) => {
    if (!canManage) return;
    e.dataTransfer.setData('text/plain', clubId);
  };

  const handleDrop = (e: React.DragEvent, dayIndex: number) => {
    e.preventDefault();
    if (!canManage) return;
    const clubId = e.dataTransfer.getData('text/plain');
    if (!clubId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    
    // Convert grid offsetY to actual time based on 60px/hour (1px/minute), starting from 07:00.
    const minutes = (offsetY / PIXELS_PER_HOUR) * 60;
    const totalMinutes = clampMinutesToGrid(snapMinutes(minutes));

    const targetDate = weekDates[dayIndex];
    const startDateTime = buildDateTimeFromDayAndMinutes(targetDate, totalMinutes);

    const endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours default duration

    const targetClub = clubs.find(c => c._id === clubId);
    const draftId = `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newDraft: DraftSchedule = {
      id: draftId,
      club_id: clubId,
      title: targetClub ? `Sinh hoạt CLB ${targetClub.name}` : 'Sinh hoạt CLB',
      description: '',
      location: 'Phòng sinh hoạt CLB',
      schedule_type: 'regular',
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      semester_id: activeSemester?._id || semesters[0]?._id,
      recurrence: defaultRecurrence ? { ...defaultRecurrence } : null,
    };

    setDraftSchedules(prev => [...prev, newDraft]);
    setActiveDraftId(draftId);
  };

  const handleSaveDraft = async (draftId: string) => {
    const draft = draftSchedules.find(d => d.id === draftId);
    if (!draft) return;

    let apiRecurrence = undefined;
    if (draft.recurrence && draft.recurrence.untilType !== 'none') {
      const startDateTime = new Date(draft.start_time);
      if (draft.recurrence.untilType === 'semester') {
        apiRecurrence = { type: draft.recurrence.type };
      } else if (draft.recurrence.untilType === 'custom') {
        let untilStr = undefined;
        if (draft.recurrence.weeksCount !== undefined) {
          const until = new Date(startDateTime.getTime() + draft.recurrence.weeksCount * 7 * 24 * 60 * 60 * 1000);
          untilStr = until.toISOString();
        } else if (draft.recurrence.untilDate) {
          const until = new Date(draft.recurrence.untilDate);
          untilStr = until.toISOString();
        }
        apiRecurrence = { 
          type: draft.recurrence.type,
          until: untilStr
        };
      }
    }

    const payload = {
      club_id: draft.club_id,
      title: draft.title,
      description: draft.description || '',
      location: draft.location || 'Phòng sinh hoạt CLB',
      schedule_type: draft.schedule_type,
      start_time: draft.start_time,
      end_time: draft.end_time,
      semester_id: draft.semester_id || activeSemester?._id || semesters[0]?._id,
      recurrence: apiRecurrence,
      max_attendees: draft.max_attendees,
    };

    try {
      await clubScheduleApi.create(payload);
      toast.success(apiRecurrence ? 'Đã xếp chuỗi lịch sinh hoạt thành công' : 'Đã xếp lịch sinh hoạt thành công');
      setDraftSchedules(prev => prev.filter(d => d.id !== draftId));
      if (activeDraftId === draftId) {
        setActiveDraftId(null);
      }
      reloadSchedules();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể lưu lịch nháp');
    }
  };

  const handleCancelDraft = (draftId: string) => {
    setDraftSchedules(prev => prev.filter(d => d.id !== draftId));
    if (activeDraftId === draftId) {
      setActiveDraftId(null);
    }
  };

  const handleOpenAdvancedSettings = (draft: DraftSchedule) => {
    setFormClubId(draft.club_id);
    setFormTitle(draft.title);
    setFormDesc(draft.description || '');
    setFormLocation(draft.location || 'Phòng sinh hoạt CLB');
    setFormType(draft.schedule_type);
    
    const startDateTime = new Date(draft.start_time);
    const endDateTime = new Date(draft.end_time);
    
    const yyyy = startDateTime.getFullYear();
    const mm = String(startDateTime.getMonth() + 1).padStart(2, '0');
    const dd = String(startDateTime.getDate()).padStart(2, '0');
    setFormDate(`${yyyy}-${mm}-${dd}`);
    
    const startH = String(startDateTime.getHours()).padStart(2, '0');
    const startM = String(startDateTime.getMinutes()).padStart(2, '0');
    setFormStartTime(`${startH}:${startM}`);
    
    const endH = String(endDateTime.getHours()).padStart(2, '0');
    const endM = String(endDateTime.getMinutes()).padStart(2, '0');
    setFormEndTime(`${endH}:${endM}`);
    
    if (draft.recurrence) {
      setFormRecurrenceType(
        draft.recurrence.untilType === 'semester' 
          ? 'semester' 
          : draft.recurrence.untilType === 'custom' 
            ? 'custom' 
            : 'none'
      );
      setFormRecurrenceWeeks(draft.recurrence.weeksCount || 8);
    } else {
      setFormRecurrenceType('none');
    }
    
    setFormMaxAttendees(draft.max_attendees ? String(draft.max_attendees) : '');
    
    setActiveDraftId(draft.id);
    setShowCreateModal(true);
  };

  const handlePointerDown = (
    e: React.PointerEvent,
    id: string,
    mode: 'dragging' | 'resizing-top' | 'resizing-bottom' | 'resizing-left' | 'resizing-right',
    isDraft: boolean
  ) => {
    if (!canManage) return;
    e.preventDefault();

    const startY = e.clientY;
    const startX = e.clientX;

    const originalItem = isDraft
      ? draftSchedules.find(d => d.id === id)
      : schedules.find(s => s._id === id);
    if (!originalItem) return;

    const startOriginal = new Date(originalItem.start_time);
    const endOriginal = new Date(originalItem.end_time);

    const originalStartDateStr = startOriginal.toDateString();
    const originalEndDateStr = endOriginal.toDateString();

    const startDayIdxOriginal = weekDates.findIndex(d => d.toDateString() === originalStartDateStr);
    const endDayIdxOriginal = weekDates.findIndex(d => d.toDateString() === originalEndDateStr);

    const gridElement = document.getElementById('schedule-grid-body');
    const daysContainer = document.getElementById('schedule-days-container');
    if (!gridElement || !daysContainer) return;

    const gridRect = daysContainer.getBoundingClientRect();
    const initialScrollTop = gridElement.scrollTop;

    // Neo tọa độ dọc
    const initialMinutesClicked = getMinutesFromPointer(startY, gridRect, initialScrollTop);
    const originalStartMinutes = getMinutesFromDayStart(startOriginal);
    const verticalOffsetMinutes = initialMinutesClicked - originalStartMinutes;

    // Neo cột ngày
    const initialDayIdxClicked = getDayIndexFromPointer(startX, gridRect);

    // Thiết lập movingSchedule ban đầu
    setMovingSchedule({
      id,
      start_time: originalItem.start_time,
      end_time: originalItem.end_time
    });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const currentScrollTop = gridElement.scrollTop;
      const minutesCurrent = getMinutesFromPointer(moveEvent.clientY, gridRect, currentScrollTop);
      const dayIdxCurrent = getDayIndexFromPointer(moveEvent.clientX, gridRect);

      let newStart = new Date(startOriginal);
      let newEnd = new Date(endOriginal);

      if (mode === 'dragging') {
        // Di chuyển ngày (ngang)
        const dayDiff = dayIdxCurrent - initialDayIdxClicked;
        const originalSpan = endDayIdxOriginal - startDayIdxOriginal;
        let newStartDayIdx = startDayIdxOriginal + dayDiff;
        let newEndDayIdx = endDayIdxOriginal + dayDiff;

        if (newStartDayIdx < 0) {
          newStartDayIdx = 0;
          newEndDayIdx = newStartDayIdx + originalSpan;
        }
        if (newEndDayIdx > 6) {
          newEndDayIdx = 6;
          newStartDayIdx = newEndDayIdx - originalSpan;
        }

        const targetStartDate = weekDates[newStartDayIdx];
        const targetEndDate = weekDates[newEndDayIdx];
        newStart.setFullYear(targetStartDate.getFullYear(), targetStartDate.getMonth(), targetStartDate.getDate());
        newEnd.setFullYear(targetEndDate.getFullYear(), targetEndDate.getMonth(), targetEndDate.getDate());
        // Di chuyển giờ (dọc)
        let newStartMinutes = minutesCurrent - verticalOffsetMinutes;
        const durationMinutes = getMinutesFromDayStart(endOriginal) - getMinutesFromDayStart(startOriginal);
        
        newStartMinutes = clampMinutesToGrid(snapMinutes(newStartMinutes));
        let newEndMinutes = newStartMinutes + durationMinutes;

        if (newEndMinutes > GRID_MINUTES) {
          newEndMinutes = GRID_MINUTES;
          newStartMinutes = newEndMinutes - durationMinutes;
        }

        newStart = buildDateTimeFromDayAndMinutes(newStart, newStartMinutes);
        newEnd = buildDateTimeFromDayAndMinutes(newEnd, newEndMinutes);

      } else if (mode === 'resizing-top') {
        const currentEndMinutes = getMinutesFromDayStart(endOriginal);
        let newStartMinutes = clampMinutesToGrid(snapMinutes(minutesCurrent));
        
        newStartMinutes = Math.min(newStartMinutes, currentEndMinutes - MIN_DURATION_MINUTES);
        newStart = buildDateTimeFromDayAndMinutes(startOriginal, newStartMinutes);

      } else if (mode === 'resizing-bottom') {
        const currentStartMinutes = getMinutesFromDayStart(startOriginal);
        let newEndMinutes = clampMinutesToGrid(snapMinutes(minutesCurrent));
        
        newEndMinutes = Math.max(newEndMinutes, currentStartMinutes + MIN_DURATION_MINUTES);
        newEnd = buildDateTimeFromDayAndMinutes(endOriginal, newEndMinutes);

      } else if (mode === 'resizing-left') {
        const dayDiff = dayIdxCurrent - initialDayIdxClicked;
        const newStartDayIdx = Math.max(0, Math.min(endDayIdxOriginal, startDayIdxOriginal + dayDiff));
        const targetDate = weekDates[newStartDayIdx];
        newStart.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

      } else if (mode === 'resizing-right') {
        const dayDiff = dayIdxCurrent - initialDayIdxClicked;
        const newEndDayIdx = Math.max(startDayIdxOriginal, Math.min(6, endDayIdxOriginal + dayDiff));
        const targetDate = weekDates[newEndDayIdx];
        newEnd.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      }

      setMovingSchedule({
        id,
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString()
      });
    };

    const handlePointerUp = async (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      const currentScrollTop = gridElement.scrollTop;
      const minutesCurrent = getMinutesFromPointer(upEvent.clientY, gridRect, currentScrollTop);
      const dayIdxCurrent = getDayIndexFromPointer(upEvent.clientX, gridRect);

      let newStart = new Date(startOriginal);
      let newEnd = new Date(endOriginal);

      if (mode === 'dragging') {
        const dayDiff = dayIdxCurrent - initialDayIdxClicked;
        const originalSpan = endDayIdxOriginal - startDayIdxOriginal;
        let newStartDayIdx = startDayIdxOriginal + dayDiff;
        let newEndDayIdx = endDayIdxOriginal + dayDiff;

        if (newStartDayIdx < 0) {
          newStartDayIdx = 0;
          newEndDayIdx = newStartDayIdx + originalSpan;
        }
        if (newEndDayIdx > 6) {
          newEndDayIdx = 6;
          newStartDayIdx = newEndDayIdx - originalSpan;
        }

        const targetStartDate = weekDates[newStartDayIdx];
        const targetEndDate = weekDates[newEndDayIdx];
        newStart.setFullYear(targetStartDate.getFullYear(), targetStartDate.getMonth(), targetStartDate.getDate());
        newEnd.setFullYear(targetEndDate.getFullYear(), targetEndDate.getMonth(), targetEndDate.getDate());

        // Di chuyển giờ (dọc)
        let newStartMinutes = minutesCurrent - verticalOffsetMinutes;
        const durationMinutes = getMinutesFromDayStart(endOriginal) - getMinutesFromDayStart(startOriginal);
        
        newStartMinutes = clampMinutesToGrid(snapMinutes(newStartMinutes));
        let newEndMinutes = newStartMinutes + durationMinutes;

        if (newEndMinutes > GRID_MINUTES) {
          newEndMinutes = GRID_MINUTES;
          newStartMinutes = newEndMinutes - durationMinutes;
        }

        newStart = buildDateTimeFromDayAndMinutes(newStart, newStartMinutes);
        newEnd = buildDateTimeFromDayAndMinutes(newEnd, newEndMinutes);

      } else if (mode === 'resizing-top') {
        const currentEndMinutes = getMinutesFromDayStart(endOriginal);
        let newStartMinutes = clampMinutesToGrid(snapMinutes(minutesCurrent));
        newStartMinutes = Math.min(newStartMinutes, currentEndMinutes - MIN_DURATION_MINUTES);
        newStart = buildDateTimeFromDayAndMinutes(startOriginal, newStartMinutes);

      } else if (mode === 'resizing-bottom') {
        const currentStartMinutes = getMinutesFromDayStart(startOriginal);
        let newEndMinutes = clampMinutesToGrid(snapMinutes(minutesCurrent));
        newEndMinutes = Math.max(newEndMinutes, currentStartMinutes + MIN_DURATION_MINUTES);
        newEnd = buildDateTimeFromDayAndMinutes(endOriginal, newEndMinutes);

      } else if (mode === 'resizing-left') {
        const dayDiff = dayIdxCurrent - initialDayIdxClicked;
        const newStartDayIdx = Math.max(0, Math.min(endDayIdxOriginal, startDayIdxOriginal + dayDiff));
        const targetDate = weekDates[newStartDayIdx];
        newStart.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

      } else if (mode === 'resizing-right') {
        const dayDiff = dayIdxCurrent - initialDayIdxClicked;
        const newEndDayIdx = Math.max(startDayIdxOriginal, Math.min(6, endDayIdxOriginal + dayDiff));
        const targetDate = weekDates[newEndDayIdx];
        newEnd.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      }

      setMovingSchedule(null);

      const finalStart = newStart.toISOString();
      const finalEnd = newEnd.toISOString();

      const hasChanged = finalStart !== originalItem.start_time || finalEnd !== originalItem.end_time;
      if (!hasChanged) return;

      if (isDraft) {
        setDraftSchedules(prev => prev.map(d => {
          if (d.id === id) {
            return {
              ...d,
              start_time: finalStart,
              end_time: finalEnd
            };
          }
          return d;
        }));
      } else {
        const previousSchedules = [...schedules];
        setSchedules(prev => prev.map(s => {
          if (s._id === id) {
            return {
              ...s,
              start_time: finalStart,
              end_time: finalEnd
            };
          }
          return s;
        }));

        try {
          await clubScheduleApi.update(id, {
            start_time: finalStart,
            end_time: finalEnd
          });
          toast.success('Đã cập nhật thời gian hoạt động');
          reloadSchedules();
        } catch (err: any) {
          toast.error(err?.message || 'Không thể cập nhật thời gian hoạt động');
          setSchedules(previousSchedules);
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleOpenRecurrenceModal = (draftId: string | null) => {
    setActiveDraftId(draftId);
    
    let currentRecurrence = null;
    if (draftId) {
      const draft = draftSchedules.find(d => d.id === draftId);
      currentRecurrence = draft?.recurrence;
    } else {
      currentRecurrence = defaultRecurrence;
    }

    if (currentRecurrence) {
      setModalRecurrenceType(currentRecurrence.type);
      setModalUntilType(currentRecurrence.untilType);
      setModalWeeksCount(currentRecurrence.weeksCount || 8);
      setModalUntilDate(currentRecurrence.untilDate || '');
    } else {
      setModalRecurrenceType('weekly');
      setModalUntilType('none');
      setModalWeeksCount(8);
      setModalUntilDate('');
    }
    setShowRecurrenceModal(true);
  };

  const handleConfirmRecurrence = () => {
    const updatedRecurrence = modalUntilType === 'none' ? null : {
      type: modalRecurrenceType,
      untilType: modalUntilType,
      weeksCount: modalUntilType === 'custom' ? modalWeeksCount : undefined,
      untilDate: modalUntilType === 'custom' ? modalUntilDate : undefined,
    };

    if (activeDraftId !== null) {
      setDraftSchedules(prev => prev.map(d => {
        if (d.id === activeDraftId) {
          return {
            ...d,
            recurrence: updatedRecurrence
          };
        }
        return d;
      }));
      toast.success('Đã cập nhật cấu hình lặp lại cho lịch nháp');
    } else {
      setDefaultRecurrence(updatedRecurrence);
      toast.success('Đã cập nhật cấu hình lặp lại mặc định');
    }

    setShowRecurrenceModal(false);
  };

  const handleOpenCreateModal = (dayIndex?: number, hourSlot?: number) => {
    if (!canManage) return;
    
    const targetDate = dayIndex !== undefined ? weekDates[dayIndex] : new Date();
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    
    setFormClubId(clubs[0]?._id || '');
    setFormTitle(clubs[0] ? `Sinh hoạt CLB ${clubs[0].name}` : '');
    setFormDesc('');
    setFormLocation('Phòng sinh hoạt CLB');
    setFormType('regular');
    setFormDate(`${yyyy}-${mm}-${dd}`);
    setFormStartTime(hourSlot !== undefined ? String(hourSlot).padStart(2, '0') + ':00' : '08:00');
    setFormEndTime(hourSlot !== undefined ? String(hourSlot + 2).padStart(2, '0') + ':00' : '10:00');
    setFormRecurrenceType('none');
    setFormMaxAttendees('');
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

    let recurrence = undefined;
    if (formRecurrenceType === 'semester') {
      recurrence = { type: 'weekly' }; // until date will be populated by backend using semester end date
    } else if (formRecurrenceType === 'custom') {
      const until = new Date(startDateTime.getTime() + formRecurrenceWeeks * 7 * 24 * 60 * 60 * 1000);
      recurrence = { type: 'weekly', until: until.toISOString() };
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
      recurrence,
      max_attendees: formMaxAttendees ? parseInt(formMaxAttendees) : undefined,
    };

    try {
      await clubScheduleApi.create(payload);
      toast.success(recurrence ? 'Đã xếp chuỗi lịch sinh hoạt thành công' : 'Đã xếp lịch sinh hoạt thành công');
      setShowCreateModal(false);
      if (activeDraftId) {
        setDraftSchedules(prev => prev.filter(d => d.id !== activeDraftId));
        setActiveDraftId(null);
      }
      reloadSchedules();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tạo lịch hoạt động');
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

  // Timeline view calculations
  const selectedDaySchedules = schedules.filter(s => {
    if (s.status === 'cancelled') return false;
    const sDate = new Date(s.start_time);
    return sDate.toDateString() === selectedDate.toDateString();
  }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const morningSchedules = selectedDaySchedules.filter(s => new Date(s.start_time).getHours() < 13);
  const afternoonSchedules = selectedDaySchedules.filter(s => new Date(s.start_time).getHours() >= 13);

  return (
    <div className="p-6 space-y-6 animate-fadeIn">
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
          {/* Week Nav controls */}
          <div className="flex p-1 bg-white/80 rounded-xl border border-slate-200/60 shadow-sm items-center">
            <button onClick={() => setWeekOffset(prev => prev - 1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-all cursor-pointer">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setWeekOffset(0)} className="px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer">
              Hôm nay
            </button>
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

          {canManage && (
            <button 
              onClick={() => handleOpenRecurrenceModal(null)} 
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
        /* Weekly timetable grid view with Left sidebar (Unscheduled Bucket) */
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Left panel: Unscheduled Bucket */}
          <div className="w-full lg:w-[280px] shrink-0 bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm flex flex-col max-h-[700px] overflow-hidden">
            <div className="p-4 border-b border-white/50 flex justify-between items-center bg-white/30">
              <h2 className="text-sm font-bold text-blue-900 flex items-center gap-1.5">
                <Activity size={16} className="text-blue-500" /> Chưa xếp lịch
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
                unscheduledClubs.map(club => (
                  <div
                    key={club._id}
                    draggable={canManage}
                    onDragStart={(e) => handleDragStart(e, club._id)}
                    className={`p-3 bg-white/60 border border-white/80 rounded-xl shadow-sm hover:shadow-md transition-all group ${canManage ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{club.name}</p>
                      <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase">{club.code}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-2 font-medium">
                      <span className="flex items-center gap-0.5"><Clock size={10} /> 2 tiếng/tuần</span>
                      <span>·</span>
                      <span className="capitalize">{club.category}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Area: Timetable Grid */}
          <div className="flex-1 bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            {/* Grid Header */}
            <div className="grid grid-cols-8 border-b border-slate-200/60 bg-white/60">
              <div className="p-3 text-center text-[11px] font-bold text-slate-400 border-r border-slate-200/40">Giờ</div>
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

            {/* Grid Body */}
            <div id="schedule-grid-body" className="relative grid grid-cols-8 max-h-[660px] overflow-y-auto" style={{ height: `${GRID_HEIGHT}px` }}>
              {/* Hour marker column */}
              <div className="border-r border-slate-200/40 bg-white/30">
                {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }).map((_, h) => (
                  <div key={h} style={{ height: `${PIXELS_PER_HOUR}px` }} className={`flex items-center justify-center text-[10px] font-bold text-slate-400/80 border-b ${HOUR_SEPARATOR_CLASS} last:border-0 box-border`}>
                    {String(h + DAY_START_HOUR).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* 7 Day Columns Container */}
              <div id="schedule-days-container" className="col-span-7 relative grid grid-cols-7 h-full">
                {/* Background Day Columns (for lines & drops) */}
                {weekDates.map((dayDate, dayIdx) => (
                  <div
                    key={dayIdx}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      handleDrop(e, dayIdx);
                    }}
                    className="relative border-r border-slate-200/40 last:border-0 hover:bg-slate-500/[0.01] transition-colors"
                  >
                    {/* Background hour lines */}
                    {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }).map((_, h) => (
                      <div
                        key={h}
                        style={{ height: `${PIXELS_PER_HOUR}px` }}
                        className={`w-full border-b ${HOUR_SEPARATOR_CLASS} last:border-0 box-border transition-all`}
                      />
                    ))}

                    {/* Absolute Overlay Layer for this specific day column */}
                    <div className="absolute inset-0 pointer-events-none z-10">
                      {[
                        ...weekSchedules.map(s => ({ ...s, isDraft: false })),
                        ...weekDraftSchedules.map(d => ({ ...d, _id: d.id, isDraft: true }))
                      ]
                        .filter(item => {
                          const startTime = movingSchedule?.id === item._id ? new Date(movingSchedule.start_time) : new Date(item.start_time);
                          const endTime = movingSchedule?.id === item._id ? new Date(movingSchedule.end_time) : new Date(item.end_time);
                          const layout = getScheduleLayout(startTime.toISOString(), endTime.toISOString(), weekDates);
                          return layout && layout.startDayIndex === dayIdx;
                        })
                        .map(item => {
                          const startTime = movingSchedule?.id === item._id ? new Date(movingSchedule.start_time) : new Date(item.start_time);
                          const endTime = movingSchedule?.id === item._id ? new Date(movingSchedule.end_time) : new Date(item.end_time);

                          const layout = getScheduleLayout(startTime.toISOString(), endTime.toISOString(), weekDates);
                          if (!layout) return null;

                          const typeColor = typeColors[item.schedule_type] || 'bg-slate-400 border-slate-400 text-slate-500';
                          const colorParts = typeColor.split(' ');

                          const isSelected = activeDraftId === item._id;
                          const isMoving = movingSchedule?.id === item._id;

                          if (item.isDraft) {
                            // RENDER DRAFT CARD
                            return (
                              <div
                                key={item._id}
                                style={{
                                  top: `${layout.top}px`,
                                  height: `${layout.height}px`,
                                  left: '4px',
                                  width: 'calc(100% - 8px)',
                                  boxSizing: 'border-box'
                                }}
                                onPointerDown={(e) => {
                                  if (!canManage) return;
                                  if ((e.target as HTMLElement).closest('button')) return;
                                  e.stopPropagation();
                                  handlePointerDown(e, item._id, 'dragging', true);
                                }}
                                onDoubleClick={(e) => {
                                  if (!canManage) return;
                                  e.stopPropagation();
                                  handleOpenAdvancedSettings(item as unknown as DraftSchedule);
                                }}
                                className={`absolute rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/95 backdrop-blur-[2px] shadow-md hover:shadow-lg flex flex-col justify-between overflow-hidden group border-l-[6px] border-l-amber-500 pointer-events-auto transition-all ${
                                  layout.height < 60 ? 'p-1' : layout.height < 90 ? 'p-1.5' : 'p-2.5'
                                } ${
                                  isSelected ? 'ring-2 ring-amber-500/70 border-amber-500 bg-amber-50/100' : ''
                                } ${
                                  isMoving ? 'transition-none z-30 opacity-90 shadow-xl border-blue-500 border-l-blue-500' : ''
                                }`}
                              >
                                {/* Resize handles */}
                                {canManage && !isMoving && (
                                  <>
                                    <div
                                      className="absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize z-20"
                                      onPointerDown={(e) => {
                                        e.stopPropagation();
                                        handlePointerDown(e, item._id, 'resizing-left', true);
                                      }}
                                    />
                                    <div
                                      className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize z-20"
                                      onPointerDown={(e) => {
                                        e.stopPropagation();
                                        handlePointerDown(e, item._id, 'resizing-right', true);
                                      }}
                                    />
                                    <div
                                      className="absolute top-0 left-2 right-2 h-1.5 cursor-ns-resize z-20"
                                      onPointerDown={(e) => {
                                        e.stopPropagation();
                                        handlePointerDown(e, item._id, 'resizing-top', true);
                                      }}
                                    />
                                    <div
                                      className="absolute bottom-0 left-2 right-2 h-1.5 cursor-ns-resize z-20"
                                      onPointerDown={(e) => {
                                        e.stopPropagation();
                                        handlePointerDown(e, item._id, 'resizing-bottom', true);
                                      }}
                                    />
                                  </>
                                )}

                                <div className="min-h-0 flex-1 overflow-hidden space-y-1 select-none">
                                  <div className="flex justify-between items-start gap-1">
                                    <div className="flex items-center gap-1 min-w-0 flex-1">
                                      {layout.height >= 65 && (
                                        <span className="shrink-0 text-[8px] font-black px-1 py-0.5 rounded bg-amber-500 text-white uppercase tracking-wider">
                                          Nháp
                                        </span>
                                      )}
                                      <p className="text-[10px] font-extrabold text-slate-800 leading-tight truncate">
                                        {item.title}
                                      </p>
                                    </div>
                                    {layout.height >= 60 && (
                                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${colorParts[0]}`} />
                                    )}
                                    
                                    {/* Compact buttons in header if height < 55px */}
                                    {layout.height < 55 && canManage && (
                                      <div className="flex items-center gap-0.5 shrink-0">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSaveDraft(item._id);
                                          }}
                                          title="Lưu lịch sinh hoạt"
                                          className="p-0.5 hover:bg-green-100 text-green-700 rounded transition-all cursor-pointer"
                                        >
                                          <Check size={10} />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCancelDraft(item._id);
                                          }}
                                          title="Hủy bản nháp"
                                          className="p-0.5 hover:bg-red-100 text-red-700 rounded transition-all cursor-pointer"
                                        >
                                          <X size={10} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {layout.height >= 75 && (
                                    <p className="text-[9px] font-medium text-slate-500 flex items-center gap-0.5 truncate">
                                      <MapPin size={8} className="shrink-0" /> {item.location || 'Phòng học'}
                                    </p>
                                  )}
                                  
                                  {layout.height >= 90 && item.recurrence && (item.recurrence as any).untilType !== 'none' && (
                                    <span className="inline-block text-[8px] font-bold px-1 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                                      Lặp: {(item.recurrence as any).type === 'weekly' ? 'Hàng tuần' : (item.recurrence as any).type === 'biweekly' ? '2 tuần/lần' : 'Hàng tháng'}
                                    </span>
                                  )}
                                </div>

                                {layout.height >= 55 && (
                                  <div className="shrink-0 flex justify-between items-center mt-1 pt-1 border-t border-amber-200/50">
                                    <span className="text-[8px] font-black text-slate-500">
                                      {startTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {endTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {canManage && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSaveDraft(item._id);
                                          }}
                                          title="Lưu lịch sinh hoạt"
                                          className="p-1 hover:bg-green-100 text-green-700 rounded transition-all cursor-pointer"
                                        >
                                          <Check size={11} />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenRecurrenceModal(item._id);
                                          }}
                                          title="Cấu hình lặp lại"
                                          className="p-1 hover:bg-slate-100 text-slate-600 rounded transition-all cursor-pointer"
                                        >
                                          <Settings size={11} />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCancelDraft(item._id);
                                          }}
                                          title="Hủy bản nháp"
                                          className="p-1 hover:bg-red-100 text-red-700 rounded transition-all cursor-pointer"
                                        >
                                          <X size={11} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          } else {
                            // RENDER PERSISTED CARD
                            return (
                              <div
                                key={item._id}
                                style={{
                                  top: `${layout.top}px`,
                                  height: `${layout.height}px`,
                                  left: '4px',
                                  width: 'calc(100% - 8px)',
                                  boxSizing: 'border-box'
                                }}
                                onPointerDown={(e) => {
                                  if (!canManage) return;
                                  if ((e.target as HTMLElement).closest('button')) return;
                                  e.stopPropagation();
                                  handlePointerDown(e, item._id, 'dragging', false);
                                }}
                                className={`absolute rounded-xl border border-slate-200 bg-white/90 backdrop-blur-[2px] shadow-sm hover:shadow-md hover:bg-white flex flex-col justify-between overflow-hidden group border-l-[6px] pointer-events-auto transition-all ${
                                  layout.height < 60 ? 'p-1' : layout.height < 90 ? 'p-1.5' : 'p-2.5'
                                } ${
                                  colorParts[1].replace('border-', 'border-l-')
                                } ${
                                  isMoving ? 'transition-none z-30 opacity-90 shadow-xl border-blue-500 border-l-blue-500' : ''
                                }`}
                              >
                                {/* Resize handles */}
                                {canManage && !isMoving && (
                                  <>
                                    <div
                                      className="absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize z-20"
                                      onPointerDown={(e) => {
                                        e.stopPropagation();
                                        handlePointerDown(e, item._id, 'resizing-left', false);
                                      }}
                                    />
                                    <div
                                      className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize z-20"
                                      onPointerDown={(e) => {
                                        e.stopPropagation();
                                        handlePointerDown(e, item._id, 'resizing-right', false);
                                      }}
                                    />
                                    <div
                                      className="absolute top-0 left-2 right-2 h-1.5 cursor-ns-resize z-20"
                                      onPointerDown={(e) => {
                                        e.stopPropagation();
                                        handlePointerDown(e, item._id, 'resizing-top', false);
                                      }}
                                    />
                                    <div
                                      className="absolute bottom-0 left-2 right-2 h-1.5 cursor-ns-resize z-20"
                                      onPointerDown={(e) => {
                                        e.stopPropagation();
                                        handlePointerDown(e, item._id, 'resizing-bottom', false);
                                      }}
                                    />
                                  </>
                                )}

                                <div className="min-h-0 flex-1 overflow-hidden space-y-1 select-none">
                                  <div className="flex justify-between items-start gap-1">
                                    <p className="text-[10px] font-extrabold text-slate-800 leading-tight truncate group-hover:text-blue-600 transition-colors">
                                      {item.title}
                                    </p>
                                    {layout.height >= 60 && (
                                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${colorParts[0]}`} />
                                    )}
                                  </div>
                                  
                                  {layout.height >= 75 && (
                                    <p className="text-[9px] font-medium text-slate-400 flex items-center gap-0.5 truncate">
                                      <MapPin size={8} className="shrink-0" /> {item.location || 'Phòng học'}
                                    </p>
                                  )}
                                </div>

                                {layout.height >= 55 && (
                                  <div className="shrink-0 flex justify-between items-center mt-1 pt-1 border-t border-slate-100">
                                    <span className="text-[8px] font-black text-slate-400">
                                      {startTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {endTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {canManage && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteClick(item as any);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-red-500 hover:text-red-600 rounded transition-all cursor-pointer"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }
                        })}
                    </div>
                  </div>
                ))}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Morning Shift */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md border border-white/70 p-3 rounded-xl shadow-sm w-fit">
                <span className="text-amber-500">☀️</span>
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
                    const start = new Date(schedule.start_time);
                    const end = new Date(schedule.end_time);
                    const typeColor = typeColors[schedule.schedule_type] || 'bg-slate-400 border-slate-400 text-slate-500';
                    const colorParts = typeColor.split(' ');

                    return (
                      <div key={schedule._id} className="relative group">
                        {/* Timeline Node dot */}
                        <span className={`absolute left-[-32px] top-4 w-3.5 h-3.5 rounded-full border-2 bg-white ${colorParts[0]}`} />
                        
                        {/* Event Card */}
                        <div className={`p-4 bg-white/70 border border-slate-200/50 rounded-2xl shadow-sm hover:shadow-md transition-all flex justify-between items-start border-l-4 ${colorParts[1].replace('border-', 'border-l-')}`}>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-extrabold text-slate-800">{schedule.title}</h3>
                              <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                                {typeLabels[schedule.schedule_type]}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                              <span className="flex items-center gap-1"><Clock size={11} /> {start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="flex items-center gap-1"><MapPin size={11} /> {schedule.location}</span>
                              {schedule.max_attendees && <span className="flex items-center gap-1"><Users size={11} /> Hạn mức: {schedule.max_attendees}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-blue-500/10 text-blue-600">Upcoming</span>
                            {canManage && (
                              <button
                                onClick={() => handleDeleteClick(schedule)}
                                className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
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
                <span className="text-orange-500">🌇</span>
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
                    const start = new Date(schedule.start_time);
                    const end = new Date(schedule.end_time);
                    const typeColor = typeColors[schedule.schedule_type] || 'bg-slate-400 border-slate-400 text-slate-500';
                    const colorParts = typeColor.split(' ');

                    return (
                      <div key={schedule._id} className="relative group">
                        {/* Timeline Node dot */}
                        <span className={`absolute left-[-32px] top-4 w-3.5 h-3.5 rounded-full border-2 bg-white ${colorParts[0]}`} />
                        
                        {/* Event Card */}
                        <div className={`p-4 bg-white/70 border border-slate-200/50 rounded-2xl shadow-sm hover:shadow-md transition-all flex justify-between items-start border-l-4 ${colorParts[1].replace('border-', 'border-l-')}`}>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-extrabold text-slate-800">{schedule.title}</h3>
                              <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                                {typeLabels[schedule.schedule_type]}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                              <span className="flex items-center gap-1"><Clock size={11} /> {start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="flex items-center gap-1"><MapPin size={11} /> {schedule.location}</span>
                              {schedule.max_attendees && <span className="flex items-center gap-1"><Users size={11} /> Hạn mức: {schedule.max_attendees}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-blue-500/10 text-blue-600">Upcoming</span>
                            {canManage && (
                              <button
                                onClick={() => handleDeleteClick(schedule)}
                                className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
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
                onClick={() => setShowRecurrenceModal(false)} 
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
                <select
                  value={modalUntilType === 'none' ? 'none' : modalRecurrenceType}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'none') {
                      setModalUntilType('none');
                    } else {
                      setModalRecurrenceType(val as any);
                      if (modalUntilType === 'none') {
                        setModalUntilType('semester'); // Default when turning recurrence back on
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="none">Một lần (Không lặp)</option>
                  <option value="weekly">Hàng tuần</option>
                  <option value="biweekly">2 tuần/lần</option>
                  <option value="monthly">Hàng tháng</option>
                </select>
              </div>

              {modalUntilType !== 'none' && (
                <>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Điểm kết thúc lặp
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                        <input
                          type="radio"
                          name="modalUntilType"
                          checked={modalUntilType === 'semester'}
                          onChange={() => setModalUntilType('semester')}
                          className="text-blue-500 focus:ring-0"
                        />
                        Hết học kỳ {activeSemester ? `(${activeSemester.semester_name})` : ''}
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                        <input
                          type="radio"
                          name="modalUntilType"
                          checked={modalUntilType === 'custom'}
                          onChange={() => setModalUntilType('custom')}
                          className="text-blue-500 focus:ring-0"
                        />
                        Số tuần custom hoặc chọn ngày cụ thể
                      </label>
                    </div>
                  </div>

                  {modalUntilType === 'custom' && (
                    <div className="grid grid-cols-2 gap-4 pt-1 animate-fadeIn">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                          Số tuần áp dụng
                        </label>
                        <input
                          type="number"
                          min="2"
                          max="24"
                          value={modalWeeksCount}
                          onChange={(e) => setModalWeeksCount(parseInt(e.target.value) || 8)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                          Hoặc chọn ngày cụ thể
                        </label>
                        <input
                          type="date"
                          value={modalUntilDate}
                          onChange={(e) => setModalUntilDate(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRecurrenceModal(false)}
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
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                <CalendarRange className="text-blue-500" size={18} />
                Xếp lịch hoạt động CLB
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-slate-200/80 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Câu lạc bộ</label>
                  <select
                    value={formClubId}
                    onChange={(e) => {
                      setFormClubId(e.target.value);
                      const club = clubs.find(c => c._id === e.target.value);
                      if (club) setFormTitle(`Sinh hoạt CLB ${club.name}`);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                  >
                    {clubs.map(c => <option key={c._id} value={c._id}>{c.name} ({c.code})</option>)}
                  </select>
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
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="regular">Sinh hoạt</option>
                    <option value="event">Sự kiện</option>
                    <option value="exam">Kiểm tra</option>
                    <option value="meeting">Họp</option>
                  </select>
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
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Giờ kết thúc</label>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Recurrence Setup */}
                <div className="col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">Chế độ lặp lại (Cố định chuỗi)</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                      <input
                        type="radio"
                        name="recurrence"
                        checked={formRecurrenceType === 'none'}
                        onChange={() => setFormRecurrenceType('none')}
                        className="text-blue-500 focus:ring-0"
                      />
                      Một lần
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                      <input
                        type="radio"
                        name="recurrence"
                        checked={formRecurrenceType === 'semester'}
                        onChange={() => setFormRecurrenceType('semester')}
                        className="text-blue-500 focus:ring-0"
                      />
                      Hết học kỳ
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                      <input
                        type="radio"
                        name="recurrence"
                        checked={formRecurrenceType === 'custom'}
                        onChange={() => setFormRecurrenceType('custom')}
                        className="text-blue-500 focus:ring-0"
                      />
                      Số tuần custom
                    </label>
                  </div>

                  {formRecurrenceType === 'custom' && (
                    <div className="flex items-center gap-3 pt-2">
                      <span className="text-xs text-slate-500 font-bold">Số tuần áp dụng:</span>
                      <input
                        type="number"
                        min="2"
                        max="24"
                        value={formRecurrenceWeeks}
                        onChange={(e) => setFormRecurrenceWeeks(parseInt(e.target.value) || 8)}
                        className="w-20 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                      />
                      <span className="text-xs text-slate-400 font-medium">(tuần)</span>
                    </div>
                  )}

                  {formRecurrenceType === 'semester' && activeSemester && (
                    <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                      <AlertCircle size={12} className="text-blue-400" />
                      Lặp lại hàng tuần cho đến hết {activeSemester.semester_name} ({new Date(activeSemester.end_date).toLocaleDateString('vi-VN')})
                    </div>
                  )}
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

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  Xác nhận xếp lịch
                </button>
              </div>
            </form>
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
    </div>
  );
}
