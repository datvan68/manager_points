'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BedDouble,
  ClipboardCheck,
  Users,
  ReceiptText,
  Wrench,
  Building2,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Zap,
  Sparkles,
  FileSpreadsheet,
  ChevronRight,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';
import { dormitoryApi, DormDashboardStats } from '@/api/dormitory-api';

interface OccupancyReportData {
  buildings: Array<{
    building_id: string;
    building_code: string;
    name: string;
    total_rooms: number;
    total_beds: number;
    used_beds: number;
    available_beds: number;
    occupancy_rate: number;
  }>;
  summary: {
    total_buildings: number;
    total_beds: number;
    used_beds: number;
    available_beds: number;
    overall_occupancy_rate: number;
  };
}

export default function DormitoryOverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DormDashboardStats | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeTrendTab, setActiveTrendTab] = useState<'occupancy' | 'finance'>('occupancy');
  const requestCount = useRef(0);

  const loadData = useCallback(async (isInitial = false) => {
    const reqId = ++requestCount.current;
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      const [statsRes, occupancyRes] = await Promise.all([
        dormitoryApi.reports.getDashboardStats().catch((err) => {
          console.warn('Failed to load dashboard stats', err);
          return null;
        }),
        dormitoryApi.reports.getOccupancyReport().catch((err) => {
          console.warn('Failed to load occupancy report', err);
          return null;
        }),
      ]);

      if (reqId === requestCount.current) {
        if (statsRes) setStats(statsRes);
        if (occupancyRes) setOccupancy(occupancyRes);
        if (!statsRes && !occupancyRes) {
          throw new Error('Không thể kết nối đến máy chủ quản lý KTX.');
        }
      }
    } catch (err: any) {
      if (reqId === requestCount.current) {
        setError(err?.message || 'Không thể tải dữ liệu tổng quan KTX.');
      }
    } finally {
      if (reqId === requestCount.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  // Derived KPI calculations
  const totalBeds = useMemo(() => {
    if (occupancy?.summary?.total_beds) return occupancy.summary.total_beds;
    const used = stats?.beds?.used || 0;
    const free = stats?.beds?.free || 0;
    return used + free;
  }, [occupancy, stats]);

  const usedBeds = useMemo(() => {
    if (occupancy?.summary?.used_beds !== undefined) return occupancy.summary.used_beds;
    return stats?.beds?.used || 0;
  }, [occupancy, stats]);

  const freeBeds = useMemo(() => {
    if (occupancy?.summary?.available_beds !== undefined) return occupancy.summary.available_beds;
    return stats?.beds?.free || 0;
  }, [occupancy, stats]);

  const overallOccupancyRate = useMemo(() => {
    if (occupancy?.summary?.overall_occupancy_rate !== undefined) {
      return occupancy.summary.overall_occupancy_rate;
    }
    if (totalBeds > 0) {
      return Math.round((usedBeds / totalBeds) * 100);
    }
    return 0;
  }, [occupancy, totalBeds, usedBeds]);

  const totalRooms = stats?.total_rooms || 0;
  const availableRooms = stats?.available_rooms || stats?.rooms?.available || 0;
  const occupiedRooms = stats?.rooms?.occupied || Math.max(0, totalRooms - availableRooms);
  const airConditionedRooms = stats?.rooms?.air_conditioned || 0;
  const standardRooms = stats?.rooms?.standard || Math.max(0, totalRooms - airConditionedRooms);

  const pendingRegistrations = stats?.pending_registrations || 0;
  const activeResidents = stats?.students?.residing || stats?.active_contracts || 0;
  const unpaidInvoices = stats?.unpaid_invoices || 0;
  const pendingMaintenance = stats?.pending_maintenance || 0;

  // Max value for 6-month trends chart normalization
  const monthlyTrends = stats?.monthly || [];
  const maxTrendValue = useMemo(() => {
    let max = 1;
    for (const item of monthlyTrends) {
      if (activeTrendTab === 'occupancy') {
        max = Math.max(max, item.registrations, item.move_ins);
      } else {
        const totalFee = item.dormitory_fee_paid + item.dormitory_fee_unpaid;
        const totalUtil = item.utility_paid + item.utility_unpaid;
        max = Math.max(max, totalFee, totalUtil);
      }
    }
    return max;
  }, [monthlyTrends, activeTrendTab]);

  // Loading skeleton
  if (loading && !stats && !occupancy) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-white/60" />
            <div className="h-8 w-64 animate-pulse rounded-xl bg-white/60" />
          </div>
          <div className="h-10 w-44 animate-pulse rounded-xl bg-white/60" />
        </div>
        {/* KPI Grid Skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-white/60 bg-white/45 p-5" />
          ))}
        </div>
        {/* Analytics Grid Skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-80 animate-pulse rounded-2xl border border-white/60 bg-white/45 lg:col-span-7" />
          <div className="h-80 animate-pulse rounded-2xl border border-white/60 bg-white/45 lg:col-span-5" />
        </div>
      </div>
    );
  }

  // Error full page if completely failed
  if (error && !stats && !occupancy) {
    return (
      <main className="mx-auto max-w-xl p-8 my-12 text-center rounded-3xl bg-white/60 backdrop-blur-md border border-white/80 shadow-lg">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-800">Không thể tải dữ liệu KTX</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{error}</p>
        <button
          onClick={() => void loadData(true)}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
        >
          <RefreshCw size={16} /> Thử lại
        </button>
      </main>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      {/* ── 1. HEADER & QUICK ACTIONS ── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-700 border border-blue-500/20">
              <Building2 size={13} /> Phân hệ KTX
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Cập nhật lúc {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Tổng quan Quản lý KTX
          </h1>
        </div>

        {/* Action buttons & Refresh */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/dormitory/registrations"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/70 hover:bg-white text-slate-700 hover:text-blue-700 text-xs font-semibold border border-white/80 shadow-sm transition backdrop-blur-sm"
          >
            <ClipboardCheck size={15} className="text-blue-600" />
            Xét duyệt đơn
          </Link>
          <Link
            href="/dormitory/buildings"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/70 hover:bg-white text-slate-700 hover:text-blue-700 text-xs font-semibold border border-white/80 shadow-sm transition backdrop-blur-sm"
          >
            <PlusCircle size={15} className="text-indigo-600" />
            Quản lý phòng
          </Link>
          <Link
            href="/dormitory/reports"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/70 hover:bg-white text-slate-700 hover:text-blue-700 text-xs font-semibold border border-white/80 shadow-sm transition backdrop-blur-sm"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            Báo cáo chi tiết
          </Link>
          <button
            aria-label="Làm mới dữ liệu"
            title="Làm mới dữ liệu"
            disabled={refreshing}
            onClick={() => void loadData(false)}
            className="p-2 rounded-xl bg-white/70 hover:bg-white text-slate-600 hover:text-blue-600 border border-white/80 shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw size={17} className={refreshing ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </header>

      {/* Warning banner if refreshing failed while cached data is displayed */}
      {error && (
        <div role="alert" className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs font-medium">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <span>Dữ liệu hiển thị từ bộ nhớ đệm: {error}</span>
        </div>
      )}

      {/* ── 2. KPI METRICS CARDS (5 Core Cards) ── */}
      <section aria-label="Chỉ số hoạt động chính" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: Tỷ lệ lấp đầy */}
        <div
          onClick={() => router.push('/dormitory/buildings')}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/75 bg-white/50 p-5 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">Tỷ lệ lấp đầy</span>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">{overallOccupancyRate}%</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-500/20">
              <BedDouble className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  overallOccupancyRate >= 90 ? 'bg-amber-500' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, overallOccupancyRate))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mt-1.5">
              <span>Đang ở: {usedBeds}</span>
              <span>Trống: {freeBeds}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Đơn đăng ký chờ duyệt */}
        <div
          onClick={() => router.push('/dormitory/registrations')}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/75 bg-white/50 p-5 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">Đơn chờ duyệt</span>
              <div className="flex items-center gap-2 mt-0.5">
                <h3 className="text-2xl font-black text-slate-900">{pendingRegistrations}</h3>
                {pendingRegistrations > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                    Cần xử lý
                  </span>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
              <ClipboardCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-3 flex items-center justify-between">
            <span>Tổng đơn: {stats?.students?.registered || 0}</span>
            <span className="text-blue-600 group-hover:underline flex items-center gap-0.5">
              Chi tiết <ChevronRight size={12} />
            </span>
          </p>
        </div>

        {/* Card 3: Sinh viên nội trú */}
        <div
          onClick={() => router.push('/dormitory/contracts')}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/75 bg-white/50 p-5 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">SV Đang nội trú</span>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">{activeResidents}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-3 flex items-center justify-between">
            <span>Hợp đồng hiệu lực</span>
            <span className="text-emerald-700 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
              {stats?.active_contracts || 0} HĐ
            </span>
          </p>
        </div>

        {/* Card 4: Hóa đơn chưa thu */}
        <div
          onClick={() => router.push('/dormitory/invoices')}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/75 bg-white/50 p-5 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">Hóa đơn chưa thu</span>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">{unpaidInvoices}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center border border-rose-500/20">
              <ReceiptText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-3 flex items-center justify-between">
            <span>Phí KTX & Điện nước</span>
            {unpaidInvoices > 0 ? (
              <span className="text-rose-600 font-semibold">Chưa đóng</span>
            ) : (
              <span className="text-emerald-600 font-semibold">Đã hoàn tất</span>
            )}
          </p>
        </div>

        {/* Card 5: Yêu cầu bảo trì */}
        <div
          onClick={() => router.push('/dormitory/maintenance')}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/75 bg-white/50 p-5 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">Bảo trì đang mở</span>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">{pendingMaintenance}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center border border-purple-500/20">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-3 flex items-center justify-between">
            <span>Sự cố cơ sở vật chất</span>
            <span className="text-purple-700 font-semibold bg-purple-500/10 px-1.5 py-0.5 rounded">
              {pendingMaintenance > 0 ? 'Cần xử lý' : 'Ổn định'}
            </span>
          </p>
        </div>
      </section>

      {/* ── 3. CAPACITY & OCCUPANCY BREAKDOWN (2 Columns) ── */}
      <section aria-label="Phân bổ công suất và tình trạng tòa nhà" className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Room & Bed Status Summary (5 Cols) */}
        <div className="rounded-2xl border border-white/75 bg-white/55 p-5 shadow-sm backdrop-blur-md lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                  <BedDouble size={18} />
                </div>
                <h2 className="text-base font-bold text-slate-800">Cơ cấu Phòng & Giường</h2>
              </div>
              <Link
                href="/dormitory/buildings"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
              >
                Sơ đồ phòng <ChevronRight size={14} />
              </Link>
            </div>

            {/* Room Type Distribution */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Loại phòng (Tổng: {totalRooms} phòng)</span>
                <span className="text-slate-500 font-semibold">
                  {airConditionedRooms} Máy lạnh · {standardRooms} Tiêu chuẩn
                </span>
              </div>
              <div className="w-full h-3 bg-slate-200/80 rounded-full overflow-hidden flex">
                <div
                  title={`Phòng máy lạnh: ${airConditionedRooms}`}
                  style={{ width: `${totalRooms > 0 ? (airConditionedRooms / totalRooms) * 100 : 50}%` }}
                  className="bg-indigo-500 h-full transition-all duration-300"
                />
                <div
                  title={`Phòng tiêu chuẩn: ${standardRooms}`}
                  style={{ width: `${totalRooms > 0 ? (standardRooms / totalRooms) * 100 : 50}%` }}
                  className="bg-sky-400 h-full transition-all duration-300"
                />
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> Có máy lạnh ({airConditionedRooms})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" /> Tiêu chuẩn ({standardRooms})
                </span>
              </div>
            </div>

            {/* Bed Status Distribution */}
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Tình trạng giường (Tổng: {totalBeds} giường)</span>
                <span className="text-slate-500 font-semibold">
                  {usedBeds} Đang ở · {freeBeds} Còn trống
                </span>
              </div>
              <div className="w-full h-3 bg-slate-200/80 rounded-full overflow-hidden flex">
                <div
                  title={`Giường đang sử dụng: ${usedBeds}`}
                  style={{ width: `${totalBeds > 0 ? (usedBeds / totalBeds) * 100 : 0}%` }}
                  className="bg-emerald-500 h-full transition-all duration-300"
                />
                <div
                  title={`Giường còn trống: ${freeBeds}`}
                  style={{ width: `${totalBeds > 0 ? (freeBeds / totalBeds) * 100 : 100}%` }}
                  className="bg-slate-300 h-full transition-all duration-300"
                />
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Đang sử dụng ({usedBeds})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" /> Còn trống ({freeBeds})
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid in Card */}
          <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-slate-200/60">
            <div className="rounded-xl bg-white/60 p-2.5 text-center border border-white/80">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Số phòng</span>
              <span className="text-lg font-black text-slate-800">{totalRooms}</span>
            </div>
            <div className="rounded-xl bg-white/60 p-2.5 text-center border border-white/80">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Phòng còn chỗ</span>
              <span className="text-lg font-black text-emerald-600">{availableRooms}</span>
            </div>
            <div className="rounded-xl bg-white/60 p-2.5 text-center border border-white/80">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Phòng đã đầy</span>
              <span className="text-lg font-black text-slate-800">{occupiedRooms}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Building Occupancy Progress (7 Cols) */}
        <div className="rounded-2xl border border-white/75 bg-white/55 p-5 shadow-sm backdrop-blur-md lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
                  <Building2 size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Tỷ lệ lấp đầy theo Tòa nhà</h2>
                  <p className="text-xs text-slate-500">Tiến độ sử dụng giường theo từng khu nội trú</p>
                </div>
              </div>
              <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                {occupancy?.buildings?.length || 0} Tòa nhà
              </span>
            </div>

            {/* Building list items */}
            {occupancy?.buildings && occupancy.buildings.length > 0 ? (
              <div className="space-y-3.5 max-h-[260px] overflow-y-auto pr-1">
                {occupancy.buildings.map((b) => {
                  const rate = b.occupancy_rate || 0;
                  const isFull = rate >= 100 || b.available_beds === 0;
                  const isAlmostFull = rate >= 80 && !isFull;
                  return (
                    <div key={b.building_id} className="rounded-xl bg-white/65 p-3 border border-white/80 shadow-xs">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{b.name}</span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {b.building_code}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 font-medium">
                            {b.used_beds}/{b.total_beds} giường
                          </span>
                          <span
                            className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                              isFull
                                ? 'bg-rose-500/10 text-rose-700'
                                : isAlmostFull
                                ? 'bg-amber-500/10 text-amber-700'
                                : 'bg-emerald-500/10 text-emerald-700'
                            }`}
                          >
                            {rate}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2.5 bg-slate-200/70 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isFull ? 'bg-rose-500' : isAlmostFull ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                        <span>Trống: {b.available_beds} giường</span>
                        <span>{isFull ? 'Đã hết giường' : isAlmostFull ? 'Sắp đầy' : 'Còn nhiều chỗ'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500">
                <Building2 className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-medium">Chưa có dữ liệu tòa nhà hoặc đang khởi tạo</p>
                <Link
                  href="/dormitory/buildings"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                >
                  Thêm tòa nhà ngay <ChevronRight size={13} />
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200/60 text-xs text-slate-500">
            <span>Tỷ lệ chung toàn KTX: <strong className="text-slate-800">{overallOccupancyRate}%</strong></span>
            <Link href="/dormitory/reports" className="text-blue-600 font-semibold hover:underline flex items-center gap-1">
              Xem báo cáo lấp đầy <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 4. 6-MONTH TRENDS & FINANCIAL CHART ── */}
      <section aria-label="Biểu đồ xu hướng vận hành và tài chính" className="rounded-2xl border border-white/75 bg-white/55 p-5 shadow-sm backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <TrendingUp size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Xu hướng Vận hành 6 Tháng Gần Nhất</h2>
              <p className="text-xs text-slate-500">Theo dõi lượng đăng ký, nhận phòng và tình hình thu phí KTX</p>
            </div>
          </div>

          {/* Toggle Tab */}
          <div className="inline-flex rounded-xl bg-white/80 p-1 border border-white shadow-xs">
            <button
              onClick={() => setActiveTrendTab('occupancy')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTrendTab === 'occupancy'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lưu trú & Đăng ký
            </button>
            <button
              onClick={() => setActiveTrendTab('finance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTrendTab === 'finance'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Thu nộp Phí & Điện nước
            </button>
          </div>
        </div>

        {/* Dynamic Bar Charts */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 pt-2">
          {monthlyTrends.map((month) => {
            if (activeTrendTab === 'occupancy') {
              const regHeight = Math.max(8, (month.registrations / maxTrendValue) * 100);
              const moveHeight = Math.max(8, (month.move_ins / maxTrendValue) * 100);

              return (
                <div
                  key={month.month}
                  className="group rounded-2xl bg-white/70 p-3.5 border border-white/80 shadow-xs hover:bg-white transition flex flex-col justify-between"
                >
                  <div className="text-center pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-700">{month.month}</span>
                  </div>

                  {/* Chart Bars */}
                  <div className="h-28 flex items-end justify-center gap-3 my-3">
                    {/* Registrations Bar */}
                    <div className="flex flex-col items-center gap-1 h-full justify-end">
                      <span className="text-[10px] font-bold text-blue-600">{month.registrations}</span>
                      <div
                        className="w-4 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md transition-all duration-300 group-hover:brightness-110"
                        style={{ height: `${regHeight}%` }}
                      />
                    </div>
                    {/* Move-ins Bar */}
                    <div className="flex flex-col items-center gap-1 h-full justify-end">
                      <span className="text-[10px] font-bold text-emerald-600">{month.move_ins}</span>
                      <div
                        className="w-4 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md transition-all duration-300 group-hover:brightness-110"
                        style={{ height: `${moveHeight}%` }}
                      />
                    </div>
                  </div>

                  {/* Legend underneath */}
                  <div className="text-[10px] text-slate-500 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700 font-medium">Đăng ký:</span>
                      <strong className="text-slate-800">{month.registrations}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-700 font-medium">Nhận phòng:</span>
                      <strong className="text-slate-800">{month.move_ins}</strong>
                    </div>
                  </div>
                </div>
              );
            }

            // Finance Tab
            const totalFee = month.dormitory_fee_paid + month.dormitory_fee_unpaid;
            const feeRate = totalFee > 0 ? Math.round((month.dormitory_fee_paid / totalFee) * 100) : 0;
            const totalUtil = month.utility_paid + month.utility_unpaid;
            const utilRate = totalUtil > 0 ? Math.round((month.utility_paid / totalUtil) * 100) : 0;

            return (
              <div
                key={month.month}
                className="group rounded-2xl bg-white/70 p-3.5 border border-white/80 shadow-xs hover:bg-white transition flex flex-col justify-between"
              >
                <div className="text-center pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-700">{month.month}</span>
                </div>

                <div className="my-3 space-y-3">
                  {/* Dorm Fee Status */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-semibold text-slate-600">Phí KTX</span>
                      <span className="text-emerald-700 font-bold">{feeRate}%</span>
                    </div>
                    <div className="w-full h-2 bg-rose-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${feeRate}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                      <span>Đã thu: {month.dormitory_fee_paid}</span>
                      <span>Nợ: {month.dormitory_fee_unpaid}</span>
                    </div>
                  </div>

                  {/* Utility Status */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-semibold text-slate-600">Điện nước</span>
                      <span className="text-cyan-700 font-bold">{utilRate}%</span>
                    </div>
                    <div className="w-full h-2 bg-amber-200 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${utilRate}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                      <span>Đã thu: {month.utility_paid}</span>
                      <span>Nợ: {month.utility_unpaid}</span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-center text-slate-400 pt-1 border-t border-slate-100">
                  {month.dormitory_fee_unpaid + month.utility_unpaid > 0 ? (
                    <span className="text-rose-600 font-medium">Còn tồn đọng phí</span>
                  ) : (
                    <span className="text-emerald-600 font-medium">Đã thu đủ 100%</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend Footer */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200/60 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            {activeTrendTab === 'occupancy' ? (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Đơn đăng ký mới
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Lượt nhận phòng chính thức
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Phí KTX đã thanh toán
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-cyan-500 inline-block" /> Tiền điện nước đã thanh toán
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-rose-400 inline-block" /> Chưa thu / Nợ phí
                </span>
              </>
            )}
          </div>
          <Link href="/dormitory/reports" className="text-blue-600 font-semibold hover:underline flex items-center gap-1">
            Xem báo cáo tài chính đầy đủ <ArrowRight size={13} />
          </Link>
        </div>
      </section>

      {/* ── 5. ACTION CENTER & MODULE SHORTCUTS (2 Columns) ── */}
      <section aria-label="Trung tâm điều hành và lối tắt chức năng" className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Urgent Action Items (5 Cols) */}
        <div className="rounded-2xl border border-white/75 bg-white/55 p-5 shadow-sm backdrop-blur-md lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Cần Xử Lý Ngay</h2>
                <p className="text-xs text-slate-500">Các hạng mục tồn đọng cần quản lý can thiệp</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Item 1: Pending Registrations */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/70 border border-white/80 shadow-xs hover:bg-white transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                    <ClipboardCheck size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Đơn đăng ký mới</h4>
                    <p className="text-[11px] text-slate-500">
                      {pendingRegistrations > 0
                        ? `${pendingRegistrations} hồ sơ sinh viên chờ duyệt & xếp phòng`
                        : 'Không có đơn nào đang chờ'}
                    </p>
                  </div>
                </div>
                <Link
                  href="/dormitory/registrations"
                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 text-xs font-semibold transition"
                >
                  Duyệt ngay
                </Link>
              </div>

              {/* Item 2: Pending Maintenance */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/70 border border-white/80 shadow-xs hover:bg-white transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                    <Wrench size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Sự cố & Bảo trì CSVC</h4>
                    <p className="text-[11px] text-slate-500">
                      {pendingMaintenance > 0
                        ? `${pendingMaintenance} yêu cầu cần kỹ thuật viên xử lý`
                        : 'Hệ thống thiết bị hoạt động tốt'}
                    </p>
                  </div>
                </div>
                <Link
                  href="/dormitory/maintenance"
                  className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 text-xs font-semibold transition"
                >
                  Xử lý
                </Link>
              </div>

              {/* Item 3: Unpaid Invoices */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/70 border border-white/80 shadow-xs hover:bg-white transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                    <ReceiptText size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Hóa đơn quá hạn</h4>
                    <p className="text-[11px] text-slate-500">
                      {unpaidInvoices > 0
                        ? `${unpaidInvoices} hóa đơn phòng/điện nước chưa đóng`
                        : 'Tất cả hóa đơn đã được thanh toán'}
                    </p>
                  </div>
                </div>
                <Link
                  href="/dormitory/invoices"
                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 text-xs font-semibold transition"
                >
                  Kiểm tra
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 size={14} /> An ninh KTX ổn định
            </span>
            <Link href="/dormitory/violations" className="text-blue-600 font-semibold hover:underline">
              Sổ kỷ luật & vi phạm
            </Link>
          </div>
        </div>

        {/* Right Column: Quick Navigation Hub (7 Cols) */}
        <div className="rounded-2xl border border-white/75 bg-white/55 p-5 shadow-sm backdrop-blur-md lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Lối Tắt Phân Hệ KTX</h2>
                <p className="text-xs text-slate-500">Truy cập nhanh các chức năng quản lý nội trú</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Link
              href="/dormitory/registrations"
              className="group p-3.5 rounded-xl bg-white/60 hover:bg-white border border-white/80 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <ClipboardCheck size={18} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 group-hover:text-blue-600">Đăng ký KTX</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">Xét duyệt hồ sơ sinh viên</p>
              </div>
            </Link>

            <Link
              href="/dormitory/buildings"
              className="group p-3.5 rounded-xl bg-white/60 hover:bg-white border border-white/80 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Building2 size={18} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">Phòng & Tòa</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">Sơ đồ phòng, giường & CSVC</p>
              </div>
            </Link>

            <Link
              href="/dormitory/contracts"
              className="group p-3.5 rounded-xl bg-white/60 hover:bg-white border border-white/80 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Users size={18} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 group-hover:text-emerald-600">Hợp đồng KTX</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">Quản lý thời hạn lưu trú</p>
              </div>
            </Link>

            <Link
              href="/dormitory/invoices"
              className="group p-3.5 rounded-xl bg-white/60 hover:bg-white border border-white/80 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <ReceiptText size={18} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 group-hover:text-amber-600">Hóa đơn & Phí</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">Tiền phòng, điện, nước</p>
              </div>
            </Link>

            <Link
              href="/dormitory/violations"
              className="group p-3.5 rounded-xl bg-white/60 hover:bg-white border border-white/80 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <ShieldAlert size={18} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 group-hover:text-rose-600">Vi phạm nội quy</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">Biên bản xử lý kỷ luật</p>
              </div>
            </Link>

            <Link
              href="/dormitory/maintenance"
              className="group p-3.5 rounded-xl bg-white/60 hover:bg-white border border-white/80 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Wrench size={18} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 group-hover:text-purple-600">Bảo trì thiết bị</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">Sửa chữa điện thoại & CSVC</p>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
