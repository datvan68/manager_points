'use client';

import type { ManualAttendanceRoster } from '@/api/activity-api';

export default function ManualAttendanceGrid({
  roster,
  pending,
  errors,
  onCheckin,
}: {
  roster: ManualAttendanceRoster;
  pending: Record<string, boolean>;
  errors: Record<string, string>;
  onCheckin: (studentId: string) => Promise<unknown>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-800">Danh sách lớp</h3>
        <span className="text-xs font-bold text-slate-500">{roster.students.filter((item) => item.attendance).length}/{roster.total}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {roster.students.map((student) => {
          const attended = Boolean(student.attendance?.approval_status === 'approved' && ['present', 'late'].includes(student.attendance.status));
          const activate = () => { if (!pending[student._id]) void onCheckin(student._id); };
          return (
            <article key={student._id} role="button" tabIndex={pending[student._id] ? -1 : 0}
              aria-pressed={attended} onClick={activate}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } }}
              className={`cursor-pointer rounded-xl border p-3 transition-colors ${attended ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-100 bg-white hover:border-emerald-200'} ${pending[student._id] ? 'cursor-wait opacity-70' : ''}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-800">{student.full_name}</p>
                  <p className="text-[10px] font-mono text-slate-500">{student.student_code}</p>
                </div>
                <button disabled={pending[student._id]} onClick={(event) => { event.stopPropagation(); activate(); }}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:bg-emerald-100 disabled:text-emerald-700">
                  {pending[student._id] ? 'Đang lưu…' : attended ? 'Đã có mặt' : 'Có mặt'}
                </button>
              </div>
              {errors[student._id] && <p className="mt-2 text-[10px] font-semibold text-red-600">{errors[student._id]}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
