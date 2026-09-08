'use client';

import React from 'react';
import ReportTable, { TableColumn } from '../ReportTable';
import { AcademicRecordStudentSummaryRow } from '../report-types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface AcademicRecordReportTabProps {
  data: AcademicRecordStudentSummaryRow[];
  isLoading: boolean;
  onExport: () => void;
  serverSide?: boolean;
  totalItems?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

function DetailCell({ row }: { row: AcademicRecordStudentSummaryRow }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-lg border border-[#1A73E8]/20 bg-[#1A73E8]/5 px-2.5 py-1 text-[11px] font-bold text-[#1A73E8] hover:bg-[#1A73E8]/10"
        >
          Chi tiết
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-64 p-3 text-xs" showCloseButton>
        <h4 className="mb-2 pr-5 font-bold text-[#1E293B]">Chi tiết ghi nhận</h4>
        <div className="space-y-1.5 text-[#475569]">
          <p><span className="font-semibold">Tổng lượt:</span> {row.record_count} lần</p>
          <p><span className="font-semibold">Khen thưởng:</span> {row.reward_count}</p>
          <p><span className="font-semibold">Cộng điểm:</span> {row.bonus_count}</p>
          <p><span className="font-semibold">Kỷ luật:</span> {row.discipline_count}</p>
          <p><span className="font-semibold">Tổng điểm:</span> {row.total_points}</p>
          <p><span className="font-semibold">Gần nhất:</span> {row.latest_record_title}</p>
          <p><span className="font-semibold">Ngày:</span> {row.latest_record_at}</p>
          <p><span className="font-semibold">Người ghi:</span> {row.latest_recorded_by}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const columns: TableColumn[] = [
  { key: 'student_code', header: 'Mã HSSV', className: 'font-bold text-[#1E293B]' },
  { key: 'full_name', header: 'Họ tên', className: 'font-bold text-[#1E293B]' },
  { key: 'class_name', header: 'Lớp' },
  { key: 'record_count', header: 'Số lượt', className: 'text-[11px]', render: (val: number) => <span>{val} lần</span> },
  { key: 'reward_count', header: 'Khen thưởng' },
  { key: 'bonus_count', header: 'Cộng điểm' },
  { key: 'discipline_count', header: 'Kỷ luật' },
  { key: 'total_points', header: 'Tổng điểm', className: 'font-black' },
  { key: 'detail', header: 'Chi tiết', render: (_value: unknown, row: AcademicRecordStudentSummaryRow) => <DetailCell row={row} /> }
];

export default function AcademicRecordReportTab({
  data,
  isLoading,
  onExport,
  serverSide,
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange
}: AcademicRecordReportTabProps) {
  return (
    <div className="p-6 text-xs">
      <ReportTable
        title="Tổng hợp Ghi nhận sinh viên"
        columns={columns}
        data={data}
        isLoading={isLoading}
        onExportExcel={onExport}
        label="sinh viên"
        emptyMessage="Không tìm thấy sinh viên có ghi nhận nào khớp với bộ lọc."
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
