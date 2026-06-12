'use client';

import React from 'react';
import ReportTable, { TableColumn } from '../ReportTable';
import { TaskReportRow, TaskProgressReportRow } from '../report-types';

interface TaskReportTabProps {
  data: TaskReportRow[];
  taskProgressData: TaskProgressReportRow[];
  isLoading: boolean;
  onExport: () => void;
  onExportProgress: () => void;
}

const columns: TableColumn[] = [
  { key: 'title', header: 'Tên nhiệm vụ', className: 'font-bold text-slate-800 max-w-[200px] truncate' },
  { key: 'type', header: 'Loại' },
  { key: 'subject', header: 'Chủ đề/Môn học', className: 'max-w-[150px] truncate' },
  { key: 'deadline', header: 'Hạn hoàn thành' },
  { 
    key: 'priority', 
    header: 'Độ ưu tiên',
    render: (val: string) => {
      const colors: Record<string, string> = {
        'Cao': 'bg-rose-50 border border-rose-100 text-rose-600',
        'Trung bình': 'bg-blue-50 border border-blue-100 text-blue-600',
        'Thấp': 'bg-slate-50 border border-slate-100 text-slate-500'
      };
      return (
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${colors[val] || 'bg-slate-50 border border-slate-100 text-slate-500'}`}>
          {val}
        </span>
      );
    }
  },
  { 
    key: 'status', 
    header: 'Trạng thái',
    render: (val: string) => {
      const isComp = val === 'Hoàn thành';
      return (
        <span className={`font-black ${isComp ? 'text-emerald-600' : 'text-slate-400'}`}>
          {val}
        </span>
      );
    }
  },
  { key: 'targetType', header: 'Đối tượng' },
  { key: 'targetScope', header: 'Phạm vi' },
  { 
    key: 'completion_rate', 
    header: 'Tiến độ hoàn thành',
    className: 'min-w-[180px]',
    render: (val: number, row: TaskReportRow) => {
      const pct = val * 100;
      return (
        <div className="flex items-center gap-2">
          {/* Progress bar */}
          <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[12px] font-black text-slate-700 shrink-0 w-9 text-right">
            {pct.toFixed(0)}%
          </span>
          <span className="text-[10px] text-slate-400 font-semibold shrink-0">
            ({row.completed_count}/{row.total_count})
          </span>
        </div>
      );
    }
  }
];

const progressColumns: TableColumn[] = [
  { key: 'taskTitle', header: 'Nhiệm vụ', className: 'font-bold text-slate-800 max-w-[200px] truncate' },
  { key: 'assigneeName', header: 'Người nhận', className: 'font-bold text-slate-700' },
  { key: 'assigneeType', header: 'Vai trò' },
  { key: 'className', header: 'Lớp học' },
  { 
    key: 'status', 
    header: 'Trạng thái tiến độ',
    render: (val: string) => {
      const colors: Record<string, string> = {
        'Chưa bắt đầu': 'bg-slate-50 border border-slate-200 text-slate-400',
        'Đang thực hiện': 'bg-blue-50 border border-blue-100 text-blue-600',
        'Hoàn thành': 'bg-emerald-50 border border-emerald-100 text-emerald-600'
      };
      return (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${colors[val] || 'bg-slate-50 border border-slate-100 text-slate-500'}`}>
          {val}
        </span>
      );
    }
  },
  { key: 'startedAt', header: 'Bắt đầu' },
  { key: 'completedAt', header: 'Hoàn thành' },
  { key: 'deadline', header: 'Hạn chót' }
];

export default function TaskReportTab({ 
  data, 
  taskProgressData, 
  isLoading, 
  onExport, 
  onExportProgress 
}: TaskReportTabProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Table 1: Task Summaries */}
      <ReportTable
        title="Bảng thống kê Nhiệm vụ HSSV"
        columns={columns}
        data={data}
        isLoading={isLoading}
        onExportExcel={onExport}
        label="nhiệm vụ"
        emptyMessage="Không tìm thấy nhiệm vụ nào khớp với bộ lọc."
      />

      {/* Table 2: Assignee Progress */}
      <ReportTable
        title="Bảng tiến độ chi tiết người nhận nhiệm vụ"
        columns={progressColumns}
        data={taskProgressData}
        isLoading={isLoading}
        onExportExcel={onExportProgress}
        label="tiến độ người nhận"
        emptyMessage="Không tìm thấy thông tin tiến độ nào khớp với bộ lọc."
      />
    </div>
  );
}
