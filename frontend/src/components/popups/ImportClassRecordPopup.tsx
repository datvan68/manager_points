'use client';
import React, { useState, useRef } from 'react';
import Popup from './Popup';
import { Download, UploadCloud, Loader2, FileSpreadsheet, Info } from 'lucide-react';
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
      <Popup 
        isOpen={isOpen} 
        onClose={closeAndReset} 
        title="Import Báo cáo lớp và Ghi nhận"
        className="max-w-lg"
      >
        <div className="p-1 space-y-5">
          {/* Bước 1 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-xl bg-[#1A73E8]/10 border border-[#1A73E8]/20 text-[#1A73E8] flex items-center justify-center text-xs font-bold font-mono">1</div>
              <h3 className="text-xs font-bold text-[#1E293B] tracking-wider uppercase">BƯỚC 1: TẢI FILE MẪU</h3>
            </div>
            <div className="ml-8">
              <p className="text-xs text-[#64748B] mb-2.5">Tải tệp mẫu để đảm bảo dữ liệu đúng định dạng.</p>
              <button 
                onClick={handleDownloadTemplate} 
                className="flex items-center gap-2 px-3.5 py-1.5 bg-white/50 backdrop-blur-sm border border-slate-200 text-[#1E293B] rounded-xl hover:bg-white/80 transition-all duration-150 ease-out hover:scale-[1.01] text-xs font-semibold shadow-sm"
              >
                <Download size={14} className="text-[#64748B]" /> Tải file mẫu (.xlsx)
              </button>
            </div>
          </div>

          {/* Bước 2 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-xl bg-[#1A73E8]/10 border border-[#1A73E8]/20 text-[#1A73E8] flex items-center justify-center text-xs font-bold font-mono">2</div>
              <h3 className="text-xs font-bold text-[#1E293B] tracking-wider uppercase">BƯỚC 2: TẢI TỆP LÊN</h3>
            </div>
            <div className="ml-8">
              <div 
                className={`border border-dashed rounded-xl p-6 text-center select-none transition-all duration-150 ease-out cursor-pointer bg-white/30 ${
                  dragActive ? 'border-[#1A73E8] bg-blue-50/20' : 'border-slate-300 hover:border-[#1A73E8] hover:bg-white/50 hover:scale-[1.01]'
                }`} 
                onDragEnter={handleDrag} 
                onDragOver={handleDrag} 
                onDragLeave={handleDrag} 
                onDrop={handleDrop} 
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  className="hidden" 
                  accept=".xlsx, .xls" 
                  onChange={handleFileChange} 
                  disabled={isImporting} 
                />
                {file ? (
                  <div className="flex flex-col items-center gap-3 w-full" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl w-10 h-10 flex items-center justify-center text-emerald-600 shadow-sm">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div className="flex flex-col items-center max-w-[85%]">
                      <p className="text-xs font-bold text-[#1E293B] truncate w-full">{file.name}</p>
                      <p className="text-[10px] text-[#64748B] font-medium mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={handleRemoveFile} 
                      className="mt-1 text-xs text-rose-600 hover:text-rose-700 font-bold px-3 py-1 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                      Chọn tệp khác
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 bg-[#1A73E8]/10 border border-[#1A73E8]/20 rounded-xl flex items-center justify-center mx-auto mb-2 text-[#1A73E8]">
                      <UploadCloud size={20} />
                    </div>
                    <p className="text-xs font-bold text-[#1E293B] mb-1">Kéo thả tệp hoặc nhấn để chọn</p>
                    <p className="text-[#64748B] text-[11px]">Chấp nhận .xlsx, .xls (Tối đa 10MB) - Tối đa 5.000 dòng</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bước 3 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-xl bg-[#1A73E8]/10 border border-[#1A73E8]/20 text-[#1A73E8] flex items-center justify-center text-xs font-bold font-mono">3</div>
              <h3 className="text-xs font-bold text-[#1E293B] tracking-wider uppercase">BƯỚC 3: XỬ LÝ & IMPORT</h3>
            </div>
            <div className="ml-8 bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl flex items-start gap-3 shadow-sm">
              <Info className="text-amber-700 shrink-0 mt-0.5" size={16} />
              <div className="text-xs text-amber-800 font-medium leading-relaxed">
                Hệ thống sẽ xác thực theo Mã lớp, Mã SV, Tiêu chí và Ngày báo cáo. Các báo cáo/lưu ghi nhận hợp lệ sẽ được tạo, bản ghi lỗi được báo cáo.
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 mt-2">
            <button 
              type="button" 
              onClick={closeAndReset} 
              disabled={isImporting} 
              className="px-4 py-2 text-[#64748B] bg-slate-100 hover:bg-slate-200/80 rounded-xl font-semibold text-xs transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm"
            >
              Hủy bỏ
            </button>
            <button 
              type="button" 
              onClick={handleStartImport} 
              disabled={!file || isImporting} 
              className="bg-[#2a216e] text-white flex gap-1.5 items-center px-4 py-2 rounded-xl font-semibold text-xs transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting && <Loader2 size={14} className="animate-spin" />}
              {isImporting ? 'Đang import...' : 'Bắt đầu Import'}
            </button>
          </div>
        </div>
      </Popup>

      <ImportClassRecordResultPopup 
        isOpen={showResultPopup} 
        onClose={() => { 
          setShowResultPopup(false); 
          if ((importStats.reports > 0 || importStats.records > 0) && onSuccess) onSuccess(); 
        }} 
        reportsCount={importStats.reports} 
        recordsCount={importStats.records} 
        errors={importStats.errors} 
      />
    </>
  );
}
