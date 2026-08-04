'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Check, Plus, RefreshCw, Search as SearchIcon, X } from 'lucide-react';
import { Building, CreateDormRegistrationInput, dormitoryApi, DormRegistration } from '@/api/dormitory-api';
import { studentApi, Student } from '@/api/student-api';
import { semesterApi, Semester } from '@/api/semester-api';
import { useAuth } from '@/providers/auth-provider';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import ResponsiveDataView, { ResponsiveColumn } from '@/components/ui/ResponsiveDataView';
import FloatingActionBar from '@/components/ui/FloatingActionBar';
import { CustomPagination } from '@/components/ui/pagination';
import { Research } from '@/components/ui/Research';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';

const pageSizeOptions = [20, 40, 50, 100];
const statusColors: Record<string, string> = {
  'Chờ duyệt': 'bg-amber-100 text-amber-700', 'Đã duyệt': 'bg-green-100 text-green-700', 'Từ chối': 'bg-red-100 text-red-700',
};
const studentName = (r: DormRegistration) => r.student_id?.full_name || r.public_registration?.ho_ten || (r as any).ho_ten || '—';
const studentCode = (r: DormRegistration) => r.student_id?.student_code || r.public_registration?.ma_sinh_vien || (r as any).ma_sinh_vien || 'Chưa có mã SV';

export type ActiveSemesterValues = { ky_hoc: string; nam_hoc: string };

export function mapActiveSemester(semesters: Semester[]): ActiveSemesterValues {
  const active = semesters.filter(semester => semester.status === 'active');
  if (active.length !== 1) throw new Error(active.length ? 'Có nhiều học kỳ đang active. Vui lòng kiểm tra cấu hình học kỳ.' : 'Chưa có học kỳ active. Vui lòng cấu hình học kỳ trước khi đăng ký.');
  const match = active[0].semester_name.trim().match(/^(HK[12]|Hè|[12])\s*-\s*(\d{4})\s*-\s*(\d{4})$/i);
  if (!match) throw new Error(`Không đọc được định dạng học kỳ active: ${active[0].semester_name}`);
  return { ky_hoc: match[1].toUpperCase() === 'HÈ' ? 'Hè' : match[1].toUpperCase(), nam_hoc: `${match[2]}-${match[3]}` };
}

type CreateForm = ActiveSemesterValues & {
  ngay_sinh: string;
  gioi_tinh: '' | 'Male' | 'Female' | 'Other';
  so_dien_thoai: string;
  doi_tuong_uu_tien: '' | 'Xa nhà' | 'Khó khăn';
  loai_phong: 'Thường' | 'Máy lạnh';
  building_id: string;
  ghi_chu: string;
};

const emptyCreateForm = (): CreateForm => ({ ky_hoc: '', nam_hoc: '', ngay_sinh: '', gioi_tinh: '', so_dien_thoai: '', doi_tuong_uu_tien: '', loai_phong: 'Thường', building_id: '', ghi_chu: '' });
const dateInputValue = (value?: string | Date) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const dateLabel = (value: string) => {
  if (!value) return 'Chọn ngày sinh';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Chọn ngày sinh' : date.toLocaleDateString('vi-VN');
};

export default function RegistrationsPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('DORM_REG_CREATE');
  const [registrations, setRegistrations] = useState<DormRegistration[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); const [source, setSource] = useState('');
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(40);
  const [selected, setSelected] = useState<string[]>([]); const [rejectId, setRejectId] = useState<string | null>(null); const [rejectReason, setRejectReason] = useState('');
  const [meta, setMeta] = useState<{ total: number; totalPages: number } | null>(null); const [refreshing, setRefreshing] = useState(false); const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null); const mobileScrollRef = useRef<HTMLDivElement>(null); const mobileSentinelRef = useRef<HTMLDivElement>(null);
  const [mobileLoadingMore, setMobileLoadingMore] = useState(false); const mobilePageRef = useRef(1); const mobileHasMoreRef = useRef(true);
  const [createOpen, setCreateOpen] = useState(false); const [createSaving, setCreateSaving] = useState(false); const [createError, setCreateError] = useState(''); const [semesterError, setSemesterError] = useState(''); const [semesterLoading, setSemesterLoading] = useState(false); const [activeSemesterName, setActiveSemesterName] = useState(''); const [calendarOpen, setCalendarOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState(''); const [studentOptions, setStudentOptions] = useState<Student[]>([]); const [student, setStudent] = useState<Student | null>(null);
  const [buildingOptions, setBuildingOptions] = useState<Building[]>([]);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);

  useEffect(() => { if (mobileSearchOpen) searchRef.current?.focus(); }, [mobileSearchOpen]);
  useEffect(() => {
    if (!createOpen || !studentSearch.trim() || student) { setStudentOptions([]); return; }
    const timer = window.setTimeout(async () => {
      try { const result = await studentApi.getStudents({ search: studentSearch.trim(), page: 1, limit: 10, status: 'Studying' }); setStudentOptions(Array.isArray(result) ? result : result.data || []); } catch { setStudentOptions([]); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [createOpen, studentSearch, student]);
  useEffect(() => {
    if (!createOpen || buildingOptions.length) return;
    void dormitoryApi.buildings.getAll({ limit: 100 }).then(result => setBuildingOptions(result.data || [])).catch(() => setBuildingOptions([]));
  }, [createOpen, buildingOptions.length]);
  useEffect(() => {
    if (!createOpen) return;
    let cancelled = false;
    setSemesterLoading(true); setSemesterError('');
    void semesterApi.getSemesters().then(items => { if (!cancelled) { const values = mapActiveSemester(items); const active = items.find(semester => semester.status === 'active'); setActiveSemesterName(active?.semester_name || ''); setCreateForm(current => ({ ...current, ...values })); } }).catch((err: any) => { if (!cancelled) { setActiveSemesterName(''); setSemesterError(err?.message || 'Không thể tải học kỳ active.'); setCreateForm(current => ({ ...current, ky_hoc: '', nam_hoc: '' })); } }).finally(() => { if (!cancelled) setSemesterLoading(false); });
    return () => { cancelled = true; };
  }, [createOpen]);
  const resetCreate = () => { setStudent(null); setStudentSearch(''); setStudentOptions([]); setCreateError(''); setSemesterError(''); setActiveSemesterName(''); setCalendarOpen(false); setCreateForm(emptyCreateForm()); };
  const selectStudent = (item: Student) => { setStudent(item); setStudentSearch(''); setStudentOptions([]); setCreateForm(current => ({ ...current, ngay_sinh: dateInputValue(item.date_bir), gioi_tinh: item.sex, loai_phong: item.sex === 'Female' ? current.loai_phong : 'Thường', so_dien_thoai: (item as Student & { phone_number?: string }).phone_number || '' })); };
  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault(); setCreateError('');
    const birthDate = createForm.ngay_sinh ? new Date(`${createForm.ngay_sinh}T00:00:00`) : null;
    if (!student || !createForm.ky_hoc || !createForm.nam_hoc || semesterError || semesterLoading) { setCreateError('Vui lòng chọn sinh viên và chờ học kỳ active được tải thành công.'); return; }
    if (!birthDate || Number.isNaN(birthDate.getTime()) || birthDate >= new Date()) { setCreateError('Ngày sinh phải là một ngày hợp lệ trong quá khứ.'); return; }
    if (!createForm.gioi_tinh || !createForm.so_dien_thoai.trim()) { setCreateError('Vui lòng nhập đủ ngày sinh, giới tính và số điện thoại.'); return; }
    if (!/^[0-9+().\s-]{8,20}$/.test(createForm.so_dien_thoai.trim())) { setCreateError('Số điện thoại không hợp lệ.'); return; }
    const payload: CreateDormRegistrationInput = { student_id: student._id, ky_hoc: createForm.ky_hoc, nam_hoc: createForm.nam_hoc, ngay_sinh: createForm.ngay_sinh, gioi_tinh: createForm.gioi_tinh, so_dien_thoai: createForm.so_dien_thoai.trim(), doi_tuong_uu_tien: createForm.doi_tuong_uu_tien || undefined };
    const nguyen_vong = { loai_phong: createForm.gioi_tinh === 'Female' ? createForm.loai_phong : 'Thường', building_id: createForm.building_id || undefined, ghi_chu: createForm.ghi_chu || undefined };
    if (Object.values(nguyen_vong).some(Boolean)) payload.nguyen_vong = nguyen_vong;
    try { setCreateSaving(true); await dormitoryApi.registrations.create(payload); toast.success('Đã tạo đơn đăng ký KTX'); setCreateOpen(false); resetCreate(); reset(); await load(true); } catch (err: any) { setCreateError(err?.message || 'Không thể tạo đơn đăng ký.'); } finally { setCreateSaving(false); }
  };
  const reset = () => { setPage(1); setSelected([]); mobilePageRef.current = 1; mobileHasMoreRef.current = true; };
  const load = useCallback(async (background = false) => { try { background ? setRefreshing(true) : setLoading(true); setError(''); const res = await dormitoryApi.registrations.getAll({ trang_thai: filterStatus || undefined, source: source || undefined, search: search.trim() || undefined, page, limit: pageSize }); setRegistrations(res.data); setMeta(res.meta); } catch (err: any) { setError(err?.message || 'Không thể tải danh sách đăng ký.'); toast.error(err?.message || 'Lỗi tải danh sách đăng ký'); } finally { setLoading(false); setRefreshing(false); } }, [filterStatus, source, search, page, pageSize]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 200); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { mobilePageRef.current = 1; mobileHasMoreRef.current = true; }, [filterStatus, source, search, pageSize]);
  const loadMoreMobile = useCallback(async () => {
    if (mobileLoadingMore || !mobileHasMoreRef.current) return;
    setMobileLoadingMore(true);
    const nextPage = mobilePageRef.current + 1;
    try {
      const res = await dormitoryApi.registrations.getAll({ trang_thai: filterStatus || undefined, source: source || undefined, search: search.trim() || undefined, page: nextPage, limit: pageSize });
      const next = res.data || [];
      setRegistrations(current => [...current, ...next.filter(item => !current.some(row => row._id === item._id))]);
      mobilePageRef.current = nextPage;
      mobileHasMoreRef.current = next.length === pageSize && nextPage * pageSize < res.meta.total;
    } catch { setError('Không thể tải thêm đăng ký.'); } finally { setMobileLoadingMore(false); }
  }, [filterStatus, source, search, pageSize, mobileLoadingMore]);
  useEffect(() => {
    const target = mobileSentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void loadMoreMobile(); }, { root: mobileScrollRef.current, rootMargin: '160px', threshold: 0.1 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMoreMobile]);
  const pendingIds = useMemo(() => registrations.filter(r => r.trang_thai === 'Chờ duyệt' && r.source !== 'PUBLIC').map(r => r._id), [registrations]);
  const allSelected = pendingIds.length > 0 && pendingIds.every(id => selected.includes(id));
  const toggleAll = (checked: boolean) => setSelected(checked ? pendingIds : []);
  const approve = async (id: string) => { try { await dormitoryApi.registrations.approve(id, { trang_thai: 'Đã duyệt' }); toast.success('Đã duyệt đơn đăng ký'); void load(true); } catch (err: any) { toast.error(err?.message || 'Lỗi duyệt đơn'); } };
  const reject = async () => { if (!rejectId || !rejectReason) return; try { await dormitoryApi.registrations.approve(rejectId, { trang_thai: 'Từ chối', ly_do_tu_choi: rejectReason }); toast.success('Đã từ chối đơn đăng ký'); setRejectId(null); setRejectReason(''); void load(true); } catch (err: any) { toast.error(err?.message || 'Lỗi từ chối đơn'); } };
  const bulkApprove = async () => { if (!selected.length) return; try { const res = await dormitoryApi.registrations.bulkApprove({ registration_ids: selected, trang_thai: 'Đã duyệt' }); toast.success(`Đã duyệt ${res.success} đơn${res.failed ? `, ${res.failed} lỗi` : ''}`); setSelected([]); void load(true); } catch (err: any) { toast.error(err?.message || 'Lỗi duyệt hàng loạt'); } };
  const columns: ResponsiveColumn<DormRegistration>[] = [
    { key: 'ma_dk', header: 'Mã ĐK', priority: 'primary' }, { key: 'student', header: 'Sinh viên', priority: 'secondary', render: (_, r) => <><div className="font-semibold text-slate-800">{studentName(r)}</div><div className="text-xs text-slate-400">{studentCode(r)}</div></> },
    { key: 'period', header: 'Kỳ/Năm', render: (_, r) => `${r.ky_hoc} / ${r.nam_hoc}` }, { key: 'priority', header: 'Ưu tiên', render: (_, r) => r.doi_tuong_uu_tien || '—' },
    { key: 'status', header: 'Trạng thái', render: (_, r) => <div className="flex flex-wrap gap-1"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusColors[r.trang_thai] || 'bg-slate-100 text-slate-600'}`}>{r.trang_thai}</span><span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-700">{r.source === 'PUBLIC' ? 'QR' : 'Chính thức'}</span>{r.classification_status === 'UNCLASSIFIED' && <span className="text-xs text-amber-600">Chưa phân lớp</span>}</div> },
    { key: 'created', header: 'Ngày tạo', render: (_, r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '—' },
    { key: 'actions', header: 'Thao tác', priority: 'action', render: (_, r) => r.source !== 'PUBLIC' && r.trang_thai === 'Chờ duyệt' ? <div className="flex gap-1"><button aria-label="Duyệt" title="Duyệt" onClick={() => void approve(r._id)} className="rounded-xl p-1.5 text-green-600 hover:bg-green-50"><Check size={16} /></button><button aria-label="Từ chối" title="Từ chối" onClick={() => setRejectId(r._id)} className="rounded-xl p-1.5 text-red-600 hover:bg-red-50"><X size={16} /></button></div> : null },
  ];
  return <main className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto bg-transparent p-4 custom-scrollbar sm:p-6">
    {mobileSearchOpen ? (
      <div className="flex w-full items-center gap-1 py-0.5 sm:hidden">
        <Research ref={searchRef} aria-label="Tìm kiếm đăng ký" placeholder="Tìm kiếm..." value={search} onChange={e => { setSearch(e.target.value); reset(); }} containerClassName="flex-1 w-full max-w-none" />
        <Button type="button" variant="outline" aria-label="Đóng tìm kiếm" title="Đóng" onClick={() => setMobileSearchOpen(false)} className="h-9 w-9 shrink-0 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700"><X size={16} /></Button>
      </div>
    ) : (
      <div className="flex shrink-0 items-center justify-start gap-1 overflow-x-auto scrollbar-none py-0.5 w-full flex-nowrap">
        <Research aria-label="Tìm kiếm đăng ký" placeholder="Tìm kiếm..." value={search} onChange={e => { setSearch(e.target.value); reset(); }} containerClassName="hidden sm:flex shrink-0 w-[231px]" />
        <Button type="button" variant="outline" aria-label="Mở tìm kiếm" title="Tìm kiếm" onClick={() => setMobileSearchOpen(true)} className="flex sm:hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700"><SearchIcon size={15} /></Button>
        <div className="ml-auto flex items-center gap-2 shrink-0 flex-nowrap">
          <Select value={filterStatus || 'ALL'} onValueChange={v => { setFilterStatus(v === 'ALL' ? '' : v); reset(); }}>
            <SelectTrigger aria-label="Lọc trạng thái" className="h-9 min-w-[140px] rounded-xl border border-white/80 bg-white/60 px-3 text-xs font-semibold text-slate-700 shadow-none"><SelectValue placeholder="Tất cả trạng thái" /></SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-md border border-white/70 shadow-xl rounded-xl z-[100]">
              <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
              <SelectItem value="Chờ duyệt">Chờ duyệt</SelectItem>
              <SelectItem value="Đã duyệt">Đã duyệt</SelectItem>
              <SelectItem value="Từ chối">Từ chối</SelectItem>
            </SelectContent>
          </Select>
          <Select value={source || 'ALL'} onValueChange={v => { setSource(v === 'ALL' ? '' : v); reset(); }}>
            <SelectTrigger aria-label="Lọc nguồn" className="h-9 min-w-[115px] rounded-xl border border-white/80 bg-white/60 px-3 text-xs font-semibold text-slate-700 shadow-none"><SelectValue placeholder="Tất cả nguồn" /></SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-md border border-white/70 shadow-xl rounded-xl z-[100]">
              <SelectItem value="ALL">Tất cả nguồn</SelectItem>
              <SelectItem value="FORMAL">Chính thức</SelectItem>
              <SelectItem value="PUBLIC">QR</SelectItem>
            </SelectContent>
          </Select>
          {canCreate && <Button type="button" aria-label="Thêm sinh viên" onClick={() => setCreateOpen(true)} className="h-9 shrink-0 rounded-xl px-3 text-xs"><Plus size={14} /> <span className="hidden sm:inline">Thêm sinh viên</span></Button>}
          <Button type="button" variant="outline" aria-label="Tải lại danh sách" title="Tải lại" onClick={() => void load(true)} disabled={refreshing} className="h-9 w-9 shrink-0 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /></Button>
        </div>
      </div>
    )}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/70 bg-white/45 shadow-sm shadow-slate-300/40 backdrop-blur-md"><ResponsiveDataView data={registrations} columns={columns} isLoading={loading} keyExtractor={r => r._id} mobileScrollRef={mobileScrollRef} hidePaginationOnMobile mobileFooter={<div ref={mobileSentinelRef} className="py-3 text-center text-xs text-slate-500">{mobileLoadingMore ? 'Đang tải thêm...' : !mobileHasMoreRef.current && registrations.length ? 'Đã hiển thị tất cả bản ghi.' : null}</div>} selection={{ selectedKeys: selected, onSelectRow: (key, checked) => setSelected(ids => checked ? [...ids, key] : ids.filter(id => id !== key)), onSelectAll: toggleAll, allSelected }} emptyState={<div className="p-8 text-center text-sm text-slate-500">Chưa có đơn đăng ký nào</div>} pagination={<CustomPagination totalItems={meta?.total || 0} pageSize={pageSize} currentPage={page} onPageChange={p => { setPage(p); setSelected([]); }} onPageSizeChange={s => { setPage(1); setPageSize(s); setSelected([]); }} pageSizeOptions={pageSizeOptions} isLoading={loading} label="đơn đăng ký" />} /></div>
    <FloatingActionBar selectedCount={selected.length} onClear={() => setSelected([])} itemLabel="đơn" actions={<button type="button" onClick={() => void bulkApprove()} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"><Check size={14} /> Duyệt</button>} />
    {rejectId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRejectId(null)}><div role="dialog" aria-labelledby="reject-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}><h2 id="reject-title" className="mb-4 text-lg font-bold text-gray-800">Từ chối đơn đăng ký</h2><textarea aria-label="Lý do từ chối" placeholder="Nhập lý do từ chối..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" rows={3} /><div className="flex gap-3"><button onClick={() => setRejectId(null)} className="flex-1 rounded-lg border px-4 py-2 text-sm">Hủy</button><button onClick={() => void reject()} disabled={!rejectReason} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50">Từ chối</button></div></div></div>}
    <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open && !createSaving) resetCreate(); }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl bg-white/45 p-6 shadow-sm shadow-slate-300/40 backdrop-blur-md sm:max-w-4xl">
        <DialogHeader className="mb-4 border-b border-white/50 pb-3">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-sm font-black uppercase tracking-wider text-[#1E293B]">
            <span>Thêm sinh viên đăng ký KTX</span>
            {activeSemesterName && <span className="text-[11px] font-semibold normal-case text-[#64748B]">{activeSemesterName}</span>}
            {semesterLoading && <span className="text-[11px] font-semibold normal-case text-[#64748B]">Đang tải học kỳ...</span>}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submitCreate} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-4 rounded-2xl border border-white/70 bg-white/35 p-4 shadow-sm">
              <div className="relative">
                <Input label="Sinh viên" required id="registration-student" value={student ? `${student.student_code} — ${student.full_name}` : studentSearch} onChange={e => { setStudent(null); setStudentSearch(e.target.value); }} placeholder="Tìm theo mã hoặc họ tên" autoComplete="off" />
                {studentOptions.length > 0 && <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-white/80 bg-white shadow-xl">{studentOptions.map(item => <Button variant="ghost" type="button" key={item._id} onClick={() => selectStudent(item)} className="h-auto w-full justify-start rounded-none px-3 py-2 text-left text-sm"><span className="font-semibold">{item.student_code} — {item.full_name}</span><span className="ml-2 text-xs text-slate-500">{typeof item.class_id === 'object' ? item.class_id?.class_name : ''}</span></Button>)}</div>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex w-full flex-col gap-1.5">
                  <label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Ngày sinh <span className="text-red-500">*</span></label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="h-10 w-full justify-between rounded-xl border border-white/70 bg-white/50 px-3 text-sm font-normal text-[#1E293B] hover:bg-white/70"><span className="truncate">{dateLabel(createForm.ngay_sinh)}</span><Calendar size={15} className="shrink-0 text-[#64748B]" /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="z-[100] w-auto overflow-hidden border-none bg-transparent p-0 shadow-none" align="start">
                      <CustomCalendar
                        startDate={createForm.ngay_sinh ? new Date(`${createForm.ngay_sinh}T00:00:00`) : null}
                        endDate={null}
                        onRangeSelect={(start) => setCreateForm(f => ({ ...f, ngay_sinh: dateInputValue(start) }))}
                        onRangeConfirm={(start, end) => setCreateForm(f => {
                          const startValue = dateInputValue(start);
                          const endValue = end ? dateInputValue(end) : '';
                          return { ...f, ngay_sinh: endValue && startValue === f.ngay_sinh ? endValue : startValue };
                        })}
                        onCancel={() => setCalendarOpen(false)}
                        onConfirm={() => setCalendarOpen(false)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5"><label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Giới tính <span className="text-red-500">*</span></label><Select value={createForm.gioi_tinh} onValueChange={value => setCreateForm(f => ({ ...f, gioi_tinh: value as CreateForm['gioi_tinh'], loai_phong: value === 'Female' ? f.loai_phong : 'Thường' }))}><SelectTrigger aria-label="Giới tính" className="w-full"><SelectValue placeholder="Chọn giới tính" /></SelectTrigger><SelectContent><SelectItem value="Male">Nam</SelectItem><SelectItem value="Female">Nữ</SelectItem><SelectItem value="Other">Khác</SelectItem></SelectContent></Select></div>
              </div>
              <Input label="Số điện thoại" required type="tel" value={createForm.so_dien_thoai} onChange={e => setCreateForm(f => ({ ...f, so_dien_thoai: e.target.value }))} placeholder="Nhập số điện thoại" />
            </section>
            <section className="space-y-4 rounded-2xl border border-white/70 bg-white/35 p-4 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Đối tượng ưu tiên</label><Select value={createForm.doi_tuong_uu_tien || 'NONE'} onValueChange={value => setCreateForm(f => ({ ...f, doi_tuong_uu_tien: value === 'NONE' ? '' : value as CreateForm['doi_tuong_uu_tien'] }))}><SelectTrigger aria-label="Đối tượng ưu tiên" className="w-full"><SelectValue placeholder="Không" /></SelectTrigger><SelectContent><SelectItem value="NONE">Không</SelectItem><SelectItem value="Xa nhà">Xa nhà</SelectItem><SelectItem value="Khó khăn">Khó khăn</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Loại phòng</label><Select value={createForm.loai_phong} disabled={createForm.gioi_tinh !== 'Female'} onValueChange={value => setCreateForm(f => ({ ...f, loai_phong: value as CreateForm['loai_phong'] }))}><SelectTrigger aria-label="Loại phòng" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Thường">Thường</SelectItem><SelectItem value="Máy lạnh">Máy lạnh (Ưu tiên cho nữ)</SelectItem></SelectContent></Select></div>
              </div>
              <div className="space-y-1.5"><label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Tòa nhà</label><Select value={createForm.building_id || 'NONE'} onValueChange={value => setCreateForm(f => ({ ...f, building_id: value === 'NONE' ? '' : value }))}><SelectTrigger aria-label="Tòa nhà" className="w-full"><SelectValue placeholder="Không chọn" /></SelectTrigger><SelectContent><SelectItem value="NONE">Không chọn</SelectItem>{buildingOptions.map(building => <SelectItem key={building._id} value={building._id}>{building.ma_toa_nha} — {building.ten}</SelectItem>)}</SelectContent></Select></div>
              <Input label="Ghi chú" multiline rows={3} value={createForm.ghi_chu} onChange={e => setCreateForm(f => ({ ...f, ghi_chu: e.target.value }))} />
            </section>
          </div>
          {(createError || semesterError) && <p role="alert" className="text-sm text-red-600">{createError || semesterError}</p>}
          <DialogFooter className="mt-2 border-t border-white/50 pt-4"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createSaving}>Hủy</Button><Button type="submit" disabled={createSaving || semesterLoading || Boolean(semesterError) || !createForm.ky_hoc}>{createSaving ? 'Đang lưu...' : 'Tạo đăng ký'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </main>;
}
