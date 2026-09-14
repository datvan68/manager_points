'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { classApi, type Class } from '@/api/class-api';
import { timetableApi, type TimetableBulkWeekSyncRequest, type TimetableClassLink, type TimetableClassSyncStatus, type TimetableFilters, type TimetableOptions, type TimetableSyncJob, type TimetableSyncSettings } from '@/api/timetable-api';
import FloatingActionBar from '@/components/ui/FloatingActionBar';
import { CustomPagination } from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TimetableWeekPopover from './TimetableWeekPopover';

const emptySettings: TimetableSyncSettings = { enabled: false, intervalMinutes: 60, coverage: [], selectedClasses: [], classLinks: [] };
const normalize = (value: unknown) => String(value || '').normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
const selectionKey = (item: { year: string; semester: string; faculty?: string; course?: string; className?: string }) => JSON.stringify([item.year, item.semester, item.faculty || '', item.course || '', item.className || '']);
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
type BulkPairState = {
  pair: TimetableBulkWeekSyncRequest;
  key: string;
  baseline: string | null;
  wasValid: boolean;
  result: 'pending' | 'success' | 'failed' | 'skipped';
  failure?: string;
};
type BulkProgress = {
  runId: number;
  phase: 'processing' | 'completed' | 'partial' | 'request-error' | 'tracking-error';
  pairs: BulkPairState[];
  message?: string;
};
const bulkPairKey = (pair: TimetableBulkWeekSyncRequest) => `${selectionKey(pair)}|${pair.week}`;

export default function TimetableSyncPanel({
  onSynced,
  active = true,
}: {
  onSynced?: () => void;
  active?: boolean;
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
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(() => new Set());
  const [bulkWeek, setBulkWeek] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const mounted = useRef(true);
  const callback = useRef(onSynced);
  const pollTimers = useRef(new Map<string, number>());
  const bulkPollTimers = useRef(new Map<string, number>());
  const bulkRun = useRef(0);

  useEffect(() => {
    callback.current = onSynced;
  }, [onSynced]);

  useEffect(
    () => () => {
      mounted.current = false;
      pollTimers.current.forEach((timer) => window.clearTimeout(timer));
      bulkPollTimers.current.forEach((timer) => window.clearTimeout(timer));
      bulkRun.current += 1;
    },
    []
  );

  useEffect(() => {
    if (bulkProgress && bulkProgress.phase !== 'processing') setBulkSubmitting(false);
  }, [bulkProgress?.phase]);

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
    let cancelled = false;
    const reportError = (e: Error) => { if (!cancelled) setError(e.message); };
    void classApi.getClasses().then((roster) => {
      if (!cancelled) setClasses(roster);
    }).catch(reportError);
    void timetableApi.loadCatalog({}).then((initialCatalog) => {
      if (!cancelled) setCatalog(initialCatalog);
    }).catch(reportError);
    void timetableApi.getSyncStatus()
      .then((data) => {
        if (cancelled) return;
        const next = data.settings || emptySettings;
        setSettingsReady(true);
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
      .catch(reportError)
      .finally(() => { if (!cancelled) setSettingsLoading(false); });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = 5000;
    const hasActiveJob = () => Boolean(job && activeStatuses.includes(job.status)) || statuses.some((row) => activeStatuses.includes(row.status));
    const poll = async () => {
      if (cancelled || !mounted.current || document.visibilityState !== 'visible' || !hasActiveJob()) return;
      const ok = await refreshStatuses();
      delay = ok ? 5000 : Math.min(delay * 2, 30000);
      if (!cancelled && mounted.current && document.visibilityState === 'visible' && hasActiveJob()) timer = setTimeout(() => void poll(), delay);
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') { delay = 5000; void poll(); } };
    document.addEventListener('visibilitychange', onVisibility);
    if (hasActiveJob() && document.visibilityState === 'visible') timer = setTimeout(() => void poll(), delay);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisibility); if (timer) clearTimeout(timer); };
  }, [isAdmin, active, job?.status, statuses]);

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
    if (!settingsReady) return;
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
  const bulkCounters = useMemo(() => {
    const pairs = bulkProgress?.pairs || [];
    return {
      processed: pairs.filter((pair) => pair.result !== 'pending').length,
      success: pairs.filter((pair) => pair.result === 'success').length,
      failed: pairs.filter((pair) => pair.result === 'failed').length,
      skipped: pairs.filter((pair) => pair.result === 'skipped').length,
    };
  }, [bulkProgress]);
  const bulkPercentage = bulkProgress?.pairs.length
    ? Math.min(100, Math.max(0, Math.floor((bulkCounters.processed / bulkProgress.pairs.length) * 100)))
    : 0;

  const clearBulkTimers = () => {
    bulkPollTimers.current.forEach((timer) => window.clearTimeout(timer));
    bulkPollTimers.current.clear();
  };

  const updateBulkPair = (runId: number, key: string, update: Partial<BulkPairState>) => {
    if (!mounted.current || bulkRun.current !== runId) return;
    setBulkProgress((current) => {
      if (!current || current.runId !== runId) return current;
      const pairs = current.pairs.map((pair) => pair.key === key ? { ...pair, ...update } : pair);
      const finished = pairs.every((pair) => pair.result !== 'pending');
      return { ...current, pairs, phase: finished ? (pairs.some((pair) => pair.result === 'failed') ? 'partial' : 'completed') : current.phase };
    });
  };

  const pollBulkPair = async (runId: number, pair: BulkPairState): Promise<void> => {
    if (!mounted.current || bulkRun.current !== runId) return;
    try {
      const result = await timetableApi.getSavedClassWeekStatus({ ...pair.pair, week: pair.pair.week });
      if (!mounted.current || bulkRun.current !== runId) return;
      if (result.status === 'failed') {
        updateBulkPair(runId, pair.key, { result: 'failed', failure: result.failure || 'Đồng bộ thất bại.' });
      } else if (result.status === 'missing') {
        updateBulkPair(runId, pair.key, { result: 'failed', failure: 'Không có kết quả đồng bộ.' });
      } else if (result.status === 'valid') {
        if (pair.wasValid && !pair.baseline) {
          setBulkProgress((current) => current?.runId === runId ? { ...current, phase: 'tracking-error', message: 'Không thể xác định kết quả mới của một cặp vì trạng thái hợp lệ cũ không có mốc cập nhật.' } : current);
          clearBulkTimers();
        } else if (!pair.wasValid || result.lastSuccessfulUpdate !== pair.baseline) {
          updateBulkPair(runId, pair.key, { result: 'success' });
        } else {
          const timer = window.setTimeout(() => void pollBulkPair(runId, pair), 2000);
          bulkPollTimers.current.set(pair.key, timer);
        }
      } else {
        const timer = window.setTimeout(() => void pollBulkPair(runId, pair), 2000);
        bulkPollTimers.current.set(pair.key, timer);
      }
    } catch (e: unknown) {
      if (!mounted.current || bulkRun.current !== runId) return;
      clearBulkTimers();
      setBulkProgress((current) => current?.runId === runId ? { ...current, phase: 'tracking-error', message: e instanceof Error ? e.message : 'Không thể theo dõi trạng thái đồng bộ.' } : current);
    }
  };

  const startBulkSync = async (pairs: TimetableBulkWeekSyncRequest[]) => {
    const runId = ++bulkRun.current;
    clearBulkTimers();
    const initialPairs = pairs.map((pair) => {
      const week = statuses.find((row) => selectionKey(row.classSelection) === selectionKey(pair))?.weeks.find((item) => item.week === pair.week);
      return { pair, key: bulkPairKey(pair), baseline: week?.lastSuccessfulUpdate || null, wasValid: week?.status === 'valid', result: 'pending' as const };
    });
    setBulkSubmitting(true);
    setBulkProgress({ runId, phase: 'processing', pairs: initialPairs });
    try {
      const result = await timetableApi.syncSavedClassWeeks(pairs);
      if (!mounted.current || bulkRun.current !== runId) return;
      const outcomes = result.outcomes || [];
      const nextPairs = initialPairs.map((pair) => {
        const outcome = outcomes.find((item) => item.key === pair.key || (item.selection.week === pair.pair.week && selectionKey(item.selection) === selectionKey(pair.pair)));
        return outcome && outcome.status !== 'accepted' ? { ...pair, result: 'skipped' as const, failure: outcome.status === 'cooldown' ? 'Đang trong thời gian chờ.' : 'Yêu cầu đã được gộp vào lần đồng bộ khác.' } : pair;
      });
      setBulkProgress({ runId, phase: nextPairs.every((pair) => pair.result !== 'pending') ? 'completed' : 'processing', pairs: nextPairs });
      await refreshStatuses();
      nextPairs.filter((pair) => pair.result === 'pending').forEach((pair) => void pollBulkPair(runId, pair));
    } catch (e: unknown) {
      if (!mounted.current || bulkRun.current !== runId) return;
      clearBulkTimers();
      setBulkProgress({ runId, phase: 'request-error', pairs: initialPairs, message: e instanceof Error ? e.message : 'Không thể đồng bộ các lớp đã chọn.' });
    }
  };

  const syncSelected = async () => {
    if (bulkSubmitting || !bulkWeek || !selectedLinks.length || !commonWeeks.includes(bulkWeek)) return;
    setError(''); setMessage('');
    await startBulkSync(selectedLinks.map((link) => ({ ...link, week: bulkWeek })));
  };

  if (!isAdmin) return null;

  return (
    <section
      aria-label="Quản trị đồng bộ thời khóa biểu"
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden"
    >
      {settingsLoading && <p role="status">Đang tải cấu hình đã lưu…</p>}
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
          <Select deferOptions
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
          <Select deferOptions
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
                  <Select deferOptions
                    value={period.year || 'NONE'}
                    onValueChange={(value: string) => void changePeriod('year', value === 'NONE' ? '' : value)}
                  >
                    <SelectTrigger
                      aria-label="year"
                      disabled={!settingsReady}
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
                  <Select deferOptions
                    value={period.semester || 'NONE'}
                    onValueChange={(value: string) => void changePeriod('semester', value === 'NONE' ? '' : value)}
                  >
                    <SelectTrigger
                      aria-label="semester"
                      disabled={!settingsReady}
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
                    disabled={busy || !settingsReady || !catalog || !period.year || !period.semester}
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
                        disabled={!settingsReady}
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
                    disabled={busy || !settingsReady}
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
                          <Select deferOptions
                            value={path.faculty || 'NONE'}
                            onValueChange={(value: string) =>
                              void setPath(item, 'faculty', value === 'NONE' ? '' : value)
                            }
                          >
                            <SelectTrigger
                              aria-label={`Khoa nguồn cho ${item.class_name}`}
                              disabled={!settingsReady}
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
                          <Select deferOptions
                            value={path.course || 'NONE'}
                            onValueChange={(value: string) =>
                              void setPath(item, 'course', value === 'NONE' ? '' : value)
                            }
                          >
                            <SelectTrigger
                              aria-label={`Khóa nguồn cho ${item.class_name}`}
                              disabled={!settingsReady || !path.faculty}
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
                          <Select deferOptions
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
                              disabled={!settingsReady || !path.faculty || !path.course}
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
                            <Select deferOptions
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
                                  <SelectItem
                                    key={week.week}
                                    value={week.week}
                                    label={week.label || week.week}
                                    aria-label={`${week.label || week.week} · ${statusLabel(week.status)}`}
                                  >
                                    <span className="flex min-w-0 items-center justify-between gap-3">
                                      <span className="truncate">{week.label || week.week}</span>
                                      <span>{' · '}</span>
                                      <span
                                        className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${statusBadgeClass(week.status)}`}
                                      >
                                        {statusLabel(week.status)}
                                      </span>
                                    </span>
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
              <TimetableWeekPopover
                links={selectedLinks}
                statuses={statuses}
                disabled={bulkSubmitting}
                onSubmit={async (pairs) => { setError(''); setMessage(''); await startBulkSync(pairs); }}
              />
              <div className="flex items-center gap-1.5" aria-label="Đồng bộ nhanh tương thích">
                <Select deferOptions value={bulkWeek || 'NONE'} onValueChange={(value: string) => setBulkWeek(value === 'NONE' ? '' : value)}>
                  <SelectTrigger aria-label="Tuần đồng bộ chung" disabled={!selectedLinks.length || bulkSubmitting} className="h-8 w-[140px] rounded-xl border-blue-200 bg-white px-2.5 py-1 text-xs"><SelectValue placeholder="Chọn tuần chung" /></SelectTrigger>
                  <SelectContent className="z-[10000]"><SelectItem value="NONE">Chọn tuần chung</SelectItem>{commonWeeks.map((week) => <SelectItem key={week} value={week}>{week}</SelectItem>)}</SelectContent>
                </Select>
                <button type="button" onClick={() => void syncSelected()} disabled={!selectedLinks.length || !bulkWeek || bulkSubmitting} className="rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1A73E8] disabled:opacity-40">Đồng bộ đã chọn</button>
              </div>
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
      <Dialog
        open={Boolean(bulkProgress)}
        onOpenChange={(open) => {
          if (!open && bulkProgress?.phase !== 'processing') {
            bulkRun.current += 1;
            clearBulkTimers();
            setBulkProgress(null);
          }
        }}
      >
        <DialogContent
          showCloseButton={bulkProgress?.phase !== 'processing'}
          onEscapeKeyDown={(event) => { if (bulkProgress?.phase === 'processing') event.preventDefault(); }}
          onPointerDownOutside={(event) => { if (bulkProgress?.phase === 'processing') event.preventDefault(); }}
          onInteractOutside={(event) => { if (bulkProgress?.phase === 'processing') event.preventDefault(); }}
          className="w-[calc(100%-1rem)] max-w-xl rounded-2xl border border-white/75 bg-white/45 p-4 text-[#1E293B] shadow-sm shadow-slate-300/40 backdrop-blur-md sm:p-5"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              {bulkProgress?.phase === 'processing' ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" /> : bulkProgress?.phase === 'completed' ? <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" /> : <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />}
              Tiến độ đồng bộ tuần
            </DialogTitle>
            <DialogDescription className="text-[#64748B]">
              {bulkProgress?.phase === 'processing' ? 'Đang theo dõi kết quả thực tế từ máy chủ.' : bulkProgress?.phase === 'request-error' ? 'Không gửi được yêu cầu đồng bộ.' : bulkProgress?.phase === 'tracking-error' ? 'Không thể xác nhận tiến độ từ máy chủ.' : bulkProgress?.phase === 'partial' ? 'Hoàn tất một phần.' : 'Đã xử lý xong các cặp lớp-tuần.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span>{bulkCounters.processed}/{bulkProgress?.pairs.length || 0} cặp đã xử lý</span>
              <span>{bulkPercentage}%</span>
            </div>
            <div role="progressbar" aria-label="Tiến độ đồng bộ tuần" aria-valuemin={0} aria-valuemax={bulkProgress?.pairs.length || 0} aria-valuenow={bulkCounters.processed} aria-valuetext={`${bulkPercentage}%`} className="h-2 overflow-hidden rounded-xl bg-blue-500/10">
              <div className="h-full rounded-xl bg-[#1A73E8] transition-[width] duration-150 motion-reduce:transition-none" style={{ width: `${bulkPercentage}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl border border-white/75 bg-white/50 px-3 py-2"><span className="block text-[#64748B]">Thành công</span><strong>{bulkCounters.success}</strong></div>
              <div className="rounded-xl border border-white/75 bg-white/50 px-3 py-2"><span className="block text-[#64748B]">Thất bại</span><strong>{bulkCounters.failed}</strong></div>
              <div className="rounded-xl border border-white/75 bg-white/50 px-3 py-2"><span className="block text-[#64748B]">Bỏ qua</span><strong>{bulkCounters.skipped}</strong></div>
            </div>
            {bulkProgress?.message && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{bulkProgress.message}</p>}
          </div>
          <DialogFooter>
            <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold" disabled={bulkProgress?.phase === 'processing'} onClick={() => { bulkRun.current += 1; clearBulkTimers(); setBulkProgress(null); }}>Đóng</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
