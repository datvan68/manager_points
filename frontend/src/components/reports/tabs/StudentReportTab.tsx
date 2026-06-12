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
  { key: 'student_code', header: 'Mã HSSV', className: 'font-bold text-slate-700' },
  { key: 'full_name', header: 'Họ tên', className: 'font-bold text-slate-800' },
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
        'Đang học': 'bg-emerald-50 text-emerald-600 border border-emerald-100',
        'Bảo lưu': 'bg-amber-50 text-amber-600 border border-amber-100',
        'Thôi học': 'bg-rose-50 text-rose-600 border border-rose-100',
        'Đình chỉ': 'bg-rose-100 text-rose-700 border border-rose-200',
        'Tốt nghiệp': 'bg-blue-50 text-blue-600 border border-blue-100'
      };
      return (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${colors[val] || 'bg-slate-50 border border-slate-100 text-slate-500'}`}>
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
        'Không hoạt động': 'text-slate-400',
        'Đã khóa': 'text-rose-600'
      };
      return <span className={`font-black ${colors[val] || 'text-slate-500'}`}>{val}</span>;
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
