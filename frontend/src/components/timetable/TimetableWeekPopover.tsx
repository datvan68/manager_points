'use client';

import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { TimetableClassLink, TimetableClassSyncStatus, TimetableBulkWeekSyncRequest } from '@/api/timetable-api';

type Props = {
  links: TimetableClassLink[];
  statuses: TimetableClassSyncStatus[];
  disabled?: boolean;
  onSubmit: (selections: TimetableBulkWeekSyncRequest[]) => Promise<void>;
};

const key = (item: TimetableClassLink | TimetableClassSyncStatus['classSelection']) => JSON.stringify([item.year, item.semester, item.faculty || '', item.course || '', item.className]);
const natural = (value: string) => value.match(/\d+/u)?.[0] ? Number(value.match(/\d+/u)![0]) : Number.MAX_SAFE_INTEGER;

export default function TimetableWeekPopover({ links, statuses, disabled, onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const statusFor = (link: TimetableClassLink) => statuses.find((row) => key(row.classSelection) === key(link));
  const weeks = useMemo(() => {
    if (!links.length) return [];
    const sets = links.map((link) => new Set((statusFor(link)?.weeks || []).map((week) => week.week)));
    const first = [...sets[0]];
    return first
      .filter((week) => sets.every((set) => set.has(week)))
      .map((week) => links.map((link) => statusFor(link)?.weeks.find((item) => item.week === week)).find(Boolean)!)
      .sort((a, b) => (a.startDate ? 0 : 1) - (b.startDate ? 0 : 1) || (a.startDate || '').localeCompare(b.startDate || '') || natural(a.week) - natural(b.week) || a.week.localeCompare(b.week));
  }, [links, statuses]);
  const eligible = weeks.filter((week) => links.some((link) => !['pending', 'running'].includes(statusFor(link)?.weeks.find((item) => item.week === week.week)?.status || 'missing')));
  const selectedCount = selected.size;
  const pairCount = selectedCount * links.length;
  const toggle = (week: string) => setSelected((current) => { const next = new Set(current); if (next.has(week)) next.delete(week); else next.add(week); return next; });
  const submit = async () => {
    const pairs = links.flatMap((link) => [...selected].flatMap((week) => {
      const current = statusFor(link)?.weeks.find((item) => item.week === week);
      return current && !['pending', 'running'].includes(current.status) ? [{ ...link, week }] : [];
    }));
    if (!pairs.length) return;
    try { await onSubmit(pairs); setOpen(false); } catch { /* parent keeps the draft and reports the request error */ }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled || !links.length} aria-label="Chọn tuần đồng bộ" className="rounded-xl bg-[#1A73E8] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Chọn tuần đồng bộ</button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw, 30rem)] min-w-[280px] p-4" onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">Đồng bộ tuần</h3><p className="mt-1 text-xs text-slate-500">{links.length} lớp · {selectedCount} tuần · {pairCount} cặp</p>{pairCount > 100 && <p role="alert" className="mt-1 text-xs font-semibold text-rose-600">Tối đa 100 cặp cho mỗi lần gửi.</p>}</div><button type="button" onClick={() => setSelected(new Set())} className="text-xs font-semibold text-slate-500">Xóa chọn</button></div>
        <div className="mt-3 flex gap-2"><button type="button" onClick={() => setSelected(new Set(eligible.map((week) => week.week)))} className="rounded-lg border px-2 py-1 text-xs">Chọn tuần hợp lệ</button><button type="button" onClick={() => setSelected(new Set(eligible.filter((week) => links.some((link) => statusFor(link)?.weeks.find((item) => item.week === week.week)?.status !== 'valid')).map((week) => week.week)))} className="rounded-lg border px-2 py-1 text-xs">Chưa đồng bộ</button></div>
        <div className="mt-3 max-h-64 space-y-1 overflow-y-auto" role="group" aria-label="Các tuần có thể đồng bộ">{weeks.map((week) => <label key={week.week} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 hover:bg-slate-50"><span className="flex items-center gap-2"><input type="checkbox" checked={selected.has(week.week)} onChange={() => toggle(week.week)} />{week.label || week.week}</span><span className="text-[11px] text-slate-500">{links.filter((link) => statusFor(link)?.weeks.find((item) => item.week === week.week)?.status === 'valid').length}/{links.length} lớp</span></label>)}</div>
        <button type="button" onClick={() => void submit()} disabled={!selectedCount || pairCount > 100} className="mt-3 w-full rounded-xl bg-[#1A73E8] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Xác nhận đồng bộ</button>
      </PopoverContent>
    </Popover>
  );
}
