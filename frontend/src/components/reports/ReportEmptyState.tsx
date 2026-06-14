'use client';

import React from 'react';
import { Inbox } from 'lucide-react';

interface ReportEmptyStateProps {
  message?: string;
}

export default function ReportEmptyState({ message = 'Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại.' }: ReportEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto select-none animate-in fade-in duration-300">
      <div className="w-14 h-14 rounded-2xl bg-white/40 border border-white/70 flex items-center justify-center text-[#64748B] shadow-sm mb-4">
        <Inbox size={24} strokeWidth={1.5} />
      </div>
      <h4 className="text-sm font-bold text-[#1E293B] leading-tight">Không có dữ liệu</h4>
      <p className="text-xs text-[#64748B] font-semibold mt-1.5 leading-relaxed">
        {message} Vui lòng điều chỉnh lại bộ lọc học kỳ, khoa, lớp hoặc từ khóa tìm kiếm.
      </p>
    </div>
  );
}
