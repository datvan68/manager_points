'use client';

import { useEffect, useState } from 'react';
import { activityAttendanceApi, ActivityAttendance } from '@/api/activity-api';
import { RouteGuard } from '@/components/guards/RouteGuard';
import ResponsiveDataView, { ResponsiveColumn } from '@/components/ui/ResponsiveDataView';

const labelStatus = (value?: string) => value === 'approved' ? 'Chính thức' : value === 'pending' ? 'Bản nháp' : value || '—';
const display = (value: any, fallback = '—') => typeof value === 'object' && value ? (value.name || value.title || value.full_name || value.class_name || value.student_code || value._id || fallback) : value || fallback;

export default function ActivitiesAttendancePage() {
  const [items, setItems] = useState<ActivityAttendance[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [approval, setApproval] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const limit = 20;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    activityAttendanceApi.getAll({ page, limit, ...(approval ? { approval_status: approval } : {}) })
      .then((result) => { if (!cancelled) { setItems(result.items || []); setTotal(result.total || 0); } })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Không thể tải danh sách điểm danh.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, approval]);

  const columns: ResponsiveColumn<ActivityAttendance>[] = [
    { key: 'activity', header: 'Hoạt động', priority: 'primary', render: (_, row) => display(row.activity_id) },
    { key: 'schedule', header: 'Lịch', priority: 'secondary', render: (_, row) => display(row.schedule_id) },
    { key: 'student', header: 'Sinh viên', render: (_, row) => display(row.student_id) },
    { key: 'class', header: 'Lớp', render: (_, row) => display(row.class_id) },
    { key: 'status', header: 'Có mặt', render: (value) => value || '—' },
    { key: 'approval_status', header: 'Trạng thái', render: (value) => labelStatus(value) },
    { key: 'recorded_at', header: 'Ghi nhận', render: (value) => value ? new Date(value).toLocaleString('vi-VN') : '—' },
  ];

  const pages = Math.max(1, Math.ceil(total / limit));
  return <RouteGuard requiredPermission="ACTIVITY_ATTENDANCE_READ" fallbackPath="/activities">
    <main className="p-4 sm:p-6 space-y-4 overflow-y-auto h-full custom-scrollbar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-lg font-black text-slate-800">Tổng hợp điểm danh</h1><p className="text-xs text-slate-500">Danh sách điểm danh của tất cả hoạt động</p></div>
        <select value={approval} onChange={(e) => { setPage(1); setApproval(e.target.value); }} className="h-9 rounded-xl border border-white/80 bg-white/60 px-3 text-xs">
          <option value="">Tất cả trạng thái</option><option value="pending">Bản nháp</option><option value="approved">Chính thức</option>
        </select>
      </div>
      {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <ResponsiveDataView data={items} columns={columns} isLoading={loading} keyExtractor={(row) => row._id} emptyState={<div className="p-8 text-center text-sm text-slate-500">Chưa có dữ liệu điểm danh.</div>} />
      <div className="flex items-center justify-between text-xs text-slate-600"><span>{total} bản ghi</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Trước</button><span className="py-1">Trang {page}/{pages}</span><button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Sau</button></div></div>
    </main>
  </RouteGuard>;
}
