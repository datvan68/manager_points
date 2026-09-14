'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { classApi, type Class } from '@/api/class-api';
import { timetableApi, type TimetableClassLink, type TimetableClassSyncStatus, type TimetableFilters, type TimetableOptions, type TimetableSyncJob, type TimetableSyncSettings } from '@/api/timetable-api';
import FloatingActionBar from '@/components/ui/FloatingActionBar';
import { CustomPagination } from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, SlidersHorizontal } from 'lucide-react';

const emptySettings: TimetableSyncSettings = { enabled: false, intervalMinutes: 60, coverage: [], selectedClasses: [], classLinks: [] };
const normalize = (value: unknown) => String(value || '').normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
const selectionKey = (item: TimetableClassLink | TimetableClassSyncStatus['classSelection']) => JSON.stringify([item.year, item.semester, item.faculty || '', item.course || '', item.className]);
const statusLabel = (status: string) =>
  ({
    valid: 'Đã đồng bộ',
    pending: 'Đang chờ',
    running: 'Đang chạy',
    failed: 'Lỗi',
    configuration: 'Chưa đủ cấu hình',
    missing: 'Chưa đồng bộ',
  }[status] || status);

const statusBadgeClass = (status?: string) => {
  switch (status) {
    case 'valid':
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
    case 'pending':
    case 'running':
      return 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20';
    case 'failed':
      return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
    case 'configuration':
    case 'missing':
      return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    default:
      return 'bg-slate-500/10 text-[#64748B] border-slate-500/20';
  }
};

const activeStatuses = ['pending', 'running'];
type Path = { faculty: string; course: string; className: string };

export default function TimetableSyncPanel({
  onSynced,
}: {
  onSynced?: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = String(user?.roleCode || '').toUpperCase() === 'ADMIN';
  const [classes, setClasses] = useState<Class[]>([]);
  const [catalog, setCatalog] = useState<TimetableOptions | null>(null);
  const [period, setPeriod] = useState({ year: '', semester: '' });
  const [paths, setPaths] = useState<Record<string, Path>>({});
  const [rowCatalogs, setRowCatalogs] = useState<Record<string, TimetableOptions>>({});
  const catalogCache = useRef(new Map<string, TimetableOptions>());
  const [settings, setSettings] = useState<TimetableSyncSettings>(emptySettings);
  const [savedLinks, setSavedLinks] = useState<TimetableClassLink[]>([]);
  const [statuses, setStatuses] = useState<TimetableClassSyncStatus[]>([]);
  const [job, setJob] = useState<TimetableSyncJob | null>(null);
  const [, setLastUpdate] = useState<string | null>(null);
  const [selectedWeeks, setSelectedWeeks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [polling, setPolling] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<'system' | 'source'>('system');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [linkStatus, setLinkStatus] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(() => new Set());
  const [bulkWeek, setBulkWeek] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const mounted = useRef(true);
  const callback = useRef(onSynced);
  const pollTimers = useRef(new Map<string, number>());

  useEffect(() => {
    callback.current = onSynced;
  }, [onSynced]);

  useEffect(
    () => () => {
      mounted.current = false;
      pollTimers.current.forEach((timer) => window.clearTimeout(timer));
    },
    []
  );

  const applyStatus = (data: {
    job: TimetableSyncJob | null;
    lastSuccessfulUpdate: string | null;
    classStatuses?: TimetableClassSyncStatus[];
  }) => {
    if (!mounted.current) return;
    setJob(data.job);
    setStatuses(data.classStatuses || []);
    setLastUpdate(data.lastSuccessfulUpdate);
  };

  const refreshStatuses = async () => {
    try {
      applyStatus(await timetableApi.getSyncStatus());
      return true;
    } catch (e: unknown) {
      if (mounted.current)
        setError(
          e instanceof Error
            ? `Đã lưu nhưng không thể làm mới trạng thái: ${e.message}`
            : 'Đã lưu nhưng không thể làm mới trạng thái.'
        );
      return false;
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    mounted.current = true;
    void Promise.all([
      classApi.getClasses(),
      timetableApi.getSyncStatus(),
      timetableApi.loadCatalog({}),
    ])
      .then(([roster, data, initialCatalog]) => {
        if (!mounted.current) return;
        const next = data.settings || emptySettings;
        setClasses(roster);
        setCatalog(initialCatalog);
        setSettings({
          ...emptySettings,
          ...next,
          classLinks: next.classLinks || [],
        });
        setSavedLinks(next.classLinks || []);
        setPeriod(next.sourcePeriod || { year: '', semester: '' });
        setPaths(
          Object.fromEntries(
            (next.classLinks || []).map((link) => [
              link.systemClassId,
              {
                faculty: link.faculty || '',
                course: link.course || '',
                className: link.className,
              },
            ])
          )
        );
        applyStatus(data);
      })
      .catch((e: Error) => mounted.current && setError(e.message));
    return () => {
      mounted.current = false;
    };
  }, [isAdmin]);

  const loadFor = async (key: string, filters: Partial<TimetableFilters>) => {
    const cacheKey = JSON.stringify(filters);
    const cached = catalogCache.current.get(cacheKey);
    if (cached) {
      setRowCatalogs((current) => ({ ...current, [key]: cached }));
      return cached;
    }
    const next = await timetableApi.loadCatalog(filters);
    catalogCache.current.set(cacheKey, next);
    if (mounted.current)
      setRowCatalogs((current) => ({ ...current, [key]: next }));
    return next;
  };

  const changePeriod = async (key: 'year' | 'semester', value: string) => {
    const next = { ...period, [key]: value };
    setPeriod(next);
    setSelectedWeeks({});
    if (!next.year || !next.semester) return;
    setError('');
    try {
      setCatalog(await loadFor('__period__', next));
    } catch (e: unknown) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : 'Không thể tải danh mục nguồn.'
        );
    }
  };

  const setPath = async (item: Class, key: keyof Path, value: string) => {
    const current = paths[item._id] || {
      faculty: '',
      course: '',
      className: '',
    };
    const next = {
      ...current,
      [key]: value,
      ...(key === 'faculty' ? { course: '', className: '' } : {}),
      ...(key === 'course' ? { className: '' } : {}),
    };
    setPaths((all) => ({ ...all, [item._id]: next }));
    setSelectedWeeks((all) => {
      const copy = { ...all };
      delete copy[item._id];
      return copy;
    });
    if (period.year && period.semester) {
      try {
        await loadFor(item._id, {
          ...period,
          faculty: next.faculty,
          course: next.course,
        });
      } catch (e: unknown) {
        if (mounted.current)
          setError(
            e instanceof Error ? e.message : 'Không thể tải danh mục nguồn.'
          );
      }
    }
  };

  const makeLink = (
    item: Class,
    path: Path,
    method: 'auto' | 'manual'
  ): TimetableClassLink => {
    const source = (
      rowCatalogs[item._id]?.classes ||
      catalog?.classes ||
      []
    ).find((option) => option.value === path.className);
    return {
      systemClassId: item._id,
      year: period.year,
      semester: period.semester,
      faculty: path.faculty,
      course: path.course,
      className: path.className,
      sourceLabel: source?.label || path.className,
      matchMethod: method,
    };
  };

  const setLink = (
    item: Class,
    path: Path | null,
    method: 'auto' | 'manual' = 'manual'
  ) =>
    setSettings((current) => ({
      ...current,
      classLinks: path?.className
        ? [
            ...(current.classLinks || []).filter(
              (link) => link.systemClassId !== item._id
            ),
            makeLink(item, path, method),
          ]
        : (current.classLinks || []).filter(
            (link) => link.systemClassId !== item._id
          ),
    }));

  const matchingOptions = (item: Class) => {
    const source = rowCatalogs[item._id] || catalog;
    return (source?.classes || []).filter(
      (option) =>
        normalize(option.label) === normalize(item.class_name) &&
        option.parent?.year === period.year &&
        option.parent?.semester === period.semester &&
        option.parent?.faculty &&
        option.parent?.course
    );
  };

  const reconcile = () => {
    if (!catalog || !period.year || !period.semester) return;
    classes.forEach((item) => {
      const matches = matchingOptions(item);
      if (matches.length === 1) {
        const path = {
          faculty: matches[0].parent!.faculty!,
          course: matches[0].parent!.course!,
          className: matches[0].value,
        };
        setPaths((all) => ({ ...all, [item._id]: path }));
        setLink(item, path, 'auto');
      }
    });
    setMessage('Đã tạo liên kết duy nhất thành bản nháp; hãy kiểm tra và lưu.');
  };

  const save = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const next = await timetableApi.updateSyncSettings({
        ...settings,
        sourcePeriod: period.year && period.semester ? period : undefined,
      });
      if (!mounted.current) return;
      const normalized = {
        ...emptySettings,
        ...next,
        classLinks: next.classLinks || [],
      };
      setSettings(normalized);
      setSavedLinks(normalized.classLinks || []);
      setMessage('Đã lưu liên kết và cấu hình.');
      await refreshStatuses();
    } catch (e: unknown) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : 'Không thể lưu cấu hình.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const draftFor = (item: Class) =>
    settings.classLinks?.find((link) => link.systemClassId === item._id);
  const statusFor = (link: TimetableClassLink) =>
    savedLinks.find(
      (saved) =>
        saved.systemClassId === link.systemClassId &&
        selectionKey(saved) === selectionKey(link)
    ) &&
    statuses.find(
      (row) => selectionKey(row.classSelection) === selectionKey(link)
    );

  const pollWeek = async (
    key: string,
    link: TimetableClassLink,
    week: string,
    before: string | null
  ) => {
    if (!mounted.current) return;
    setPolling((current) => ({ ...current, [key]: true }));
    try {
      const result = await timetableApi.getSavedClassWeekStatus({
        ...link,
        week,
      });
      if (!mounted.current) return;
      const terminal =
        !activeStatuses.includes(result.status) &&
        (result.status !== 'valid' ||
          !before ||
          result.lastSuccessfulUpdate !== before);
      if (terminal) {
        setPolling((current) => ({ ...current, [key]: false }));
        if (result.status === 'valid') {
          setMessage(`Đồng bộ ${link.sourceLabel} tuần ${week} đã hoàn tất.`);
          callback.current?.();
        } else if (result.status === 'failed')
          setError(result.failure || `Đồng bộ tuần ${week} thất bại.`);
        return;
      }
      const timer = window.setTimeout(
        () => void pollWeek(key, link, week, before),
        2000
      );
      pollTimers.current.set(key, timer);
    } catch (e: unknown) {
      if (mounted.current) {
        setPolling((current) => ({ ...current, [key]: false }));
        setError(
          e instanceof Error
            ? e.message
            : 'Không thể theo dõi trạng thái đồng bộ.'
        );
      }
    }
  };

  const syncWeek = async (
    link: TimetableClassLink,
    week: string,
    before: string | null
  ) => {
    const key = link.systemClassId;
    if (submitting || polling[key]) return;
    setSubmitting(key);
    setError('');
    setMessage('');
    try {
      const result = await timetableApi.syncSavedClassWeek(
        { ...link, week },
        'sync'
      );
      if (!mounted.current) return;
      setSubmitting(null);
      setMessage(
        result.status === 'pending' || result.status === 'running'
          ? `Đã nhận yêu cầu tuần ${week}; đang theo dõi...`
          : 'Đã gửi yêu cầu đồng bộ.'
      );
      void pollWeek(key, link, week, before);
    } catch (e: unknown) {
      if (mounted.current) {
        setSubmitting(null);
        setError(
          e instanceof Error ? e.message : 'Không thể đồng bộ tuần đã chọn.'
        );
      }
    }
  };

  const departments = useMemo(
    () =>
      [
        ...new Set(
          classes.map((item) =>
            typeof item.dept_id === 'object'
              ? `${(item.dept_id as any).name || ''}|${(item.dept_id as any).code || ''}`
              : String(item.dept_id || '')
          )
        ),
      ].filter(Boolean),
    [classes]
  );

  const filteredClasses = useMemo(
    () =>
      classes.filter((item) => {
        const dept =
          typeof item.dept_id === 'object'
            ? `${(item.dept_id as any).name || ''}|${(item.dept_id as any).code || ''}`
            : String(item.dept_id || '');
        const linked = Boolean(draftFor(item));
        return (
          (!normalize(search) ||
            normalize(item.class_name).includes(normalize(search))) &&
          (!department || dept === department) &&
          (linkStatus === 'all' ||
            (linkStatus === 'linked' ? linked : !linked))
        );
      }),
    [classes, search, department, linkStatus, settings.classLinks]
  );

  useEffect(() => setPage(1), [search, department, linkStatus, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filteredClasses.length / pageSize));
  const visibleClasses = useMemo(() => filteredClasses.slice((page - 1) * pageSize, page * pageSize), [filteredClasses, page, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const eligibleVisibleIds = visibleClasses.filter((item) => savedLinks.some((link) => link.systemClassId === item._id)).map((item) => item._id);
  const allVisibleSelected = eligibleVisibleIds.length > 0 && eligibleVisibleIds.every((id) => selectedClassIds.has(id));
  const selectedLinks = savedLinks.filter((link) => selectedClassIds.has(link.systemClassId));
  const commonWeeks = useMemo(() => {
    if (!selectedLinks.length) return [];
    const sets = selectedLinks.map((link) => new Set((statuses.find((row) => selectionKey(row.classSelection) === selectionKey(link))?.weeks || []).map((week) => week.week)));
    return [...sets[0]].filter((week) => sets.every((set) => set.has(week)));
  }, [selectedLinks, statuses]);
  const toggleClass = (id: string, checked: boolean) => setSelectedClassIds((current) => { const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next; });
  const toggleVisible = (checked: boolean) => setSelectedClassIds((current) => { const next = new Set(current); eligibleVisibleIds.forEach((id) => checked ? next.add(id) : next.delete(id)); return next; });
  const syncSelected = async () => {
    if (bulkSubmitting || !bulkWeek || !selectedLinks.length || !commonWeeks.includes(bulkWeek)) return;
    setBulkSubmitting(true); setError(''); setMessage('');
    try { const result = await timetableApi.syncSavedClassWeeks(selectedLinks.map((link) => ({ ...link, week: bulkWeek }))); setMessage(`Đã gửi ${result.total} lớp; đang theo dõi tiến độ...`); await refreshStatuses(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Không thể đồng bộ các lớp đã chọn.'); }
    finally { setBulkSubmitting(false); }
  };

  if (!isAdmin) return null;

  return (
    <section
      aria-label="Quản trị đồng bộ thời khóa biểu"
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden"
    >
      {/* Filter and Search Bar */}
      <div className="flex shrink-0 flex-col items-stretch gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:min-w-[220px] sm:max-w-md">
          <Search aria-hidden="true" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            aria-label="Tìm lớp"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm lớp hệ thống"
            className="h-10 w-full rounded-xl border border-white/75 bg-white/60 py-2 pl-9 pr-3 text-xs font-medium text-[#1E293B] placeholder:text-[#64748B] shadow-sm backdrop-blur-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
          />
        </div>
        <div className="min-w-0 sm:w-[190px]">
          <Select
            value={department || 'ALL'}
            onValueChange={(value: string) => setDepartment(value === 'ALL' ? '' : value)}
          >
            <SelectTrigger
              aria-label="Khoa hệ thống"
              className="h-10 w-full rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm"
            >
              <SelectValue placeholder="Tất cả khoa" />
            </SelectTrigger>
            <SelectContent className="z-[60]">
              <SelectItem value="ALL">Tất cả khoa</SelectItem>
              {departments.map((value) => (
                <SelectItem key={value} value={value}>
                  {value.replace('|', ' · ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 sm:w-[190px]">
          <Select
            value={linkStatus}
            onValueChange={(value: string) => setLinkStatus(value as 'all' | 'linked' | 'unlinked')}
          >
            <SelectTrigger
              aria-label="Trạng thái liên kết"
              className="h-10 w-full rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm"
            >
              <SelectValue placeholder="Mọi trạng thái" />
            </SelectTrigger>
            <SelectContent className="z-[60]">
              <SelectItem value="all">Mọi trạng thái</SelectItem>
              <SelectItem value="linked">Đã liên kết</SelectItem>
              <SelectItem value="unlinked">Chưa liên kết</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div role="group" aria-label="Kiểu hiển thị" className="flex h-10 shrink-0 items-center rounded-xl border border-white/70 bg-white/35 p-1 text-xs font-semibold text-[#64748B]">
            <button type="button" aria-pressed={view === 'system'} onClick={() => setView('system')} className={`h-full rounded-lg px-3 transition focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 ${view === 'system' ? 'bg-white text-[#1A73E8] shadow-sm' : 'hover:bg-white/50'}`}>Lớp hệ thống</button>
            <button type="button" aria-pressed={view === 'source'} onClick={() => setView('source')} className={`h-full rounded-lg px-3 transition focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 ${view === 'source' ? 'bg-white text-[#1A73E8] shadow-sm' : 'hover:bg-white/50'}`}>Lớp nguồn</button>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Mở cấu hình nâng cao"
                title="Cấu hình liên kết"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/75 bg-white/60 text-[#64748B] shadow-sm transition hover:bg-white/80 hover:text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
              >
                <SlidersHorizontal size={18} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(92vw,540px)] p-4"
              onPointerDownOutside={(e) => {
                const target = e.target as HTMLElement | null;
                if (target?.closest('[data-select-content="true"]')) {
                  e.preventDefault();
                }
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#1E293B]">Niên học nguồn</span>
                  <Select
                    value={period.year || 'NONE'}
                    onValueChange={(value: string) => void changePeriod('year', value === 'NONE' ? '' : value)}
                  >
                    <SelectTrigger
                      aria-label="year"
                      className="h-10 w-full rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm"
                    >
                      <SelectValue placeholder="Chọn" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="NONE">Chọn</SelectItem>
                      {(catalog?.years || [])
                        .filter((option) => option.value)
                        .map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#1E293B]">Học kỳ nguồn</span>
                  <Select
                    value={period.semester || 'NONE'}
                    onValueChange={(value: string) => void changePeriod('semester', value === 'NONE' ? '' : value)}
                  >
                    <SelectTrigger
                      aria-label="semester"
                      className="h-10 w-full rounded-xl border border-white/75 bg-white/60 px-3 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm"
                    >
                      <SelectValue placeholder="Chọn" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="NONE">Chọn</SelectItem>
                      {(catalog?.semesters || [])
                        .filter((option) => option.value)
                        .map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/60 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void changePeriod('year', period.year)}
                    disabled={busy || !period.year || !period.semester}
                    className="rounded-xl border border-white/75 bg-white/50 px-3.5 py-2 text-xs font-semibold text-[#1E293B] shadow-sm transition-all duration-150 ease-out hover:bg-white/80 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                  >
                    Tải danh mục nguồn
                  </button>
                  <button
                    type="button"
                    onClick={reconcile}
                    disabled={busy || !catalog || !period.year || !period.semester}
                    className="rounded-xl border border-indigo-200/80 bg-indigo-50/70 px-3.5 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition-all duration-150 ease-out hover:bg-indigo-100 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                  >
                    Đối chiếu lớp
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#1E293B]">
                    <span>Khoảng đồng bộ</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        aria-label="Khoảng đồng bộ"
                        type="number"
                        min={30}
                        value={settings.intervalMinutes}
                        onChange={(e) =>
                          setSettings((current) => ({
                            ...current,
                            intervalMinutes: Number(e.target.value),
                          }))
                        }
                        className="w-20 rounded-xl border border-white/75 bg-white/60 px-2.5 py-1.5 text-center text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
                      />
                      <span className="text-xs font-normal text-[#64748B]">phút</span>
                    </div>
                  </label>
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={busy}
                    className="rounded-xl bg-[#1A73E8] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all duration-150 ease-out hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                  >
                    Lưu liên kết
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Class Mapping Table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/75 bg-white/45 shadow-sm shadow-slate-300/40 backdrop-blur-md">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1050px] border-collapse text-left text-xs">
            <caption className="sr-only">Bảng quản lý liên kết lớp</caption>
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-white/70 bg-white/90 text-[11px] font-bold uppercase tracking-wider text-[#1E293B]">
                <th className="px-3.5 py-3"><input aria-label="Chọn tất cả lớp trên trang" type="checkbox" checked={allVisibleSelected} onChange={(e) => toggleVisible(e.target.checked)} disabled={!eligibleVisibleIds.length || bulkSubmitting} /></th>
                <th className="px-3.5 py-3">Lớp hệ thống</th>
                <th className="px-3.5 py-3">Khoa nguồn</th>
                <th className="px-3.5 py-3">Khóa nguồn</th>
                <th className="min-w-[220px] px-3.5 py-3">Lớp nguồn</th>
                <th className="px-3.5 py-3">Phương thức</th>
                <th className="min-w-[130px] px-3.5 py-3">Tuần đã chọn</th>
                <th className="px-3.5 py-3">Trạng thái</th>
                <th className="px-3.5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {view === 'system' ? (
                visibleClasses.length ? visibleClasses.map((item) => {
                  const link = draftFor(item);
                  const path = paths[item._id] || {
                    faculty: link?.faculty || '',
                    course: link?.course || '',
                    className: link?.className || '',
                  };
                  const source = rowCatalogs[item._id] || catalog;
                  const status = link && statusFor(link);
                  const selected = link && selectedWeeks[item._id];
                  const weekStatus = status?.weeks?.find(
                    (week) => week.week === selected
                  );
                  const matches = matchingOptions(item);
                  const blocked = Boolean(
                    !link ||
                      !status ||
                      !weekStatus ||
                      busy ||
                      submitting === item._id ||
                      polling[item._id]
                  );

                  return (
                    <tr
                      key={item._id}
                      className="border-b border-white/50 transition-colors duration-150 ease-out hover:bg-white/40"
                    >
                      <td className="px-3.5 py-2.5"><input aria-label={`Chọn lớp ${item.class_name}`} type="checkbox" checked={selectedClassIds.has(item._id)} onChange={(e) => toggleClass(item._id, e.target.checked)} disabled={!savedLinks.some((saved) => saved.systemClassId === item._id) || bulkSubmitting} /></td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-bold text-[#1E293B]">
                        {item.class_name}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="w-full min-w-[130px]">
                          <Select
                            value={path.faculty || 'NONE'}
                            onValueChange={(value: string) =>
                              void setPath(item, 'faculty', value === 'NONE' ? '' : value)
                            }
                          >
                            <SelectTrigger
                              aria-label={`Khoa nguồn cho ${item.class_name}`}
                              className="h-8 rounded-xl border-white/75 bg-white/60 px-2.5 py-1 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm"
                            >
                              <SelectValue placeholder="Chọn" />
                            </SelectTrigger>
                            <SelectContent className="z-[60]">
                              <SelectItem value="NONE">Chọn</SelectItem>
                              {(source?.faculties || []).map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="w-full min-w-[110px]">
                          <Select
                            value={path.course || 'NONE'}
                            onValueChange={(value: string) =>
                              void setPath(item, 'course', value === 'NONE' ? '' : value)
                            }
                          >
                            <SelectTrigger
                              aria-label={`Khóa nguồn cho ${item.class_name}`}
                              disabled={!path.faculty}
                              className="h-8 rounded-xl border-white/75 bg-white/60 px-2.5 py-1 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <SelectValue placeholder="Chọn" />
                            </SelectTrigger>
                            <SelectContent className="z-[60]">
                              <SelectItem value="NONE">Chọn</SelectItem>
                              {(source?.courses || []).map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="w-full min-w-[200px]">
                          <Select
                            value={path.className || 'NONE'}
                            onValueChange={(value: string) => {
                              const finalVal = value === 'NONE' ? '' : value;
                              const next = { ...path, className: finalVal };
                              void setPath(item, 'className', finalVal);
                              setLink(item, finalVal ? next : null);
                            }}
                          >
                            <SelectTrigger
                              aria-label={`Nguồn cho ${item.class_name}`}
                              disabled={!path.faculty || !path.course}
                              className="h-8 rounded-xl border-white/75 bg-white/60 px-2.5 py-1 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <SelectValue placeholder="Chưa liên kết / unverified" />
                            </SelectTrigger>
                            <SelectContent className="z-[60] max-w-[320px]">
                              <SelectItem value="NONE">Chưa liên kết / unverified</SelectItem>
                              {(matches.length ? matches : source?.classes || []).map(
                                (option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        {link && (
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-[#64748B]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#1A73E8]" />
                            <span>
                              {link.sourceLabel} · {link.year}/{link.semester}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5">
                        {link ? (
                          link.matchMethod === 'auto' ? (
                            <span className="inline-flex items-center rounded-xl border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#1A73E8]">
                              Tự động (unique)
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-xl border border-purple-500/20 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700">
                              Thủ công
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center rounded-xl border border-slate-500/20 bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#64748B]">
                            Unverified
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5">
                        {status?.weeks?.length ? (
                          <div className="w-full min-w-[120px]">
                            <Select
                              value={selected || 'NONE'}
                              onValueChange={(value: string) =>
                                setSelectedWeeks((current) => ({
                                  ...current,
                                  [item._id]: value === 'NONE' ? '' : value,
                                }))
                              }
                            >
                              <SelectTrigger
                                aria-label={`Tuần cho ${item.class_name}`}
                                className="h-8 rounded-xl border-white/75 bg-white/60 px-2.5 py-1 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm"
                              >
                                <SelectValue placeholder="Chọn tuần" />
                              </SelectTrigger>
                              <SelectContent className="z-[60]">
                                <SelectItem value="NONE">Chọn tuần</SelectItem>
                                {status.weeks.map((week) => (
                                  <SelectItem key={week.week} value={week.week}>
                                    {week.label || week.week}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <span className="text-xs italic text-[#64748B]">
                            {status?.error || 'Chưa có tuần khả dụng.'}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-xl border px-2.5 py-0.5 text-[11px] font-semibold ${
                            weekStatus
                              ? statusBadgeClass(weekStatus.status)
                              : status?.error
                              ? 'bg-rose-500/10 text-rose-700 border-rose-500/20'
                              : 'bg-slate-500/10 text-[#64748B] border-slate-500/20'
                          }`}
                        >
                          {weekStatus
                            ? statusLabel(weekStatus.status)
                            : status?.error || 'Chưa chọn tuần'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={blocked}
                            onClick={() =>
                              link &&
                              selected &&
                              void syncWeek(
                                link,
                                selected,
                                weekStatus?.lastSuccessfulUpdate || null
                              )
                            }
                            className="rounded-xl bg-[#1A73E8] px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 ease-out hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                          >
                            Đồng bộ tuần
                          </button>
                          <button
                            type="button"
                            disabled={!link || busy}
                            onClick={() => {
                              setLink(item, null);
                              setPaths((all) => ({
                                ...all,
                                [item._id]: {
                                  faculty: '',
                                  course: '',
                                  className: '',
                                },
                              }));
                            }}
                            className="rounded-xl border border-rose-200/80 bg-rose-50/60 px-2.5 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition-all duration-150 ease-out hover:bg-rose-100 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                          >
                            Bỏ liên kết
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={9} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">Không có lớp phù hợp.</td></tr>
                )
              ) : (
                (catalog?.classes || []).length ? (catalog?.classes || []).map((source) => (
                  <tr
                    key={source.value}
                    className="border-b border-white/50 transition-colors duration-150 ease-out hover:bg-white/40"
                  >
                    <td className="px-3.5 py-2.5 font-mono text-[#64748B]">—</td>
                    <td className="px-3.5 py-2.5 font-mono text-[#64748B]">
                      —
                    </td>
                    <td
                      colSpan={2}
                      className="px-3.5 py-2.5 font-mono text-[#64748B]"
                    >
                      —
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-[#1E293B]">
                      {source.label}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="inline-flex items-center rounded-xl border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                        Source-only
                      </span>
                    </td>
                    <td
                      colSpan={3}
                      className="px-3.5 py-2.5 text-xs italic text-[#64748B]"
                    >
                      Không đủ điều kiện đồng bộ
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={9} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">Không có lớp nguồn.</td></tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {view === 'system' && (
          <div className="shrink-0 sticky bottom-0 z-10 border-t border-white/60 bg-white/80 px-2 backdrop-blur-md shadow-sm">
            <CustomPagination
              totalItems={filteredClasses.length}
              pageSize={pageSize}
              currentPage={Math.min(page, totalPages)}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
              pageSizeOptions={[10, 20, 50]}
              label="lớp"
            />
          </div>
        )}
      </div>

      {view === 'system' && (
        <FloatingActionBar
          selectedCount={selectedLinks.length}
          onClear={() => { setSelectedClassIds(new Set()); setBulkWeek(''); }}
          itemLabel="lớp"
          actions={(
            <>
              <div className="w-[160px]">
                <Select
                  value={bulkWeek || 'NONE'}
                  onValueChange={(value: string) => setBulkWeek(value === 'NONE' ? '' : value)}
                >
                  <SelectTrigger
                    aria-label="Tuần đồng bộ chung"
                    disabled={!selectedLinks.length || bulkSubmitting}
                    className="h-8 rounded-xl border-blue-200 bg-white px-2.5 py-1 text-xs text-[#1E293B]"
                  >
                    <SelectValue placeholder="Chọn tuần chung" />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    <SelectItem value="NONE">Chọn tuần chung</SelectItem>
                    {commonWeeks.map((week) => (
                      <SelectItem key={week} value={week}>
                        {week}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button type="button" onClick={() => void syncSelected()} disabled={!selectedLinks.length || !bulkWeek || bulkSubmitting} className="rounded-xl bg-[#1A73E8] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{bulkSubmitting ? 'Đang gửi...' : 'Đồng bộ đã chọn'}</button>
            </>
          )}
        />
      )}

      {/* Messages and Alerts */}
      {message && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-700"
        >
          {message}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-medium text-rose-700"
        >
          {error}
        </div>
      )}
    </section>
  );
}
