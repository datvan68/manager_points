'use client';

import React from 'react';
import ReportTable, { TableColumn } from '../ReportTable';
import { ScoreReportRow, ScoreDetailReportRow } from '../report-types';

interface ScoreReportTabProps {
  data: ScoreReportRow[];
  scoreDetailsData: ScoreDetailReportRow[];
  isLoading: boolean;
  onExport: () => void;
  onExportDetails: () => void;
  
  // Table 1 (summaries) pagination
  serverSide?: boolean;
  totalItems?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;

  // Table 2 (details) pagination
  detailsServerSide?: boolean;
  detailsTotalItems?: number;
  detailsCurrentPage?: number;
  detailsPageSize?: number;
  detailsOnPageChange?: (page: number) => void;
  detailsOnPageSizeChange?: (size: number) => void;
}

const columns: TableColumn[] = [
  { key: 'student_code', header: 'Mã HSSV', className: 'font-bold text-[#1E293B]' },
  { key: 'full_name', header: 'Họ tên', className: 'font-bold text-[#1E293B]' },
  { key: 'class_name', header: 'Lớp' },
  { key: 'department_name', header: 'Khoa' },
  { key: 'semester_name', header: 'Học kỳ' },
  { 
    key: 'total_score', 
    header: 'Tổng điểm',
    className: 'text-center font-black text-[#1E293B] text-[14px]',
    render: (val: number) => {
      let colorClass = 'text-[#1E293B]';
      if (val >= 90) colorClass = 'text-emerald-600';
      else if (val >= 80) colorClass = 'text-blue-600';
      else if (val >= 65) colorClass = 'text-amber-600';
      else if (val >= 50) colorClass = 'text-orange-600';
      else colorClass = 'text-rose-600';
      
      return <span className={colorClass}>{val}</span>;
    }
  },
  { 
    key: 'grading', 
    header: 'Xếp loại',
    render: (val: string) => {
      const colors: Record<string, string> = {
        'Xuất sắc': 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600',
        'Tốt': 'bg-emerald-500/5 border border-emerald-500/10 text-emerald-500',
        'Khá': 'bg-blue-500/10 border border-blue-500/20 text-[#1A73E8]',
        'Trung bình': 'bg-amber-500/10 border border-amber-500/20 text-amber-600',
        'Yếu': 'bg-orange-500/10 border border-orange-500/20 text-orange-600',
        'Kém': 'bg-rose-500/10 border border-rose-500/20 text-rose-600'
      };
      return (
        <span className={`inline-block px-2.5 py-0.5 rounded-xl text-[11px] font-bold ${colors[val] || 'bg-white/50 border border-white/70 text-[#64748B]'}`}>
          {val}
        </span>
      );
    }
  },
  { 
    key: 'status', 
    header: 'Trạng thái',
    render: (val: string) => {
      const colors: Record<string, string> = {
        'Nháp': 'bg-white/40 border border-white/70 text-[#64748B]',
        'SV đã nộp': 'bg-amber-500/10 border border-amber-500/20 text-amber-600',
        'GV đã duyệt': 'bg-blue-500/10 border border-blue-500/20 text-[#1A73E8]',
        'Đã khóa': 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600'
      };
      return (
        <span className={`inline-block px-2.5 py-0.5 rounded-xl text-[11px] font-bold ${colors[val] || 'bg-white/50 border border-white/70 text-[#64748B]'}`}>
          {val}
        </span>
      );
    }
  },
  { key: 'updatedAt', header: 'Cập nhật' }
];

const detailColumns: TableColumn[] = [
  { key: 'student_code', header: 'Mã HSSV', className: 'font-bold text-[#1E293B]' },
  { key: 'full_name', header: 'Họ tên', className: 'font-bold text-[#1E293B]' },
  { key: 'class_name', header: 'Lớp' },
  { key: 'category_name', header: 'Nhóm tiêu chí', className: 'font-bold text-[#1A73E8]' },
  { key: 'criterion_name', header: 'Tiêu chí', className: 'max-w-[200px] truncate' },
  { key: 'current_count', header: 'Số lần', className: 'text-center text-[#1E293B] font-bold' },
  { key: 'system_score', header: 'Điểm HT', className: 'text-center text-[#64748B] font-medium' },
  { key: 'sv_score', header: 'Điểm SV', className: 'text-center text-[#64748B] font-bold' },
  { key: 'gv_score', header: 'Điểm GV', className: 'text-center text-[#1E293B] font-extrabold' },
  { 
    key: 'final_score', 
    header: 'Điểm cuối', 
    className: 'text-center font-black text-[#1A73E8] text-[13.5px]'
  },
  { 
    key: 'status', 
    header: 'Trạng thái',
    render: (val: string) => {
      const colors: Record<string, string> = {
        'Nháp': 'text-[#64748B]',
        'SV đã nộp': 'text-amber-500',
        'GV đã duyệt': 'text-[#1A73E8]',
        'Đã khóa': 'text-emerald-600'
      };
      return <span className={`font-black ${colors[val] || 'text-[#64748B]'}`}>{val}</span>;
    }
  }
];

export default function ScoreReportTab({ 
  data, 
  scoreDetailsData, 
  isLoading, 
  onExport, 
  onExportDetails,
  serverSide,
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  detailsServerSide,
  detailsTotalItems,
  detailsCurrentPage,
  detailsPageSize,
  detailsOnPageChange,
  detailsOnPageSizeChange
}: ScoreReportTabProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Table 1: Summary Scores */}
      <ReportTable
        title="Bảng điểm rèn luyện tổng hợp"
        columns={columns}
        data={data}
        isLoading={isLoading}
        onExportExcel={onExport}
        label="kết quả điểm"
        emptyMessage="Không tìm thấy kết quả điểm rèn luyện nào khớp với bộ lọc."
        serverSide={serverSide}
        totalItems={totalItems}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />

      {/* Table 2: Criteria Details */}
      <ReportTable
        title="Bảng chi tiết tiêu chí rèn luyện"
        columns={detailColumns}
        data={scoreDetailsData}
        isLoading={isLoading}
        onExportExcel={onExportDetails}
        label="chi tiết tiêu chí"
        emptyMessage="Không tìm thấy chi tiết tiêu chí rèn luyện nào khớp với bộ lọc."
        serverSide={detailsServerSide}
        totalItems={detailsTotalItems}
        currentPage={detailsCurrentPage}
        pageSize={detailsPageSize}
        onPageChange={detailsOnPageChange}
        onPageSizeChange={detailsOnPageSizeChange}
      />
    </div>
  );
}
