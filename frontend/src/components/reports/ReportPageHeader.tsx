'use client';

import React from 'react';
import { Download, RefreshCw } from 'lucide-react';

interface ReportPageHeaderProps {
  onExportAll: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  canExport: boolean;
}

export default function ReportPageHeader({
  onExportAll,
  onRefresh,
  isRefreshing,
  canExport
}: ReportPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-white/45 backdrop-blur-md border-b border-white/75 shadow-sm">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Thống kê & Báo cáo</h1>
        <p className="text-xs text-slate-400 font-semibold mt-1">
          Tổng hợp tình hình sinh viên, học tập, chuyên cần, rèn luyện và tiến độ nhiệm vụ
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center justify-center gap-2 px-4 h-9 rounded-xl text-[13px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          title="Tải lại dữ liệu"
        >
          <RefreshCw size={15} className={`text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>

        <button
          onClick={onExportAll}
          disabled={!canExport || isRefreshing}
          className="flex items-center justify-center gap-2 px-5 h-9 rounded-xl text-[13px] font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
        >
          <Download size={15} />
          <span>Xuất workbook tổng hợp</span>
        </button>
      </div>
    </div>
  );
}
