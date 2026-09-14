'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { classApi, type Class } from '@/api/class-api';
import { timetableApi, type TimetableClassLink, type TimetableClassSyncStatus, type TimetableFilters, type TimetableOptions, type TimetableSyncJob, type TimetableSyncSettings } from '@/api/timetable-api';

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
      className="min-w-0 space-y-4 rounded-2xl border border-white/75 bg-white/45 p-4 sm:p-5 shadow-sm shadow-slate-300/40 backdrop-blur-md"
    >
      {/* Header & Status Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/60 pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
            Quản trị đồng bộ
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B]">
            Đối chiếu toàn bộ lớp hệ thống với danh mục lớp nguồn.
          </p>
        </div>
        {job && (
          <div
            role="status"
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold backdrop-blur-sm shadow-sm ${
              job.status === 'succeeded'
                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                : job.status === 'failed'
                ? 'bg-rose-500/10 text-rose-700 border-rose-500/20'
                : 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                job.status === 'running' || job.status === 'pending'
                  ? 'bg-[#1A73E8] animate-pulse'
                  : job.status === 'succeeded'
                  ? 'bg-emerald-600'
                  : 'bg-rose-600'
              }`}
            />
            <span>
              {job.status === 'succeeded'
                ? 'Đồng bộ hoàn tất'
                : job.status === 'failed'
                ? 'Đồng bộ có lỗi'
                : 'Đang đồng bộ'}{' '}
              · {job.completed || 0}/{job.total || 0}
            </span>
          </div>
        )}
      </div>

      {/* Source Configuration Controls */}
      <div className="rounded-xl border border-white/70 bg-white/40 p-3.5 sm:p-4 shadow-sm backdrop-blur-sm space-y-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold text-[#1E293B]">
            <span>Niên học nguồn</span>
            <select
              aria-label="year"
              value={period.year}
              onChange={(e) => void changePeriod('year', e.target.value)}
              className="w-full rounded-xl border border-white/75 bg-white/60 px-3 py-2 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
            >
              <option value="">Chọn</option>
              {(catalog?.years || [])
                .filter((option) => option.value)
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-[#1E293B]">
            <span>Học kỳ nguồn</span>
            <select
              aria-label="semester"
              value={period.semester}
              onChange={(e) => void changePeriod('semester', e.target.value)}
              className="w-full rounded-xl border border-white/75 bg-white/60 px-3 py-2 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
            >
              <option value="">Chọn</option>
              {(catalog?.semesters || [])
                .filter((option) => option.value)
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
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
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <input
            aria-label="Tìm lớp"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm lớp hệ thống"
            className="w-full rounded-xl border border-white/75 bg-white/60 px-3 py-2 text-xs font-medium text-[#1E293B] placeholder:text-[#64748B] shadow-sm backdrop-blur-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
          />
        </div>
        <select
          aria-label="Khoa hệ thống"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="rounded-xl border border-white/75 bg-white/60 px-3 py-2 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
        >
          <option value="">Tất cả khoa</option>
          {departments.map((value) => (
            <option key={value} value={value}>
              {value.replace('|', ' · ')}
            </option>
          ))}
        </select>
        <select
          aria-label="Trạng thái liên kết"
          value={linkStatus}
          onChange={(e) => setLinkStatus(e.target.value)}
          className="rounded-xl border border-white/75 bg-white/60 px-3 py-2 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
        >
          <option value="all">Mọi trạng thái</option>
          <option value="linked">Đã liên kết</option>
          <option value="unlinked">Chưa liên kết</option>
        </select>
        <select
          aria-label="Kiểu hiển thị"
          value={view}
          onChange={(e) => setView(e.target.value as 'system' | 'source')}
          className="rounded-xl border border-white/75 bg-white/60 px-3 py-2 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
        >
          <option value="system">Lớp hệ thống</option>
          <option value="source">Lớp nguồn / chưa liên kết</option>
        </select>
      </div>

      {/* Class Mapping Table */}
      <div className="overflow-hidden rounded-2xl border border-white/75 bg-white/45 shadow-sm shadow-slate-300/40 backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse text-left text-xs">
            <caption className="border-b border-white/70 bg-white/60 px-4 py-2.5 text-left text-xs font-bold text-[#1E293B]">
              Bảng quản lý liên kết lớp
            </caption>
            <thead>
              <tr className="border-b border-white/70 bg-white/70 text-[11px] font-bold uppercase tracking-wider text-[#1E293B]">
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
                visibleClasses.map((item) => {
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
                        <select
                          aria-label={`Khoa nguồn cho ${item.class_name}`}
                          value={path.faculty}
                          onChange={(e) =>
                            void setPath(item, 'faculty', e.target.value)
                          }
                          className="w-full min-w-[120px] rounded-xl border border-white/75 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
                        >
                          <option value="">Chọn</option>
                          {(source?.faculties || []).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <select
                          aria-label={`Khóa nguồn cho ${item.class_name}`}
                          value={path.course}
                          disabled={!path.faculty}
                          onChange={(e) =>
                            void setPath(item, 'course', e.target.value)
                          }
                          className="w-full min-w-[100px] rounded-xl border border-white/75 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <option value="">Chọn</option>
                          {(source?.courses || []).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <select
                          aria-label={`Nguồn cho ${item.class_name}`}
                          value={path.className}
                          disabled={!path.faculty || !path.course}
                          onChange={(e) => {
                            const next = { ...path, className: e.target.value };
                            setPath(item, 'className', e.target.value);
                            setLink(item, next);
                          }}
                          className="w-full rounded-xl border border-white/75 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <option value="">Chưa liên kết / unverified</option>
                          {(matches.length ? matches : source?.classes || []).map(
                            (option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            )
                          )}
                        </select>
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
                          <select
                            aria-label={`Tuần cho ${item.class_name}`}
                            value={selected || ''}
                            onChange={(e) =>
                              setSelectedWeeks((current) => ({
                                ...current,
                                [item._id]: e.target.value,
                              }))
                            }
                            className="w-full min-w-[110px] rounded-xl border border-white/75 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-[#1E293B] shadow-sm backdrop-blur-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
                          >
                            <option value="">Chọn tuần</option>
                            {status.weeks.map((week) => (
                              <option key={week.week} value={week.week}>
                                {week.label || week.week}
                              </option>
                            ))}
                          </select>
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
                })
              ) : (
                (catalog?.classes || []).map((source) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {view === 'system' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/80 p-3" aria-label="Đồng bộ hàng loạt">
          <span className="text-xs font-semibold text-blue-800">Đã chọn {selectedLinks.length} lớp</span>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Tuần đồng bộ chung" value={bulkWeek} onChange={(e) => setBulkWeek(e.target.value)} disabled={!selectedLinks.length || bulkSubmitting} className="rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-xs">
              <option value="">Chọn tuần chung</option>
              {commonWeeks.map((week) => <option key={week} value={week}>{week}</option>)}
            </select>
            <button type="button" onClick={() => void syncSelected()} disabled={!selectedLinks.length || !bulkWeek || bulkSubmitting} className="rounded-xl bg-[#1A73E8] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{bulkSubmitting ? 'Đang gửi...' : 'Đồng bộ đã chọn'}</button>
            <button type="button" onClick={() => { setSelectedClassIds(new Set()); setBulkWeek(''); }} disabled={!selectedLinks.length || bulkSubmitting} className="rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 disabled:opacity-40">Xóa lựa chọn</button>
          </div>
        </div>
      )}

      {view === 'system' && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]" aria-label="Phân trang bảng lớp">
          <span>Trang {Math.min(page, totalPages)}/{totalPages} · {filteredClasses.length} lớp</span>
          <div className="flex items-center gap-2">
            <label>Hiển thị <select aria-label="Số dòng mỗi trang" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded border px-1.5 py-1"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select> dòng</label>
            <button type="button" aria-label="Trang trước" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="rounded border px-2 py-1 disabled:opacity-40">‹</button>
            <button type="button" aria-label="Trang sau" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="rounded border px-2 py-1 disabled:opacity-40">›</button>
          </div>
        </div>
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
