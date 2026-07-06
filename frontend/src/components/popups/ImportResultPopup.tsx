'use client';
import React from 'react';
import Popup from './Popup';
import {
  Download, AlertCircle, CheckCircle2, Calendar, User, GraduationCap, FileWarning
} from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface ImportValidationError {
  row: number;
  studentCode?: string;
  fullName?: string;
  reason: string;
}

interface ImportResultPopupProps {
  isOpen: boolean;
  successCount: number;
  duplicatedCount: number;
  errors: ImportValidationError[];
  onClose: () => void;
}

export default function ImportResultPopup({ isOpen, onClose, successCount, duplicatedCount, errors }: ImportResultPopupProps) {

  // Export only the error records into a new Excel file for user correction
  const handleDownloadErrorReport = async () => {
    try {
      const XLSX = await import('xlsx');
      const headers = [['Dòng', 'Mã SV', 'Họ tên', 'Lý do lỗi']];
      const errorData = errors.map(err => [
        err.row,
        err.studentCode || '',
        err.fullName || '',
        err.reason
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...errorData]);

      // Professional Column Widths
      worksheet['!cols'] = [
        { wch: 10 }, // Dòng
        { wch: 15 }, // Mã SV
        { wch: 25 }, // Họ tên
        { wch: 45 }  // Lý do lỗi
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Error_Report');
      XLSX.writeFile(workbook, 'Bao_Cao_Loi_Import.xlsx');
    } catch (err) {
      console.error('Lỗi khi xuất file báo cáo lỗi:', err);
    }
  };

  // Helper to render appropriate error badge based on error text
  const renderErrorReasonBadge = (reason: string) => {
    const norm = reason.toLowerCase();

    // 1. Duplicate MSSV
    if (norm.includes('tồn tại') || norm.includes('trùng')) {
      return (
        <div className="bg-[rgba(255,218,214,0.3)] text-[#ba1a1a] flex gap-1.5 items-center px-2.5 py-1 rounded-md shrink-0 border border-[#ffdad6]/40">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="font-semibold text-xs leading-4">Mã sinh viên đã tồn tại</span>
        </div>
      );
    }

    // 2. Invalid Date format
    if (norm.includes('định dạng ngày sinh') || norm.includes('dd/mm/yyyy')) {
      return (
        <div className="bg-[rgba(255,218,214,0.3)] text-[#ba1a1a] flex gap-1.5 items-center px-2.5 py-1 rounded-md shrink-0 border border-[#ffdad6]/40">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span className="font-semibold text-xs leading-4">Định dạng ngày sinh không hợp lệ</span>
        </div>
      );
    }

    // 3. Missing Name
    if (norm.includes('họ tên') || norm.includes('họ đệm') || norm.includes('tên')) {
      return (
        <div className="bg-[rgba(249,171,0,0.1)] text-[#b07800] flex gap-1.5 items-center px-2.5 py-1 rounded-md shrink-0 border border-[#f9ab00]/20">
          <User className="w-3.5 h-3.5 shrink-0" />
          <span className="font-semibold text-xs leading-4">Dữ liệu trống họ tên</span>
        </div>
      );
    }

    // 4. Missing Date of birth
    if (norm.includes('thiếu ngày sinh') || norm.includes('ngày sinh')) {
      return (
        <div className="bg-[rgba(255,218,214,0.3)] text-[#ba1a1a] flex gap-1.5 items-center px-2.5 py-1 rounded-md shrink-0 border border-[#ffdad6]/40">
          <GraduationCap className="w-3.5 h-3.5 shrink-0" />
          <span className="font-semibold text-xs leading-4">Thiếu ngày sinh</span>
        </div>
      );
    }

    // Default Fallback
    return (
      <div className="bg-slate-50 text-slate-600 flex gap-1.5 items-center px-2.5 py-1 rounded-md shrink-0 border border-slate-100">
        <FileWarning className="w-3.5 h-3.5 shrink-0" />
        <span className="font-semibold text-xs leading-4 truncate max-w-[200px]">{reason}</span>
      </div>
    );
  };

  return (
    <Popup isOpen={isOpen} onClose={onClose} className="max-w-[720px] !bg-white/95 !backdrop-blur-md" contentClassName="p-0">
      <div className="flex flex-col items-start overflow-hidden rounded-[16px] w-full font-sans shadow-sm">

        {/* Modal Header */}
        <div className="border-slate-100 border-b flex h-[58px] items-center justify-between px-8 w-full shrink-0">
          <h2 className="font-bold text-[#1E293B] text-[16px] leading-6">
            Kết quả Import Sinh viên
          </h2>
        </div>

        {/* Modal Content */}
        <div className="flex flex-col gap-6 items-start overflow-y-auto p-8 w-full max-h-[60vh] custom-scrollbar">

          {/* Section 1: Summary Statistics (Bento Style Cards) */}
          <div className="grid grid-cols-3 gap-4 w-full shrink-0">

            {/* Success Card */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 flex items-center p-4 rounded-xl shadow-sm w-full">
              <div className="bg-emerald-500/20 flex items-center justify-center rounded-full shrink-0 w-10 h-10 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="pl-3 flex flex-col items-start justify-center">
                <span className="text-[11px] text-emerald-800 tracking-wide uppercase font-bold leading-normal mb-1">
                  THÀNH CÔNG
                </span>
                <div className="flex gap-1 items-baseline leading-none">
                  <span className="font-mono font-black text-emerald-600 text-3xl">
                    {successCount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#64748B] font-semibold ml-1">
                    bản ghi
                  </span>
                </div>
              </div>
            </div>

            {/* Duplicated Card */}
            <div className="bg-amber-500/10 border border-amber-500/20 flex items-center p-4 rounded-xl shadow-sm w-full">
              <div className="bg-amber-500/20 flex items-center justify-center rounded-full shrink-0 w-10 h-10 text-amber-600">
                <FileWarning className="w-5 h-5" />
              </div>
              <div className="pl-3 flex flex-col items-start justify-center">
                <span className="text-[11px] text-amber-800 tracking-wide uppercase font-bold leading-normal mb-1">
                  TRÙNG LẶP
                </span>
                <div className="flex gap-1 items-baseline leading-none">
                  <span className="font-mono font-black text-amber-600 text-3xl">
                    {duplicatedCount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#64748B] font-semibold ml-1">
                    bản ghi
                  </span>
                </div>
              </div>
            </div>

            {/* Failure Card */}
            <div className="bg-rose-500/10 border border-rose-500/20 flex items-center p-4 rounded-xl shadow-sm w-full">
              <div className="bg-rose-500/20 flex items-center justify-center rounded-full shrink-0 w-10 h-10 text-rose-600">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="pl-3 flex flex-col items-start justify-center">
                <span className="text-[11px] text-rose-800 tracking-wide uppercase font-bold leading-normal mb-1">
                  THẤT BẠI
                </span>
                <div className="flex gap-1 items-baseline leading-none">
                  <span className="font-mono font-black text-rose-600 text-3xl">
                    {errors.length.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#64748B] font-semibold ml-1">
                    bản ghi
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Section 2: Detailed Error List */}
          {errors.length > 0 && (
            <div className="flex flex-col gap-2 items-start w-full">
              <div className="flex items-center justify-between w-full">
                <h3 className="font-bold text-[#414754] text-[12px] tracking-[0.6px] uppercase leading-4">
                  DANH SÁCH CHI TIẾT LỖI
                </h3>
                <div className="bg-[#e9e7eb] flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-extrabold text-[#575f6b] tracking-wide uppercase shrink-0">
                  {errors.length} RECORDS
                </div>
              </div>

              {/* Table Container */}
              <div className="bg-[#f4f3f7] border border-slate-200/50 rounded-xl overflow-hidden w-full shrink-0 shadow-inner shadow-slate-100">
                <div className="w-full flex flex-col">

                  {/* Table Header */}
                  <div className="bg-[#efedf1] flex items-center w-full border-b border-slate-200/60 font-sans">
                    <div className="w-[30%] px-4 py-3 font-semibold text-[#414754] text-xs tracking-[0.6px]">
                      Dòng / MSSV
                    </div>
                    <div className="w-[30%] px-4 py-3 font-semibold text-[#414754] text-xs tracking-[0.6px]">
                      Họ và Tên
                    </div>
                    <div className="w-[40%] px-4 py-3 font-semibold text-[#414754] text-xs tracking-[0.6px]">
                      Lý do Lỗi
                    </div>
                  </div>

                  {/* Table Body */}
                  <div className="flex flex-col w-full divide-y divide-slate-100 max-h-[30vh] overflow-y-auto custom-scrollbar bg-white">
                    {errors.map((error, idx) => (
                      <div key={idx} className="flex items-center w-full font-sans hover:bg-slate-50/50 transition-colors">
                        <div className="w-[30%] px-4 py-3.5 text-[#1a1b1e] text-[14px] font-medium leading-5">
                          Row {error.row} / <span className="font-mono text-slate-500 text-xs">{error.studentCode || 'N/A'}</span>
                        </div>
                        <div className="w-[30%] px-4 py-3.5 text-[#1a1b1e] text-[14px] font-medium leading-5">
                          {error.fullName || 'Chưa nhập'}
                        </div>
                        <div className="w-[40%] px-4 py-3 flex items-center">
                          {renderErrorReasonBadge(error.reason)}
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50/50 backdrop-blur-sm border-t border-slate-100 flex items-center justify-between px-8 py-4 w-full shrink-0">

          {/* Download Report Button */}
          <button
            type="button"
            onClick={handleDownloadErrorReport}
            className="flex items-center gap-2 text-[#1A73E8] font-bold text-xs hover:text-blue-700 hover:bg-slate-100/80 transition-all duration-150 ease-out h-auto py-2 px-4 shrink-0 rounded-xl hover:scale-[1.01]"
          >
            <Download className="w-4 h-4" />
            Tải về báo cáo lỗi (.xlsx)
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-100 text-[#64748B] hover:bg-slate-200/80 rounded-xl font-bold text-xs transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm"
          >
            Đóng
          </button>
        </div>

      </div>
    </Popup>
  );
}
