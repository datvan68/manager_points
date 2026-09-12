'use client';
import { useEffect, useRef, useState } from 'react';
import { timetableApi, type TimetableFilters, type TimetableResult } from '@/api/timetable-api';
import TimetableGrid from './TimetableGrid';
import { changeFilter, emptyFilters, emptyOptions, fields, selectionKey } from './timetable-filters';

export default function TimetableLookup({ refreshKey = 0 }: { refreshKey?: number }) {
  const [options, setOptions] = useState(emptyOptions);
  const [filters, setFilters] = useState<TimetableFilters>(emptyFilters);
  const [result, setResult] = useState<TimetableResult | null>(null);
  const [state, setState] = useState<'loading' | 'options-loading' | 'ready' | 'empty' | 'error'>('options-loading');
  const [error, setError] = useState('');
  const requestId = useRef(0);

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
    setFilters(emptyFilters);
    setResult(null);
    void loadOptions(emptyFilters);
    return () => { requestId.current += 1; };
  }, [refreshKey]);

  const setFilter = (key: keyof TimetableFilters, value: string) => {
    const next = changeFilter(filters, key, value);
    setFilters(next);
    setResult(null);
    setError('');
    if (key === 'className') setState('ready');
    else void loadOptions(next);
  };

  const search = async () => {
    const id = ++requestId.current;
    setState('loading');
    setError('');
    try {
      const data = await timetableApi.getTimetable(filters);
      if (id === requestId.current) { setResult(data); setState(data.isEmpty ? 'empty' : 'ready'); }
    } catch (e: unknown) {
      if (id === requestId.current) { setError(e instanceof Error ? e.message : 'Không thể tải thời khóa biểu.'); setState('error'); }
    }
  };
  const busy = state === 'loading' || state === 'options-loading';
  const covered = options.availableCoverage?.some((item) => selectionKey(item) === selectionKey(filters)) ?? true;

  return <section className="space-y-5" aria-label="Tra cứu thời khóa biểu">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-slate-600">Bộ lọc chỉ hiển thị phạm vi đã đồng bộ. Chọn lần lượt niên học, học kỳ và tuần để tra cứu.</p>
      <button type="button" disabled={busy} onClick={() => { setResult(null); void loadOptions(filters); }} className="rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-50">Làm mới danh mục</button>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map(([key, label, optionField], index) => <label key={key} className="space-y-1 text-sm font-semibold">
        <span>{label}</span>
        <select aria-label={label} value={filters[key] || ''} onChange={(event) => setFilter(key, event.target.value)}
          disabled={busy || (index > 0 && !filters.year) || (index > 1 && !filters.semester) || (index > 2 && !filters.week)}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white/75 px-3 text-sm disabled:opacity-50">
          {!options[optionField].some((item) => item.value === '') && <option value="">Chọn {label.toLowerCase()}</option>}
          {options[optionField].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>)}
    </div>
    <button type="button" onClick={() => void search()} disabled={!filters.year || !filters.semester || !filters.week || !covered || busy}
      className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Tìm kiếm</button>
    {filters.week && !covered && !busy && <p className="text-sm text-amber-800">Hãy chọn khoa, khóa và lớp trong danh mục để khớp phạm vi đã đồng bộ.</p>}
    {state === 'options-loading' && <p role="status">Đang tải bộ lọc...</p>}
    {state === 'loading' && <p role="status">Đang tải thời khóa biểu...</p>}
    {state === 'error' && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {state === 'empty' && <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-800">Không có lịch cho bộ lọc đã chọn.</p>}
    {result && state === 'ready' && <>
      <p className="text-sm text-slate-600">Kết quả: {fields.slice(0, 3).map(([key, , optionField]) => options[optionField].find((item) => item.value === result.filters[key])?.label || result.filters[key]).join(' · ')}
        {result.syncedAt && ` · Cập nhật ${new Date(result.syncedAt).toLocaleString('vi-VN')}`}</p>
      <TimetableGrid result={result} />
    </>}
  </section>;
}
