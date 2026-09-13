'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { timetableApi, type TimetableFilters, type TimetableOptions, type TimetableSyncJob, type TimetableSyncSettings, type TimetableClassSelection, type TimetableWeekDate, type TimetableClassSyncStatus } from '@/api/timetable-api';
import { changeFilter, emptyFilters, fields, selectionKey } from './timetable-filters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const initial: TimetableSyncSettings = { enabled: false, intervalMinutes: 60, coverage: [] };
const reasons: Record<string, string> = {
  SOURCE_TIMEOUT: 'Nguồn phản hồi quá lâu', SOURCE_UNAVAILABLE: 'Không kết nối được nguồn',
  SOURCE_NOT_CONFIGURED: 'Chưa cấu hình tài khoản nguồn', SOURCE_SESSION_EXPIRED: 'Phiên nguồn hết hạn',
  SOURCE_INVALID_SELECTION: 'Bộ lọc không còn hợp lệ ở nguồn', SOURCE_MARKUP_CHANGED: 'Cấu trúc trang nguồn đã thay đổi',
  SYNC_INTERRUPTED: 'Đồng bộ bị gián đoạn. Có thể đồng bộ lại.', SYNC_FAILED: 'Không lưu được dữ liệu đồng bộ',
};

export default function TimetableSyncPanel({ onSynced }: { onSynced?: () => void }) {
  const { user } = useAuth();
  const isAdmin = String(user?.roleCode || '').toUpperCase() === 'ADMIN';
  const [catalog, setCatalog] = useState<TimetableOptions | null>(null);
  const [selection, setSelection] = useState<TimetableFilters>(emptyFilters);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [settings, setSettings] = useState(initial);
  const [savedSettings, setSavedSettings] = useState(initial);
  const [classStatuses, setClassStatuses] = useState<TimetableClassSyncStatus[]>([]);
  const [job, setJob] = useState<TimetableSyncJob | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusReady, setStatusReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const labels = useRef(new Map<string, string>());
  const onSyncedRef = useRef(onSynced);
  useEffect(() => { onSyncedRef.current = onSynced; }, [onSynced]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    void timetableApi.getSyncStatus().then((data) => {
      if (!active) return;
      const next = data.settings || initial; setSettings(next); setSavedSettings(next); setClassStatuses(data.classStatuses || []); setJob(data.job); setLastUpdate(data.lastSuccessfulUpdate); setStatusReady(true);
    }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [isAdmin]);

  const running = job?.status === 'running' || job?.status === 'pending';
  useEffect(() => {
    if (!isAdmin || !running) return;
    let active = true;
    let pending = false;
    const timer = window.setInterval(() => {
      if (pending) return;
      pending = true;
      void timetableApi.getSyncStatus().then((data) => {
        if (!active) return;
        setJob(data.job); setLastUpdate(data.lastSuccessfulUpdate); setClassStatuses(data.classStatuses || []);
        if (data.job && !['running', 'pending'].includes(data.job.status)) onSyncedRef.current?.();
      }).catch(() => { if (active) setError('Không thể cập nhật tiến trình. Hệ thống sẽ thử lại.'); })
        .finally(() => { pending = false; });
    }, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [isAdmin, running, job?.id]);

  if (!isAdmin) return null;
  const remember = (data: TimetableOptions) => {
    fields.forEach(([field, , optionField]) => data[optionField].forEach((item) => labels.current.set(`${field}:${item.value}`, item.label)));
  };
  const describe = (item: TimetableFilters) => fields.map(([field, label]) => item[field]
    ? `${label}: ${labels.current.get(`${field}:${item[field]}`) || item[field]}` : '').filter(Boolean).join(' · ');

  const loadCatalog = async (next = selection) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const { week: _week, className: _class, ...parents } = next;
      const data = await timetableApi.loadCatalog(parents);
      remember(data); setCatalog(data);
      setWeeks((current) => current.filter((week) => data.weeks.some((item) => item.value === week)));
    } catch (e: unknown) {
      setCatalog(null);
      setError(e instanceof Error ? e.message : 'Không thể tải danh mục nguồn.');
    } finally { setBusy(false); }
  };
  const select = (key: keyof TimetableFilters, value: string) => {
    const next = changeFilter(selection, key, value);
    setSelection(next);
    if (key === 'year' || key === 'semester') setWeeks([]);
    if (key !== 'className') void loadCatalog(next);
  };
  const addCoverage = () => {
    const additions = weeks.map((week) => ({ ...selection, week }));
    const coverage = [...new Map([...settings.coverage, ...additions].map((item) => [selectionKey(item), item])).values()];
    if (coverage.length > 100) { setError('Chỉ được chọn tối đa 100 tổ hợp đồng bộ.'); return; }
    setSettings((current) => ({ ...current, coverage })); setError(''); setMessage('Đã thêm phạm vi. Lưu cấu hình để áp dụng cho lần chạy định kỳ.');
  };
  const addClass = () => {
    if (!selection.year || !selection.semester || !selection.className) { setError('Hãy chọn niên học, học kỳ và lớp cụ thể.'); return; }
    const selected: TimetableClassSelection = { year: selection.year, semester: selection.semester, faculty: selection.faculty || '', course: selection.course || '', className: selection.className };
    const classes = [...new Map([...(settings.selectedClasses || []), selected].map((item) => [JSON.stringify(item), item])).values()];
    if (classes.length > 100) { setError('Chỉ được chọn tối đa 100 lớp.'); return; }
    setSettings((current) => ({ ...current, selectedClasses: classes })); setError(''); setMessage('Đã thêm lớp. Lưu cấu hình để bật tra cứu demand cho lớp này.');
  };
  const toggleRolling = (enabled: boolean) => {
    const sourceDates = catalog?.weekDates || catalog?.weeks.filter((item) => item.startDate && item.endDate).map((item) => ({ year: selection.year, semester: selection.semester, week: item.value, startDate: item.startDate!, endDate: item.endDate! } as TimetableWeekDate)) || [];
    setSettings((current) => ({ ...current, rolling: { enabled, weekDates: enabled ? sourceDates : current.rolling?.weekDates || [] } }));
  };
  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try { const next = await timetableApi.updateSyncSettings(settings); setSettings(next); setSavedSettings(next); setMessage('Đã lưu cấu hình đồng bộ.'); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Không thể lưu cấu hình.'); }
    finally { setBusy(false); }
  };
  const start = async (coverage = settings.coverage) => {
    setBusy(true); setError(''); setMessage('');
    try { setJob(await timetableApi.startSync(coverage)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Không thể bắt đầu đồng bộ.'); }
    finally { setBusy(false); }
  };
  const updateClassDraft = (index: number, patch: Partial<TimetableClassSelection>) => setSettings((current) => ({ ...current, selectedClasses: (current.selectedClasses || []).map((item, i) => i === index ? { ...item, ...patch } : item) }));
  const statusFor = (item: TimetableClassSelection) => classStatuses.find((row) => JSON.stringify(row.classSelection && [row.classSelection.year, row.classSelection.semester, row.classSelection.faculty || '', row.classSelection.course || '', row.classSelection.className]) === JSON.stringify([item.year, item.semester, item.faculty || '', item.course || '', item.className]));

  return <section aria-label="Quản trị đồng bộ thời khóa biểu" className="min-w-0 space-y-3 rounded-2xl border border-white/75 bg-white/45 p-4 shadow-sm shadow-slate-300/40 backdrop-blur-md">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-semibold text-[#1E293B]">Quản trị đồng bộ</h2><p className="text-sm text-[#64748B]">Chọn các tuần và lớp cần cung cấp cho người tra cứu.</p></div>
      <button type="button" aria-expanded={expanded} aria-controls="timetable-sync-config" onClick={() => setExpanded((current) => !current)} className="rounded-xl border border-white/70 bg-white/40 px-3 py-1.5 text-sm font-semibold text-[#1E293B] transition-all duration-150 ease-out motion-reduce:transition-none hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30">{expanded ? 'Thu gọn cấu hình' : 'Mở cấu hình'}</button>
    </div>
    <div className="space-y-2 text-sm">
      {job && <p role="status" className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-[#1A73E8]">{running ? 'Đang đồng bộ' : job.status === 'succeeded' ? 'Đồng bộ hoàn tất' : (job.completed || 0) > 0 ? 'Đồng bộ thành công một phần' : 'Đồng bộ chưa thành công'} · {job.completed || 0}/{job.total || 0} mục hoàn tất · {job.failures?.length || 0} lỗi</p>}
      {lastUpdate && <p className="text-xs text-[#64748B]">Dữ liệu cập nhật gần nhất: {new Date(lastUpdate).toLocaleString('vi-VN')}</p>}
    </div>
    <div id="timetable-sync-config" hidden={!expanded} className="space-y-4 border-t border-white/70 pt-3">
      <button type="button" onClick={() => void loadCatalog()} disabled={busy} className="rounded-xl border border-white/70 bg-white/40 px-3 py-1.5 text-sm font-semibold text-[#1E293B] transition-all duration-150 ease-out motion-reduce:transition-none hover:bg-white/70 disabled:opacity-50">Tải danh mục nguồn</button>
    {expanded && catalog && <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.filter(([field]) => field !== 'week').map(([field, label, optionField]) => <label key={field} className="space-y-1 text-sm font-semibold">
          <span>{label}</span><Select value={selection[field] || ''} onValueChange={(value: string) => select(field, value)}>
            <SelectTrigger aria-label={`Đồng bộ ${label.toLowerCase()}`} disabled={busy || (field !== 'year' && !selection.year) || (!['year', 'semester'].includes(field) && !selection.semester)} className="w-full bg-white/50 backdrop-blur-sm motion-reduce:transition-none">
              <SelectValue placeholder={['year', 'semester'].includes(field) ? `Chọn ${label.toLowerCase()}` : `Tất cả ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent className="z-[60]">
              <SelectItem value="">{['year', 'semester'].includes(field) ? `Chọn ${label.toLowerCase()}` : `Tất cả ${label.toLowerCase()}`}</SelectItem>
              {catalog[optionField].filter((item) => item.value).map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>)}
      </div>
      <fieldset disabled={busy || !selection.year || !selection.semester} className="space-y-2">
        <legend className="text-sm font-semibold">Tuần cần đồng bộ</legend>
        <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-white/70 bg-white/50 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.weeks.map((week) => <label key={week.value} className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={weeks.includes(week.value)} onChange={(e) => setWeeks((current) => e.target.checked ? [...current, week.value] : current.filter((value) => value !== week.value))} />
            {week.label}
          </label>)}
        </div>
      </fieldset>
      <button type="button" onClick={addCoverage} disabled={busy || !statusReady || !selection.year || !selection.semester || !weeks.length}
        className="rounded-xl border border-white/70 bg-white/40 px-4 py-2 text-sm font-semibold text-[#1E293B] transition-all duration-150 ease-out motion-reduce:transition-none hover:bg-white/70 disabled:opacity-50">Thêm phạm vi ({weeks.length} tuần)</button>
    </>}
    <div className="space-y-2">
      <p className="text-sm font-semibold">Phạm vi đã chọn: {settings.coverage.length}/100</p>
      <p className="text-xs text-slate-600">Có thể thêm nhiều lớp một lần. Việc lưu lớp không tự tải lịch cho mọi tuần; demand chỉ tải đúng tuần người dùng yêu cầu.</p>
      <button type="button" onClick={addClass} disabled={busy || !statusReady || !selection.year || !selection.semester || !selection.className} className="rounded-xl border border-white/70 bg-white/40 px-4 py-2 text-sm font-semibold text-[#1E293B] transition-all duration-150 ease-out hover:bg-white/70 disabled:opacity-50">Thêm lớp đã chọn</button>
      {!!settings.selectedClasses?.length && <div className="overflow-x-auto rounded-xl border border-white/70 bg-white/50"><table className="min-w-[720px] w-full text-left text-sm"><caption className="p-2 text-left font-semibold">Cấu hình đã lưu theo lớp</caption><thead><tr className="border-t border-white/70"><th className="p-2">Lớp</th><th className="p-2">Nguồn</th><th className="p-2">Số tuần</th><th className="p-2">Tuần đích</th><th className="p-2">Trạng thái</th><th className="p-2">Thao tác</th></tr></thead><tbody>{settings.selectedClasses.map((item, index) => { const row = statusFor(item); const saved = savedSettings.selectedClasses?.find((value) => JSON.stringify(value) === JSON.stringify(item)); return <tr key={`${item.year}-${item.semester}-${item.className}-${index}`} className="border-t border-white/70 align-top"><td className="p-2 font-semibold">{item.className}<div className="text-xs font-normal text-slate-600">{item.year}/{item.semester}</div></td><td className="p-2">{[item.faculty, item.course].filter(Boolean).join(' · ') || 'Tất cả'}</td><td className="p-2"><input aria-label={`Số tuần lớp ${index + 1}`} type="number" min={1} max={100} value={item.weekCount || 1} disabled={busy} onChange={(e) => updateClassDraft(index, { weekCount: Number(e.target.value) })} className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1" /></td><td className="p-2">{row?.targetWeeks?.join(', ') || (row?.error || 'Chưa xác định')}</td><td className="p-2">{row?.status || 'Chưa lưu'}</td><td className="p-2"><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || JSON.stringify(saved) === JSON.stringify(item)} onClick={() => void save()} className="rounded-lg border px-2 py-1 disabled:opacity-50">Lưu</button><button type="button" disabled={busy || !saved} onClick={() => saved && void timetableApi.startSavedClassSync(saved).then(setJob).catch((e: Error) => setError(e.message))} className="rounded-lg bg-[#1A73E8] px-2 py-1 text-white disabled:opacity-50">Đồng bộ</button><button type="button" aria-label={`Bỏ lớp ${index + 1}`} disabled={busy} onClick={() => setSettings((current) => ({ ...current, selectedClasses: (current.selectedClasses || []).filter((_, i) => i !== index) }))} className="rounded-lg px-2 py-1 text-rose-700">Bỏ</button></div></td></tr>})}</tbody></table></div>}
      {settings.coverage.length > 0 && <ul aria-label="Phạm vi đồng bộ" className="max-h-48 space-y-2 overflow-y-auto">
        {settings.coverage.map((item, index) => <li key={selectionKey(item)} className="flex items-start justify-between gap-2 rounded-xl border border-white/70 bg-white/50 p-2 text-sm">
          <span>{describe(item)}{!item.className && ' · Tất cả lớp'}</span>
          <button type="button" aria-label={`Bỏ phạm vi ${index + 1}`} disabled={busy} onClick={() => setSettings((current) => ({ ...current, coverage: current.coverage.filter((_, i) => i !== index) }))} className="shrink-0 rounded-xl px-2 py-1 text-rose-700 transition-all duration-150 ease-out motion-reduce:transition-none hover:bg-rose-500/10">Bỏ</button>
        </li>)}
      </ul>}
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Khoảng đồng bộ (phút)<input aria-label="Khoảng đồng bộ" type="number" min={30} max={10080} value={settings.intervalMinutes}
        disabled={busy || !statusReady} onChange={(e) => setSettings({ ...settings, intervalMinutes: Number(e.target.value) })} className="ml-2 h-9 w-24 rounded-xl border border-white/70 bg-white/50 px-2 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30" /></label>
      <label className="text-sm"><input type="checkbox" disabled={busy || !statusReady} checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} /> Bật định kỳ</label>
      <label className="text-sm"><input type="checkbox" disabled={busy || !statusReady} checked={settings.rolling?.enabled || false} onChange={(e) => toggleRolling(e.target.checked)} /> Bật cuốn tuần hiện tại/kế tiếp</label>
      <button type="button" onClick={() => void save()} disabled={busy || !statusReady || (!settings.coverage.length && !settings.selectedClasses?.length) || !Number.isInteger(settings.intervalMinutes) || settings.intervalMinutes < 30 || settings.intervalMinutes > 10080} className="rounded-xl border border-white/70 bg-white/40 px-3 py-1.5 text-sm font-semibold text-[#1E293B] transition-all duration-150 ease-out motion-reduce:transition-none hover:bg-white/70 disabled:opacity-50">Lưu cấu hình</button>
      <button type="button" onClick={() => void start()} disabled={busy || !statusReady || !settings.coverage.length || running} className="rounded-xl bg-[#1A73E8] px-3 py-1.5 text-sm font-bold text-white transition-all duration-150 ease-out motion-reduce:transition-none hover:scale-[1.01] motion-reduce:hover:scale-100 hover:bg-blue-700 disabled:opacity-50">Đồng bộ ngay</button>
    </div>
    {job && <div className="space-y-2 text-sm">
      {job.error && <p className="text-amber-800">{reasons[job.error] || 'Tiến trình bị gián đoạn. Vui lòng đồng bộ lại.'}</p>}
      {job.error === 'SYNC_INTERRUPTED' && !!job.coverage?.length && <div className="space-y-1">
        <p className="text-[#64748B]">Chạy lại toàn bộ phạm vi cũ, bao gồm phần đã thành công, để không bỏ sót lịch chưa xử lý.</p>
        <button type="button" disabled={busy || running} onClick={() => void start(job.coverage!)} className="rounded-xl border border-white/70 bg-white/60 px-3 py-1.5 transition-all duration-150 ease-out hover:bg-white/80 disabled:opacity-50">Chạy lại job gián đoạn</button>
      </div>}
      {!!job.failures?.length && <>
        <ul aria-label="Phạm vi đồng bộ lỗi" className="max-h-40 space-y-1 overflow-y-auto text-red-700">{job.failures.map((failure) => <li key={selectionKey(failure.coverage)}>{describe(failure.coverage)}: {reasons[failure.reason] || 'Đồng bộ thất bại'}</li>)}</ul>
        <button type="button" disabled={busy || running} onClick={() => void start(job.failures!.map((failure) => failure.coverage))} className="rounded-xl border border-white/70 bg-white/60 px-3 py-1.5 transition-all duration-150 ease-out hover:bg-white/80 disabled:opacity-50">Thử lại phạm vi lỗi</button>
      </>}
    </div>}
    {settings.rolling?.enabled && !settings.rolling.weekDates?.length && <p role="alert" className="text-sm text-amber-800">Nguồn chưa cung cấp ngày tuần. Hãy nhập bản đồ tuần/ngày đã được kiểm chứng để bật cuốn tuần; tra cứu thủ công và demand vẫn hoạt động.</p>}
    {message && <p role="status" className="text-sm text-purple-700">{message}</p>}
    {error && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-700">{error}</p>}
    </div>
  </section>;
}
