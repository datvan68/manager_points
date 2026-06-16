'use client';

import React from 'react';
import ReportTable, { TableColumn } from '../ReportTable';
import { AttendanceReportRow } from '../report-types';

interface AttendanceReportTabProps {
  data: AttendanceReportRow[];
  isLoading: boolean;
  onExport: () => void;
  serverSide?: boolean;
  totalItems?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const columns: TableColumn[] = [
  { key: 'report_date', header: 'Ngày báo cáo' },
  { key: 'class_name', header: 'Lớp học', className: 'font-bold text-[#1E293B]' },
  { key: 'department_name', header: 'Khoa' },
  { key: 'teacher_name', header: 'Giảng viên' },
  { key: 'total_present', header: 'Có mặt', className: 'text-center font-bold text-emerald-600' },
  { key: 'total_absent', header: 'Vắng', className: 'text-center font-bold text-rose-600' },
  { key: 'total', header: 'Tổng số', className: 'text-center text-[#64748B]' },
  { 
    key: 'attendance_rate', 
    header: 'Tỉ lệ hiện diện',
    className: 'text-center font-black text-[#1E293B] text-[13.5px]',
    render: (val: number) => {
      const pct = val * 100;
      let color = 'text-[#1E293B]';
      if (pct >= 95) color = 'text-emerald-600';
      else if (pct >= 85) color = 'text-blue-600';
      else if (pct >= 75) color = 'text-amber-600';
      else color = 'text-rose-600';

      return <span className={color}>{pct.toFixed(1)}%</span>;
    }
  },
  { key: 'class_note', header: 'Ghi chú', className: 'max-w-[200px] truncate text-[#64748B] font-medium' }
];

export default function AttendanceReportTab({
  data,
  isLoading,
  onExport,
  serverSide,
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange
}: AttendanceReportTabProps) {
  return (
    <div className="p-6">
      <ReportTable
        title="Danh sách Báo cáo Chuyên cần Lớp học"
        columns={columns}
        data={data}
        isLoading={isLoading}
        onExportExcel={onExport}
        label="báo cáo ngày"
        emptyMessage="Không tìm thấy báo cáo chuyên cần nào khớp với bộ lọc."
        serverSide={serverSide}
        totalItems={totalItems}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
