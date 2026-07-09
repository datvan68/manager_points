'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, Wrench, DollarSign } from 'lucide-react';
import { dormitoryApi } from '@/api/dormitory-api';
import { toast } from 'sonner';

export default function ReportsPage() {
  const [occupancy, setOccupancy] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [violMaint, setViolMaint] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [occ, rev, vm] = await Promise.all([
        dormitoryApi.reports.getOccupancyReport(),
        dormitoryApi.reports.getRevenueReport(),
        dormitoryApi.reports.getViolationMaintenanceReport(),
      ]);
      setOccupancy(occ);
      setRevenue(rev);
      setViolMaint(vm);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tải báo cáo');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-800">Báo cáo & Thống kê</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 animate-pulse">
              <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
              <div className="h-32 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Báo cáo & Thống kê</h1>
        <button onClick={loadAll} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Làm mới</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Occupancy Report */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-800">Tỷ lệ lấp đầy theo khu vực</h2>
          </div>
          {occupancy?.buildings?.length > 0 ? (
            <div className="space-y-3">
              {occupancy.buildings.map((b: any) => (
                <div key={b.building_id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{b.ten}</span>
                    <span className="text-gray-500">{b.used_beds}/{b.total_beds} giường ({b.occupancy_rate}%)</span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${b.occupancy_rate > 90 ? 'bg-red-500' : b.occupancy_rate > 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                      style={{ width: `${b.occupancy_rate}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-3 mt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-gray-800">Tổng cộng</span>
                  <span className="text-blue-600">{occupancy.summary.used_beds}/{occupancy.summary.total_beds} ({occupancy.summary.overall_occupancy_rate}%)</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">Chưa có dữ liệu</p>
          )}
        </div>

        {/* Revenue Report */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={18} className="text-green-600" />
            <h2 className="font-semibold text-gray-800">Doanh thu & Công nợ</h2>
          </div>
          {revenue ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-green-600 mb-1">Đã thu</p>
                  <p className="text-lg font-bold text-green-700">{revenue.total_revenue?.toLocaleString('vi-VN')}đ</p>
                  <p className="text-xs text-green-500 mt-1">{revenue.paid_count} hóa đơn</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-amber-600 mb-1">Chưa thu</p>
                  <p className="text-lg font-bold text-amber-700">{revenue.total_unpaid?.toLocaleString('vi-VN')}đ</p>
                  <p className="text-xs text-amber-500 mt-1">{revenue.unpaid_count} hóa đơn</p>
                </div>
              </div>
              {revenue.total_overdue > 0 && (
                <div className="bg-red-50 rounded-lg p-3 flex items-center gap-3">
                  <AlertTriangle size={16} className="text-red-500" />
                  <div>
                    <p className="text-sm text-red-700 font-medium">Quá hạn: {revenue.total_overdue?.toLocaleString('vi-VN')}đ</p>
                    <p className="text-xs text-red-500">{revenue.overdue_count} hóa đơn quá hạn</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">Chưa có dữ liệu</p>
          )}
        </div>

        {/* Violations Report */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-amber-600" />
            <h2 className="font-semibold text-gray-800">Thống kê vi phạm</h2>
          </div>
          {violMaint?.violations ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-yellow-600">Nhẹ</p>
                  <p className="text-xl font-bold text-yellow-700">{violMaint.violations.by_level.nhe}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-orange-600">Trung bình</p>
                  <p className="text-xl font-bold text-orange-700">{violMaint.violations.by_level.trung_binh}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-red-600">Nghiêm trọng</p>
                  <p className="text-xl font-bold text-red-700">{violMaint.violations.by_level.nghiem_trong}</p>
                </div>
              </div>
              <div className="text-sm text-gray-500 pt-2 border-t border-gray-100">
                Tổng: <strong className="text-gray-700">{violMaint.violations.total}</strong> vi phạm
                {violMaint.violations.pending > 0 && (
                  <span className="text-amber-600 ml-2">• {violMaint.violations.pending} chờ xử lý</span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">Chưa có dữ liệu</p>
          )}
        </div>

        {/* Maintenance Report */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Wrench size={18} className="text-orange-600" />
            <h2 className="font-semibold text-gray-800">Thống kê bảo trì</h2>
          </div>
          {violMaint?.maintenance ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-600">Mới</p>
                  <p className="text-xl font-bold text-blue-700">{violMaint.maintenance.by_status.moi}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-amber-600">Đang xử lý</p>
                  <p className="text-xl font-bold text-amber-700">{violMaint.maintenance.by_status.dang_xu_ly}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-600">Hoàn tất</p>
                  <p className="text-xl font-bold text-green-700">{violMaint.maintenance.by_status.hoan_tat}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-red-600">Từ chối</p>
                  <p className="text-xl font-bold text-red-700">{violMaint.maintenance.by_status.tu_choi}</p>
                </div>
              </div>
              <div className="text-sm text-gray-500 pt-2 border-t border-gray-100">
                Tổng: <strong className="text-gray-700">{violMaint.maintenance.total}</strong> yêu cầu bảo trì
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">Chưa có dữ liệu</p>
          )}
        </div>
      </div>
    </div>
  );
}
