'use client';

import { Clock, MapPin, User, Video, Coffee } from 'lucide-react';
import type { TimetableLesson } from '@/api/timetable-api';

const sessionGroups = [
  { label: 'Buổi Sáng', match: (lesson: TimetableLesson) => lesson.startPeriod <= 6 || lesson.sessionLabel?.toLowerCase().includes('sáng'), className: 'border-amber-500/30 bg-amber-500/15 text-amber-800' },
  { label: 'Buổi Chiều', match: (lesson: TimetableLesson) => (lesson.startPeriod >= 7 && lesson.startPeriod <= 12) || lesson.sessionLabel?.toLowerCase().includes('chiều'), className: 'border-blue-500/30 bg-blue-500/15 text-[#1A73E8]' },
  { label: 'Buổi Tối', match: (lesson: TimetableLesson) => lesson.startPeriod >= 13 || lesson.sessionLabel?.toLowerCase().includes('tối'), className: 'border-purple-500/30 bg-purple-500/15 text-purple-800' },
];

function DayLessonCard({ lesson }: { lesson: TimetableLesson }) {
  const period = lesson.startPeriod === lesson.endPeriod ? `Tiết ${lesson.startPeriod}` : `Tiết ${lesson.startPeriod} - ${lesson.endPeriod}`;
  return (
    <article className="rounded-xl border border-slate-200/80 bg-white/75 p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[11px] font-bold text-[#1A73E8]">{period}</span>
          <h3 className="mt-1 text-sm font-bold leading-snug text-[#1E293B]">{lesson.subject}</h3>
          {lesson.subjectCode && <span className="text-[10px] text-[#64748B]">Mã: {lesson.subjectCode}</span>}
        </div>
        {lesson.room && <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700"><MapPin className="h-3 w-3" />{lesson.room}</span>}
      </div>
      <div className="mt-2 grid gap-1 text-[11px] text-[#64748B]">
        {lesson.teacher && <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{lesson.teacher}</span>}
        {(lesson.sourceTime || lesson.durationLabel) && <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{lesson.sourceTime || lesson.durationLabel}</span>}
      </div>
      {lesson.onlineUrl && <a href={lesson.onlineUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1A73E8] px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600"><Video className="h-3.5 w-3.5" />Họp trực tuyến</a>}
    </article>
  );
}

export default function TimetableDayView({ date, lessons }: { date: string; lessons: TimetableLesson[] }) {
  const ordered = [...lessons].sort((a, b) => a.startPeriod - b.startPeriod);
  return (
    <div data-testid="timetable-day-view" className="max-h-[min(70vh,32rem)] space-y-3 overflow-y-auto pr-1">
      <div className="border-b border-slate-200/70 pb-2"><p className="text-sm font-bold text-[#1E293B]">Lịch ngày {date.split('-').reverse().join('/')}</p><p className="text-xs text-[#64748B]">Chỉ hiển thị lịch của hôm nay</p></div>
      {!ordered.length ? <div className="flex flex-col items-center py-8 text-center text-[#64748B]"><Coffee className="mb-2 h-7 w-7 text-slate-400" /><p className="text-sm font-semibold text-[#1E293B]">Không có lịch học trong ngày</p><p className="text-xs">Ngày hôm nay chưa có tiết học.</p></div> : sessionGroups.map((group) => {
        const groupLessons = ordered.filter(group.match);
        return groupLessons.length ? <section key={group.label} className="space-y-2"><div className="flex items-center gap-2"><span className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${group.className}`}>{group.label}</span><div className="h-px flex-1 bg-slate-200/70" /></div>{groupLessons.map((lesson, index) => <DayLessonCard key={`${lesson.subject}-${lesson.startPeriod}-${index}`} lesson={lesson} />)}</section> : null;
      })}
    </div>
  );
}
