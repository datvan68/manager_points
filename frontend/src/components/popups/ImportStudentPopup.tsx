'use client';
import React, { useState, useRef, useEffect } from 'react';
import Popup from './Popup';
import {
  Download, UploadCloud, Info, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle, Upload, FileText, XCircle
} from 'lucide-react';
import { toast } from 'sonner';

import { studentApi } from '@/api/student-api';
import ImportResultPopup, { ImportValidationError } from './ImportResultPopup';

interface ImportStudentPopupProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  onSuccess?: () => void;
}

const normalizeImportHeader = (header: string): string => {
  if (!header) return '';
  return header
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

const findValue = (row: any, aliases: string[]) => {
  if (!row || typeof row !== 'object') return undefined;
  const normalizedRow: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    normalizedRow[normalizeImportHeader(key)] = row[key];
  }
  const normalizedAliases = aliases.map(a => normalizeImportHeader(a));
  for (const alias of normalizedAliases) {
    if (normalizedRow[alias] !== undefined && normalizedRow[alias] !== null) {
      return normalizedRow[alias];
    }
  }
  return undefined;
};

export default function ImportStudentPopup({ isOpen, onClose, classId, onSuccess }: ImportStudentPopupProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewResult, setPreviewResult] = useState<any>(null);
  const [importProgress, setImportProgress] = useState<any>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const parsedStudentMapRef = useRef<Map<string, { row: number; fullName: string }>>(new Map());
  const parsedRowToNameMapRef = useRef<Map<number, string>>(new Map());

  const [showResultPopup, setShowResultPopup] = useState(false);
  const [importStats, setImportStats] = useState<{ successCount: number; duplicatedCount: number; errors: ImportValidationError[] }>({
    successCount: 0,
    duplicatedCount: 0,
    errors: [],
  });

  // 1. Generate and Download dynamic Excel Template file
  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const headers = [['Mã SV', 'Họ đệm', 'Tên', 'Giới tính', 'Ngày sinh']];
      const sampleData = [
        ['SV202601', 'Nguyễn Văn', 'Anh', 'Nam', '15/05/2004'],
        ['SV202602', 'Lê Thị', 'Bình', 'Nữ', '20/11/2005']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);

      // Set Column Widths to look professional
      worksheet['!cols'] = [
        { wch: 15 }, // Mã SV
        { wch: 20 }, // Họ đệm
        { wch: 12 }, // Tên
        { wch: 18 }, // Giới tính
        { wch: 25 }  // Ngày sinh
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Import_Students');
      XLSX.writeFile(workbook, 'Mau_Import_Sinh_Vien.xlsx');
      toast.success('Đã tải xuống file mẫu Excel thành công!');
    } catch (err) {
      console.error('Lỗi khi sinh file Excel:', err);
      toast.error('Có lỗi xảy ra khi tải file mẫu');
    }
  };

  // 2. Handle File Drag & Drop Events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'xlsx' && fileExtension !== 'xls') {
      toast.error('Chỉ chấp nhận tệp Excel (.xlsx, .xls)!');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('Dung lượng tệp vượt quá giới hạn 10MB!');
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setPreviewResult(null);
    setImportProgress(null);
    setIsProcessing(false);
    parsedStudentMapRef.current.clear();
    parsedRowToNameMapRef.current.clear();
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
    if (!file) {
      toast.error('Vui lòng chọn tệp Excel trước khi xử lý!');
      return;
    }
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

        if (rawRows.length === 0) {
          throw new Error('Tệp Excel không chứa dữ liệu hoặc sai định dạng!');
        }
        if (rawRows.length > 5000) {
          throw new Error('Số lượng bản ghi vượt quá giới hạn 5.000!');
        }

        // Parse names and row numbers on frontend for later mapping
        parsedStudentMapRef.current.clear();
        parsedRowToNameMapRef.current.clear();

        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          const rowNumber = i + 2;

          const studentCodeRaw = findValue(row, ['Mã SV', 'Mã SV (*)', 'Mã sinh viên', 'Mã sinh viên (*)', 'MSSV', 'student_code', 'studentCode', 'Mã số sinh viên']);
          const hoDemRaw = findValue(row, ['Họ đệm', 'Họ đệm (*)', 'Họ', 'ho_dem', 'Ho dem', 'Ho', 'last_name', 'lastName']);
          const tenRaw = findValue(row, ['Tên', 'Tên (*)', 'ten', 'Ten', 'first_name', 'firstName']);
          const combinedRaw = findValue(row, ['Họ và tên', 'Họ và tên (*)', 'Họ tên', 'full_name', 'fullName', 'Ho va ten', 'Ho ten']);

          let fullName = '';
          const combinedVal = combinedRaw !== undefined && combinedRaw !== null ? combinedRaw.toString().trim() : '';
          if (combinedVal) {
            fullName = combinedVal;
          } else {
            const hoDemVal = hoDemRaw !== undefined && hoDemRaw !== null ? hoDemRaw.toString().trim() : '';
            const tenVal = tenRaw !== undefined && tenRaw !== null ? tenRaw.toString().trim() : '';
            if (hoDemVal && tenVal) {
              fullName = `${hoDemVal} ${tenVal}`;
            }
          }
          const studentCode = studentCodeRaw ? studentCodeRaw.toString().trim() : '';
          if (studentCode) {
            parsedStudentMapRef.current.set(studentCode.toLowerCase(), { row: rowNumber, fullName });
          }
          parsedRowToNameMapRef.current.set(rowNumber, fullName);
        }

        const res = await studentApi.previewImportStudents(classId, rawRows);
        setPreviewResult(res);
        setStep('preview');
      } catch (err: any) {
        console.error('Lỗi khi preview students:', err);
        toast.error(err?.message || 'Có lỗi xảy ra khi đọc tệp');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      toast.error('Lỗi khi đọc file');
      setIsProcessing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const startPolling = (sessionId: string) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const progressRes = await studentApi.getImportStudentsProgress(sessionId);
        setImportProgress(progressRes);

        if (progressRes.status === 'completed' || progressRes.status === 'failed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setIsProcessing(false);

          // Get preview validation errors
          const previewErrors = (previewResult?.errors || []).map((err: any) => {
            const codeKey = err.studentCode ? err.studentCode.toLowerCase() : '';
            const info = parsedStudentMapRef.current.get(codeKey);
            return {
              row: err.row,
              studentCode: err.studentCode || '',
              fullName: err.fullName || info?.fullName || parsedRowToNameMapRef.current.get(err.row) || '',
              reason: err.reason || 'Lỗi kiểm tra dữ liệu'
            };
          });

          // Get commit/insertion errors
          const commitErrors = (progressRes.failedItems || []).map((err: any) => {
            const codeKey = err.studentCode ? err.studentCode.toLowerCase() : '';
            const info = parsedStudentMapRef.current.get(codeKey);
            return {
              row: info ? info.row : 'N/A',
              studentCode: err.studentCode || '',
              fullName: err.fullName || info?.fullName || '',
              reason: err.reason || 'Lỗi lưu dữ liệu'
            };
          });

          // Combine errors
          const allErrors = [...previewErrors, ...commitErrors];

          setImportStats({
            successCount: progressRes.insertedCount || 0,
            duplicatedCount: progressRes.duplicatedCount || 0,
            errors: allErrors
          });

          if (progressRes.status === 'completed') {
            if ((progressRes.insertedCount || 0) === 0 && (progressRes.duplicatedCount || 0) > 0) {
              toast.success(`Import hoàn tất: Không có bản ghi mới, tất cả đã tồn tại.`);
            } else {
              toast.success(`Import hoàn tất! Thành công: ${progressRes.insertedCount || 0} sinh viên.`);
            }
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
      await studentApi.confirmImportStudents(previewResult.sessionId);
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
      <div className="flex flex-col gap-4 px-6 py-5 w-full overflow-y-auto max-h-[72vh] bg-transparent scrollbar-hover">
        {/* Step 1: Download Template */}
        <div className="flex flex-col gap-2.5 items-start w-full">
          <div className="flex gap-2 items-center w-full">
            <div className="bg-[#1A73E8]/10 border border-[#1A73E8]/25 text-[#1A73E8] flex items-center justify-center rounded-xl shrink-0 w-6 h-6">
              <span className="font-bold text-xs">1</span>
            </div>
            <h3 className="font-bold text-[#1E293B] text-xs tracking-wider uppercase">
              BƯỚC 1: CHUẨN BỊ TỆP
            </h3>
          </div>
          <p className="text-[#64748B] text-sm pl-8 font-medium">
            Tải tệp mẫu để đảm bảo dữ liệu đúng định dạng.
          </p>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="ml-8 bg-white/50 backdrop-blur-sm border border-slate-200 hover:bg-[#1A73E8] hover:text-white hover:border-transparent text-[#1A73E8] flex gap-2 items-center px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm shadow-blue-900/5"
          >
            <Download size={14} />
            Tải tệp mẫu (.xlsx)
          </button>
        </div>

        {/* Step 2: Upload Area */}
        <div className="flex flex-col gap-2.5 items-start w-full">
          <div className="flex gap-2 items-center w-full">
            <div className="bg-[#1A73E8]/10 border border-[#1A73E8]/25 text-[#1A73E8] flex items-center justify-center rounded-xl shrink-0 w-6 h-6">
              <span className="font-bold text-xs">2</span>
            </div>
            <h3 className="font-bold text-[#1E293B] text-xs tracking-wider uppercase">
              BƯỚC 2: TẢI TỆP LÊN
            </h3>
          </div>

          <div className="w-full pl-8">
            <div
              className={`bg-white/40 backdrop-blur-sm border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer select-none ${
                dragActive 
                  ? 'border-[#1A73E8] bg-[#1A73E8]/10' 
                  : 'border-[#1A73E8]/30 hover:border-[#1A73E8]/60 hover:bg-white/60 shadow-sm'
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
                disabled={isProcessing}
              />

              {file ? (
                <div className="flex flex-col items-center gap-3 w-full" onClick={(e) => e.stopPropagation()}>
                  <div className="bg-emerald-500/10 rounded-xl w-12 h-12 flex items-center justify-center text-emerald-600 shadow-sm border border-white/80">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div className="flex flex-col items-center max-w-[85%]">
                    <p className="text-[14px] font-bold text-[#1E293B] truncate w-full">{file.name}</p>
                    <p className="text-xs text-[#64748B] font-medium mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="mt-1 text-xs text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] font-bold"
                  >
                    Chọn tệp khác
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-[#1A73E8]/10 rounded-xl w-12 h-12 flex items-center justify-center text-[#1A73E8] mb-3 shadow-sm border border-white/80">
                    <UploadCloud size={24} />
                  </div>
                  <p className="text-[14px] font-bold text-[#1E293B] leading-6 px-2">
                    Kéo và thả tệp vào đây hoặc nhấn để chọn từ máy tính
                  </p>
                  <p className="text-[11px] text-[#64748B] font-semibold mt-1">
                    Chấp nhận tệp .xlsx, .xls (Tối đa 10MB)
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Important notes */}
        <div className="flex flex-col gap-2.5 items-start w-full">
          <div className="flex gap-2 items-center w-full">
            <div className="bg-[#1A73E8]/10 border border-[#1A73E8]/25 text-[#1A73E8] flex items-center justify-center rounded-xl shrink-0 w-6 h-6">
              <span className="font-bold text-xs">3</span>
            </div>
            <h3 className="font-bold text-[#1E293B] text-xs tracking-wider uppercase">
              LƯU Ý QUAN TRỌNG
            </h3>
          </div>

          <div className="w-full pl-8">
            <div className="bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl p-4 flex gap-3 w-full shadow-sm">
              <div className="text-[#1A73E8] shrink-0 mt-0.5">
                <Info size={16} />
              </div>
              <div className="flex flex-col gap-2 text-[#64748B] text-xs font-semibold leading-relaxed">
                <p className="flex items-center gap-1.5 flex-wrap">
                  • Định dạng ngày sinh bắt buộc:
                  <code className="bg-white/70 border border-white/80 text-[#1E293B] px-1.5 py-0.5 rounded-xl font-mono text-[10px]">
                    DD/MM/YYYY
                  </code>.
                </p>
                <p>• Mã sinh viên là duy nhất trong hệ thống.</p>
                <p>• Giới hạn tệp: Tối đa 5.000 bản ghi mỗi lần import.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Footer */}
      <div className="bg-white/50 backdrop-blur-md flex gap-3 items-center justify-end px-6 py-4 border-t border-[#1E293B]/10 w-full shrink-0">
        <button
          type="button"
          onClick={handleClose}
          disabled={isProcessing}
          className="px-4 py-2 text-xs font-bold text-[#64748B] hover:text-[#1E293B] hover:bg-white/60 rounded-xl border border-slate-200 bg-white/30 transition-all duration-150 ease-out hover:scale-[1.01] disabled:opacity-50"
        >
          Hủy bỏ
        </button>

        <button
          type="button"
          onClick={handlePreview}
          disabled={!file || isProcessing}
          className="bg-[#1a73e8] hover:bg-blue-600 disabled:bg-blue-300 text-white flex gap-1.5 items-center px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 ease-out hover:scale-[1.01] shadow-md shadow-blue-200/60 disabled:shadow-none disabled:cursor-not-allowed"
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
    const duplicatesCount = (errors || []).filter((err: any) =>
      err.reason.toLowerCase().includes('trùng') || err.reason.toLowerCase().includes('tồn tại')
    ).length;
    const invalidCount = errorCount - duplicatesCount;

    return (
      <>
        <div className="flex flex-col gap-4 px-6 py-5 w-full overflow-y-auto max-h-[72vh] bg-transparent scrollbar-hover">
          <h3 className="font-bold text-[#1E293B] text-[15px] border-b border-slate-200 pb-2">Kết quả kiểm tra dữ liệu</h3>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-3 shadow-sm">
              <div className="bg-emerald-100 text-emerald-600 p-2 rounded-full"><CheckCircle2 size={20}/></div>
              <div>
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide mb-0.5">Hợp lệ</p>
                <p className="text-2xl font-black text-emerald-600 leading-none font-mono">{validCount}</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-3 shadow-sm">
              <div className="bg-amber-100 text-amber-600 p-2 rounded-full"><AlertCircle size={20}/></div>
              <div>
                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide mb-0.5">Trùng lặp</p>
                <p className="text-2xl font-black text-amber-600 leading-none font-mono">{duplicatesCount}</p>
              </div>
            </div>
            
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center gap-3 shadow-sm">
              <div className="bg-rose-100 text-rose-600 p-2 rounded-full"><AlertCircle size={20}/></div>
              <div>
                <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wide mb-0.5">Lỗi khác</p>
                <p className="text-2xl font-black text-rose-600 leading-none font-mono">{Math.max(0, invalidCount)}</p>
              </div>
            </div>
          </div>

          {errorCount > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-sm font-semibold text-[#1E293B]">Chi tiết lỗi ({errors.length} dòng đầu):</p>
              <div className="border border-slate-200/60 rounded-xl shadow-inner bg-white/30 backdrop-blur-sm overflow-hidden custom-scrollbar max-h-48 overflow-y-auto text-sm">
                <div className="sticky top-0 bg-slate-50/90 backdrop-blur-md flex font-bold text-[#1E293B] px-3 py-2 text-xs border-b border-slate-200/80">
                  <div className="w-[10%]">Dòng</div>
                  <div className="w-[20%]">Mã SV</div>
                  <div className="w-[30%]">Họ tên</div>
                  <div className="w-[40%]">Lý do</div>
                </div>
                {errors.slice(0, 100).map((err: any, idx: number) => {
                  const fullName = err.fullName || parsedRowToNameMapRef.current.get(err.row) || '';
                  return (
                    <div key={idx} className="flex px-3 py-2 border-b last:border-0 border-slate-100 hover:bg-white/40 transition-colors duration-100">
                      <div className="w-[10%] font-medium text-slate-500 font-mono text-xs">#{err.row}</div>
                      <div className="w-[20%] font-mono text-slate-700 text-xs">{err.studentCode || 'N/A'}</div>
                      <div className="w-[30%] text-slate-700 text-xs truncate" title={fullName}>{fullName || 'N/A'}</div>
                      <div className="w-[40%] text-rose-600 font-semibold text-xs leading-relaxed" title={err.reason}>{err.reason}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white/50 backdrop-blur-md flex gap-3 items-center justify-between px-6 py-4 border-t border-[#1E293B]/10 w-full shrink-0">
          <button
            type="button"
            className="px-4 py-2 text-xs font-bold text-[#64748B] hover:text-[#1E293B] transition-all duration-150 ease-out"
            onClick={() => setStep('upload')}
            disabled={isProcessing}
          >
            Quay lại
          </button>
          
          {validCount > 0 ? (
            <button
              type="button"
              className="bg-[#1a73e8] hover:bg-blue-600 disabled:opacity-50 text-white flex gap-1.5 items-center px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 ease-out hover:scale-[1.01] shadow-md shadow-blue-200/60"
              onClick={handleCommit}
              disabled={isProcessing}
            >
              Tiến hành Import ({validCount} dòng)
            </button>
          ) : (
            <button
              type="button"
              className="bg-slate-300 text-white rounded-xl font-semibold text-xs cursor-not-allowed shadow-sm px-5 py-2.5"
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
      <div className="flex flex-col items-center justify-center p-8 w-full gap-6 h-[350px]">
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
      <Popup isOpen={isOpen} onClose={handleClose} className="max-w-[550px] bg-white/80 backdrop-blur-xl border border-white/80 rounded-2xl shadow-lg shadow-slate-300/40" contentClassName="p-0">
        <div className="bg-transparent flex flex-col items-start overflow-hidden w-full font-sans">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E293B]/10 w-full shrink-0 bg-transparent pr-12">
            <h2 className="text-[18px] font-bold text-[#1E293B] leading-7">
              Import Sinh viên từ Excel
            </h2>
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
          if (importStats.successCount > 0 && onSuccess) {
            onSuccess();
          }
        }}
        successCount={importStats.successCount}
        duplicatedCount={importStats.duplicatedCount}
        errors={importStats.errors}
      />
    </>
  );
}
