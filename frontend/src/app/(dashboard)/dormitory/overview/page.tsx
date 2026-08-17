'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BedDouble,
  Building2,
  ClipboardCheck,
  ReceiptText,
  RefreshCw,
  Search,
  Users,
  Wrench,
} from 'lucide-react';
import {
  dormitoryApi,
  DormDashboardStats,
  DormitoryRoomRow,
} from '@/api/dormitory-api';

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-white/80 bg-white/65 p-5 shadow-sm ${className}`}>{children}</section>;
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/70 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export default function DormitoryOverviewPage() {
  const [data, setData] = useState<DormDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const inFlightRef = useRef(false);

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
      <main className="w-full space-y-5 pb-6" aria-label="Đang tải tổng quan KTX">
        <div className="h-9 w-72 animate-pulse rounded-xl bg-white/60" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-white/60" />)}
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-white/60" />
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="mx-auto my-12 max-w-xl rounded-3xl border border-white/80 bg-white/70 p-8 text-center shadow-lg">
        <AlertTriangle className="mx-auto h-10 w-10 text-rose-600" />
        <h1 className="mt-4 text-xl font-bold text-slate-900">Không thể tải dữ liệu KTX</h1>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
        <button onClick={() => void loadData(true)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
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
    pending_confirmation: 0,
    pending_approval: 0,
    approved_unassigned: 0,
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
    <main className="w-full space-y-5 pb-8" aria-label="Tổng quan quản lý KTX">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Phân hệ KTX</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Tổng quan Quản lý KTX</h1>
          <p className="mt-1 text-sm text-slate-500">Theo dõi phòng, giường và công nợ theo từng phòng.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dormitory/registrations" className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700">
            <ClipboardCheck size={15} className="text-blue-600" /> Đăng ký
          </Link>
          <Link href="/dormitory/invoices" className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700">
            <ReceiptText size={15} className="text-rose-600" /> Hóa đơn
          </Link>
          <button aria-label="Làm mới dữ liệu" title="Làm mới dữ liệu" disabled={refreshing} onClick={() => void loadData(false)} className="rounded-xl border border-white/80 bg-white/70 p-2 text-slate-600 disabled:opacity-50">
            <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={16} /> Dữ liệu hiển thị từ lần tải trước: {error}</div>}
      {isPartial && <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={16} /> Một phần báo cáo chưa có dữ liệu; các số liệu còn lại vẫn được hiển thị.</div>}

      <section aria-label="Thống kê nhanh" className="flex gap-4 overflow-x-auto pb-1">
        <div className="min-w-[220px] flex-1"><Stat label="Tổng số phòng" value={summary.total_rooms} /></div>
        <div className="min-w-[220px] flex-1"><Stat label="Phòng Thường" value={summary.by_type.thuong} hint={`Còn trống: ${freeBedsByType.thuong} giường`} /></div>
        <div className="min-w-[220px] flex-1"><Stat label="Phòng Máy lạnh" value={summary.by_type.may_lanh} hint={`Còn trống: ${freeBedsByType.may_lanh} giường`} /></div>
        <div className="min-w-[220px] flex-1"><Stat label="Giường còn chỗ" value={summary.free_beds} /></div>
        <div className="min-w-[220px] flex-1"><Stat label="Tổng danh sách KTX" value={registrations?.total || 0} /></div>
      </section>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><BedDouble size={19} className="text-blue-600" /><h2 className="text-lg font-bold text-slate-900">Tình trạng phòng</h2></div>
          </div>
        </div>

        <label className="relative mt-5 block"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Tìm phòng" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã hoặc tên phòng" className="w-full rounded-xl border border-slate-200 bg-white px-9 py-2.5 text-sm outline-none focus:border-blue-500" /></label>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Hiển thị {filteredRooms.length}/{roomRows.length} phòng</span>
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-[680px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Phòng</th><th className="px-3 py-3">Loại</th><th className="px-3 py-3">Giường</th><th className="px-3 py-3">Còn chỗ</th><th className="px-3 py-3 text-right">Trạng thái</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRooms.map((room: DormitoryRoomRow) => {
                const occupancy = room.total_beds > 0 ? Math.round((room.occupied_beds / room.total_beds) * 100) : 0;
                const isFull = room.total_beds > 0 && room.occupied_beds >= room.total_beds;
                return <tr key={room.room_id} className="hover:bg-slate-50"><td className="px-3 py-3"><div className="font-semibold text-slate-900">{room.room_code}</div><div className="text-xs text-slate-500">{room.room_name}</div></td><td className="px-3 py-3">{room.room_type}</td><td className="px-3 py-3">{room.occupied_beds}/{room.total_beds}</td><td className="px-3 py-3 font-semibold">{room.free_beds}</td><td className="px-3 py-3 text-right"><div className="flex items-center justify-end gap-2"><span aria-label={`${room.state}, ${occupancy}% đã sử dụng`} className={`grid h-11 w-11 place-items-center rounded-full text-xs font-bold ${isFull ? 'text-rose-700' : 'text-slate-700'}`} style={{ background: `conic-gradient(${isFull ? '#e11d48' : '#2563eb'} ${occupancy}%, #e2e8f0 0)` }}><span className="grid h-8 w-8 place-items-center rounded-full bg-white">{occupancy}%</span></span><span className="text-xs font-semibold text-slate-600">{room.state}</span></div></td></tr>;
              })}
              {!filteredRooms.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">Không có phòng phù hợp với tìm kiếm.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><ReceiptText size={19} className="text-rose-600" /><h2 className="text-lg font-bold text-slate-900">Công nợ theo phòng</h2></div><p className="mt-1 text-xs text-slate-500">Chỉ gồm hóa đơn Chưa thanh toán và Quá hạn; hóa đơn đã thanh toán không được tính.</p></div><div className="text-right"><p className="text-xl font-black text-rose-700">{money.format(invoices.total_outstanding_amount)}</p><p className="text-xs text-slate-500">{invoices.outstanding_invoice_count} hóa đơn · {invoices.unpaid_count} chưa thanh toán · {invoices.overdue_count} quá hạn</p></div></div>
        {invoices.anomaly_count > 0 && <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Có {invoices.anomaly_count} hóa đơn còn nợ ({money.format(invoices.anomaly_amount)}) chưa xác định được phòng; số này không cộng vào các dòng phòng.</div>}
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-[800px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Phòng</th><th className="px-3 py-3">Người nợ</th><th className="px-3 py-3">Chưa thanh toán</th><th className="px-3 py-3">Quá hạn</th><th className="px-3 py-3 text-right">Tổng còn nợ</th></tr></thead><tbody className="divide-y divide-slate-100">{invoices.rows.map((row) => <tr key={row.room_id} className="hover:bg-slate-50"><td className="px-3 py-3"><div className="font-semibold text-slate-900">{row.room_code}</div><div className="text-xs text-slate-500">{row.room_name} · {row.building_name}</div></td><td className="px-3 py-3">{row.debtor_count}</td><td className="px-3 py-3">{row.unpaid_count}</td><td className="px-3 py-3">{row.overdue_count}</td><td className="px-3 py-3 text-right font-bold text-rose-700">{money.format(row.total_outstanding_amount)}</td></tr>)}{!invoices.rows.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">Không có phòng nào đang có hóa đơn chưa thu.</td></tr>}</tbody></table></div>
      </Card>

      <Card className="bg-white/50">
        <div className="flex items-center gap-2"><ClipboardCheck size={19} className="text-indigo-600" /><h2 className="text-lg font-bold text-slate-900">Tóm tắt đăng ký</h2><span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">{registrations.total} hồ sơ</span></div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Chờ xác nhận" value={registrations.pending_confirmation} /><Stat label="Chờ duyệt" value={registrations.pending_approval} /><Stat label="Đã duyệt, chưa xếp" value={registrations.approved_unassigned} /><Stat label="Nhu cầu Máy lạnh" value={registrations.requested_room_type.may_lanh} hint={`Thường: ${registrations.requested_room_type.thuong}`} /></div>
        <p className="mt-3 text-xs text-slate-500">Hồ sơ QR đã liên kết được loại khỏi tổng số để tránh đếm trùng. <Link href="/dormitory/registrations" className="font-semibold text-blue-600 hover:underline">Mở danh sách đăng ký</Link></p>
      </Card>

      <div className="grid gap-3 text-xs text-slate-500 sm:grid-cols-3"><Link href="/dormitory/buildings" className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/55 p-3 font-semibold text-slate-700"><Building2 size={16} className="text-blue-600" /> Quản lý phòng & tòa nhà</Link><Link href="/dormitory/contracts" className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/55 p-3 font-semibold text-slate-700"><Users size={16} className="text-emerald-600" /> Hợp đồng nội trú</Link><Link href="/dormitory/maintenance" className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/55 p-3 font-semibold text-slate-700"><Wrench size={16} className="text-amber-600" /> Bảo trì đang mở: {data?.pending_maintenance || 0}</Link></div>
    </main>
  );
}
