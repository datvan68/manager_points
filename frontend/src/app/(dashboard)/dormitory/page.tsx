'use client';

import React, { useEffect, useState } from 'react';
import {
  Building2,
  DoorOpen,
  Users,
  ClipboardList,
  Receipt,
  Wrench,
  TrendingUp,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { dormitoryApi, DormDashboardStats } from '@/api/dormitory-api';
import { toast } from 'sonner';

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
        <span className="text-sm text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function DormitoryDashboardPage() {
  const [stats, setStats] = useState<DormDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      const data = await dormitoryApi.reports.getDashboardStats();
      setStats(data);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải dữ liệu dashboard');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-800">Quản lý Ký túc xá</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 animate-pulse">
              <div className="h-10 w-10 bg-gray-200 rounded-lg mb-3" />
              <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
              <div className="h-6 w-12 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Quản lý Ký túc xá</h1>
        <button
          onClick={loadStats}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Làm mới
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={DoorOpen}
          label="Tổng phòng"
          value={stats?.total_rooms ?? 0}
          color="bg-blue-500"
        />
        <StatCard
          icon={Building2}
          label="Phòng trống"
          value={stats?.available_rooms ?? 0}
          color="bg-green-500"
        />
        <StatCard
          icon={Users}
          label="SV đang ở"
          value={stats?.active_contracts ?? 0}
          color="bg-purple-500"
        />
        <StatCard
          icon={ClipboardList}
          label="Chờ duyệt"
          value={stats?.pending_registrations ?? 0}
          color="bg-amber-500"
          sub="Đơn đăng ký"
        />
        <StatCard
          icon={Receipt}
          label="Chưa thanh toán"
          value={stats?.unpaid_invoices ?? 0}
          color="bg-red-500"
          sub="Hóa đơn"
        />
        <StatCard
          icon={Wrench}
          label="Cần xử lý"
          value={stats?.pending_maintenance ?? 0}
          color="bg-orange-500"
          sub="Bảo trì"
        />
      </div>

      {/* Quick Info Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Occupancy Overview */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-800">Tổng quan lấp đầy</h2>
          </div>
          <div className="text-center py-8 text-gray-400">
            <BarChart3 size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Biểu đồ tỷ lệ lấp đầy theo khu vực</p>
            <p className="text-xs mt-1">Truy cập tab Báo cáo để xem chi tiết</p>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-amber-600" />
            <h2 className="font-semibold text-gray-800">Cảnh báo gần nhất</h2>
          </div>
          <div className="space-y-3">
            {(stats?.pending_registrations ?? 0) > 0 && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                <ClipboardList size={16} className="text-amber-600" />
                <span className="text-sm text-amber-800">
                  Có <strong>{stats?.pending_registrations}</strong> đơn đăng ký chờ duyệt
                </span>
              </div>
            )}
            {(stats?.unpaid_invoices ?? 0) > 0 && (
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <Receipt size={16} className="text-red-600" />
                <span className="text-sm text-red-800">
                  Có <strong>{stats?.unpaid_invoices}</strong> hóa đơn chưa thanh toán
                </span>
              </div>
            )}
            {(stats?.pending_maintenance ?? 0) > 0 && (
              <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                <Wrench size={16} className="text-orange-600" />
                <span className="text-sm text-orange-800">
                  Có <strong>{stats?.pending_maintenance}</strong> yêu cầu bảo trì cần xử lý
                </span>
              </div>
            )}
            {(stats?.pending_registrations ?? 0) === 0 &&
              (stats?.unpaid_invoices ?? 0) === 0 &&
              (stats?.pending_maintenance ?? 0) === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Không có cảnh báo nào</p>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
