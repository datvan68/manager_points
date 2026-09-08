'use client';

import React from 'react';
import { Download, RefreshCw, SlidersHorizontal } from 'lucide-react';

interface ReportPageHeaderProps {
  onExportAll: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  canExport: boolean;
  isFiltersOpen: boolean;
  onToggleFilters: () => void;
}

export default function ReportPageHeader({
  onExportAll,
  onRefresh,
  isRefreshing,
  canExport,
  isFiltersOpen,
  onToggleFilters
}: ReportPageHeaderProps) {
  return (
    <div className="mx-6 mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl shadow-sm">
      <button
        type="button"
        onClick={onToggleFilters}
        aria-expanded={isFiltersOpen}
        aria-controls="reports-filter-panel"
        className="flex items-center justify-center gap-2 px-3 h-9 rounded-xl text-[13px] font-bold text-[#1E293B] bg-white/50 hover:bg-white/80 border border-white/70 transition-all"
      >
        <SlidersHorizontal size={15} />
        <span>Bộ lọc</span>
      </button>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center justify-center gap-2 px-4 h-9 rounded-xl text-[13px] font-bold text-[#1E293B] bg-white/40 hover:bg-white/70 border border-white/70 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          title="Tải lại dữ liệu"
        >
          <RefreshCw size={15} className={`text-[#64748B] ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>

        <button
          onClick={onExportAll}
          disabled={!canExport || isRefreshing}
          className="flex items-center justify-center gap-2 px-5 h-9 rounded-xl text-[13px] font-bold text-white bg-[#1A73E8] hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
        >
          <Download size={15} />
          <span>Xuất workbook tổng hợp</span>
        </button>
      </div>
    </div>
  );
}
