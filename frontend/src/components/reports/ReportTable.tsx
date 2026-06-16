'use client';

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { CustomPagination } from '@/components/ui/pagination';
import ReportEmptyState from './ReportEmptyState';

export interface TableColumn {
  key: string;
  header: string;
  className?: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface ReportTableProps {
  title: string;
  columns: TableColumn[];
  data: any[];
  isLoading: boolean;
  onExportExcel: () => void;
  label?: string;
  emptyMessage?: string;
  
  // Server-side pagination props
  serverSide?: boolean;
  totalItems?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export default function ReportTable({
  title,
  columns,
  data,
  isLoading,
  onExportExcel,
  label = 'dòng',
  emptyMessage,
  serverSide = false,
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange
}: ReportTableProps) {
  const [localCurrentPage, setLocalCurrentPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState(10);

  const activeCurrentPage = serverSide ? (currentPage ?? 1) : localCurrentPage;
  const activePageSize = serverSide ? (pageSize ?? 10) : localPageSize;

  const totalCount = serverSide ? (totalItems ?? data.length) : data.length;
  
  const paginatedData = serverSide ? data : data.slice(
    (activeCurrentPage - 1) * activePageSize,
    activeCurrentPage * activePageSize
  );

  const handlePageChange = (page: number) => {
    if (serverSide && onPageChange) {
      onPageChange(page);
    } else {
      setLocalCurrentPage(page);
    }
  };

  const handlePageSizeChange = (size: number) => {
    if (serverSide && onPageSizeChange) {
      onPageSizeChange(size);
    } else {
      setLocalPageSize(size);
      setLocalCurrentPage(1);
    }
  };

  return (
    <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* Header of Table */}
      <div className="px-6 py-4 border-b border-white/50 flex items-center justify-between bg-white/40">
        <div>
          <h3 className="font-bold text-[#1E293B] text-[15px]">{title}</h3>
          <span className="text-[11px] text-[#64748B] font-semibold">
            Tổng cộng: {totalCount} bản ghi
          </span>
        </div>
        <button
          onClick={onExportExcel}
          disabled={totalCount === 0 || isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/40 hover:bg-white/70 border border-white/70 text-[#1E293B] disabled:opacity-50 disabled:scale-100 active:scale-95 transition-all text-xs font-bold rounded-xl shadow-sm cursor-pointer"
        >
          <Download size={13} className="text-[#64748B]" />
          <span>Xuất Excel</span>
        </button>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto custom-scrollbar flex-1 min-h-[300px]">
        {isLoading ? (
          <div className="w-full">
            {/* Skeleton Header */}
            <div className="grid grid-cols-6 gap-4 px-6 py-3.5 border-b border-white/50 bg-white/40">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-4 bg-slate-200/80 rounded-md animate-pulse" />
              ))}
            </div>
            {/* Skeleton Rows */}
            {Array.from({ length: 5 }).map((_, rIdx) => (
              <div key={rIdx} className="grid grid-cols-6 gap-4 px-6 py-4 border-b border-white/40">
                {Array.from({ length: 6 }).map((_, cIdx) => (
                  <div key={cIdx} className="h-3.5 bg-slate-100 rounded-md animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="py-12 flex justify-center">
            <ReportEmptyState message={emptyMessage} />
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-[13px] font-sans">
            <thead>
              <tr className="bg-white/50 border-b border-white/75 text-[#64748B] font-bold">
                {columns.map((col, idx) => (
                  <th key={idx} className={`px-6 py-3.5 font-bold uppercase tracking-wider text-[11px] select-none ${col.className || ''}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40 text-[#1E293B] font-semibold">
              {paginatedData.map((row, rIdx) => (
                <tr key={row.key || rIdx} className="hover:bg-white/60 transition-colors duration-150">
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className={`px-6 py-3.5 align-middle ${col.className || ''}`}>
                       {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Table Pagination */}
      {!isLoading && totalCount > 0 && (
        <div className="border-t border-white/50">
          <CustomPagination
            totalItems={totalCount}
            pageSize={activePageSize}
            currentPage={activeCurrentPage}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            label={label}
            className="shadow-none border-none rounded-none bg-transparent"
          />
        </div>
      )}
    </div>
  );
}
