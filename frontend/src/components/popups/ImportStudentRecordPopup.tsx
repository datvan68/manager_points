'use client';
import React, { useState, useRef, useEffect } from 'react';
import Popup from './Popup';
import { Download, UploadCloud, Info, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle, Upload, FileText, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import ImportResultPopup, { ImportValidationError } from './ImportResultPopup';
import { academicRecordApi } from '@/api/academic-record-api';
import { useAuth } from '@/providers/auth-provider';

interface ImportStudentRecordPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ImportStudentRecordPopup({ isOpen, onClose, onSuccess }: ImportStudentRecordPopupProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewResult, setPreviewResult] = useState<any>(null);
  const [importProgress, setImportProgress] = useState<any>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [showResultPopup, setShowResultPopup] = useState(false);
  const [importStats, setImportStats] = useState<{ successCount: number; errors: ImportValidationError[] }>({ successCount: 0, errors: [] });

  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const headers = [['Ma SV', 'Tieu chi', 'Ngay ghi nhan', 'Ghi chu', 'Hoc ky', 'Trang thai']];
      const sample = [ ['SV202601', 'Vắng có phép', '15/05/2026', 'Ghi chú mẫu', '', 'active'] ];
      const ws = XLSX.utils.aoa_to_sheet([...headers, ...sample]);
      ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 18 }, { wch: 30 }, { wch: 20 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Import_Student_Records');
      XLSX.writeFile(wb, 'Mau_Import_Student_Records.xlsx');
      toast.success('Đã tải xuống file mẫu Excel thành công!');
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tải file mẫu');
    }
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

  const validateAndSetFile = (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      toast.error('Chỉ chấp nhận tệp Excel (.xlsx, .xls)!');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('Dung lượng tệp vượt quá 10MB!');
      return;
    }
    setFile(selectedFile);
    setStep('upload');
    setPreviewResult(null);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setStep('upload');
    setPreviewResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setPreviewResult(null);
    setImportProgress(null);
    setIsProcessing(false);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (step === 'importing') {
      toast.error('Đang import, không thể đóng!');
      return;
    }
    resetState();
    onClose();
  };

  const handlePreview = async () => {
    if (!file) { toast.error('Vui lòng chọn tệp Excel trước khi xử lý!'); return; }
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet) as any[];
        
        if (rawRows.length === 0) throw new Error('Tệp Excel không chứa dữ liệu hoặc sai định dạng!');
        if (rawRows.length > 5000) throw new Error('Số lượng bản ghi vượt quá giới hạn 5.000!');

        const res = await academicRecordApi.previewImportRecords(rawRows);
        setPreviewResult(res);
        setStep('preview');
      } catch (err: any) {
        console.error('Lỗi khi preview records:', err);
        toast.error(err?.message || 'Có lỗi xảy ra khi đọc tệp');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => { toast.error('Lỗi khi đọc file'); setIsProcessing(false); };
    reader.readAsArrayBuffer(file);
  };

  const startPolling = (sessionId: string) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const progressRes = await academicRecordApi.getImportProgress(sessionId);
        setImportProgress(progressRes);
        
        if (progressRes.status === 'completed' || progressRes.status === 'failed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setIsProcessing(false);
          
          // Show Result Popup
          const mappedErrors = (progressRes.failedItems || []).map((err: any) => ({
            row: err.row,
            studentCode: err.studentCode || '',
            fullName: err.fullName || '',
            reason: err.reason || 'Lỗi không xác định'
          }));
          
          setImportStats({
            successCount: progressRes.insertedCount || 0,
            errors: mappedErrors
          });
          
          if (progressRes.status === 'completed') {
            toast.success(`Import hoàn tất! Thành công: ${progressRes.insertedCount} bản ghi.`);
          } else {
            toast.error('Import thất bại hoặc có lỗi xảy ra.');
          }
          
          setShowResultPopup(true);
          resetState();
          onClose(); // Hide the current popup
        }
      } catch (err) {
        console.error('Lỗi khi poll progress:', err);
      }
    }, 1000);
  };

  const handleCommit = async () => {
    if (!previewResult || !previewResult.sessionId) return;
    setIsProcessing(true);
    setStep('importing');
    setImportProgress({
      status: 'processing',
      progress: 0,
      processedCount: 0,
      totalRows: previewResult.validCount
    });

    try {
      await academicRecordApi.commitImportRecords(previewResult.sessionId);
      startPolling(previewResult.sessionId);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi bắt đầu import');
      setIsProcessing(false);
      setStep('preview');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen]);

  const renderUploadStep = () => (
    <>
      <div className="flex flex-col gap-5 px-6 py-5 w-full overflow-y-auto max-h-[75vh]">
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
              <Download size={14} className="text-[#64748B]" />
              Tải tệp mẫu (.xlsx)
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
              onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} disabled={isProcessing} />
              
              <div className="w-10 h-10 bg-[#1A73E8]/10 border border-[#1A73E8]/20 rounded-xl flex items-center justify-center mx-auto mb-2 text-[#1A73E8]">
                <Upload className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-[#1E293B] mb-1">
                Kéo và thả tệp vào đây hoặc nhấn để chọn từ máy tính
              </p>
              <p className="text-[#64748B] text-[11px]">
                Chấp nhận tệp .xlsx, .xls (Tối đa 10MB) - Tối đa 5.000 dòng
              </p>
              
              {file && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 rounded-xl">
                    <FileText size={14} />
                    <span className="font-semibold text-xs max-w-[200px] truncate">{file.name}</span>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                      className="text-emerald-500 hover:text-emerald-700 ml-0.5 transition-colors"
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-slate-50/50 backdrop-blur-sm w-full">
        <button
          className="px-4 py-2 text-[#64748B] bg-slate-100/50 hover:bg-slate-200/80 rounded-xl font-semibold text-xs transition-all duration-150 ease-out shadow-sm hover:scale-[1.01]"
          onClick={handleClose}
          disabled={isProcessing}
        >
          Hủy bỏ
        </button>
        <button
          className="px-4 py-2 bg-[#1A73E8] text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-xs flex gap-1.5 items-center transition-all duration-150 ease-out shadow-sm hover:scale-[1.01]"
          onClick={handlePreview}
          disabled={!file || isProcessing}
        >
          {isProcessing && <Loader2 size={14} className="animate-spin" />}
          Kiểm tra file
        </button>
      </div>
    </>
  );

  const renderPreviewStep = () => {
    if (!previewResult) return null;
    const { validCount, errorCount, errors } = previewResult;

    return (
      <>
        <div className="flex flex-col gap-5 px-6 py-5 w-full overflow-y-auto max-h-[75vh]">
          <h3 className="font-bold text-[#1E293B] text-[15px] border-b border-slate-200 pb-2">Kết quả kiểm tra dữ liệu</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-full"><CheckCircle2 size={24}/></div>
              <div>
                <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide mb-1">Hợp lệ</p>
                <p className="text-3xl font-black text-emerald-600 leading-none font-mono">{validCount}</p>
              </div>
            </div>
            
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className="bg-rose-100 text-rose-600 p-2.5 rounded-full"><AlertCircle size={24}/></div>
              <div>
                <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wide mb-1">Không hợp lệ</p>
                <p className="text-3xl font-black text-rose-600 leading-none font-mono">{errorCount}</p>
              </div>
            </div>
          </div>

          {errorCount > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-sm font-semibold text-[#1E293B]">Chi tiết lỗi ({errors.length} dòng đầu):</p>
              <div className="border border-slate-200/60 rounded-xl shadow-inner bg-white/30 backdrop-blur-sm overflow-hidden custom-scrollbar max-h-48 overflow-y-auto text-sm">
                <div className="sticky top-0 bg-slate-50/90 backdrop-blur-md flex font-bold text-[#1E293B] px-3 py-2 text-xs border-b border-slate-200/80">
                  <div className="w-[20%]">Dòng</div>
                  <div className="w-[80%]">Lý do</div>
                </div>
                {errors.slice(0, 50).map((err: any, idx: number) => (
                  <div key={idx} className="flex px-3 py-2 border-b last:border-0 border-slate-100 hover:bg-white/40 transition-colors duration-100">
                    <div className="w-[20%] font-medium text-slate-500 font-mono text-xs">#{err.row}</div>
                    <div className="w-[80%] text-rose-600 font-semibold text-xs leading-relaxed" title={err.reason}>{err.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-slate-50/50 backdrop-blur-sm w-full">
          <button
            className="px-4 py-2 font-bold text-[#64748B] hover:text-[#1E293B] transition-colors duration-150 text-xs"
            onClick={() => setStep('upload')}
            disabled={isProcessing}
          >
            Quay lại
          </button>
          
          {validCount > 0 ? (
            <button
              className="px-4 py-2 bg-[#1A73E8] text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-xs transition-all duration-150 ease-out shadow-sm hover:scale-[1.01]"
              onClick={handleCommit}
              disabled={isProcessing}
            >
              Tiến hành Import ({validCount} dòng)
            </button>
          ) : (
            <button
              className="px-4 py-2 bg-slate-300 text-white rounded-xl font-semibold text-xs cursor-not-allowed shadow-sm"
              disabled
            >
              Không có dữ liệu hợp lệ
            </button>
          )}
        </div>
      </>
    );
  };

  const renderImportingStep = () => {
    const progress = importProgress?.progress || 0;
    const processed = importProgress?.processedCount || 0;
    const total = importProgress?.totalRows || previewResult?.validCount || 0;

    return (
      <div className="flex flex-col items-center justify-center p-8 w-full gap-6 h-[400px]">
        <div className="bg-[#1A73E8]/10 text-[#1A73E8] p-4 rounded-xl border border-[#1A73E8]/20">
          <Loader2 size={40} className="animate-spin" />
        </div>
        
        <div className="text-center w-full max-w-md">
          <h3 className="text-lg font-bold text-[#1E293B] mb-2">Đang Import Dữ Liệu</h3>
          <p className="text-[#64748B] text-xs mb-6 font-medium">Vui lòng không đóng cửa sổ này. Quá trình có thể mất vài phút.</p>
          
          <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden shadow-inner">
            <div 
              className="bg-[#1A73E8] h-full rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between text-xs font-bold text-[#64748B]">
            <span>{progress.toFixed(0)}%</span>
            <span className="font-mono">{processed} / {total}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
    <Popup isOpen={isOpen} onClose={handleClose} className="max-w-[600px] !bg-white/95 !backdrop-blur-md" contentClassName="p-0">
      <div className="flex flex-col items-start overflow-hidden rounded-[16px] w-full font-sans shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 w-full shrink-0">
          <h2 className="text-[16px] font-bold text-[#1E293B] leading-6">Import Ghi nhận HSSV từ Excel</h2>
        </div>

        {step === 'upload' && renderUploadStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'importing' && renderImportingStep()}
        
      </div>
    </Popup>

    <ImportResultPopup 
      isOpen={showResultPopup} 
      onClose={() => { 
        setShowResultPopup(false); 
        if (importStats.successCount > 0 && onSuccess) onSuccess(); 
      }} 
      successCount={importStats.successCount} 
      errors={importStats.errors} 
    />
    </>
  );
}

