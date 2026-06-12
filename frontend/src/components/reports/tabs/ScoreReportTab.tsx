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
}

const columns: TableColumn[] = [
  { key: 'student_code', header: 'Mã HSSV', className: 'font-bold text-slate-700' },
  { key: 'full_name', header: 'Họ tên', className: 'font-bold text-slate-800' },
  { key: 'class_name', header: 'Lớp' },
  { key: 'department_name', header: 'Khoa' },
  { key: 'semester_name', header: 'Học kỳ' },
  { 
    key: 'total_score', 
    header: 'Tổng điểm',
    className: 'text-center font-black text-slate-800 text-[14px]',
    render: (val: number) => {
      let colorClass = 'text-slate-700';
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
        'Xuất sắc': 'bg-emerald-50 border border-emerald-100 text-emerald-600',
        'Tốt': 'bg-emerald-50/50 border border-emerald-100/50 text-emerald-500',
        'Khá': 'bg-blue-50 border border-blue-100 text-blue-600',
        'Trung bình': 'bg-amber-50 border border-amber-100 text-amber-600',
        'Yếu': 'bg-orange-50 border border-orange-100 text-orange-600',
        'Kém': 'bg-rose-50 border border-rose-100 text-rose-600'
      };
      return (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${colors[val] || 'bg-slate-50 border border-slate-100 text-slate-500'}`}>
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
        'Nháp': 'bg-slate-50 border border-slate-200 text-slate-400',
        'SV đã nộp': 'bg-amber-50 border border-amber-100 text-amber-500',
        'GV đã duyệt': 'bg-blue-50 border border-blue-100 text-blue-600',
        'Đã khóa': 'bg-emerald-50 border border-emerald-100 text-emerald-600'
      };
      return (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${colors[val] || 'bg-slate-50 border border-slate-100 text-slate-500'}`}>
          {val}
        </span>
      );
    }
  },
  { key: 'updatedAt', header: 'Cập nhật' }
];

const detailColumns: TableColumn[] = [
  { key: 'student_code', header: 'Mã HSSV', className: 'font-bold text-slate-700' },
  { key: 'full_name', header: 'Họ tên', className: 'font-bold text-slate-800' },
  { key: 'class_name', header: 'Lớp' },
  { key: 'category_name', header: 'Nhóm tiêu chí', className: 'font-bold text-blue-600' },
  { key: 'criterion_name', header: 'Tiêu chí', className: 'max-w-[200px] truncate' },
  { key: 'current_count', header: 'Số lần', className: 'text-center text-slate-600 font-bold' },
  { key: 'system_score', header: 'Điểm HT', className: 'text-center text-slate-400 font-medium' },
  { key: 'sv_score', header: 'Điểm SV', className: 'text-center text-slate-500 font-bold' },
  { key: 'gv_score', header: 'Điểm GV', className: 'text-center text-slate-700 font-extrabold' },
  { 
    key: 'final_score', 
    header: 'Điểm cuối', 
    className: 'text-center font-black text-blue-600 text-[13.5px]'
  },
  { 
    key: 'status', 
    header: 'Trạng thái',
    render: (val: string) => {
      const colors: Record<string, string> = {
        'Nháp': 'text-slate-400',
        'SV đã nộp': 'text-amber-500',
        'GV đã duyệt': 'text-blue-600',
        'Đã khóa': 'text-emerald-600'
      };
      return <span className={`font-black ${colors[val] || 'text-slate-500'}`}>{val}</span>;
    }
  }
];

export default function ScoreReportTab({ 
  data, 
  scoreDetailsData, 
  isLoading, 
  onExport, 
  onExportDetails 
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
      />
    </div>
  );
}
