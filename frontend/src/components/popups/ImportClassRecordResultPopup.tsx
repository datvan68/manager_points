'use client';
import React from 'react';
import Popup from './Popup';
import { Download, AlertCircle, CheckCircle2, FileWarning } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';

export interface ImportValidationError {
  row: number;
  studentCode?: string;
  fullName?: string;
  reason: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  reportsCount: number;
  recordsCount: number;
  errors: ImportValidationError[];
}

export default function ImportClassRecordResultPopup({ isOpen, onClose, reportsCount, recordsCount, errors }: Props) {
  const handleDownloadErrorReport = () => {
    try {
      const headers = [['Dòng', 'Mã SV', 'Họ và tên', 'Nguyên nhân Lỗi / Cảnh báo']];
      const errorData = errors.map(err => [
        `Dòng ${err.row}`,
        err.studentCode || '',
        err.fullName || '',
        err.reason
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...errorData]);
      worksheet['!cols'] = [ { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 45 } ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Error_Report');
      XLSX.writeFile(workbook, 'Bao_Cao_Loi_Import_BaoCaoLop.xlsx');
    } catch (err) {
      console.error('Lỗi khi xuất file báo cáo lỗi:', err);
    }
  };

  return (
    <Popup isOpen={isOpen} onClose={onClose} className="max-w-[720px]" contentClassName="p-0">
      <div className="bg-white flex flex-col items-start overflow-hidden rounded-[12px] shadow-[0px_24px_48px_0px_rgba(0,0,0,0.12)] w-full font-sans">
        <div className="border-[#efedf1] border-b border-solid flex h-[58px] items-center justify-between px-8 w-full shrink-0">
          <h2 className="font-bold text-[#1a1b1e] text-[18px] leading-[28px]">Kết quả Import Báo cáo Lớp</h2>
        </div>

        <div className="flex flex-col gap-6 items-start overflow-y-auto p-8 w-full max-h-[60vh] custom-scrollbar">
          <div className="grid grid-cols-2 gap-4 w-full shrink-0">
            <div className="bg-[#006d2b]/[0.05] flex items-center h-[68.5px] p-3 rounded-lg border border-[#006d2b]/10 w-full">
              <div className="bg-[#96f8a1] flex items-center justify-center rounded-full shrink-0 w-10 h-10 text-[#006d2b] shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="pl-3 flex flex-col items-start justify-center">
                <span className="text-[#575f6b] text-[10px] tracking-[0.5px] uppercase font-medium leading-normal">BÁO CÁO TẠO</span>
                <div className="flex gap-1 items-baseline mt-0.5 leading-none">
                  <span className="font-black text-[#006d2b] text-[24px]">{reportsCount.toLocaleString()}</span>
                  <span className="text-[10px] text-[#414754]/80 font-normal">báo cáo</span>
                </div>
              </div>
            </div>

            <div className="bg-[#006d2b]/[0.05] flex items-center h-[68.5px] p-3 rounded-lg border border-[#006d2b]/10 w-full">
              <div className="bg-[#96f8a1] flex items-center justify-center rounded-full shrink-0 w-10 h-10 text-[#006d2b] shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="pl-3 flex flex-col items-start justify-center">
                <span className="text-[#575f6b] text-[10px] tracking-[0.5px] uppercase font-medium leading-normal">GHI NHẬN TẠO</span>
                <div className="flex gap-1 items-baseline mt-0.5 leading-none">
                  <span className="font-black text-[#006d2b] text-[24px]">{recordsCount.toLocaleString()}</span>
                  <span className="text-[10px] text-[#414754]/80 font-normal">ghi nhận</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-start w-full">
            <div className="flex items-center justify-between w-full">
              <h3 className="font-bold text-[#414754] text-[12px] tracking-[0.6px] uppercase leading-4">DANH SÁCH CHI TIẾT LỖI</h3>
              <div className="bg-[#e9e7eb] flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-extrabold text-[#575f6b] tracking-wide uppercase shrink-0">{errors.length} RECORDS</div>
            </div>

            <div className="bg-[#f4f3f7] border border-slate-200/50 rounded-xl overflow-hidden w-full shrink-0">
              <div className="w-full flex flex-col">
                <div className="bg-[#efedf1] flex items-center w-full border-b border-slate-200/60 font-sans">
                  <div className="w-[30%] px-4 py-3 font-semibold text-[#414754] text-xs tracking-[0.6px]">Dòng / MSSV</div>
                  <div className="w-[30%] px-4 py-3 font-semibold text-[#414754] text-xs tracking-[0.6px]">Họ và Tên</div>
                  <div className="w-[40%] px-4 py-3 font-semibold text-[#414754] text-xs tracking-[0.6px]">Lý do Lỗi</div>
                </div>

                <div className="flex flex-col w-full divide-y divide-slate-100 max-h-[30vh] overflow-y-auto custom-scrollbar bg-white">
                  {errors.map((error, idx) => (
                    <div key={idx} className="flex items-center w-full font-sans hover:bg-slate-50/50 transition-colors">
                      <div className="w-[30%] px-4 py-3.5 text-[#1a1b1e] text-[14px] font-medium leading-5">Row {error.row} / <span className="font-mono text-slate-500 text-xs">{error.studentCode || 'N/A'}</span></div>
                      <div className="w-[30%] px-4 py-3.5 text-[#1a1b1e] text-[14px] font-medium leading-5">{error.fullName || 'Chưa nhập'}</div>
                      <div className="w-[40%] px-4 py-3 flex items-center">
                        <div className="bg-slate-50 text-slate-600 flex gap-1.5 items-center px-2.5 py-1 rounded-md shrink-0 border border-slate-100">
                          <FileWarning className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-semibold text-xs leading-4 truncate max-w-[200px]">{error.reason}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#faf9fd] border-[#efedf1] border-solid border-t flex items-center justify-between px-8 py-4 w-full shrink-0">
          <Button type="button" variant="ghost" onClick={handleDownloadErrorReport} className="flex items-center gap-2 text-[#005bbf] font-bold text-sm hover:text-[#004493] hover:bg-slate-100/80 transition-colors h-auto py-2 px-4 shrink-0">
            <Download className="w-4 h-4" /> Tải về báo cáo lỗi (.xlsx)
          </Button>

          <Button type="button" onClick={onClose} className="px-6 py-2.5 h-auto text-sm">Đóng</Button>
        </div>
      </div>
    </Popup>
  );
}
