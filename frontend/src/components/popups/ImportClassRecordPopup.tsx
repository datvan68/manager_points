'use client';
import React, { useState, useRef } from 'react';
import Popup from './Popup';
import { Download, UploadCloud, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

import { ImportValidationError } from './ImportResultPopup';
import ImportClassRecordResultPopup from './ImportClassRecordResultPopup';
import { dailyClassReportApi } from '@/api/daily-class-report-api';

interface ImportClassRecordPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportClassRecordPopup({ isOpen, onClose, onSuccess }: ImportClassRecordPopupProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showResultPopup, setShowResultPopup] = useState(false);
  const [importStats, setImportStats] = useState<{ reports: number; records: number; errors: ImportValidationError[] }>({ reports: 0, records: 0, errors: [] });

  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const headers = [['Ma lop', 'Ngay bao cao', 'Giang vien ghi nhan', 'Ma sinh vien', 'Tieu chi', 'Ghi chu lop', 'Ghi chu ghi nhan', 'Trang thai']];
      const sample = [['CS101','15/05/2026','Nguyen Van A','SV202601','Vắng có phép','Ghi chú lớp','Ghi chú ghi nhận','active']];
      const ws = XLSX.utils.aoa_to_sheet([...headers, ...sample]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Import_Class_Records');
      XLSX.writeFile(wb, 'Mau_Import_Class_Records.xlsx');
      toast.success('Đã tải file mẫu');
    } catch (e) {
      console.error(e);
      toast.error('Lỗi khi tạo file mẫu');
    }
  };

  const validateAndSetFile = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') { toast.error('Chỉ chấp nhận file Excel'); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error('Dung lượng vượt quá 10MB'); return; }
    setFile(f);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) validateAndSetFile(e.target.files[0]);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeAndReset = () => {
    setFile(null);
    setIsImporting(false);
    setImportStats({ reports: 0, records: 0, errors: [] });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowResultPopup(false);
    onClose();
  };

  const handleStartImport = async () => {
    if (!file) {
      toast.error('Chọn file');
      return;
    }
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet) as any[];
        if (!rawRows || rawRows.length === 0) throw new Error('Tệp Excel rỗng');
        if (rawRows.length > 5000) throw new Error('Giới hạn 5.000 dòng');

        // 1. Validate on backend
        const valRes = await dailyClassReportApi.importClassRecords(rawRows, false);
        if (!valRes.success || (valRes.errors && valRes.errors.length > 0)) {
          setImportStats({
            reports: 0,
            records: 0,
            errors: valRes.errors || [],
          });
          setShowResultPopup(true);
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        // 2. Commit on backend
        const commitRes = await dailyClassReportApi.importClassRecords(rawRows, true);
        if (commitRes.success) {
          setImportStats({
            reports: commitRes.reportsCreated || 0,
            records: commitRes.recordsCreated || 0,
            errors: [],
          });
          toast.success('Import thành công!');
          if (onSuccess) onSuccess();
        } else {
          setImportStats({
            reports: 0,
            records: 0,
            errors: commitRes.errors || [],
          });
        }
        setShowResultPopup(true);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || 'Lỗi khi import');
      } finally {
        setIsImporting(false);
      }
    };
    reader.onerror = () => {
      toast.error('Lỗi đọc file');
      setIsImporting(false);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <>
      <Popup isOpen={isOpen} onClose={closeAndReset} className="max-w-[600px]" contentClassName="p-0">
        <div className="bg-white flex flex-col items-start overflow-hidden rounded-[12px] w-full font-sans">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 w-full shrink-0">
            <h2 className="text-[18px] font-bold text-[#0f172a] leading-7">Import Báo cáo lớp và Ghi nhận</h2>
          </div>

          <div className="flex flex-col gap-3 px-6 py-5 w-full overflow-y-auto max-h-[75vh]">
            <div className="flex gap-2 items-center w-full">
              <div className="bg-[#d8e2ff] flex items-center justify-center rounded-full shrink-0 w-6 h-6">
                <span className="font-bold text-[#004493] text-xs">1</span>
              </div>
              <h3 className="font-bold text-[#0f172a] text-xs tracking-wider uppercase">BƯỚC 1: TẢI FILE MẪU</h3>
            </div>
            <div className="pl-8">
              <button onClick={handleDownloadTemplate} className="border border-blue-100 hover:bg-blue-50 text-[#1a73e8] flex gap-2 items-center px-4 py-2 rounded-lg text-xs font-bold">
                <Download size={14} /> Tải file mẫu (.xlsx)
              </button>
            </div>

            <div className="flex gap-2 items-center w-full">
              <div className="bg-[#d8e2ff] flex items-center justify-center rounded-full shrink-0 w-6 h-6">
                <span className="font-bold text-[#004493] text-xs">2</span>
              </div>
              <h3 className="font-bold text-[#0f172a] text-xs tracking-wider uppercase">BƯỚC 2: TẢI TỆP LÊN</h3>
            </div>

            <div className="w-full pl-8">
              <div className={`bg-[#f8fafc] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer select-none \${dragActive ? 'border-blue-500 bg-blue-50/20' : 'border-[#cbd5e1] hover:border-blue-400 hover:bg-slate-50/50'}`} onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} disabled={isImporting} />
                {file ? (
                  <div className="flex flex-col items-center gap-3 w-full" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-emerald-50 rounded-full w-12 h-12 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100"><FileSpreadsheet size={24} /></div>
                    <div className="flex flex-col items-center max-w-[85%]"><p className="text-[14px] font-bold text-slate-800 truncate w-full">{file.name}</p><p className="text-xs text-slate-400 font-medium mt-0.5">{(file.size / 1024).toFixed(1)} KB</p></div>
                    <button type="button" onClick={handleRemoveFile} className="mt-1 text-xs text-rose-500 hover:text-rose-700 font-bold px-3 py-1 hover:bg-rose-50 rounded-lg">Chọn tệp khác</button>
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-50/70 rounded-full w-12 h-12 flex items-center justify-center text-blue-600 mb-3 shadow-sm border border-blue-100/50"><UploadCloud size={24} /></div>
                    <p className="text-[14px] font-semibold text-slate-800 leading-6 px-2">Kéo thả tệp hoặc nhấn để chọn</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-1">Chấp nhận .xlsx, .xls (Tối đa 10MB) - Tối đa 5.000 dòng</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-2 items-center w-full pt-2">
              <div className="bg-[#d8e2ff] flex items-center justify-center rounded-full shrink-0 w-6 h-6"><span className="font-bold text-[#004493] text-xs">3</span></div>
              <h3 className="font-bold text-[#0f172a] text-xs tracking-wider uppercase">BƯỚC 3: XỬ LÝ & IMPORT</h3>
            </div>
            <div className="pl-8 text-slate-500 text-sm">Hệ thống sẽ xác thực theo Mã lớp, Mã SV, Tiêu chí và Ngày báo cáo. Các báo cáo/lưu ghi nhận hợp lệ sẽ được tạo, bản ghi lỗi được báo cáo.</div>
          </div>

          <div className="bg-slate-50 flex gap-3 items-center justify-end px-6 py-4 border-t border-slate-100 w-full shrink-0">
            <button type="button" onClick={closeAndReset} disabled={isImporting} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg">Hủy bỏ</button>
            <button type="button" onClick={handleStartImport} disabled={!file || isImporting} className="bg-[#1a73e8] hover:bg-blue-700 disabled:bg-blue-300 text-white flex gap-1.5 items-center px-5 py-2.5 rounded-lg text-xs font-bold">{isImporting && <Loader2 size={14} className="animate-spin" />}{isImporting ? 'Đang import...' : 'Bắt đầu Import'}</button>
          </div>
        </div>
      </Popup>

      <ImportClassRecordResultPopup isOpen={showResultPopup} onClose={() => { setShowResultPopup(false); if ((importStats.reports > 0 || importStats.records > 0) && onSuccess) onSuccess(); }} reportsCount={importStats.reports} recordsCount={importStats.records} errors={importStats.errors} />
    </>
  );
}
