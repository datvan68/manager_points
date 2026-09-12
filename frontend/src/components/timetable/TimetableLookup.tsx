'use client';
import { useEffect, useRef, useState } from 'react';
import { timetableApi, type TimetableFilters, type TimetableResult } from '@/api/timetable-api';
import TimetableGrid from './TimetableGrid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { changeFilter, emptyFilters, emptyOptions, fields, selectionKey } from './timetable-filters';

export default function TimetableLookup({ refreshKey = 0 }: { refreshKey?: number }) {
  const [options, setOptions] = useState(emptyOptions);
  const [filters, setFilters] = useState<TimetableFilters>(emptyFilters);
  const [result, setResult] = useState<TimetableResult | null>(null);
  const [state, setState] = useState<'loading' | 'options-loading' | 'ready' | 'empty' | 'pending' | 'error'>('options-loading');
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopPolling = () => { if (pollTimer.current) clearTimeout(pollTimer.current); pollTimer.current = null; };

  const loadOptions = async (next: TimetableFilters) => {
    const id = ++requestId.current;
    setState('options-loading');
    setError('');
    try {
      const data = await timetableApi.getOptions(next);
      if (id === requestId.current) { setOptions(data); setState('ready'); }
    } catch (e: unknown) {
      if (id === requestId.current) { setError(e instanceof Error ? e.message : 'Không thể tải bộ lọc.'); setState('error'); }
    }
  };

  useEffect(() => {
    stopPolling();
    setFilters(emptyFilters);
    setResult(null);
    void loadOptions(emptyFilters);
    return () => { requestId.current += 1; stopPolling(); };
  }, [refreshKey]);

  const setFilter = (key: keyof TimetableFilters, value: string) => {
    const next = changeFilter(filters, key, value);
    requestId.current += 1; stopPolling();
    setFilters(next);
    setResult(null);
    setError('');
    if (key === 'className') setState('ready');
    else void loadOptions(next);
  };

  const pollPending = (next: TimetableFilters, id: number, attempt = 0) => {
    stopPolling();
    pollTimer.current = setTimeout(() => {
      if (id !== requestId.current) return;
      void timetableApi.getDemandStatus(next).then((status) => {
        if (id !== requestId.current) return;
        if (status.status === 'valid' || status.status === 'succeeded') { void searchFor(next, id); return; }
        if (status.status === 'failed' || status.status === 'busy') { setState('error'); setError('Làm mới thời khóa biểu thất bại. Vui lòng thử lại.'); return; }
        setState('pending'); pollPending(next, id, attempt + 1);
      }).catch(() => { if (id === requestId.current) { setState('pending'); pollPending(next, id, attempt + 1); } });
    }, Math.min(8000, 500 * 2 ** Math.min(attempt, 4)));
  };
  const searchFor = async (next: TimetableFilters, id: number) => {
    try {
      const data = await (timetableApi.requestDemand ? timetableApi.requestDemand(next) : timetableApi.getTimetable(next));
      if (id !== requestId.current) return;
      if (data.status === 'pending') { setState('pending'); pollPending(next, id); return; }
      stopPolling(); setResult(data); setState(data.isEmpty ? 'empty' : 'ready');
    } catch (e: unknown) {
      if (id === requestId.current) { stopPolling(); setError(e instanceof Error ? e.message : 'Không thể tải thời khóa biểu.'); setState('error'); }
    }
  };
  const search = async () => {
    const id = ++requestId.current;
    setState('loading');
    setError('');
    stopPolling(); await searchFor(filters, id);
  };
  const busy = state === 'loading' || state === 'options-loading';

  return <section className="min-w-0 space-y-4" aria-label="Tra cứu thời khóa biểu">
    <div className="rounded-2xl border border-white/75 bg-white/45 p-4 shadow-sm shadow-slate-300/40 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-[#1E293B]">Tra cứu lịch học</h2><p className="mt-1 max-w-2xl text-sm text-[#64748B]">Bộ lọc chỉ hiển thị phạm vi đã đồng bộ. Chọn lần lượt niên học, học kỳ và tuần để tra cứu.</p></div>
        <button type="button" disabled={busy} onClick={() => { setResult(null); void loadOptions(filters); }} className="rounded-xl border border-white/70 bg-white/40 px-3 py-1.5 text-sm font-semibold text-[#1E293B] transition-all duration-150 ease-out motion-reduce:transition-none hover:bg-white/70 disabled:opacity-50">Làm mới danh mục</button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map(([key, label, optionField], index) => <label key={key} className="space-y-1 text-sm font-semibold text-[#1E293B]">
        <span>{label}</span>
        <Select value={filters[key] || ''} onValueChange={(value: string) => setFilter(key, value)}>
          <SelectTrigger aria-label={label} disabled={busy || (index > 0 && !filters.year) || (index > 1 && !filters.semester) || (index > 2 && !filters.week)} className="w-full bg-white/50 backdrop-blur-sm motion-reduce:transition-none">
            <SelectValue placeholder={`Chọn ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent className="z-[60]">
            {!options[optionField].some((item) => item.value === '') && <SelectItem value="">{index >= 3 ? `Tất cả ${label.toLowerCase()}` : `Chọn ${label.toLowerCase()}`}</SelectItem>}
            {options[optionField].map((item) => <SelectItem key={item.value || `${key}-all`} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>)}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void search()} disabled={!filters.year || !filters.semester || !filters.week || !filters.className || busy}
          className="rounded-xl bg-[#1A73E8] px-4 py-2 text-sm font-bold text-white transition-all duration-150 ease-out motion-reduce:transition-none hover:scale-[1.01] motion-reduce:hover:scale-100 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 disabled:cursor-not-allowed disabled:opacity-50">Tìm kiếm</button>
        {filters.week && filters.className && !options.availableCoverage?.some((item) => selectionKey(item) === selectionKey(filters)) && !busy && <p className="text-sm text-blue-700">Tuần này chưa có bản lưu; hệ thống sẽ tải đúng phạm vi lớp đã được quản trị viên chọn.</p>}
      </div>
    </div>
    {state === 'options-loading' && <p role="status" className="rounded-xl border border-white/75 bg-white/45 p-3 text-sm text-[#64748B]">Đang tải bộ lọc...</p>}
    {state === 'loading' && <p role="status" className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-[#1A73E8]">Đang tải thời khóa biểu...</p>}
    {state === 'pending' && <p role="status" className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-[#1A73E8]">Đang chuẩn bị lịch học cho phạm vi đã chọn...</p>}
    {state === 'error' && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700"><span>{error}</span><button type="button" onClick={() => { setResult(null); void loadOptions(filters); }} className="rounded-xl border border-white/70 bg-white/60 px-3 py-1.5 font-semibold transition-all duration-150 ease-out motion-reduce:transition-none hover:bg-white/80">Thử lại</button></div>}
    {state === 'ready' && !result && !options.years.length && <p role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-700">Chưa có dữ liệu thời khóa biểu đã đồng bộ để tra cứu.</p>}
    {state === 'empty' && <p role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-700">Không có lịch cho bộ lọc đã chọn.</p>}
    {result && (state === 'ready' || state === 'empty') && <>
      <p className="text-sm text-slate-600">Kết quả: {fields.slice(0, 3).map(([key, , optionField]) => options[optionField].find((item) => item.value === result.filters[key])?.label || result.filters[key]).join(' · ')}
        {result.syncedAt && ` · Cập nhật ${new Date(result.syncedAt).toLocaleString('vi-VN')}`}</p>
      {result.refresh?.pending && <p role="status" className="text-sm text-blue-700">Đang cập nhật nền; kết quả hiện tại vẫn được giữ nguyên.</p>}
      {result.refresh?.stale && <p className="text-xs text-amber-700">Dữ liệu đã cũ hơn 30 phút.</p>}
      <button type="button" disabled={busy} onClick={() => { const id = ++requestId.current; setState('pending'); setError(''); void timetableApi.refreshTimetable(filters).then(() => pollPending(filters, id)).catch((e: unknown) => { if (id === requestId.current) { setState('error'); setError(e instanceof Error ? e.message : 'Không thể làm mới.'); } }); }} className="rounded-xl border border-white/70 bg-white/60 px-3 py-1.5 text-sm font-semibold">Làm mới lịch</button>
      <TimetableGrid result={result} />
    </>}
  </section>;
}
