'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

type TeacherOption = {
  id: string;
  name: string;
  detail: string;
  effectiveMethods?: ActivityAttendanceMethod[];
};

function teacherId(grant: ActivityAttendanceGrant) {
  return typeof grant.teacher_id === 'string' ? grant.teacher_id : grant.teacher_id._id;
}

function normalizeCandidate(candidate: ActivityAttendanceGrantCandidate): TeacherOption | null {
  const id = candidate.advisor_id?._id || candidate._id;
  if (!id) return null;
  const name = candidate.user_name
    || candidate.advisor_id?.user_name
    || candidate.email
    || candidate.advisor_id?.email
    || id;
  const classNames = candidate.class_names?.length
    ? candidate.class_names
    : candidate.classes?.length
      ? candidate.classes.map((item) => item.class_name)
      : candidate.class_name ? [candidate.class_name] : [];
  return {
    id,
    name,
    detail: classNames.join(', '),
    effectiveMethods: candidate.effective_methods,
  };
}

export default function AttendanceGrantManager({ activityId }: { activityId: string }) {
  const [candidates, setCandidates] = useState<ActivityAttendanceGrantCandidate[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [displayed, setDisplayed] = useState<Record<string, ActivityAttendanceMethod[]>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const desiredRef = useRef<Record<string, ActivityAttendanceMethod[]>>({});
  const confirmedRef = useRef<Record<string, ActivityAttendanceMethod[]>>({});
  const savingRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    void Promise.all([
      activityAttendanceGrantApi.getCandidates(activityId),
      activityAttendanceGrantApi.getGrants(activityId),
    ]).then(([nextCandidates, nextGrants]) => {
      if (!active) return;
      const states: Record<string, ActivityAttendanceMethod[]> = {};
      nextCandidates.forEach((candidate) => {
        const option = normalizeCandidate(candidate);
        if (option?.effectiveMethods) states[option.id] = option.effectiveMethods;
      });
      nextGrants.forEach((grant) => {
        states[teacherId(grant)] = grant.effective_methods
          || (grant.status === 'active' ? grant.allowed_methods : []);
      });
      setCandidates(nextCandidates);
      setDisplayed(states);
      desiredRef.current = { ...states };
      confirmedRef.current = { ...states };
    }).catch((reason: unknown) => {
      if (active) setErrors({ _load: reason instanceof Error ? reason.message : 'Không thể tải quyền điểm danh' });
    });
    return () => { active = false; };
  }, [activityId]);

  const options = useMemo(() => {
    const unique = new Map<string, TeacherOption>();
    candidates.forEach((candidate) => {
      const option = normalizeCandidate(candidate);
      if (option && !unique.has(option.id)) unique.set(option.id, option);
    });
    return [...unique.values()];
  }, [candidates]);

  const persist = async (id: string) => {
    if (savingRef.current[id]) return;
    savingRef.current[id] = true;
    setPending((current) => ({ ...current, [id]: true }));
    setErrors((current) => ({ ...current, [id]: '' }));
    try {
      while (true) {
        const requested = desiredRef.current[id] || [];
        try {
          const updated = await activityAttendanceGrantApi.upsertGrant(activityId, id, requested);
          const reconciled = updated.effective_methods
            || (updated.status === 'active' ? updated.allowed_methods : []);
          confirmedRef.current = { ...confirmedRef.current, [id]: reconciled };
          if (desiredRef.current[id] === requested) {
            setDisplayed((current) => ({ ...current, [id]: reconciled }));
            desiredRef.current[id] = reconciled;
            break;
          }
        } catch (reason: unknown) {
          const restored = confirmedRef.current[id] || [];
          desiredRef.current[id] = restored;
          setDisplayed((current) => ({ ...current, [id]: restored }));
          setErrors((current) => ({
            ...current,
            [id]: reason instanceof Error ? reason.message : 'Không thể cập nhật quyền',
          }));
          break;
        }
      }
    } finally {
      savingRef.current[id] = false;
      setPending((current) => ({ ...current, [id]: false }));
    }
  };

  const toggle = (method: ActivityAttendanceMethod) => {
    if (!selectedTeacherId) return;
    const current = desiredRef.current[selectedTeacherId] || displayed[selectedTeacherId] || [];
    const next = current.includes(method)
      ? current.filter((item) => item !== method)
      : methods.map((item) => item.id).filter((item) => item === method || current.includes(item));
    desiredRef.current[selectedTeacherId] = next;
    setDisplayed((value) => ({ ...value, [selectedTeacherId]: next }));
    void persist(selectedTeacherId);
  };

  const selected = displayed[selectedTeacherId] || [];

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white/70 p-4">
      <div>
        <h3 className="text-sm font-black text-slate-800">Phân quyền điểm danh</h3>
        <p className="text-xs text-slate-500">Chọn một giáo viên và bật từng phương thức cần cho phép.</p>
      </div>
      <Select value={selectedTeacherId} onValueChange={(val: string) => setSelectedTeacherId(val)}>
        <SelectTrigger className="w-full bg-white border border-slate-200 rounded-lg text-sm" aria-label="Giáo viên">
          <SelectValue placeholder="Chọn giáo viên" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}{option.detail ? ` (${option.detail})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedTeacherId && (
        <div role="group" className="flex flex-wrap gap-2" aria-label="Phương thức điểm danh">
          {methods.map((method) => {
            const pressed = selected.includes(method.id);
            return (
              <button
                key={method.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => toggle(method.id)}
                className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                  pressed ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                {method.label}
              </button>
            );
          })}
        </div>
      )}
      {selectedTeacherId && pending[selectedTeacherId] && <p role="status" className="text-xs text-slate-500">Đang lưu…</p>}
      {(errors[selectedTeacherId] || errors._load) && (
        <p role="alert" className="text-xs font-semibold text-red-600">
          {errors[selectedTeacherId] || errors._load}
        </p>
      )}
    </section>
  );
}
