'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, RefreshCw, Search as SearchIcon, X } from 'lucide-react';
import { dormitoryApi, DormRegistration } from '@/api/dormitory-api';
import { toast } from 'sonner';
import ResponsiveDataView, { ResponsiveColumn } from '@/components/ui/ResponsiveDataView';
import FloatingActionBar from '@/components/ui/FloatingActionBar';
import { CustomPagination } from '@/components/ui/pagination';
import { Research } from '@/components/ui/Research';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const pageSizeOptions = [20, 40, 50, 100];
const statusColors: Record<string, string> = {
  'Chờ duyệt': 'bg-amber-100 text-amber-700', 'Đã duyệt': 'bg-green-100 text-green-700', 'Từ chối': 'bg-red-100 text-red-700',
};
const studentName = (r: DormRegistration) => r.student_id?.full_name || r.public_registration?.ho_ten || (r as any).ho_ten || '—';
const studentCode = (r: DormRegistration) => r.student_id?.student_code || r.public_registration?.ma_sinh_vien || (r as any).ma_sinh_vien || 'Chưa có mã SV';

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<DormRegistration[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); const [source, setSource] = useState('');
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(40);
  const [selected, setSelected] = useState<string[]>([]); const [rejectId, setRejectId] = useState<string | null>(null); const [rejectReason, setRejectReason] = useState('');
  const [meta, setMeta] = useState<{ total: number; totalPages: number } | null>(null); const [refreshing, setRefreshing] = useState(false); const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null); const mobileScrollRef = useRef<HTMLDivElement>(null); const mobileSentinelRef = useRef<HTMLDivElement>(null);
  const [mobileLoadingMore, setMobileLoadingMore] = useState(false); const mobilePageRef = useRef(1); const mobileHasMoreRef = useRef(true);

  useEffect(() => { if (mobileSearchOpen) searchRef.current?.focus(); }, [mobileSearchOpen]);
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
    {mobileSearchOpen ? <div className="flex gap-1 sm:hidden"><Research ref={searchRef} aria-label="Tìm kiếm đăng ký" value={search} onChange={e => { setSearch(e.target.value); reset(); }} containerClassName="max-w-none flex-1" /><Button variant="outline" aria-label="Đóng tìm kiếm" onClick={() => setMobileSearchOpen(false)} className="h-9 w-9 p-0"><X size={15} /></Button></div> : <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto py-0.5 scrollbar-none"><Research aria-label="Tìm kiếm đăng ký" placeholder="Tìm kiếm..." value={search} onChange={e => { setSearch(e.target.value); reset(); }} containerClassName="hidden shrink-0 sm:flex" /><Button variant="outline" aria-label="Mở tìm kiếm" onClick={() => setMobileSearchOpen(true)} className="h-9 w-9 shrink-0 p-0 sm:hidden"><SearchIcon size={15} /></Button><div className="ml-auto flex shrink-0 gap-2"><Select value={filterStatus || 'ALL'} onValueChange={v => { setFilterStatus(v === 'ALL' ? '' : v); reset(); }}><SelectTrigger aria-label="Lọc trạng thái" className="h-9 min-w-[140px] rounded-xl text-xs"><SelectValue placeholder="Tất cả trạng thái" /></SelectTrigger><SelectContent><SelectItem value="ALL">Tất cả trạng thái</SelectItem><SelectItem value="Chờ duyệt">Chờ duyệt</SelectItem><SelectItem value="Đã duyệt">Đã duyệt</SelectItem><SelectItem value="Từ chối">Từ chối</SelectItem></SelectContent></Select><Select value={source || 'ALL'} onValueChange={v => { setSource(v === 'ALL' ? '' : v); reset(); }}><SelectTrigger aria-label="Lọc nguồn" className="h-9 min-w-[105px] rounded-xl text-xs"><SelectValue placeholder="Tất cả nguồn" /></SelectTrigger><SelectContent><SelectItem value="ALL">Tất cả nguồn</SelectItem><SelectItem value="FORMAL">Chính thức</SelectItem><SelectItem value="PUBLIC">QR</SelectItem></SelectContent></Select><Button variant="outline" aria-label="Tải lại danh sách" onClick={() => void load(true)} disabled={refreshing} className="h-9 w-9 shrink-0 rounded-xl p-0"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /></Button></div></div>}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/70 bg-white/45 shadow-sm backdrop-blur-md"><ResponsiveDataView data={registrations} columns={columns} isLoading={loading} keyExtractor={r => r._id} mobileScrollRef={mobileScrollRef} hidePaginationOnMobile mobileFooter={<div ref={mobileSentinelRef} className="py-3 text-center text-xs text-slate-500">{mobileLoadingMore ? 'Đang tải thêm...' : !mobileHasMoreRef.current && registrations.length ? 'Đã hiển thị tất cả bản ghi.' : null}</div>} selection={{ selectedKeys: selected, onSelectRow: (key, checked) => setSelected(ids => checked ? [...ids, key] : ids.filter(id => id !== key)), onSelectAll: toggleAll, allSelected }} emptyState={<div className="p-8 text-center text-sm text-slate-500">Chưa có đơn đăng ký nào</div>} pagination={<CustomPagination totalItems={meta?.total || 0} pageSize={pageSize} currentPage={page} onPageChange={p => { setPage(p); setSelected([]); }} onPageSizeChange={s => { setPage(1); setPageSize(s); setSelected([]); }} pageSizeOptions={pageSizeOptions} isLoading={loading} label="đơn đăng ký" />} /></div>
    <FloatingActionBar selectedCount={selected.length} onClear={() => setSelected([])} itemLabel="đơn" actions={<button type="button" onClick={() => void bulkApprove()} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"><Check size={14} /> Duyệt</button>} />
    {rejectId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRejectId(null)}><div role="dialog" aria-labelledby="reject-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}><h2 id="reject-title" className="mb-4 text-lg font-bold text-gray-800">Từ chối đơn đăng ký</h2><textarea aria-label="Lý do từ chối" placeholder="Nhập lý do từ chối..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" rows={3} /><div className="flex gap-3"><button onClick={() => setRejectId(null)} className="flex-1 rounded-lg border px-4 py-2 text-sm">Hủy</button><button onClick={() => void reject()} disabled={!rejectReason} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50">Từ chối</button></div></div></div>}
  </main>;
}
