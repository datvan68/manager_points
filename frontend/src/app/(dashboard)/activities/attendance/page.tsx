'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import { activityAttendanceApi, ActivityAttendance } from '@/api/activity-api';
import { RouteGuard } from '@/components/guards/RouteGuard';
import ResponsiveDataView, { ResponsiveColumn } from '@/components/ui/ResponsiveDataView';
import FloatingActionBar from '@/components/ui/FloatingActionBar';
import { CustomPagination } from '@/components/ui/pagination';

const pageSizeOptions = [20, 40, 50, 100];

const display = (value: any, fallback = '—') => {
  if (!value) return fallback;
  if (typeof value !== 'object') return String(value);
  return value.class_name || value.name || value.title || value.full_name || value.student_code || value._id || fallback;
};

const attendanceLabel = (value?: string) => value === 'present' || value === 'late' ? 'Có mặt' : value === 'absent' ? 'Vắng mặt' : value || '—';

function statusBadge(value?: string) {
  const present = value === 'present' || value === 'late';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${present ? 'bg-emerald-100 text-emerald-700' : value === 'absent' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{attendanceLabel(value)}</span>;
}

export default function ActivitiesAttendancePage() {
  const [items, setItems] = useState<ActivityAttendance[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(40);
  const [total, setTotal] = useState(0);
  const [approval, setApproval] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    activityAttendanceApi.getAll({ page, limit: pageSize, ...(approval ? { approval_status: approval } : {}) })
      .then((result) => { if (!cancelled) { setItems(result.items || []); setTotal(result.total || 0); } })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Không thể tải danh sách điểm danh.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, pageSize, approval]);

  const pageIds = useMemo(() => items.map((row) => row._id), [items]);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const selectAll = (checked: boolean) => setSelectedIds((ids) => checked ? Array.from(new Set([...ids, ...pageIds])) : ids.filter((id) => !pageIds.includes(id)));
  const exportSelected = () => {
    const rows = items.filter((row) => selectedIds.includes(row._id)).map((row) => ({
      'Hoạt động': display(row.activity_id), 'Lịch': display(row.schedule_id), 'Sinh viên': display(row.student_id),
      'Lớp': display(row.class_id), 'Có mặt': attendanceLabel(row.status), 'Trạng thái': row.approval_status === 'pending' ? 'Bản nháp' : row.approval_status === 'approved' ? 'Chính thức' : row.approval_status,
      'Ghi nhận': row.recorded_at ? new Date(row.recorded_at).toLocaleString('vi-VN') : '—',
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Điểm danh');
    XLSX.writeFile(workbook, 'danh-sach-diem-danh.xlsx');
  };

  const columns: ResponsiveColumn<ActivityAttendance>[] = [
    { key: 'activity', header: 'Hoạt động', priority: 'primary', render: (_, row) => display(row.activity_id) },
    { key: 'schedule', header: 'Lịch', priority: 'secondary', render: (_, row) => display(row.schedule_id) },
    { key: 'student', header: 'Sinh viên', render: (_, row) => display(row.student_id) },
    { key: 'class', header: 'Lớp', render: (_, row) => display(row.class_id) },
    { key: 'status', header: 'Có mặt', render: (value) => statusBadge(value) },
    { key: 'approval_status', header: 'Trạng thái', render: (value) => value === 'pending' ? 'Bản nháp' : value === 'approved' ? 'Chính thức' : value || '—' },
    { key: 'recorded_at', header: 'Ghi nhận', render: (value) => value ? new Date(value).toLocaleString('vi-VN') : '—' },
  ];

  return <RouteGuard requiredPermission="ACTIVITY_ATTENDANCE_READ" fallbackPath="/activities">
    <main className="p-4 sm:p-6 space-y-4 overflow-y-auto h-full custom-scrollbar">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-lg font-black text-slate-800">Tổng hợp điểm danh</h1><p className="text-xs text-slate-500">Danh sách điểm danh của tất cả hoạt động</p></div><select aria-label="Lọc trạng thái" value={approval} onChange={(e) => { setPage(1); setApproval(e.target.value); }} className="h-9 rounded-xl border border-white/80 bg-white/60 px-3 text-xs"><option value="">Tất cả trạng thái</option><option value="pending">Bản nháp</option><option value="approved">Chính thức</option></select></div>
      {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <ResponsiveDataView data={items} columns={columns} isLoading={loading} keyExtractor={(row) => row._id} selection={{ selectedKeys: selectedIds, onSelectRow: (key, checked) => setSelectedIds((ids) => checked ? [...ids, key] : ids.filter((id) => id !== key)), onSelectAll: selectAll, allSelected }} emptyState={<div className="p-8 text-center text-sm text-slate-500">Chưa có dữ liệu điểm danh.</div>} pagination={<CustomPagination totalItems={total} pageSize={pageSize} currentPage={page} onPageChange={setPage} onPageSizeChange={(size) => { setPage(1); setPageSize(size); }} pageSizeOptions={pageSizeOptions} isLoading={loading} label="bản ghi" />} />
      <FloatingActionBar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])} itemLabel="bản ghi" actions={<button type="button" onClick={exportSelected} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"><Download size={14} /> Xuất Excel</button>} />
    </main>
  </RouteGuard>;
}
