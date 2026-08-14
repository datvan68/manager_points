'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw, Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { dormitoryApi, UnclassifiedRegistration } from '@/api/dormitory-api';
import ResponsiveDataView, { ResponsiveColumn } from '@/components/ui/ResponsiveDataView';
import { CustomPagination } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('vi-VN') : '—';

export default function UnclassifiedStudentsPage() {
  const router = useRouter();
  const [items, setItems] = useState<UnclassifiedRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(40);
  const [meta, setMeta] = useState<{ total: number; totalPages: number } | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (background = false) => {
    const id = ++requestId.current;
    if (background) setRefreshing(true); else setLoading(true);
    try {
      const result = await dormitoryApi.registrations.getUnclassified({ search: search.trim() || undefined, page, limit: pageSize });
      if (id !== requestId.current) return;
      setItems(result.data);
      setMeta(result.meta);
    } catch (error: any) {
      if (id === requestId.current) toast.error(error?.message || 'Không thể tải danh sách chưa phân loại');
    } finally {
      if (id === requestId.current) { setLoading(false); setRefreshing(false); }
    }
  }, [page, pageSize, search]);

  useEffect(() => { void load(); }, [load]);

  const columns: ResponsiveColumn<UnclassifiedRegistration>[] = [
    { key: 'full_name', header: 'HỌ VÀ TÊN', priority: 'primary', render: value => <span className="font-semibold text-slate-800">{value || '—'}</span> },
    { key: 'phone_number', header: 'LIÊN HỆ', priority: 'secondary', render: value => value || '—' },
    { key: 'room_code', header: 'PHÒNG', priority: 'metadata', render: (_, row) => row.room_code || 'Chưa xếp phòng' },
    { key: 'source', header: 'NGUỒN', priority: 'metadata', render: value => value === 'PUBLIC' ? 'QR' : 'Thủ công' },
    { key: 'status', header: 'TRẠNG THÁI', priority: 'metadata', render: value => <span className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-700">{value || 'Chưa phân loại'}</span> },
    { key: 'createdAt', header: 'NGÀY TẠO', priority: 'secondary', render: value => formatDate(value) },
  ];

  return <main className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto bg-transparent p-4 custom-scrollbar sm:p-6">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" aria-label="Quay lại danh sách lớp" onClick={() => router.back()} className="h-9 w-9 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700"><ArrowLeft size={16} /></Button>
        <div><h1 className="text-xl font-bold text-slate-800">Chưa phân loại</h1><p className="text-sm text-slate-500">Đăng ký KTX chưa có mã sinh viên hoặc lớp</p></div>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="Tìm kiếm chưa phân loại" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm theo tên, điện thoại..." className="h-9 w-56 rounded-xl border border-white/80 bg-white/60 pl-9 pr-3 text-sm outline-none" /></div>
        <Button type="button" variant="outline" aria-label="Tải lại danh sách" onClick={() => void load(true)} disabled={refreshing} className="h-9 w-9 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /></Button>
      </div>
    </div>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/45 shadow-sm shadow-slate-300/40 backdrop-blur-md">
      <ResponsiveDataView data={items} columns={columns} isLoading={loading} keyExtractor={row => row._id} emptyState={<div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-slate-500"><Users size={24} className="text-amber-500" />Không có đăng ký chưa phân loại</div>} pagination={<CustomPagination totalItems={meta?.total || 0} pageSize={pageSize} currentPage={page} onPageChange={setPage} onPageSizeChange={size => { setPage(1); setPageSize(size); }} pageSizeOptions={[20, 40, 50, 100]} isLoading={loading} label="bản ghi" />} />
    </div>
  </main>;
}
