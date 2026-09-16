'use client';

import React, { useMemo, useState } from 'react';
import type { TimetableLesson, TimetableResult } from '@/api/timetable-api';
import { User, MapPin, Clock, Video, Coffee } from 'lucide-react';

const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const formatDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}` : null;
};

const columnDate = (startDate: string | undefined, endDate: string | undefined, index: number) => {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || (end.getTime() - start.getTime()) / 86_400_000 !== 6) return null;
  return formatDate(new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10));
};

const isDateToday = (startDate: string | undefined, index: number): boolean => {
  if (!startDate) return false;
  const start = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return false;
  const colDateStr = new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return colDateStr === `${year}-${month}-${day}`;
};

interface SubjectTheme {
  border: string;
  bg: string;
  badgeBg: string;
  badgeText: string;
  accentBar: string;
  titleColor: string;
  roomBadge: string;
  dot: string;
}

const THEMES: SubjectTheme[] = [
  {
    border: 'border-blue-500/30',
    bg: 'bg-gradient-to-br from-blue-50/90 via-white/80 to-blue-50/40',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-[#1A73E8]',
    accentBar: 'bg-[#1A73E8]',
    titleColor: 'text-[#1A73E8]',
    roomBadge: 'bg-blue-50/90 text-blue-700 border-blue-200/80',
    dot: 'bg-[#1A73E8]',
  },
  {
    border: 'border-emerald-500/30',
    bg: 'bg-gradient-to-br from-emerald-50/90 via-white/80 to-teal-50/40',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-700',
    accentBar: 'bg-emerald-600',
    titleColor: 'text-emerald-800',
    roomBadge: 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80',
    dot: 'bg-emerald-600',
  },
  {
    border: 'border-purple-500/30',
    bg: 'bg-gradient-to-br from-purple-50/90 via-white/80 to-violet-50/40',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-700',
    accentBar: 'bg-purple-600',
    titleColor: 'text-purple-800',
    roomBadge: 'bg-purple-50/90 text-purple-700 border-purple-200/80',
    dot: 'bg-purple-600',
  },
  {
    border: 'border-amber-500/30',
    bg: 'bg-gradient-to-br from-amber-50/90 via-white/80 to-orange-50/40',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-800',
    accentBar: 'bg-amber-500',
    titleColor: 'text-amber-900',
    roomBadge: 'bg-amber-50/90 text-amber-800 border-amber-200/80',
    dot: 'bg-amber-500',
  },
  {
    border: 'border-indigo-500/30',
    bg: 'bg-gradient-to-br from-indigo-50/90 via-white/80 to-sky-50/40',
    badgeBg: 'bg-indigo-500/10',
    badgeText: 'text-indigo-700',
    accentBar: 'bg-indigo-600',
    titleColor: 'text-indigo-900',
    roomBadge: 'bg-indigo-50/90 text-indigo-700 border-indigo-200/80',
    dot: 'bg-indigo-600',
  },
  {
    border: 'border-rose-500/30',
    bg: 'bg-gradient-to-br from-rose-50/90 via-white/80 to-pink-50/40',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-700',
    accentBar: 'bg-rose-600',
    titleColor: 'text-rose-800',
    roomBadge: 'bg-rose-50/90 text-rose-700 border-rose-200/80',
    dot: 'bg-rose-600',
  },
];

const getSubjectTheme = (subject: string): SubjectTheme => {
  let hash = 0;
  for (let i = 0; i < subject.length; i += 1) {
    hash = (hash << 5) - hash + subject.charCodeAt(i);
    hash |= 0;
  }
  return THEMES[Math.abs(hash) % THEMES.length];
};

function MobileLessonCard({ lesson }: { lesson: TimetableLesson }) {
  const theme = getSubjectTheme(lesson.subject);
  const sourceTime =
    lesson.durationLabel && lesson.sourceTime
      ? lesson.sourceTime.replace(lesson.durationLabel, '').replace(/\s+$/, '')
      : lesson.sourceTime;

  const periodLabel =
    lesson.startPeriod === lesson.endPeriod
      ? `Tiết ${lesson.startPeriod}`
      : `Tiết ${lesson.startPeriod} - ${lesson.endPeriod}`;

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border ${theme.border} ${theme.bg} p-3.5 shadow-xs shadow-slate-200/50 backdrop-blur-sm transition-all duration-150 ease-out hover:shadow-md`}
    >
      <div className={`absolute inset-y-0 left-0 w-1.5 ${theme.accentBar}`} />

      <div className="space-y-2 pl-2 break-words">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-block rounded-lg border border-white/80 bg-white/80 px-2 py-0.5 text-[11px] font-bold text-[#1E293B] shadow-2xs">
                {periodLabel}
              </span>
              {lesson.durationLabel && (
                <span className="text-[11px] font-medium text-[#64748B]">
                  ({lesson.durationLabel})
                </span>
              )}
            </div>
            <h3 className={`text-sm font-bold leading-snug ${theme.titleColor}`}>
              {lesson.subject}
            </h3>
            {lesson.classLabel && (
              <span data-testid="mobile-lesson-class" className="mt-1 inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                Lớp: {lesson.classLabel}
              </span>
            )}
            {lesson.subjectCode && (
              <span className="mt-0.5 inline-block rounded-md border border-white/80 bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-[#64748B]">
                Mã: {lesson.subjectCode}
              </span>
            )}
          </div>

          {lesson.room && (
            <div className="shrink-0">
              <span className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs font-semibold ${theme.roomBadge}`}>
                <MapPin className="h-3 w-3 shrink-0" />
                <span>Phòng: {lesson.room}</span>
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-1 text-xs text-[#1E293B]">
          {lesson.teacher && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
              <User className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
              <span className="font-medium text-[#1E293B]">GV: {lesson.teacher}</span>
            </div>
          )}
          {sourceTime && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
              <Clock className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
              <span>Thời gian: {sourceTime}</span>
            </div>
          )}
        </div>

        {lesson.onlineUrl && (
          <div className="pt-1">
            <a
              href={lesson.onlineUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-500/30 bg-[#1A73E8] px-3 py-2 text-xs font-semibold text-white shadow-xs backdrop-blur-sm transition-all duration-150 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
            >
              <Video className="h-3.5 w-3.5 shrink-0" />
              <span>Tham gia Họp trực tuyến</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TimetableMobileView({ result }: { result: TimetableResult }) {
  const initialDay = useMemo(() => {
    if (result.startDate) {
      for (let i = 0; i < 7; i += 1) {
        if (isDateToday(result.startDate, i)) return i + 1;
      }
    }
    const daysWithLessons = Array.from(new Set(result.lessons.map((l) => l.day))).sort((a, b) => a - b);
    return daysWithLessons[0] || 1;
  }, [result.startDate, result.lessons]);

  const [selectedDay, setSelectedDay] = useState<number>(initialDay);

  const lessonsForSelectedDay = useMemo(() => {
    return result.lessons
      .filter((l) => l.day === selectedDay)
      .sort((a, b) => a.startPeriod - b.startPeriod);
  }, [result.lessons, selectedDay]);

  const morningLessons = lessonsForSelectedDay.filter(
    (l) => l.startPeriod <= 6 || l.sessionLabel?.toLowerCase().includes('sáng')
  );
  const afternoonLessons = lessonsForSelectedDay.filter(
    (l) =>
      (l.startPeriod >= 7 && l.startPeriod <= 12) ||
      l.sessionLabel?.toLowerCase().includes('chiều')
  );
  const eveningLessons = lessonsForSelectedDay.filter(
    (l) => l.startPeriod >= 13 || l.sessionLabel?.toLowerCase().includes('tối')
  );

  const selectedDayName = days[selectedDay - 1] || `Thứ ${selectedDay + 1}`;
  const selectedDayDate = columnDate(result.startDate, result.endDate, selectedDay - 1);
  const isSelectedDayToday = isDateToday(result.startDate, selectedDay - 1);

  return (
    <div
      className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/60 p-3 shadow-sm shadow-slate-300/40 backdrop-blur-md"
      data-testid="timetable-mobile-view"
    >
      <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none]">
        {days.map((dayName, index) => {
          const dayNumber = index + 1;
          const isSelected = dayNumber === selectedDay;
          const isToday = isDateToday(result.startDate, index);
          const date = columnDate(result.startDate, result.endDate, index);
          const lessonCount = result.lessons.filter((l) => l.day === dayNumber).length;

          return (
            <button
              key={dayName}
              type="button"
              aria-label={`${dayName === 'Chủ nhật' ? 'CN' : dayName.replace('Thứ ', 'T')}`}
              onClick={() => setSelectedDay(dayNumber)}
              className={`flex min-w-[52px] flex-1 flex-col items-center justify-center rounded-xl border py-2 px-1.5 text-center transition-all duration-150 ease-out focus:outline-none ${
                isSelected
                  ? 'border-[#1A73E8] bg-[#1A73E8] text-white shadow-md shadow-blue-400/30'
                  : isToday
                  ? 'border-blue-400/60 bg-blue-50/70 text-[#1E293B] hover:bg-blue-100/60'
                  : 'border-slate-200/80 bg-white/80 text-[#1E293B] hover:bg-white'
              }`}
            >
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  isSelected ? 'text-blue-100' : 'text-[#64748B]'
                }`}
              >
                {dayName === 'Chủ nhật' ? 'CN' : dayName.replace('Thứ ', 'T')}
              </span>
              <span className="my-0.5 text-sm font-bold leading-none">
                {date ? date.split('/')[0] : dayNumber}
              </span>
              <div className="flex h-1.5 items-center gap-0.5">
                {lessonCount > 0 ? (
                  <>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-[#1A73E8]'
                      }`}
                    />
                    {lessonCount > 1 && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isSelected ? 'bg-blue-200' : 'bg-emerald-500'
                        }`}
                      />
                    )}
                  </>
                ) : (
                  <span
                    className={`h-1 w-1 rounded-full ${
                      isSelected ? 'bg-blue-300' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 pt-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#1E293B]">
            {selectedDayName}
            {selectedDayDate && <> · {selectedDayDate}</>}
          </span>
          {isSelectedDayToday && (
            <span className="rounded-xl bg-[#1A73E8] px-2 py-0.5 text-[10px] font-semibold text-white shadow-2xs">
              Hôm nay
            </span>
          )}
        </div>
        <span className="text-[11px] font-semibold text-[#64748B]">
          {lessonsForSelectedDay.length} buổi học
        </span>
      </div>

      {lessonsForSelectedDay.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center text-[#64748B]">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 shadow-xs">
            <Coffee className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-bold text-[#1E293B]">Không có lịch học trong ngày</p>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Bạn có thể tự học, làm bài tập hoặc nghỉ ngơi nhé!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {morningLessons.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-xl border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  Buổi Sáng
                </span>
                <div className="h-[1px] flex-1 bg-slate-200/60" />
              </div>
              <div className="space-y-2">
                {morningLessons.map((lesson, idx) => (
                  <MobileLessonCard
                    key={`${lesson.subject}-${lesson.startPeriod}-${idx}`}
                    lesson={lesson}
                  />
                ))}
              </div>
            </div>
          )}

          {afternoonLessons.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-xl border border-blue-500/30 bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-[#1A73E8]">
                  Buổi Chiều
                </span>
                <div className="h-[1px] flex-1 bg-slate-200/60" />
              </div>
              <div className="space-y-2">
                {afternoonLessons.map((lesson, idx) => (
                  <MobileLessonCard
                    key={`${lesson.subject}-${lesson.startPeriod}-${idx}`}
                    lesson={lesson}
                  />
                ))}
              </div>
            </div>
          )}

          {eveningLessons.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-xl border border-purple-500/30 bg-purple-500/15 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
                  Buổi Tối
                </span>
                <div className="h-[1px] flex-1 bg-slate-200/60" />
              </div>
              <div className="space-y-2">
                {eveningLessons.map((lesson, idx) => (
                  <MobileLessonCard
                    key={`${lesson.subject}-${lesson.startPeriod}-${idx}`}
                    lesson={lesson}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
