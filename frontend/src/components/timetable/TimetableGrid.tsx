'use client';

import React from 'react';
import type { TimetableLesson, TimetableResult } from '@/api/timetable-api';
import { User, MapPin, Clock, Video } from 'lucide-react';

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

function LessonCard({ lesson }: { lesson: TimetableLesson }) {
  const theme = getSubjectTheme(lesson.subject);
  const sourceTime =
    lesson.durationLabel && lesson.sourceTime
      ? lesson.sourceTime.replace(lesson.durationLabel, '').replace(/\s+$/, '')
      : lesson.sourceTime;

  return (
    <div
      className={`group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-xl border ${theme.border} ${theme.bg} p-2.5 shadow-xs shadow-slate-200/50 backdrop-blur-sm transition-all duration-150 ease-out hover:shadow-md hover:scale-[1.01]`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${theme.accentBar}`} />

      <div className="space-y-1.5 pl-1.5 break-words">
        <div>
          <div className={`font-bold leading-snug ${theme.titleColor} text-xs`}>
            {lesson.subject}
          </div>
          {lesson.subjectCode && (
            <div className="mt-0.5 inline-block rounded-md border border-white/80 bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-[#64748B]">
              Mã: {lesson.subjectCode}
            </div>
          )}
        </div>

        {lesson.teacher && (
          <div className="flex items-center gap-1 text-[11px] text-[#1E293B]">
            <User className="h-3 w-3 shrink-0 text-[#64748B]" />
            <span className="truncate">GV: {lesson.teacher}</span>
          </div>
        )}

        {lesson.room && (
          <div className="flex items-center gap-1 text-[11px]">
            <MapPin className="h-3 w-3 shrink-0 text-[#64748B]" />
            <span className={`inline-flex items-center rounded-xl border px-1.5 py-0.5 text-[10px] font-semibold ${theme.roomBadge}`}>
              Phòng: {lesson.room}
            </span>
          </div>
        )}

        {(sourceTime || lesson.durationLabel) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#64748B]">
            {sourceTime && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0 text-[#64748B]" />
                <span>{sourceTime}</span>
              </div>
            )}
            {lesson.durationLabel && (
              <span className="font-medium text-[#64748B]">
                Thời lượng: {lesson.durationLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {lesson.onlineUrl && (
        <div className="mt-2 pl-1.5">
          <a
            href={lesson.onlineUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/15 px-2.5 py-1 text-[11px] font-semibold text-[#1A73E8] shadow-xs backdrop-blur-sm transition-all duration-150 hover:bg-blue-500/25 hover:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
          >
            <Video className="h-3 w-3 shrink-0 text-[#1A73E8]" />
            <span>Họp trực tuyến</span>
          </a>
        </div>
      )}
    </div>
  );
}

export default function TimetableGrid({ result }: { result: TimetableResult }) {
  const sourcePeriods = result.periods.length
    ? result.periods.map(Number)
    : Array.from({ length: 18 }, (_, index) => index + 1);

  const groups = Array.from(
    new Set(
      result.lessons.map(
        (lesson) =>
          `${lesson.classLabel || result.classLabel || 'Tất cả lớp'}\u0000${lesson.sessionLabel || result.sessionLabel || ''}`
      )
    )
  );

  if (!groups.length) {
    groups.push(`${result.classLabel || 'Tất cả lớp'}\u0000${result.sessionLabel || ''}`);
  }

  const lessonsByGroup = (key: string) =>
    result.lessons.filter(
      (lesson) =>
        `${lesson.classLabel || result.classLabel || 'Tất cả lớp'}\u0000${lesson.sessionLabel || result.sessionLabel || ''}` === key
    );

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="timetable-grid-hint" className="text-xs text-[#64748B]">
          Vuốt ngang hoặc dùng Shift + con trỏ để xem đủ các ngày.
        </p>
      </div>

      <div
        role="region"
        aria-label="Bảng thời khóa biểu, vùng cuộn ngang"
        aria-describedby="timetable-grid-hint"
        tabIndex={0}
        className="min-w-0 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/60 shadow-sm shadow-slate-300/40 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
        data-testid="timetable-grid"
      >
        <table className="min-w-[1120px] w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/90 text-[#1E293B]">
              <th className="min-w-28 border border-slate-200/80 p-2.5 text-left font-bold">Lớp học</th>
              <th className="min-w-20 border border-slate-200/80 p-2.5 text-left font-bold">Buổi</th>
              <th className="sticky left-0 z-20 min-w-20 border border-slate-200/80 bg-slate-50/95 p-2.5 text-left font-bold shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">Tiết</th>
              {days.map((day, index) => {
                const date = columnDate(result.startDate, result.endDate, index);
                const isWeekend = index >= 5;
                const isToday = isDateToday(result.startDate, index);

                return (
                  <th
                    key={day}
                    className={`min-w-36 border border-slate-200/80 p-2.5 text-center transition-colors ${
                      isToday
                        ? 'bg-blue-50/90 ring-1 ring-inset ring-[#1A73E8]/30'
                        : isWeekend
                        ? 'bg-slate-100/50'
                        : 'bg-white/80'
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="font-bold text-[#1E293B]">
                        {day}{date && <> · {date}</>}
                      </span>
                      {isToday && (
                        <span className="rounded-xl bg-[#1A73E8] px-2 py-0.5 text-[10px] font-semibold text-white shadow-xs">
                          Hôm nay
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((groupKey) => {
              const [classLabel, sessionLabel] = groupKey.split('\u0000');
              const lessons = lessonsByGroup(groupKey);
              const session = sessionLabel.trim().toLocaleLowerCase('vi');
              const start = session === 'sáng' ? 1 : session === 'chiều' ? 7 : session === 'tối' ? 13 : null;
              const periods = start === null ? sourcePeriods : Array.from({ length: 6 }, (_, index) => start + index);
              const occupied = new Set<string>();

              const sessionTextColor =
                session === 'sáng'
                  ? 'text-amber-800'
                  : session === 'chiều'
                  ? 'text-[#1A73E8]'
                  : session === 'tối'
                  ? 'text-purple-800'
                  : 'text-[#1E293B]';

              return periods.map((period, periodIndex) => {
                const cells: React.ReactNode[] = [];

                if (periodIndex === 0) {
                  cells.push(
                    <th
                      key="class"
                      rowSpan={periods.length}
                      className="border border-slate-200/80 bg-white/90 p-2.5 text-left align-top font-bold text-[#1E293B]"
                    >
                      {classLabel}
                    </th>
                  );
                  cells.push(
                    <th
                      key="session"
                      rowSpan={periods.length}
                      className={`border border-slate-200/80 bg-white/90 p-2.5 text-left align-top font-semibold ${sessionTextColor}`}
                    >
                      {sessionLabel || '—'}
                    </th>
                  );
                }

                cells.push(
                  <th
                    key="period"
                    className="sticky left-0 z-10 border border-slate-200/80 bg-white/95 p-2 text-left font-bold text-[#1E293B] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]"
                  >
                    Tiết {period}
                  </th>
                );

                days.forEach((_, dayIndex) => {
                  const occupancyKey = `${dayIndex + 1}:${period}`;
                  if (occupied.has(occupancyKey)) return;

                  const lesson = lessons.find(
                    (item) => item.day === dayIndex + 1 && item.startPeriod <= period && item.endPeriod >= period
                  );

                  if (!lesson) {
                    cells.push(
                      <td
                        key={dayIndex}
                        className="border border-slate-200/70 bg-white/30 p-1.5 align-top transition-colors hover:bg-slate-50/40"
                      />
                    );
                    return;
                  }

                  const span = Math.max(
                    1,
                    periods.slice(periodIndex).filter((value) => value <= lesson.endPeriod).length
                  );

                  for (let next = period; next < period + span; next += 1) {
                    occupied.add(`${dayIndex + 1}:${next}`);
                  }

                  cells.push(
                    <td
                      key={dayIndex}
                      rowSpan={span}
                      className="border border-slate-200/80 p-1.5 align-top text-[#1E293B]"
                    >
                      <LessonCard lesson={lesson} />
                    </td>
                  );
                });

                return <tr key={`${groupKey}-${period}`}>{cells}</tr>;
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

