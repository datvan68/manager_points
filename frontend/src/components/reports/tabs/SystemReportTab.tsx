'use client';

import React from 'react';
import ReportTable, { TableColumn } from '../ReportTable';
import { SystemReportRow } from '../report-types';

interface SystemReportTabProps {
  notificationsData: any[];
  onExportNotifications: () => void;
  logsData: SystemReportRow[];
  onExportLogs: () => void;
  isLoading: boolean;
  showLogs: boolean;
}

const notificationColumns: TableColumn[] = [
  { key: 'createdAt', header: 'Thời điểm', className: 'font-mono text-slate-400' },
  { key: 'title', header: 'Tiêu đề', className: 'font-bold text-slate-800 max-w-[250px] truncate' },
  { key: 'type', header: 'Loại' },
  { key: 'description', header: 'Nội dung thông báo', className: 'text-slate-500 max-w-[350px] truncate' },
  { 
    key: 'isRead', 
    header: 'Trạng thái',
    render: (val: string) => {
      const isRead = val === 'Đã đọc';
      return (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
          isRead ? 'bg-slate-50 border border-slate-200 text-slate-400' : 'bg-blue-50 border border-blue-100 text-blue-600'
        }`}>
          {val}
        </span>
      );
    }
  },
  { key: 'source', header: 'Nguồn phát' }
];

const logColumns: TableColumn[] = [
  { key: 'login_time', header: 'Thời điểm' },
  { key: 'user_name', header: 'Tài khoản', className: 'font-bold text-slate-800' },
  { key: 'email', header: 'Email' },
  { 
    key: 'role_name', 
    header: 'Vai trò',
    render: (val: string) => {
      const isAdm = val.toLowerCase().includes('admin');
      return (
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
          isAdm ? 'bg-rose-50 border border-rose-100 text-rose-600' : 'bg-slate-50 border border-slate-100 text-slate-500'
        }`}>
          {val}
        </span>
      );
    }
  },
  { key: 'ip_address', header: 'Địa chỉ IP', className: 'font-mono text-slate-400' },
  { 
    key: 'action', 
    header: 'Hành động',
    render: (val: string) => {
      let style = 'text-slate-600';
      if (val.includes('thành công')) style = 'text-emerald-600';
      else if (val.includes('thất bại')) style = 'text-rose-600';
      else if (val.includes('đăng xuất')) style = 'text-slate-400';
      
      return <span className={`font-black ${style}`}>{val}</span>;
    }
  },
  { key: 'details', header: 'Chi tiết hành động', className: 'max-w-[200px] truncate text-slate-400 font-medium' }
];

export default function SystemReportTab({
  notificationsData,
  onExportNotifications,
  logsData,
  onExportLogs,
  isLoading,
  showLogs
}: SystemReportTabProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Table 1: System Notifications */}
      <ReportTable
        title="Thống kê Thông báo Hệ thống"
        columns={notificationColumns}
        data={notificationsData}
        isLoading={isLoading}
        onExportExcel={onExportNotifications}
        label="thông báo"
        emptyMessage="Không tìm thấy thông tin thông báo nào khớp với bộ lọc."
      />

      {/* Table 2: System Logs (Admin only) */}
      {showLogs && (
        <ReportTable
          title="Nhật ký Đăng nhập & Vận hành Hệ thống"
          columns={logColumns}
          data={logsData}
          isLoading={isLoading}
          onExportExcel={onExportLogs}
          label="nhật ký logs"
          emptyMessage="Không tìm thấy nhật ký logs nào khớp với bộ lọc."
        />
      )}
    </div>
  );
}
