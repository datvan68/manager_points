'use client';

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { CustomPagination } from '@/components/ui/pagination';
import ReportEmptyState from './ReportEmptyState';
import ResponsiveDataView, { ResponsiveColumn } from '@/components/ui/ResponsiveDataView';

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

  const responsiveColumns: ResponsiveColumn[] = columns.map((col, idx) => {
    let priority: 'primary' | 'secondary' | 'metadata' | 'action' | undefined = undefined;
    if (idx === 0) priority = 'primary';
    else if (idx === 1) priority = 'secondary';
    else if (
      col.key === 'action' || 
      col.key === 'actions' || 
      col.header.toLowerCase().includes('tác vụ') || 
      col.header.toLowerCase().includes('hành động')
    ) {
      priority = 'action';
    } else {
      priority = 'metadata';
    }

    return {
      key: col.key,
      header: col.header,
      priority,
      className: col.className,
      render: (val, row) => col.render ? col.render(val, row) : String(val ?? '')
    };
  });

  const paginationNode = !isLoading && totalCount > 0 ? (
    <div className="border-t border-white/50 w-full">
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
  ) : null;

  return (
    <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* Header of Table */}
      <div className="px-6 py-4 border-b border-white/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/40">
        <div>
          <h3 className="font-bold text-[#1E293B] text-[15px]">{title}</h3>
          <span className="text-[11px] text-[#64748B] font-semibold">
            Tổng cộng: {totalCount} bản ghi
          </span>
        </div>
        <button
          onClick={onExportExcel}
          disabled={totalCount === 0 || isLoading}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/40 hover:bg-white/70 border border-white/70 text-[#1E293B] disabled:opacity-50 disabled:scale-100 active:scale-95 transition-all text-xs font-bold rounded-xl shadow-sm cursor-pointer w-full sm:w-auto shrink-0"
        >
          <Download size={13} className="text-[#64748B]" />
          <span>Xuất Excel</span>
        </button>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto custom-scrollbar flex-1 min-h-[300px]">
        <ResponsiveDataView
          data={paginatedData}
          columns={responsiveColumns}
          isLoading={isLoading}
          emptyState={
            <div className="py-12 flex justify-center w-full">
              <ReportEmptyState message={emptyMessage} />
            </div>
          }
          keyExtractor={(row, idx) => row.key || row._id || row.id || String(idx)}
          pagination={paginationNode}
        />
      </div>
    </div>
  );
}
