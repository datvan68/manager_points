'use client';
import { useEffect, useRef, useState } from 'react';
import { timetableApi, type TimetableFilters, type TimetableResult } from '@/api/timetable-api';
import TimetableGrid from './TimetableGrid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RotateCw, Search, SlidersHorizontal } from 'lucide-react';
import { changeFilter, emptyFilters, emptyOptions, selectionKey } from './timetable-filters';

export default function TimetableLookup({ refreshKey = 0 }: { refreshKey?: number }) {
  const [options, setOptions] = useState(emptyOptions);
  const [filters, setFilters] = useState<TimetableFilters>(emptyFilters);
  const [result, setResult] = useState<TimetableResult | null>(null);
  const [state, setState] = useState<'loading' | 'options-loading' | 'ready' | 'empty' | 'pending' | 'error'>('options-loading');
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const loadInitialOptions = async () => {
    const id = ++requestId.current;
    setState('options-loading');
    setError('');
    try {
      const initialData = await timetableApi.getOptions(emptyFilters);
      if (id !== requestId.current) return;

      if (!initialData.years.length) {
        setOptions(initialData);
        setFilters(emptyFilters);
        setState('ready');
        return;
      }

      let defaultYear = '';
      let defaultSemester = '';
      try {
        const savedYear = typeof window !== 'undefined' ? localStorage.getItem('timetable_default_year') : null;
        if (savedYear && initialData.years.some((item) => item.value === savedYear)) {
          defaultYear = savedYear;
        }
      } catch {}
      if (!defaultYear && initialData.years.length > 0) {
        defaultYear = initialData.years[0].value;
      }

      try {
        const savedSem = typeof window !== 'undefined' ? localStorage.getItem('timetable_default_semester') : null;
        if (savedSem && initialData.semesters.some((item) => item.value === savedSem)) {
          defaultSemester = savedSem;
        }
      } catch {}
      if (!defaultSemester && initialData.semesters.length > 0) {
        defaultSemester = initialData.semesters[0].value;
      }

      const activeFilters: TimetableFilters = {
        ...emptyFilters,
        year: defaultYear,
        semester: defaultSemester,
      };

      setFilters(activeFilters);

      if (defaultYear && defaultSemester) {
        const periodData = await timetableApi.getOptions(activeFilters);
        if (id !== requestId.current) return;
        setOptions(periodData);
      } else {
        setOptions(initialData);
      }
      setState('ready');
    } catch (e: unknown) {
      if (id === requestId.current) {
        setError(e instanceof Error ? e.message : 'Không thể tải bộ lọc.');
        setState('error');
      }
    }
  };

  const loadOptions = async (next: TimetableFilters) => {
    const id = ++requestId.current;
    setState('options-loading');
    setError('');
    try {
      const data = await timetableApi.getOptions(next);
      if (id !== requestId.current) return;

      if (next.year && !next.semester && data.semesters.length > 0) {
        const autoSemester = data.semesters[0].value;
        try {
          if (typeof window !== 'undefined') localStorage.setItem('timetable_default_semester', autoSemester);
        } catch {}
        const withSemester: TimetableFilters = { ...next, semester: autoSemester };
        setFilters(withSemester);
        const dataForPeriod = await timetableApi.getOptions(withSemester);
        if (id !== requestId.current) return;
        setOptions(dataForPeriod);
        setState('ready');
        return;
      }

      setOptions(data);
      setState('ready');
    } catch (e: unknown) {
      if (id === requestId.current) {
        setError(e instanceof Error ? e.message : 'Không thể tải bộ lọc.');
        setState('error');
      }
    }
  };

  useEffect(() => {
    setResult(null);
    void loadInitialOptions();
    return () => {
      requestId.current += 1;
    };
  }, [refreshKey]);

  const setFilter = (key: keyof TimetableFilters, value: string) => {
    if (key === 'year') {
      try {
        if (typeof window !== 'undefined') localStorage.setItem('timetable_default_year', value);
      } catch {}
    }
    if (key === 'semester') {
      try {
        if (typeof window !== 'undefined') localStorage.setItem('timetable_default_semester', value);
      } catch {}
    }
    const next = changeFilter(filters, key, value);
    requestId.current += 1;
    setFilters(next);
    setResult(null);
    setError('');
    if (key === 'className') setState('ready');
    else void loadOptions(next);
  };

  const searchFor = async (next: TimetableFilters, id: number) => {
    try {
      const data = await timetableApi.getTimetable(next);
      if (id !== requestId.current) return;
      setResult(data);
      setState(data.isEmpty ? 'empty' : 'ready');
    } catch (e: unknown) {
      if (id === requestId.current) {
        setError(e instanceof Error ? e.message : 'Không thể tải thời khóa biểu.');
        setState('error');
      }
    }
  };

  const search = async () => {
    const id = ++requestId.current;
    setState('loading');
    setError('');
    await searchFor(filters, id);
  };

  const handleRefresh = () => {
    setResult(null);
    void loadOptions(filters);
  };

  const busy = state === 'loading' || state === 'options-loading';
  const canSearch = Boolean(
    filters.year &&
    filters.semester &&
    filters.week &&
    filters.className &&
    options.availableCoverage?.some((item) => selectionKey(item) === selectionKey(filters))
  );

  const yearLabel = options.years.find((y) => y.value === filters.year)?.label || filters.year;
  const semesterLabel = options.semesters.find((s) => s.value === filters.semester)?.label || filters.semester;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4" aria-label="Tra cứu thời khóa biểu">
      {/* Thanh Menu Tra cứu Lịch học */}
      <div className="flex shrink-0 flex-col items-stretch gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Tuần */}
        <div className="min-w-0 sm:w-[150px]">
          <Select
            value={filters.week || ''}
            onValueChange={(value: string) => setFilter('week', value)}
          >
            <SelectTrigger
              aria-label="Tuần"
              disabled={busy || !filters.year || !filters.semester}
              className="h-10 w-full rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm"
            >
              <SelectValue placeholder="Chọn tuần" />
            </SelectTrigger>
            <SelectContent className="z-[60]">
              {!options.weeks.some((item) => item.value === '') && (
                <SelectItem value="">Chọn tuần</SelectItem>
              )}
              {options.weeks.map((item) => (
                <SelectItem key={item.value || 'week-all'} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Khoa */}
        <div className="min-w-0 sm:w-[180px]">
          <Select
            value={filters.faculty || ''}
            onValueChange={(value: string) => setFilter('faculty', value)}
          >
            <SelectTrigger
              aria-label="Khoa"
              disabled={busy || !filters.week}
              className="h-10 w-full rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm"
            >
              <SelectValue placeholder="Tất cả khoa" />
            </SelectTrigger>
            <SelectContent className="z-[60]">
              {!options.faculties.some((item) => item.value === '') && (
                <SelectItem value="">Tất cả khoa</SelectItem>
              )}
              {options.faculties.map((item) => (
                <SelectItem key={item.value || 'faculty-all'} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Khóa */}
        <div className="min-w-0 sm:w-[130px]">
          <Select
            value={filters.course || ''}
            onValueChange={(value: string) => setFilter('course', value)}
          >
            <SelectTrigger
              aria-label="Khóa"
              disabled={busy || !filters.week}
              className="h-10 w-full rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm"
            >
              <SelectValue placeholder="Tất cả khóa" />
            </SelectTrigger>
            <SelectContent className="z-[60]">
              {!options.courses.some((item) => item.value === '') && (
                <SelectItem value="">Tất cả khóa</SelectItem>
              )}
              {options.courses.map((item) => (
                <SelectItem key={item.value || 'course-all'} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lớp */}
        <div className="min-w-0 flex-1 sm:min-w-[180px] sm:max-w-xs">
          <Select
            value={filters.className || ''}
            onValueChange={(value: string) => setFilter('className', value)}
          >
            <SelectTrigger
              aria-label="Lớp"
              disabled={busy || !filters.week}
              className="h-10 w-full rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm"
            >
              <SelectValue placeholder="Chọn lớp" />
            </SelectTrigger>
            <SelectContent className="z-[60]">
              {!options.classes.some((item) => item.value === '') && (
                <SelectItem value="">Chọn lớp</SelectItem>
              )}
              {options.classes.map((item) => (
                <SelectItem key={item.value || 'class-all'} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Nhóm thao tác: Tìm kiếm, Làm mới, Cấu hình mặc định */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void search()}
            disabled={!canSearch || busy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1A73E8] px-4 text-xs font-bold text-white shadow-sm transition-all duration-150 ease-out motion-reduce:transition-none hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search size={15} />
            <span>Tìm kiếm</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={handleRefresh}
            aria-label="Làm mới danh mục"
            title="Làm mới danh mục"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/75 bg-white/60 text-[#64748B] shadow-sm transition hover:bg-white/80 hover:text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 disabled:opacity-50"
          >
            <RotateCw size={16} className={busy ? 'animate-spin' : ''} />
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Mở cấu hình nâng cao"
                title={`Cấu hình niên học, học kỳ (${yearLabel || 'Niên học'} · ${semesterLabel || 'Học kỳ'})`}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-semibold text-[#1E293B] shadow-sm backdrop-blur-sm transition hover:bg-white/80 hover:text-[#1A73E8] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
              >
                <SlidersHorizontal size={16} className="text-[#64748B]" />
                <span className="hidden xl:inline text-xs font-medium text-[#64748B]">
                  {yearLabel && semesterLabel ? `${yearLabel} · ${semesterLabel}` : 'Cấu hình'}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(92vw,440px)] p-4 shadow-lg border border-white/80 bg-white/95 backdrop-blur-md rounded-2xl z-[60]"
              onPointerDownOutside={(e) => {
                const target = e.target as HTMLElement | null;
                if (target?.closest('[data-select-content="true"]')) {
                  e.preventDefault();
                }
              }}
            >
              <div className="space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">Cấu hình niên học & học kỳ</h3>
                  <p className="mt-0.5 text-xs text-[#64748B]">Chọn niên học và học kỳ mặc định để tra cứu thời khóa biểu.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-[#1E293B]">Niên học</span>
                    <Select
                      value={filters.year || ''}
                      onValueChange={(val: string) => setFilter('year', val)}
                    >
                      <SelectTrigger
                        aria-label="Niên học"
                        disabled={busy}
                        className="h-10 w-full rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm"
                      >
                        <SelectValue placeholder="Chọn niên học" />
                      </SelectTrigger>
                      <SelectContent className="z-[10000]">
                        {!options.years.some((item) => item.value === '') && (
                          <SelectItem value="">Chọn niên học</SelectItem>
                        )}
                        {options.years.map((item) => (
                          <SelectItem key={item.value || 'year-all'} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-[#1E293B]">Học kỳ</span>
                    <Select
                      value={filters.semester || ''}
                      onValueChange={(val: string) => setFilter('semester', val)}
                    >
                      <SelectTrigger
                        aria-label="Học kỳ"
                        disabled={busy || !filters.year}
                        className="h-10 w-full rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm"
                      >
                        <SelectValue placeholder="Chọn học kỳ" />
                      </SelectTrigger>
                      <SelectContent className="z-[10000]">
                        {!options.semesters.some((item) => item.value === '') && (
                          <SelectItem value="">Chọn học kỳ</SelectItem>
                        )}
                        {options.semesters.map((item) => (
                          <SelectItem key={item.value || 'semester-all'} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {filters.week && filters.className && !options.availableCoverage?.some((item) => selectionKey(item) === selectionKey(filters)) && !busy && (
        <p className="text-xs text-amber-700 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
          Dữ liệu thời khóa biểu cho bộ lọc này chưa được đồng bộ.
        </p>
      )}

      {state === 'options-loading' && (
        <p role="status" className="rounded-xl border border-white/75 bg-white/45 p-3 text-sm text-[#64748B]">
          Đang tải bộ lọc...
        </p>
      )}
      {state === 'loading' && (
        <p role="status" className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-[#1A73E8]">
          Đang tải thời khóa biểu...
        </p>
      )}
      {state === 'error' && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-xl border border-white/70 bg-white/60 px-3 py-1.5 font-semibold transition-all duration-150 ease-out motion-reduce:transition-none hover:bg-white/80"
          >
            Thử lại
          </button>
        </div>
      )}
      {state === 'ready' && !result && !options.years.length && (
        <p role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-700">
          Chưa có dữ liệu thời khóa biểu đã đồng bộ để tra cứu.
        </p>
      )}
      {state === 'empty' && (
        <p role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-700">
          Không có lịch cho bộ lọc đã chọn.
        </p>
      )}
      {result && (state === 'ready' || state === 'empty') && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              Kết quả: {[yearLabel, semesterLabel, options.weeks.find((w) => w.value === result.filters.week)?.label || result.filters.week, options.classes.find((c) => c.value === result.filters.className)?.label || result.filters.className].filter(Boolean).join(' · ')}
            </span>
            {result.syncedAt && (
              <span className="text-[#64748B]">Cập nhật: {new Date(result.syncedAt).toLocaleString('vi-VN')}</span>
            )}
          </div>
          <TimetableGrid result={result} />
        </div>
      )}
    </section>
  );
}
