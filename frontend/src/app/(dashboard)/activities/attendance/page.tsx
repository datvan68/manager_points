'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Calendar as CalendarIcon, Download } from 'lucide-react';
import { activityAttendanceApi, ActivityAttendance } from '@/api/activity-api';
import { RouteGuard } from '@/components/guards/RouteGuard';
import ResponsiveDataView, { ResponsiveColumn } from '@/components/ui/ResponsiveDataView';
import FloatingActionBar from '@/components/ui/FloatingActionBar';
import { CustomPagination } from '@/components/ui/pagination';
import { Research } from '@/components/ui/Research';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const pageSizeOptions = [20, 40, 50, 100];
type DateRange = { start: Date; end: Date } | null;

const display = (value: any, fallback = '—') => {
  if (!value) return fallback;
  if (typeof value !== 'object') return String(value);
  return value.class_name || value.name || value.title || value.full_name || value.student_code || value._id || fallback;
};

const attendanceLabel = (value?: string) => value === 'present' || value === 'late' ? 'Có mặt' : value === 'absent' ? 'Vắng mặt' : value || '—';
const approvalLabel = (value?: string) => value === 'pending' ? 'Bản nháp' : value === 'approved' ? 'Chính thức' : value === 'rejected' ? 'Từ chối' : value || '—';

function statusBadge(value?: string) {
  const present = value === 'present' || value === 'late';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${present ? 'bg-emerald-100 text-emerald-700' : value === 'absent' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{attendanceLabel(value)}</span>;
}

const toDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ActivitiesAttendancePage() {
  const [items, setItems] = useState<ActivityAttendance[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(40);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [approval, setApproval] = useState('');
  const [status, setStatus] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let cancelled = false;
      setLoading(true); setError('');
      activityAttendanceApi.getAll({
        page, limit: pageSize, search: search.trim() || undefined,
        approval_status: approval || undefined, status: status || undefined,
        start_date: dateRange ? toDateParam(dateRange.start) : undefined,
        end_date: dateRange ? toDateParam(dateRange.end) : undefined,
      }).then((result) => { if (!cancelled) { setItems(result.items || []); setTotal(result.total || 0); } })
        .catch((err) => { if (!cancelled) setError(err?.message || 'Không thể tải danh sách điểm danh.'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, 250);
    return () => window.clearTimeout(timer);
  }, [page, pageSize, search, approval, status, dateRange]);

  const resetPageAndSelection = () => { setPage(1); setSelectedIds([]); };
  const pageIds = useMemo(() => items.map((row) => row._id), [items]);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const selectAll = (checked: boolean) => setSelectedIds((ids) => checked ? Array.from(new Set([...ids, ...pageIds])) : ids.filter((id) => !pageIds.includes(id)));
  const exportSelected = () => {
    const rows = items.filter((row) => selectedIds.includes(row._id)).map((row) => ({
      'Hoạt động': display(row.activity_id), 'Lịch': display(row.schedule_id), 'Sinh viên': display(row.student_id),
      'Lớp': display(row.class_id), 'Có mặt': attendanceLabel(row.status), 'Trạng thái': approvalLabel(row.approval_status),
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
    { key: 'approval_status', header: 'Trạng thái', render: (value) => approvalLabel(value) },
    { key: 'recorded_at', header: 'Ghi nhận', render: (value) => value ? new Date(value).toLocaleString('vi-VN') : '—' },
  ];

  return <RouteGuard requiredPermission="ACTIVITY_ATTENDANCE_READ" fallbackPath="/activities">
    <main className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto bg-transparent p-4 custom-scrollbar sm:p-6">
      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Research aria-label="Tìm kiếm điểm danh" placeholder="Tìm kiếm..." value={search} onChange={(event) => { setSearch(event.target.value); resetPageAndSelection(); }} containerClassName="max-w-none sm:max-w-[231px]" />
          <select aria-label="Lọc trạng thái có mặt" value={status} onChange={(event) => { setStatus(event.target.value); resetPageAndSelection(); }} className="h-9 rounded-xl border border-white/80 bg-white/60 px-3 text-xs font-semibold text-slate-700"><option value="">Tất cả có mặt</option><option value="present">Có mặt</option><option value="absent">Vắng mặt</option><option value="late">Đi muộn</option><option value="excused">Có phép</option></select>
          <select aria-label="Lọc trạng thái duyệt" value={approval} onChange={(event) => { setApproval(event.target.value); resetPageAndSelection(); }} className="h-9 rounded-xl border border-white/80 bg-white/60 px-3 text-xs font-semibold text-slate-700"><option value="">Tất cả trạng thái</option><option value="pending">Bản nháp</option><option value="approved">Chính thức</option><option value="rejected">Từ chối</option></select>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}><PopoverTrigger asChild><Button variant="outline" aria-label="Lọc theo khoảng ngày" className="h-9 shrink-0 rounded-xl border border-white/80 bg-white/50 px-3 text-xs font-semibold text-slate-700"><CalendarIcon className="mr-1.5 h-3.5 w-3.5" />{dateRange ? `${dateRange.start.toLocaleDateString('vi-VN')} - ${dateRange.end.toLocaleDateString('vi-VN')}` : 'Chọn khoảng ngày'}</Button></PopoverTrigger><PopoverContent className="w-auto border-none bg-transparent p-0 shadow-none" align="end"><CustomCalendar startDate={dateRange?.start || null} endDate={dateRange?.end || null} onRangeSelect={(start, end) => setDateRange({ start, end })} onCancel={() => { setDateRange(null); resetPageAndSelection(); setCalendarOpen(false); }} onConfirm={() => { resetPageAndSelection(); setCalendarOpen(false); }} /></PopoverContent></Popover>
        </div>
      </div>
      {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/70 bg-white/45 shadow-sm shadow-slate-300/40 backdrop-blur-md">
        <ResponsiveDataView data={items} columns={columns} isLoading={loading} keyExtractor={(row) => row._id} selection={{ selectedKeys: selectedIds, onSelectRow: (key, checked) => setSelectedIds((ids) => checked ? [...ids, key] : ids.filter((id) => id !== key)), onSelectAll: selectAll, allSelected }} emptyState={<div className="p-8 text-center text-sm text-slate-500">Chưa có dữ liệu điểm danh.</div>} pagination={<CustomPagination totalItems={total} pageSize={pageSize} currentPage={page} onPageChange={setPage} onPageSizeChange={(size) => { setPage(1); setPageSize(size); setSelectedIds([]); }} pageSizeOptions={pageSizeOptions} isLoading={loading} label="bản ghi" />} />
      </div>
      <FloatingActionBar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])} itemLabel="bản ghi" actions={<button type="button" onClick={exportSelected} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"><Download size={14} /> Xuất Excel</button>} />
    </main>
  </RouteGuard>;
}
