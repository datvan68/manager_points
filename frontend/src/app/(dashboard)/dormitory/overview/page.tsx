'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BedDouble,
  Building2,
  ClipboardCheck,
  DoorOpen,
  ReceiptText,
  RefreshCw,
  Search,
  Users,
  Wind,
  Wrench,
} from 'lucide-react';
import {
  dormitoryApi,
  DormDashboardStats,
  DormitoryRoomRow,
  DormitoryRoomState,
} from '@/api/dormitory-api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-white/75 bg-white/45 p-5 shadow-sm shadow-slate-300/30 backdrop-blur-md ${className}`}>
      {children}
    </section>
  );
}

interface StatProps {
  label: string;
  value: number | string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  iconBg?: string;
  iconColor?: string;
}

function Stat({ label, value, hint, icon: Icon, iconBg, iconColor }: StatProps) {
  return (
    <div className="group flex h-full flex-col justify-between rounded-2xl border border-white/80 bg-gradient-to-br from-white/60 to-white/40 p-3 sm:p-3.5 shadow-xs shadow-slate-200/40 backdrop-blur-md transition-all duration-150 hover:bg-white/70 hover:shadow-md hover:scale-[1.01]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 truncate">{label}</span>
        {Icon && (
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg || 'bg-slate-100/80'} ${iconColor || 'text-slate-600'} border border-white/80 shadow-2xs`}>
            <Icon size={14} />
          </div>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <div className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
          {value}
        </div>
        {hint && (
          <span className="inline-flex items-center rounded-md bg-white/80 border border-white/90 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600 shadow-2xs">
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

const stateConfig: Record<
  DormitoryRoomState,
  {
    ringColor: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    dotColor: string;
  }
> = {
  'Trống': {
    ringColor: '#10b981',
    badgeBg: 'bg-emerald-50/80',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200/70',
    dotColor: 'bg-emerald-500',
  },
  'Còn chỗ': {
    ringColor: '#6366f1',
    badgeBg: 'bg-indigo-50/80',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200/70',
    dotColor: 'bg-indigo-500',
  },
  'Đầy': {
    ringColor: '#e11d48',
    badgeBg: 'bg-rose-50/80',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200/70',
    dotColor: 'bg-rose-500',
  },
  'Bảo trì': {
    ringColor: '#f59e0b',
    badgeBg: 'bg-amber-50/80',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200/70',
    dotColor: 'bg-amber-500',
  },
  'Khóa': {
    ringColor: '#64748b',
    badgeBg: 'bg-slate-100/80',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-300/70',
    dotColor: 'bg-slate-500',
  },
  'Chưa cấu hình': {
    ringColor: '#94a3b8',
    badgeBg: 'bg-slate-50/80',
    badgeText: 'text-slate-500',
    badgeBorder: 'border-slate-200/70',
    dotColor: 'bg-slate-400',
  },
};

export default function DormitoryOverviewPage() {
  const [data, setData] = useState<DormDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<DormitoryRoomRow | null>(null);
  const [isCompact, setIsCompact] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  const loadData = useCallback(async (initial = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const response = await dormitoryApi.reports.getDashboardStats();
      setData(response);
    } catch (reason: any) {
      setError(reason?.message || 'Không thể tải dữ liệu tổng quan KTX.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadData(true);
    const refresh = () => {
      if (document.visibilityState === 'visible') void loadData(false);
    };
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadData]);

  const roomRows = data?.room_rows || [];
  const freeBedsByType = useMemo(() => roomRows.reduce(
    (totals, room) => {
      if (room.room_type === 'Thường') totals.thuong += room.free_beds;
      if (room.room_type === 'Máy lạnh') totals.may_lanh += room.free_beds;
      return totals;
    },
    { thuong: 0, may_lanh: 0 },
  ), [roomRows]);
  const roomSummary = data?.room_summary;
  const registrationSummary = data?.registration_summary;
  const invoiceSummary = data?.invoice_summary;
  const isPartial = Boolean(
    data && (!roomSummary || !roomRows || !registrationSummary || !invoiceSummary),
  );

  const filteredRooms = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('vi');
    return roomRows
      .filter((room) => !normalizedSearch || [room.room_code, room.room_name]
        .some((value) => value.toLocaleLowerCase('vi').includes(normalizedSearch)))
      .toSorted((left, right) => {
        const leftEmpty = left.state === 'Trống' ? 0 : 1;
        const rightEmpty = right.state === 'Trống' ? 0 : 1;
        return leftEmpty - rightEmpty || left.room_code.localeCompare(right.room_code, 'vi');
      });
  }, [roomRows, search]);

  if (loading && !data) {
    return (
      <main className="w-full space-y-4 pb-6" aria-label="Đang tải tổng quan KTX">
        <div className="h-8 w-64 animate-pulse rounded-xl bg-white/45" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/45" />)}
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-white/45" />
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="mx-auto my-12 max-w-xl rounded-3xl border border-white/80 bg-white/60 p-8 text-center shadow-lg shadow-slate-300/30 backdrop-blur-md">
        <AlertTriangle className="mx-auto h-10 w-10 text-rose-600" />
        <h1 className="mt-4 text-xl font-bold text-slate-900">Không thể tải dữ liệu KTX</h1>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
        <button onClick={() => void loadData(true)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors">
          <RefreshCw size={16} /> Thử lại
        </button>
      </main>
    );
  }

  const summary = roomSummary || {
    total_rooms: 0,
    total_beds: 0,
    occupied_beds: 0,
    free_beds: 0,
    by_type: { thuong: 0, may_lanh: 0, unknown: 0 },
    by_state: { trong: 0, con_cho: 0, day: 0, bao_tri: 0, khoa: 0, chua_cau_hinh: 0 },
  };
  const registrations = registrationSummary || {
    total: 0,
    assigned: 0,
    male: 0,
    female: 0,
    unlinked: 0,
    unassigned: 0,
    requested_room_type: { thuong: 0, may_lanh: 0, unknown: 0 },
  };
  const invoices = invoiceSummary || {
    outstanding_invoice_count: 0,
    unpaid_count: 0,
    overdue_count: 0,
    total_outstanding_amount: 0,
    anomaly_amount: 0,
    anomaly_count: 0,
    rows: [],
  };

  return (
    <main className="w-full space-y-4 pb-8" aria-label="Tổng quan quản lý KTX">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">Tổng quan Quản lý KTX</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dormitory/roster" className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs backdrop-blur-md transition-all hover:bg-white/80 hover:shadow-sm">
            <ClipboardCheck size={14} className="text-blue-600" /> Danh sách
          </Link>
          <Link href="/dormitory/invoices" className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs backdrop-blur-md transition-all hover:bg-white/80 hover:shadow-sm">
            <ReceiptText size={14} className="text-rose-600" /> Hóa đơn
          </Link>
          <button aria-label="Làm mới dữ liệu" title="Làm mới dữ liệu" disabled={refreshing} onClick={() => void loadData(false)} className="rounded-xl border border-white/80 bg-white/50 p-2 text-slate-600 shadow-xs backdrop-blur-md transition-all hover:bg-white/80 hover:shadow-sm disabled:opacity-50">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-sm text-amber-900 backdrop-blur-sm"><AlertTriangle size={16} /> Dữ liệu hiển thị từ lần tải trước: {error}</div>}
      {isPartial && <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-sm text-amber-900 backdrop-blur-sm"><AlertTriangle size={16} /> Một phần báo cáo chưa có dữ liệu; các số liệu còn lại vẫn được hiển thị.</div>}

      <section aria-label="Thống kê nhanh" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <div className="flex-1">
          <Stat
            label="Tổng số phòng"
            value={summary.total_rooms}
            icon={Building2}
            iconBg="bg-blue-500/15"
            iconColor="text-blue-600"
          />
        </div>
        <div className="flex-1">
          <Stat
            label="Phòng Thường"
            value={summary.by_type.thuong}
            hint={`Còn trống: ${freeBedsByType.thuong} giường`}
            icon={DoorOpen}
            iconBg="bg-teal-500/15"
            iconColor="text-teal-600"
          />
        </div>
        <div className="flex-1">
          <Stat
            label="Phòng Máy lạnh"
            value={summary.by_type.may_lanh}
            hint={`Còn trống: ${freeBedsByType.may_lanh} giường`}
            icon={Wind}
            iconBg="bg-sky-500/15"
            iconColor="text-sky-600"
          />
        </div>
        <div className="flex-1">
          <Stat
            label="Giường còn chỗ"
            value={summary.free_beds}
            icon={BedDouble}
            iconBg="bg-indigo-500/15"
            iconColor="text-indigo-600"
          />
        </div>
        <div className="col-span-2 flex-1 sm:col-span-1">
          <Stat
            label="Tổng danh sách KTX"
            value={registrations?.total || 0}
            icon={Users}
            iconBg="bg-amber-500/15"
            iconColor="text-amber-600"
          />
        </div>
      </section>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><BedDouble size={18} className="text-blue-600" /><h2 className="text-base font-bold text-slate-900">Tình trạng phòng</h2></div>
          </div>
        </div>

        <label className="relative mt-3.5 block">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            aria-label="Tìm phòng"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm mã hoặc tên phòng"
            className="w-full rounded-xl border border-white/80 bg-white/60 px-9 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none backdrop-blur-sm transition-all focus:border-blue-500 focus:bg-white/90"
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Hiển thị {filteredRooms.length}/{roomRows.length} phòng</span>
        </div>

        {isCompact ? (
          <div className="mt-2.5 space-y-3 lg:hidden">
            {filteredRooms.map((room: DormitoryRoomRow) => {
              const occupancy = room.total_beds > 0 ? Math.round((room.occupied_beds / room.total_beds) * 100) : 0;
              const isFull = room.total_beds > 0 && room.occupied_beds >= room.total_beds;
              const config = stateConfig[room.state] || stateConfig['Chưa cấu hình'];
              return (
                <article key={room.room_id} className="rounded-xl border border-white/75 bg-white/55 p-3 shadow-2xs">
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="font-semibold text-slate-900">{room.room_code}</div><div className="text-xs text-slate-500">{room.room_name}</div></div>
                    <span aria-label={`${room.state}, ${occupancy}% đã sử dụng`} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[10.5px] font-bold ${isFull ? 'text-rose-700' : occupancy > 0 ? 'text-indigo-700' : 'text-slate-500'}`} style={{ background: occupancy > 0 ? `conic-gradient(${isFull ? '#e11d48' : config.ringColor} ${occupancy}%, #e2e8f0 0)` : '#e2e8f0' }}><span className="grid h-6.5 w-6.5 place-items-center rounded-full bg-white/90 shadow-2xs">{occupancy}%</span></span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-white/60 pt-3 text-xs">
                    <div><dt className="text-slate-500">Loại phòng</dt><dd className="mt-0.5 font-semibold text-slate-700">{room.room_type}</dd></div>
                    <div><dt className="text-slate-500">Giường</dt><dd className="mt-0.5 font-semibold text-slate-700">{room.occupied_beds}/{room.total_beds}</dd></div>
                    <div><dt className="text-slate-500">Còn chỗ</dt><dd className={`mt-0.5 font-semibold ${room.free_beds > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{room.free_beds}</dd></div>
                    <div className="text-right"><dt className="sr-only">Thành viên</dt><dd><button type="button" aria-label={`Xem thành viên phòng ${room.room_code}`} onClick={() => setSelectedRoom(room)} className="inline-flex items-center rounded-lg border border-white/80 bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white hover:text-blue-600">Chi tiết</button></dd></div>
                  </dl>
                </article>
              );
            })}
            {!filteredRooms.length && <p className="rounded-xl border border-dashed border-white/80 px-4 py-8 text-center text-sm text-slate-500">Không có phòng phù hợp với tìm kiếm.</p>}
          </div>
        ) : <div className="mt-2.5 max-h-[min(45vh,32rem)] overflow-auto rounded-xl border border-white/75 bg-white/50 backdrop-blur-md shadow-2xs">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-white/60 bg-slate-50/95 text-xs uppercase tracking-wide text-slate-500 backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3">Phòng</th>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3">Giường</th>
                <th className="px-4 py-3">Còn chỗ</th>
                <th className="px-4 py-3">Thành viên</th>
                <th className="px-4 py-3 text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {filteredRooms.map((room: DormitoryRoomRow) => {
                const occupancy = room.total_beds > 0 ? Math.round((room.occupied_beds / room.total_beds) * 100) : 0;
                const isFull = room.total_beds > 0 && room.occupied_beds >= room.total_beds;
                const config = stateConfig[room.state] || stateConfig['Chưa cấu hình'];

                return (
                  <tr key={room.room_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{room.room_code}</div>
                      <div className="text-xs text-slate-500">{room.room_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${room.room_type === 'Máy lạnh' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200/60' : 'bg-slate-100 text-slate-700 border border-slate-200/60'}`}>
                        {room.room_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{room.occupied_beds}/{room.total_beds}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${room.free_beds > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {room.free_beds}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-label={`Xem thành viên phòng ${room.room_code}`}
                        onClick={() => setSelectedRoom(room)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/80 bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-white hover:text-blue-600 transition-colors"
                      >
                        Chi tiết
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end">
                        <span
                          aria-label={`${room.state}, ${occupancy}% đã sử dụng`}
                          title={`${room.state}: ${occupancy}% đã sử dụng`}
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[10.5px] font-bold ${isFull ? 'text-rose-700' : occupancy > 0 ? 'text-indigo-700' : 'text-slate-500'}`}
                          style={{
                            background: occupancy > 0
                              ? `conic-gradient(${isFull ? '#e11d48' : config.ringColor} ${occupancy}%, #e2e8f0 0)`
                              : '#e2e8f0'
                          }}
                        >
                          <span className="grid h-6.5 w-6.5 place-items-center rounded-full bg-white/90 shadow-2xs backdrop-blur-xs">
                            {occupancy}%
                          </span>
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredRooms.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Không có phòng phù hợp với tìm kiếm.</td></tr>}
            </tbody>
          </table>
        </div>}
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><ReceiptText size={18} className="text-rose-600" /><h2 className="text-base font-bold text-slate-900">Công nợ theo phòng</h2></div>
            <p className="mt-0.5 text-xs text-slate-500">Chỉ gồm hóa đơn Chưa thanh toán và Quá hạn; hóa đơn đã thanh toán không được tính.</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-rose-700">{money.format(invoices.total_outstanding_amount)}</p>
            <p className="text-[11px] text-slate-500">{invoices.outstanding_invoice_count} hóa đơn · {invoices.unpaid_count} chưa thanh toán · {invoices.overdue_count} quá hạn</p>
          </div>
        </div>
        {invoices.anomaly_count > 0 && <div role="status" className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/80 p-2.5 text-xs text-amber-900 backdrop-blur-sm">Có {invoices.anomaly_count} hóa đơn còn nợ ({money.format(invoices.anomaly_amount)}) chưa xác định được phòng; số này không cộng vào các dòng phòng.</div>}
        {isCompact ? (
          <div className="mt-3 space-y-3 lg:hidden">
            {invoices.rows.map((row) => (
              <article key={row.room_id} className="rounded-xl border border-white/75 bg-white/55 p-3 shadow-2xs">
                <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-slate-900">{row.room_code}</div><div className="text-xs text-slate-500">{row.room_name} · {row.building_name}</div></div><div className="text-right font-bold text-rose-700">{money.format(row.total_outstanding_amount)}</div></div>
                <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-white/60 pt-3 text-xs"><div><dt className="text-slate-500">Người nợ</dt><dd className="mt-0.5 font-semibold text-slate-700">{row.debtor_count}</dd></div><div><dt className="text-slate-500">Chưa thanh toán</dt><dd className="mt-0.5 font-semibold text-slate-700">{row.unpaid_count}</dd></div><div><dt className="text-slate-500">Quá hạn</dt><dd className="mt-0.5 font-semibold text-rose-700">{row.overdue_count}</dd></div></dl>
              </article>
            ))}
            {!invoices.rows.length && <p className="rounded-xl border border-dashed border-white/80 px-4 py-8 text-center text-sm text-slate-500">Không có phòng nào đang có hóa đơn chưa thu.</p>}
          </div>
        ) : <div className="mt-3 max-h-[min(45vh,32rem)] overflow-auto rounded-xl border border-white/75 bg-white/50 backdrop-blur-md shadow-2xs">
          <table className="min-w-[800px] w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-white/60 bg-slate-50/95 text-xs uppercase tracking-wide text-slate-500 backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3">Phòng</th>
                <th className="px-4 py-3">Người nợ</th>
                <th className="px-4 py-3">Chưa thanh toán</th>
                <th className="px-4 py-3">Quá hạn</th>
                <th className="px-4 py-3 text-right">Tổng còn nợ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {invoices.rows.map((row) => (
                <tr key={row.room_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{row.room_code}</div>
                    <div className="text-xs text-slate-500">{row.room_name} · {row.building_name}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{row.debtor_count}</td>
                  <td className="px-4 py-3 font-medium">{row.unpaid_count}</td>
                  <td className="px-4 py-3 font-medium">{row.overdue_count}</td>
                  <td className="px-4 py-3 text-right font-bold text-rose-700">{money.format(row.total_outstanding_amount)}</td>
                </tr>
              ))}
              {!invoices.rows.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Không có phòng nào đang có hóa đơn chưa thu.</td></tr>}
            </tbody>
          </table>
        </div>}
      </Card>

      <Card className="bg-white/35">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={18} className="text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">Tóm tắt đăng ký</h2>
          <span className="rounded-full bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 text-xs font-bold text-indigo-700">{registrations.total} hồ sơ</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="Đã xếp phòng" value={registrations.assigned} />
          <Stat label="Nam" value={registrations.male} />
          <Stat label="Nữ" value={registrations.female} />
          <Stat label="Máy lạnh" value={registrations.requested_room_type.may_lanh} />
        </div>
        <p className="mt-2.5 text-xs text-slate-500"><Link href="/dormitory/roster" className="font-semibold text-blue-600 hover:underline">Mở Danh sách KTX</Link></p>
      </Card>

      <div className="grid gap-2.5 text-xs text-slate-500 sm:grid-cols-3">
        <Link href="/dormitory/buildings" className="flex items-center gap-2 rounded-2xl border border-white/75 bg-white/45 p-3 font-semibold text-slate-700 shadow-2xs backdrop-blur-md hover:bg-white/75 hover:shadow-sm transition-all">
          <Building2 size={15} className="text-blue-600" /> Quản lý phòng & tòa nhà
        </Link>
        <Link href="/dormitory/contracts" className="flex items-center gap-2 rounded-2xl border border-white/75 bg-white/45 p-3 font-semibold text-slate-700 shadow-2xs backdrop-blur-md hover:bg-white/75 hover:shadow-sm transition-all">
          <Users size={15} className="text-emerald-600" /> Hợp đồng nội trú
        </Link>
        <Link href="/dormitory/maintenance" className="flex items-center gap-2 rounded-2xl border border-white/75 bg-white/45 p-3 font-semibold text-slate-700 shadow-2xs backdrop-blur-md hover:bg-white/75 hover:shadow-sm transition-all">
          <Wrench size={15} className="text-amber-600" /> Bảo trì đang mở: {data?.pending_maintenance || 0}
        </Link>
      </div>

      <Dialog
        open={Boolean(selectedRoom)}
        onOpenChange={(open) => {
          if (!open) setSelectedRoom(null);
        }}
      >
        <DialogContent className="max-w-md bg-white/95 backdrop-blur-xl border border-white/80 p-5 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              Thành viên phòng {selectedRoom?.room_code}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {selectedRoom?.room_name ? `${selectedRoom.room_name} · ` : ''}
              {selectedRoom?.building_name || ''}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 max-h-80 overflow-y-auto">
            {selectedRoom?.members && selectedRoom.members.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Họ tên</th>
                    <th className="px-3 py-2">Lớp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedRoom.members.map((member, index) => (
                    <tr key={index} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5 font-medium text-slate-800">{member.full_name}</td>
                      <td className="px-3 py-2.5 text-slate-600">{member.class_name || 'Chưa cập nhật'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                Chưa có thành viên nào trong phòng này.
              </div>
            )}
          </div>

          <DialogFooter className="mt-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setSelectedRoom(null)}
              className="rounded-xl border border-slate-200/80 bg-slate-100/80 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Đóng
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
