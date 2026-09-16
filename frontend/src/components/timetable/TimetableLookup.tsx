'use client';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { timetableApi, type TimetableFilters, type TimetableResult } from '@/api/timetable-api';
import TimetableGrid from './TimetableGrid';
import TimetableMobileView from './TimetableMobileView';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Check, RotateCw, Search, SlidersHorizontal, ChevronLeft, ChevronRight, X, Filter } from 'lucide-react';
import { changeFilter, emptyFilters, emptyOptions, selectionKey } from './timetable-filters';

function MobileChoicePopover({
  label,
  placeholder,
  value,
  options,
  disabled,
  onValueChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: { label: string; value: string }[];
  disabled?: boolean;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const [query, setQuery] = useState('');

  const selectedLabel = options.find((item) => item.value === value)?.label || placeholder;
  const filteredOptions = options.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  const handleOpen = () => {
    setDraftValue(value);
    setQuery('');
    setOpen(true);
  };

  const modalContent = open ? (
    <div
      data-mobile-choice-popover="true"
      className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/40 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in-0 duration-150"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl border border-white/80 bg-[#F5F7FA] p-4 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-150"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {/* Header with Title & Close button */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200/80 pb-2.5">
          <h3 className="text-sm font-bold text-[#1E293B]">
            {label === 'Tuần học' ? 'Chọn tuần học' : label === 'Lớp học' ? 'Chọn lớp học' : `Chọn ${label.toLowerCase()}`}
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Đóng"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-500 shadow-2xs transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search Input */}
        <div className="shrink-0 pt-3 pb-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={label === 'Lớp học' ? 'Tìm mã lớp học...' : 'Tìm tuần học...'}
              aria-label={`Tìm ${label.toLowerCase()}`}
              className="h-10 w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-8 text-xs text-[#1E293B] shadow-2xs outline-none placeholder:text-slate-400 focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Xóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Options Listbox */}
        <div
          role="listbox"
          aria-label="Options"
          className="flex-1 min-h-0 space-y-1 overflow-y-auto overscroll-contain rounded-xl border border-slate-200/80 bg-white p-1.5 [scrollbar-width:thin] [scrollbar-color:#CBD5E1_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent"
        >
          {filteredOptions.length ? (
            filteredOptions.map((item) => {
              const isSelected = draftValue === item.value;
              return (
                <button
                  key={item.value || `${label}-empty`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => setDraftValue(item.value)}
                  className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition ${
                    isSelected
                      ? 'bg-blue-50/90 font-semibold text-[#1A73E8]'
                      : 'text-[#1E293B] hover:bg-slate-50 active:bg-blue-50/50'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {isSelected && (
                    <span aria-hidden="true" className="shrink-0 text-[#1A73E8] pl-2">
                      <Check size={15} />
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <p className="px-4 py-8 text-center text-xs text-slate-400">Không tìm thấy lựa chọn</p>
          )}
        </div>

        {/* Action Buttons: Hủy & Xác nhận */}
        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-200/80 pt-3 mt-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 shadow-2xs hover:bg-slate-50 active:bg-slate-100"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => {
              onValueChange(draftValue);
              setOpen(false);
            }}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#1A73E8] px-5 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-600 active:bg-blue-700"
          >
            <Check size={14} />
            <span>Xác nhận</span>
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        role="combobox"
        aria-label={label === 'Tuần học' ? 'Tuần' : label === 'Lớp học' ? 'Lớp' : label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={handleOpen}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-white/75 bg-white/60 px-3 text-left text-xs font-medium text-[#1E293B] shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={value ? '' : 'text-[#64748B]/60'}>{selectedLabel}</span>
        <span aria-hidden="true" className="text-sm text-[#64748B]">⌄</span>
      </button>
      {typeof document !== 'undefined' && modalContent ? createPortal(modalContent, document.body) : modalContent}
    </div>
  );
}

function weekNumber(item: { label: string; value: string }): number | null {
  const label = item.label.trim();
  const weekLabel = label.match(/^Tuần\s+(\d+)(?:\D|$)/i);
  if (weekLabel) return Number(weekLabel[1]);
  if (/^\d+$/.test(label)) return Number(label);
  if (/^\d+$/.test(item.value.trim())) return Number(item.value);
  return null;
}

export default function TimetableLookup({ refreshKey = 0 }: { refreshKey?: number }) {
  const [options, setOptions] = useState(emptyOptions);
  const [filters, setFilters] = useState<TimetableFilters>(emptyFilters);
  const [result, setResult] = useState<TimetableResult | null>(null);
  const [state, setState] = useState<'loading' | 'options-loading' | 'ready' | 'empty' | 'pending' | 'error'>('options-loading');
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const mobileOpenerRef = useRef<HTMLButtonElement | null>(null);
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

  const sortedWeeks = useMemo(() => options.weeks
    .map((item, index) => ({ item, index, number: weekNumber(item) }))
    .sort((a, b) => {
      if (!a.item.value && b.item.value) return -1;
      if (a.item.value && !b.item.value) return 1;
      if (a.number !== null && b.number !== null) return a.number - b.number || a.index - b.index;
      if (a.number !== null) return -1;
      if (b.number !== null) return 1;
      return a.index - b.index;
    })
    .map(({ item }) => item), [options.weeks]);

  const currentWeekIndex = sortedWeeks.findIndex((w) => w.value === filters.week);
  const canPrevWeek = currentWeekIndex > 0;
  const canNextWeek = currentWeekIndex >= 0 && currentWeekIndex < sortedWeeks.length - 1;

  const rememberMobileOpener = (event: MouseEvent<HTMLButtonElement>) => {
    mobileOpenerRef.current = event.currentTarget;
  };

  const navigateWeek = (direction: -1 | 1) => {
    const targetIndex = currentWeekIndex + direction;
    if (targetIndex >= 0 && targetIndex < sortedWeeks.length) {
      const targetWeek = sortedWeeks[targetIndex];
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
    <Dialog
      open={mobileFilterOpen}
      onOpenChange={setMobileFilterOpen}
    >
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4" aria-label="Tra cứu thời khóa biểu">
      {/* Mobile Compact Filter Trigger Bar (Chỉ hiển thị trên Mobile) */}
      <div className="flex sm:hidden items-center justify-between gap-2 rounded-2xl border border-white/80 bg-white/70 p-2.5 shadow-sm backdrop-blur-md">
        <DialogTrigger asChild>
        <button
          type="button"
          onClick={rememberMobileOpener}
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
        </DialogTrigger>

        <div className="flex items-center gap-1.5 shrink-0">
          <DialogTrigger asChild>
          <button
            type="button"
            onClick={rememberMobileOpener}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/80 bg-white/80 px-2.5 text-xs font-semibold text-[#1A73E8] shadow-2xs hover:bg-white"
          >
            <SlidersHorizontal size={13} />
            <span>Lọc</span>
          </button>
          </DialogTrigger>
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

      {/* Mobile floating filter dialog */}
      <DialogContent
        showCloseButton={false}
        aria-label="Bộ lọc tra cứu thời khóa biểu"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          mobileOpenerRef.current?.focus();
        }}
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('[data-select-content="true"], [data-mobile-choice-popover]')) event.preventDefault();
        }}
        className="flex w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] max-w-none flex-col overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-4 shadow-2xl sm:hidden"
      >
          {/* Modal Header */}
          <DialogHeader className="relative items-center border-b border-white/50 pb-3 pr-8 text-center">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-[#1A73E8]">
                <Filter size={16} />
              </span>
              <DialogTitle className="sr-only">Bộ lọc tra cứu thời khóa biểu</DialogTitle>
              <h2 className="text-sm font-bold text-[#1E293B]">Tra cứu thời khóa biểu</h2>
            </div>
            <p className="text-[11px] text-[#64748B]">Chọn tuần và lớp học để tra cứu</p>
            <DialogClose asChild>
              <button type="button" aria-label="Đóng bộ lọc" className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/60 text-slate-500 hover:bg-white/80">
                <X size={18} />
              </button>
            </DialogClose>
          </DialogHeader>

          {/* Form Fields inside Fullscreen Popover */}
          <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain py-4 text-xs">
            {/* Niên học & Học kỳ (ẩn trên mobile theo yêu cầu) */}
            <div className="hidden">
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
              <MobileChoicePopover
                label="Tuần học"
                placeholder="Chọn tuần"
                value={filters.week || ''}
                options={sortedWeeks.some((item) => item.value === '') ? sortedWeeks : [{ label: 'Chọn tuần', value: '' }, ...sortedWeeks]}
                disabled={busy || !filters.year || !filters.semester}
                onValueChange={(value) => setFilter('week', value)}
              />
            </div>

            {/* Khoa & Khóa */}
            <div className="hidden">
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
              <MobileChoicePopover
                label="Lớp học"
                placeholder="Chọn lớp"
                value={filters.className || ''}
                options={options.classes.some((item) => item.value === '') ? options.classes : [{ label: 'Chọn lớp', value: '' }, ...options.classes]}
                disabled={busy || !filters.week}
                onValueChange={(value) => setFilter('className', value)}
              />
            </div>
          </div>

          {/* Action Button: Lắng nghe btn tra cứu */}
          <div className="shrink-0 border-t border-white/50 pt-3">
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
      </DialogContent>

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
              {sortedWeeks.map((item) => (
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
                Kết quả: {[yearLabel, semesterLabel, sortedWeeks.find((w) => w.value === result.filters.week)?.label || result.filters.week, options.classes.find((c) => c.value === result.filters.className)?.label || result.filters.className].filter(Boolean).join(' · ')}
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
    </Dialog>
  );
}
