'use client';
import React, { useState, useRef } from 'react';
import Popup from './Popup';
import {
  Download, UploadCloud, Info, Loader2, FileSpreadsheet, X, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { studentApi } from '@/api/student-api';

interface ImportStudentPopupProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  onSuccess?: () => void;
}

export default function ImportStudentPopup({ isOpen, onClose, classId, onSuccess }: ImportStudentPopupProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Generate and Download dynamic Excel Template file
  const handleDownloadTemplate = () => {
    try {
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
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
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
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 3. Process and Upload the selected Excel file
  const handleStartImport = () => {
    if (!file) {
      toast.error('Vui lòng chọn tệp Excel trước khi import!');
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert sheet data to JSON array
        const rawRows = XLSX.utils.sheet_to_json(sheet) as any[];

        if (rawRows.length === 0) {
          throw new Error('Tệp Excel không chứa dữ liệu hoặc sai định dạng!');
        }

        // Validate and Map rows to backend Student DTO format
        const studentDtos: any[] = [];

        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];

          // Map properties based on flexible column names
          const studentCode = row['Mã SV'] || row['Mã SV (*)'] || row['Mã sinh viên'] || row['Mã sinh viên (*)'] || row['MSSV'] || row['student_code'];
          const hoDem = row['Họ đệm'] || row['Họ đệm (*)'] || row['Họ'] || row['ho_dem'];
          const ten = row['Tên'] || row['Tên (*)'] || row['ten'];
          
          let fullName = '';
          if (hoDem && ten) {
            fullName = `${hoDem.toString().trim()} ${ten.toString().trim()}`;
          } else {
            fullName = row['Họ và tên'] || row['Họ và tên (*)'] || row['Họ tên'] || row['full_name'];
          }

          let dobValue = row['Ngày sinh'] || row['Ngày sinh (DD/MM/YYYY) (*)'] || row['Ngày sinh (YYYY-MM-DD) (*)'] || row['date_bir'];
          const genderStr = row['Giới tính'] || row['Giới tính (Nam/Nữ)'] || row['sex'];
          const email = row['Email'] || row['email'];

          if (!studentCode || !fullName || !dobValue) {
            throw new Error(`Dòng ${i + 2}: Thiếu các trường bắt buộc (Mã SV, Họ đệm và Tên, hoặc Ngày sinh)`);
          }

          // Handle Excel date value if it's parsed as number by sheetjs
          let finalDob = '';
          if (typeof dobValue === 'number') {
            // Excel serial date to JS date object
            const jsDate = new Date(Math.round((dobValue - 25569) * 86400 * 1000));
            finalDob = jsDate.toISOString();
          } else {
            const strDob = dobValue.toString().trim();
            // Thử kiểm tra định dạng DD/MM/YYYY (ví dụ: 15/05/2004 hoặc 15-05-2004)
            const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
            const match = strDob.match(dmyRegex);
            if (match) {
              const day = parseInt(match[1], 10);
              const month = parseInt(match[2], 10) - 1; // 0-indexed
              const year = parseInt(match[3], 10);
              const parsedDate = new Date(year, month, day);
              if (isNaN(parsedDate.getTime()) || parsedDate.getDate() !== day || parsedDate.getMonth() !== month) {
                throw new Error(`Dòng ${i + 2}: Ngày sinh "${dobValue}" không tồn tại trên thực tế.`);
              }
              finalDob = parsedDate.toISOString();
            } else {
              // Thử parse thông thường (VD: YYYY-MM-DD)
              const parsedDate = new Date(strDob);
              if (isNaN(parsedDate.getTime())) {
                throw new Error(`Dòng ${i + 2}: Định dạng ngày sinh "${dobValue}" không hợp lệ. Phải có định dạng DD/MM/YYYY.`);
              }
              finalDob = parsedDate.toISOString();
            }
          }

          // Standardize gender mapping
          let sex: 'Male' | 'Female' | 'Other' = 'Male';
          if (genderStr) {
            const normGender = genderStr.toString().trim().toLowerCase();
            if (normGender === 'nữ' || normGender === 'nu' || normGender === 'female' || normGender === 'n') {
              sex = 'Female';
            } else if (normGender === 'nam' || normGender === 'male' || normGender === 'm') {
              sex = 'Male';
            } else {
              sex = 'Other';
            }
          }

          studentDtos.push({
            student_code: studentCode.toString().trim(),
            full_name: fullName.toString().trim(),
            date_bir: finalDob,
            sex,
            status: 'Studying',
            class_id: classId,
            email: email ? email.toString().trim() : undefined
          });
        }

        if (studentDtos.length > 5000) {
          throw new Error('Số lượng sinh viên vượt quá giới hạn 5.000 bản ghi mỗi lần import!');
        }

        // Call backend Bulk creation endpoint
        const result = await studentApi.createStudentBulk(studentDtos);

        toast.success(`Import thành công! Đã thêm mới ${result.length} sinh viên vào lớp.`);

        if (onSuccess) {
          onSuccess();
        }
        onClose();
      } catch (err: any) {
        console.error('Lỗi khi import:', err);
        toast.error(err.message || 'Đã xảy ra lỗi trong quá trình import dữ liệu');
      } finally {
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      toast.error('Lỗi khi đọc file từ hệ thống!');
      setIsImporting(false);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <Popup isOpen={isOpen} onClose={onClose} className="max-w-[500px]" contentClassName="p-0">
      <div className="bg-white flex flex-col items-start overflow-hidden rounded-[12px] w-full font-sans">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 w-full shrink-0">
          <h2 className="text-[18px] font-bold text-[#0f172a] leading-7">
            Import Sinh viên từ Excel
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex justify-center items-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex flex-col gap-3 px-6 py-5 w-full overflow-y-auto max-h-[75vh]">

          {/* Step 1: Download Template */}
          <div className="flex flex-col gap-2.5 items-start w-full">
            <div className="flex gap-2 items-center w-full">
              <div className="bg-[#d8e2ff] flex items-center justify-center rounded-full shrink-0 w-6 h-6">
                <span className="font-bold text-[#004493] text-xs">1</span>
              </div>
              <h3 className="font-bold text-[#0f172a] text-xs tracking-wider uppercase">
                BƯỚC 1: CHUẨN BỊ TỆP
              </h3>
            </div>
            <p className="text-slate-500 text-sm pl-8">
              Tải tệp mẫu để đảm bảo dữ liệu đúng định dạng.
            </p>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="ml-8 border border-blue-100 hover:bg-blue-50 text-[#1a73e8] hover:text-blue-800 flex gap-2 items-center px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm shadow-blue-50"
            >
              <Download size={14} />
              Tải tệp mẫu (.xlsx)
            </button>
          </div>

          {/* Step 2: Upload Area */}
          <div className="flex flex-col gap-2.5 items-start w-full">
            <div className="flex gap-2 items-center w-full">
              <div className="bg-[#d8e2ff] flex items-center justify-center rounded-full shrink-0 w-6 h-6">
                <span className="font-bold text-[#004493] text-xs">2</span>
              </div>
              <h3 className="font-bold text-[#0f172a] text-xs tracking-wider uppercase">
                BƯỚC 2: TẢI TỆP LÊN
              </h3>
            </div>

            <div className="w-full pl-8">
              <div
                className={`bg-[#f8fafc] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer select-none ${dragActive ? 'border-blue-500 bg-blue-50/20' : 'border-[#cbd5e1] hover:border-blue-400 hover:bg-slate-50/50'
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
                    <div className="bg-emerald-50 rounded-full w-12 h-12 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                      <FileSpreadsheet size={24} />
                    </div>
                    <div className="flex flex-col items-center max-w-[85%]">
                      <p className="text-[14px] font-bold text-slate-800 truncate w-full">{file.name}</p>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="mt-1 text-xs text-rose-500 hover:text-rose-700 font-bold px-3 py-1 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                    >
                      Chọn tệp khác
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-50/70 rounded-full w-12 h-12 flex items-center justify-center text-blue-600 mb-3 shadow-sm border border-blue-100/50">
                      <UploadCloud size={24} />
                    </div>
                    <p className="text-[14px] font-semibold text-slate-800 leading-6 px-2">
                      Kéo và thả tệp vào đây hoặc nhấn để chọn từ máy tính
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium mt-1">
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
              <div className="bg-[#d8e2ff] flex items-center justify-center rounded-full shrink-0 w-6 h-6">
                <span className="font-bold text-[#004493] text-xs">3</span>
              </div>
              <h3 className="font-bold text-[#0f172a] text-xs tracking-wider uppercase">
                LƯU Ý QUAN TRỌNG
              </h3>
            </div>

            <div className="w-full pl-8">
              <div className="bg-[#f8fafc] border border-slate-100 rounded-xl p-4 flex gap-3 w-full">
                <div className="text-blue-500 shrink-0 mt-0.5">
                  <Info size={16} />
                </div>
                <div className="flex flex-col gap-2 text-slate-500 text-xs font-medium leading-relaxed">
                  <p>• Mã sinh viên là duy nhất trong hệ thống.</p>
                  <p className="flex items-center gap-1.5 flex-wrap">
                    • Định dạng ngày sinh bắt buộc:
                    <code className="bg-[#f1f5f9] border border-slate-200/50 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                      DD/MM/YYYY
                    </code>.
                  </p>
                  <p>• Giới hạn tệp: Tối đa 5.000 bản ghi mỗi lần import.</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 flex gap-3 items-center justify-end px-6 py-4 border-t border-slate-100 w-full shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors disabled:opacity-50"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            onClick={handleStartImport}
            disabled={!file || isImporting}
            className="bg-[#1a73e8] hover:bg-blue-700 disabled:bg-blue-300 text-white flex gap-1.5 items-center px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-200/60 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {isImporting && <Loader2 size={14} className="animate-spin" />}
            {isImporting ? 'Đang Import...' : 'Bắt đầu Import'}
          </button>
        </div>

      </div>
    </Popup>
  );
}
