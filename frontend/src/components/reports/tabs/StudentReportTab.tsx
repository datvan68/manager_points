'use client';

import React from 'react';
import ReportTable, { TableColumn } from '../ReportTable';
import { StudentReportRow } from '../report-types';

interface StudentReportTabProps {
  data: StudentReportRow[];
  isLoading: boolean;
  onExport: () => void;
}

const columns: TableColumn[] = [
  { key: 'student_code', header: 'Mã HSSV', className: 'font-bold text-[#1E293B]' },
  { key: 'full_name', header: 'Họ tên', className: 'font-bold text-[#1E293B]' },
  { key: 'class_name', header: 'Lớp' },
  { key: 'department_name', header: 'Khoa' },
  { key: 'class_year', header: 'Khóa/Năm' },
  { key: 'class_type', header: 'Hệ đào tạo' },
  { key: 'headquarters', header: 'Cơ sở' },
  { 
    key: 'status', 
    header: 'Trạng thái học tập',
    render: (val: string) => {
      const colors: Record<string, string> = {
        'Đang học': 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
        'Bảo lưu': 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
        'Thôi học': 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
        'Đình chỉ': 'bg-rose-500/20 text-rose-700 border border-rose-500/30',
        'Tốt nghiệp': 'bg-blue-500/10 text-[#1A73E8] border border-blue-500/20'
      };
      return (
        <span className={`inline-block px-2.5 py-0.5 rounded-xl text-[11px] font-bold ${colors[val] || 'bg-white/50 border border-white/70 text-[#64748B]'}`}>
          {val}
        </span>
      );
    }
  },
  { 
    key: 'account_status', 
    header: 'Tài khoản',
    render: (val: string) => {
      const colors: Record<string, string> = {
        'Hoạt động': 'text-emerald-600',
        'Không hoạt động': 'text-[#64748B]',
        'Đã khóa': 'text-rose-600'
      };
      return <span className={`font-black ${colors[val] || 'text-[#64748B]'}`}>{val}</span>;
    }
  }
];

export default function StudentReportTab({ data, isLoading, onExport }: StudentReportTabProps) {
  return (
    <div className="p-6">
      <ReportTable
        title="Danh sách Học sinh sinh viên"
        columns={columns}
        data={data}
        isLoading={isLoading}
        onExportExcel={onExport}
        label="học sinh sinh viên"
        emptyMessage="Không tìm thấy học sinh sinh viên nào khớp với bộ lọc."
      />
    </div>
  );
}
