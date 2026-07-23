'use client';

import { useEffect, useState } from 'react';
import {
  activityAttendanceGrantApi,
  type ActivityAttendanceGrant,
  type ActivityAttendanceGrantCandidate,
  type ActivityAttendanceMethod,
} from '@/api/activity-api';

const methods: Array<{ id: ActivityAttendanceMethod; label: string }> = [
  { id: 'qr', label: 'QR' },
  { id: 'proximity', label: 'GPS' },
  { id: 'manual_class', label: 'Lớp thủ công' },
];

export default function AttendanceGrantManager({ activityId }: { activityId: string }) {
  const [candidates, setCandidates] = useState<ActivityAttendanceGrantCandidate[]>([]);
  const [grants, setGrants] = useState<ActivityAttendanceGrant[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ActivityAttendanceMethod[]>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    void Promise.all([
      activityAttendanceGrantApi.getCandidates(activityId),
      activityAttendanceGrantApi.getGrants(activityId),
    ]).then(([nextCandidates, nextGrants]) => {
      setCandidates(nextCandidates);
      setGrants(nextGrants);
      setDrafts(Object.fromEntries(nextGrants.map((grant) => [
        typeof grant.teacher_id === 'string' ? grant.teacher_id : grant.teacher_id._id,
        grant.status === 'active' ? grant.allowed_methods : [],
      ])));
    });
  }, [activityId]);

  const save = async (teacherId: string) => {
    const allowed = drafts[teacherId] || [];
    setPending((value) => ({ ...value, [teacherId]: true }));
    setErrors((value) => ({ ...value, [teacherId]: '' }));
    try {
      const updated = allowed.length
        ? await activityAttendanceGrantApi.upsertGrant(activityId, teacherId, allowed)
        : await activityAttendanceGrantApi.revokeGrant(activityId, teacherId);
      setGrants((current) => [updated, ...current.filter((grant) =>
        (typeof grant.teacher_id === 'string' ? grant.teacher_id : grant.teacher_id._id) !== teacherId,
      )]);
    } catch (error: any) {
      setErrors((value) => ({ ...value, [teacherId]: error.message || 'Không thể cập nhật quyền' }));
    } finally {
      setPending((value) => ({ ...value, [teacherId]: false }));
    }
  };

  const uniqueCandidates = Array.from(new Map(candidates.map((item) => [item.advisor_id?._id, item])).values())
    .filter((item) => item.advisor_id?._id);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-black text-slate-800">Phân quyền điểm danh</h3>
        <p className="text-xs text-slate-500">Chỉ giáo viên chủ nhiệm được ủy quyền; bỏ tất cả phương thức để thu hồi.</p>
      </div>
      {uniqueCandidates.map((candidate) => {
        const teacherId = candidate.advisor_id._id;
        const selected = drafts[teacherId] || [];
        return (
          <div key={teacherId} className="rounded-xl border border-slate-100 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-800">{candidate.advisor_id.user_name || candidate.advisor_id.email}</p>
                <p className="text-[10px] text-slate-500">{candidate.class_name}</p>
              </div>
              <button disabled={pending[teacherId]} onClick={() => void save(teacherId)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">
                {pending[teacherId] ? 'Đang lưu…' : selected.length ? 'Lưu quyền' : 'Thu hồi'}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              {methods.map((method) => (
                <label key={method.id} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <input type="checkbox" checked={selected.includes(method.id)} onChange={() => setDrafts((current) => ({
                    ...current,
                    [teacherId]: selected.includes(method.id)
                      ? selected.filter((item) => item !== method.id)
                      : [...selected, method.id],
                  }))} />
                  {method.label}
                </label>
              ))}
            </div>
            {errors[teacherId] && <p className="mt-2 text-[11px] font-semibold text-red-600">{errors[teacherId]}</p>}
          </div>
        );
      })}
    </section>
  );
}
