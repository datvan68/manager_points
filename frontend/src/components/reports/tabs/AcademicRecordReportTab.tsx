'use client';

import React from 'react';
import ReportTable, { TableColumn } from '../ReportTable';
import { AcademicRecordReportRow } from '../report-types';

interface AcademicRecordReportTabProps {
  data: AcademicRecordReportRow[];
  isLoading: boolean;
  onExport: () => void;
}

const columns: TableColumn[] = [
  { key: 'recorded_at', header: 'Ngày ghi nhận' },
  { key: 'student_code', header: 'Mã HSSV', className: 'font-bold text-[#1E293B]' },
  { key: 'full_name', header: 'Họ tên', className: 'font-bold text-[#1E293B]' },
  { key: 'class_name', header: 'Lớp' },
  { 
    key: 'type', 
    header: 'Phân loại',
    render: (val: string) => {
      const config: Record<string, { label: string; style: string }> = {
        'ky_luat': { label: 'Kỷ luật', style: 'bg-rose-500/10 border border-rose-500/20 text-rose-700' },
        'khen_thuong': { label: 'Khen thưởng', style: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600' },
        'cong_diem': { label: 'Cộng điểm', style: 'bg-blue-500/10 border border-blue-500/20 text-[#1A73E8]' },
        'khac': { label: 'Khác', style: 'bg-white/50 border border-white/70 text-[#64748B]' }
      };
      const item = config[val] || config.khac;
      return (
        <span className={`inline-block px-2.5 py-0.5 rounded-xl text-[11px] font-bold ${item.style}`}>
          {item.label}
        </span>
      );
    }
  },
  { key: 'record_title', header: 'Tiêu đề ghi nhận', className: 'max-w-[200px] truncate' },
  { key: 'description', header: 'Mô tả', className: 'max-w-[250px] truncate text-[#64748B] font-medium' },
  { 
    key: 'points_effect', 
    header: 'Điểm RL',
    className: 'text-center font-black text-[13px]',
    render: (val: number) => {
      if (val > 0) return <span className="text-[#1A73E8]">+{val}</span>;
      if (val < 0) return <span className="text-rose-600">{val}</span>;
      return <span className="text-[#64748B]">0</span>;
    }
  },
  { key: 'recorded_by', header: 'Người ghi' },
  { 
    key: 'status', 
    header: 'Trạng thái',
    render: (val: string) => {
      const isAct = val === 'Hoạt động';
      return (
        <span className={`font-black ${isAct ? 'text-emerald-600' : 'text-[#64748B]'}`}>
          {val}
        </span>
      );
    }
  }
];

export default function AcademicRecordReportTab({ data, isLoading, onExport }: AcademicRecordReportTabProps) {
  return (
    <div className="p-6">
      <ReportTable
        title="Danh sách Ghi nhận Rèn luyện"
        columns={columns}
        data={data}
        isLoading={isLoading}
        onExportExcel={onExport}
        label="ghi nhận"
        emptyMessage="Không tìm thấy ghi nhận rèn luyện nào khớp với bộ lọc."
      />
    </div>
  );
}
