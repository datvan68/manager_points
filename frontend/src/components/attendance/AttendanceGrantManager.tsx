'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [query, setQuery] = useState('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
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
  const filteredOptions = options.filter((option) =>
    `${option.name} ${option.detail}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')),
  );
  const selectedOption = options.find((option) => option.id === selectedTeacherId);

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
      <label className="block text-xs font-bold text-slate-700">
        Giáo viên
        <input
          role="combobox"
          aria-label="Giáo viên"
          aria-autocomplete="list"
          aria-controls="attendance-teacher-options"
          aria-expanded={selectorOpen}
          aria-activedescendant={selectorOpen && filteredOptions[highlightedIndex]
            ? `attendance-teacher-${filteredOptions[highlightedIndex].id}`
            : undefined}
          value={selectorOpen ? query : selectedOption?.name || ''}
          onFocus={() => {
            setQuery('');
            setHighlightedIndex(0);
            setSelectorOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlightedIndex(0);
            setSelectorOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setSelectorOpen(true);
              setHighlightedIndex((current) => Math.min(current + 1, filteredOptions.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlightedIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Enter' && selectorOpen && filteredOptions[highlightedIndex]) {
              event.preventDefault();
              setSelectedTeacherId(filteredOptions[highlightedIndex].id);
              setQuery('');
              setSelectorOpen(false);
            } else if (event.key === 'Escape') {
              setQuery('');
              setSelectorOpen(false);
            }
          }}
          placeholder="Tìm giáo viên"
          className="mt-1 max-h-56 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </label>
      {selectorOpen && (
        <div
          id="attendance-teacher-options"
          role="listbox"
          aria-label="Kết quả giáo viên"
          className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1"
        >
          {filteredOptions.map((option) => (
            <button
              key={option.id}
              id={`attendance-teacher-${option.id}`}
              type="button"
              role="option"
              aria-selected={option.id === selectedTeacherId}
              onMouseEnter={() => setHighlightedIndex(filteredOptions.indexOf(option))}
              onClick={() => {
                setSelectedTeacherId(option.id);
                setQuery('');
                setHighlightedIndex(0);
                setSelectorOpen(false);
              }}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 ${
                filteredOptions[highlightedIndex]?.id === option.id ? 'bg-slate-100' : ''
              }`}
            >
              <span className="font-semibold">{option.name}</span>
              {option.detail && <span className="ml-2 text-xs text-slate-500">{option.detail}</span>}
            </button>
          ))}
          {!filteredOptions.length && <p className="px-3 py-2 text-xs text-slate-500">Không tìm thấy giáo viên</p>}
        </div>
      )}
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
