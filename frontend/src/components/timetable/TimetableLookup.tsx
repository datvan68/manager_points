'use client';
import { useEffect, useRef, useState } from 'react';
import { timetableApi, type TimetableFilters, type TimetableResult } from '@/api/timetable-api';
import TimetableGrid from './TimetableGrid';
import TimetableMobileView from './TimetableMobileView';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RotateCw, Search, SlidersHorizontal, ChevronLeft, ChevronRight, X, Filter } from 'lucide-react';
import { changeFilter, emptyFilters, emptyOptions, selectionKey } from './timetable-filters';

export default function TimetableLookup({ refreshKey = 0 }: { refreshKey?: number }) {
  const [options, setOptions] = useState(emptyOptions);
  const [filters, setFilters] = useState<TimetableFilters>(emptyFilters);
  const [result, setResult] = useState<TimetableResult | null>(null);
  const [state, setState] = useState<'loading' | 'options-loading' | 'ready' | 'empty' | 'pending' | 'error'>('options-loading');
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('day');
    }
  }, []);

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

  const currentWeekIndex = options.weeks.findIndex((w) => w.value === filters.week);
  const canPrevWeek = currentWeekIndex > 0;
  const canNextWeek = currentWeekIndex >= 0 && currentWeekIndex < options.weeks.length - 1;

  const navigateWeek = (direction: -1 | 1) => {
    const targetIndex = currentWeekIndex + direction;
    if (targetIndex >= 0 && targetIndex < options.weeks.length) {
      const targetWeek = options.weeks[targetIndex];
      setFilter('week', targetWeek.value);
      if (filters.className) {
        const nextFilters = { ...filters, week: targetWeek.value };
        const id = ++requestId.current;
        setState('loading');
        setError('');
        void searchFor(nextFilters, id);
      }
    }
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4" aria-label="Tra cứu thời khóa biểu">
      {/* Mobile Compact Filter Trigger Bar (Chỉ hiển thị trên Mobile) */}
      <div className="flex sm:hidden items-center justify-between gap-2 rounded-2xl border border-white/80 bg-white/70 p-2.5 shadow-sm backdrop-blur-md">
        <button
          type="button"
          onClick={() => setMobileFilterOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus:outline-none"
          aria-label="Mở bộ lọc tra cứu thời khóa biểu"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-[#1A73E8]">
            <Search size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-bold text-[#1E293B]">
                {options.classes.find((c) => c.value === filters.className)?.label || filters.className || 'Chọn lớp học'}
              </span>
              {filters.week && (
                <span className="shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#1A73E8] border border-blue-200/60">
                  {options.weeks.find((w) => w.value === filters.week)?.label || `Tuần ${filters.week}`}
                </span>
              )}
            </div>
            <p className="truncate text-[11px] text-[#64748B]">
              {[yearLabel, semesterLabel, options.faculties.find((f) => f.value === filters.faculty)?.label, options.courses.find((c) => c.value === filters.course)?.label].filter(Boolean).join(' · ') || 'Chạm để đổi lớp, tuần & học kỳ'}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/80 bg-white/80 px-2.5 text-xs font-semibold text-[#1A73E8] shadow-2xs hover:bg-white"
          >
            <SlidersHorizontal size={13} />
            <span>Lọc</span>
          </button>
          <button
            type="button"
            onClick={() => void search()}
            disabled={!canSearch || busy}
            aria-label="Tìm kiếm ngay"
            title="Tìm kiếm ngay"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A73E8] text-white shadow-2xs hover:bg-blue-600 disabled:opacity-40"
          >
            <Search size={15} />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleRefresh}
            aria-label="Tải lại lịch học"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/80 bg-white/80 text-[#64748B] shadow-2xs hover:bg-white hover:text-[#1E293B] disabled:opacity-50"
          >
            <RotateCw size={14} className={busy ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Mobile Fullscreen Filter Popover / Modal */}
      {mobileFilterOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bộ lọc tra cứu thời khóa biểu"
          className="fixed inset-0 z-[100] flex flex-col bg-white/95 backdrop-blur-md p-4 sm:hidden overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-[#1A73E8]">
                <Filter size={16} />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#1E293B]">Tra cứu thời khóa biểu</h2>
                <p className="text-[11px] text-[#64748B]">Chọn thông tin để tải lịch học</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileFilterOpen(false)}
              aria-label="Đóng bộ lọc"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Fields inside Fullscreen Popover */}
          <div className="flex-1 space-y-3.5 py-4 text-xs">
            {/* Niên học & Học kỳ */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <span className="font-semibold text-[#1E293B]">Niên học</span>
                <Select
                  value={filters.year || ''}
                  onValueChange={(val: string) => setFilter('year', val)}
                >
                  <SelectTrigger
                    disabled={busy}
                    className="h-10 w-full rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-medium text-[#1E293B] shadow-sm"
                  >
                    <SelectValue placeholder="Chọn niên học" />
                  </SelectTrigger>
                  <SelectContent className="z-[10002]">
                    {!options.years.some((item) => item.value === '') && (
                      <SelectItem value="">Chọn niên học</SelectItem>
                    )}
                    {options.years.map((item) => (
                      <SelectItem key={item.value || 'm-year-all'} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-[#1E293B]">Học kỳ</span>
                <Select
                  value={filters.semester || ''}
                  onValueChange={(val: string) => setFilter('semester', val)}
                >
                  <SelectTrigger
                    disabled={busy || !filters.year}
                    className="h-10 w-full rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-medium text-[#1E293B] shadow-sm"
                  >
                    <SelectValue placeholder="Chọn học kỳ" />
                  </SelectTrigger>
                  <SelectContent className="z-[10002]">
                    {!options.semesters.some((item) => item.value === '') && (
                      <SelectItem value="">Chọn học kỳ</SelectItem>
                    )}
                    {options.semesters.map((item) => (
                      <SelectItem key={item.value || 'm-semester-all'} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tuần học */}
            <div className="space-y-1">
              <span className="font-semibold text-[#1E293B]">Tuần học</span>
              <Select
                value={filters.week || ''}
                onValueChange={(value: string) => setFilter('week', value)}
              >
                <SelectTrigger
                  disabled={busy || !filters.year || !filters.semester}
                  className="h-10 w-full rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-medium text-[#1E293B] shadow-sm"
                >
                  <SelectValue placeholder="Chọn tuần" />
                </SelectTrigger>
                <SelectContent className="z-[10002]">
                  {!options.weeks.some((item) => item.value === '') && (
                    <SelectItem value="">Chọn tuần</SelectItem>
                  )}
                  {options.weeks.map((item) => (
                    <SelectItem key={item.value || 'm-week-all'} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Khoa & Khóa */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <span className="font-semibold text-[#1E293B]">Khoa</span>
                <Select
                  value={filters.faculty || ''}
                  onValueChange={(value: string) => setFilter('faculty', value)}
                >
                  <SelectTrigger
                    disabled={busy || !filters.week}
                    className="h-10 w-full rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-medium text-[#1E293B] shadow-sm"
                  >
                    <SelectValue placeholder="Tất cả khoa" />
                  </SelectTrigger>
                  <SelectContent className="z-[10002]">
                    {!options.faculties.some((item) => item.value === '') && (
                      <SelectItem value="">Tất cả khoa</SelectItem>
                    )}
                    {options.faculties.map((item) => (
                      <SelectItem key={item.value || 'm-faculty-all'} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-[#1E293B]">Khóa</span>
                <Select
                  value={filters.course || ''}
                  onValueChange={(value: string) => setFilter('course', value)}
                >
                  <SelectTrigger
                    disabled={busy || !filters.week}
                    className="h-10 w-full rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-medium text-[#1E293B] shadow-sm"
                  >
                    <SelectValue placeholder="Tất cả khóa" />
                  </SelectTrigger>
                  <SelectContent className="z-[10002]">
                    {!options.courses.some((item) => item.value === '') && (
                      <SelectItem value="">Tất cả khóa</SelectItem>
                    )}
                    {options.courses.map((item) => (
                      <SelectItem key={item.value || 'm-course-all'} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Lớp học */}
            <div className="space-y-1">
              <span className="font-semibold text-[#1E293B]">Lớp học</span>
              <Select
                value={filters.className || ''}
                onValueChange={(value: string) => setFilter('className', value)}
              >
                <SelectTrigger
                  disabled={busy || !filters.week}
                  className="h-10 w-full rounded-xl border border-blue-500/30 bg-blue-50/40 px-3 text-xs font-semibold text-[#1A73E8] shadow-sm"
                >
                  <SelectValue placeholder="Chọn lớp" />
                </SelectTrigger>
                <SelectContent className="z-[10002]">
                  {!options.classes.some((item) => item.value === '') && (
                    <SelectItem value="">Chọn lớp</SelectItem>
                  )}
                  {options.classes.map((item) => (
                    <SelectItem key={item.value || 'm-class-all'} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Button: Lắng nghe btn tra cứu */}
          <div className="border-t border-slate-200/80 pt-3">
            <button
              type="button"
              onClick={async () => {
                setMobileFilterOpen(false);
                await search();
              }}
              disabled={!canSearch || busy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1A73E8] font-bold text-xs text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search size={16} />
              <span>Tra cứu thời khóa biểu</span>
            </button>
          </div>
        </div>
      )}

      {/* Thanh Menu Tra cứu Lịch học (Desktop / Tablet) */}
      <div className="hidden shrink-0 sm:flex sm:flex-wrap sm:items-center gap-2.5">
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
          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => navigateWeek(-1)}
                  disabled={!canPrevWeek || busy}
                  aria-label="Tuần trước"
                  title="Chuyển sang tuần trước"
                  className="inline-flex h-8 items-center gap-1 rounded-xl border border-white/80 bg-white/70 px-2.5 text-xs font-semibold text-[#1E293B] shadow-2xs backdrop-blur-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                  <span className="hidden sm:inline">Tuần trước</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateWeek(1)}
                  disabled={!canNextWeek || busy}
                  aria-label="Tuần sau"
                  title="Chuyển sang tuần sau"
                  className="inline-flex h-8 items-center gap-1 rounded-xl border border-white/80 bg-white/70 px-2.5 text-xs font-semibold text-[#1E293B] shadow-2xs backdrop-blur-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="hidden sm:inline">Tuần sau</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              <span className="font-semibold text-[#1E293B]">
                Kết quả: {[yearLabel, semesterLabel, options.weeks.find((w) => w.value === result.filters.week)?.label || result.filters.week, options.classes.find((c) => c.value === result.filters.className)?.label || result.filters.className].filter(Boolean).join(' · ')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {result.syncedAt && (
                <span className="hidden lg:inline text-[#64748B]">
                  Cập nhật: {new Date(result.syncedAt).toLocaleString('vi-VN')}
                </span>
              )}

              <div className="inline-flex rounded-xl border border-white/80 bg-slate-100/80 p-0.5 text-xs font-semibold shadow-2xs backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('day')}
                  className={`rounded-xl px-2.5 py-1 transition-all duration-150 ${
                    viewMode === 'day'
                      ? 'bg-[#1A73E8] text-white shadow-xs'
                      : 'text-[#64748B] hover:text-[#1E293B]'
                  }`}
                >
                  📱 Theo ngày
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('week')}
                  className={`rounded-xl px-2.5 py-1 transition-all duration-150 ${
                    viewMode === 'week'
                      ? 'bg-[#1A73E8] text-white shadow-xs'
                      : 'text-[#64748B] hover:text-[#1E293B]'
                  }`}
                >
                  📊 Lưới tuần
                </button>
              </div>
            </div>
          </div>

          {viewMode === 'day' ? (
            <TimetableMobileView result={result} />
          ) : (
            <TimetableGrid result={result} />
          )}
        </div>
      )}
    </section>
  );
}
