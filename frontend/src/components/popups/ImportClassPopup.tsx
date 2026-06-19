import React, { useState, useRef } from "react";
import Popup from "./Popup";
import { Upload, FileText, AlertCircle, CheckCircle2, XCircle, Info, RefreshCw, Eye, Download } from "lucide-react";
import { classApi } from "@/api/class-api";
import { toast } from "sonner";
import { addNotification } from "@/lib/notifications";
import * as XLSX from "xlsx";

interface ImportClassPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportClassPopup({ isOpen, onClose, onSuccess }: ImportClassPopupProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'skip_duplicates' | 'fail_on_duplicates'>('skip_duplicates');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const ext = droppedFile.name.substring(droppedFile.name.lastIndexOf('.')).toLowerCase();
      if (validExtensions.includes(ext)) {
        if (droppedFile.size > 10 * 1024 * 1024) {
          toast.error("File quá lớn. Tối đa 10MB.");
        } else {
          setFile(droppedFile);
          setPreviewData(null);
        }
      } else {
        toast.error("Vui lòng chọn file .xlsx, .xls hoặc .csv");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("File quá lớn. Tối đa 10MB.");
        return;
      }
      setFile(selectedFile);
      setPreviewData(null);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Tên lớp", "Khóa/Năm học", "Mã khoa", "Email cố vấn", "Hệ đào tạo", "Cơ sở"],
      ["CTK44", "44", "CNTT", "covan@example.com", "Chính quy", "Cơ sở 1"],
      ["CTK45", "45", "CNTT", "", "Chính quy", "Cơ sở 1"]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Import_Class_Template.xlsx");
  };

  const handlePreview = async () => {
    if (!file) {
      toast.error("Vui lòng chọn file hợp lệ");
      return;
    }

    setLoading(true);
    try {
      const data = await classApi.previewImport(file);
      setPreviewData(data);
      toast.success("Đọc file thành công");
    } catch (error: any) {
      toast.error(error.message || "Lỗi đọc file");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!previewData || previewData.validRows === 0) {
      toast.error("Không có dữ liệu hợp lệ để import");
      return;
    }

    setLoading(true);
    try {
      const validRows = previewData.rows.filter((r: any) => r.status === 'valid').map((r: any) => r.data);
      
      const res = await classApi.confirmImport({
        rows: validRows,
        mode
      });
      
      const successCount = res.success || 0;
      const skipCount = res.skipped || 0;
      toast.success(`Import thành công ${successCount} lớp, bỏ qua ${skipCount}`);
      
      addNotification(
        "Import lớp hoàn tất",
        `Đã import thành công ${successCount} lớp, bỏ qua ${skipCount} lớp.`,
        "system",
        "/students"
      );

      onSuccess();
      handleClose();
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi import dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData(null);
    setLoading(false);
    onClose();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-xl bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 whitespace-nowrap">
            Hợp lệ
          </span>
        );
      case 'missing_required_field':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-xl bg-rose-500/10 text-rose-700 border border-rose-500/20 whitespace-nowrap">
            Thiếu dữ liệu
          </span>
        );
      case 'duplicate_in_file':
      case 'duplicate_in_database':
        return (
          <span className="inline-flex items-center justify-center text-center px-2 py-0.5 text-[11px] font-semibold rounded-xl bg-amber-500/10 text-amber-700 border border-amber-500/20 leading-tight w-[72px]">
            Trùng lặp
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-xl bg-rose-500/10 text-rose-700 border border-rose-500/20 whitespace-nowrap">
            Lỗi
          </span>
        );
    }
  };

  return (
    <Popup 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="Import danh sách lớp"
      className={previewData ? "max-w-2xl" : "max-w-lg"}
    >
      <div className="p-1">
        {!previewData ? (
          <div className="space-y-5">
            {/* Bước 1 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-xl bg-[#1A73E8]/10 border border-[#1A73E8]/20 text-[#1A73E8] flex items-center justify-center text-xs font-bold font-mono">1</div>
                <h3 className="text-xs font-bold text-[#1E293B] tracking-wider uppercase">BƯỚC 1: CHUẨN BỊ TỆP</h3>
              </div>
              <div className="ml-8">
                <p className="text-xs text-[#64748B] mb-2.5">Tải tệp mẫu để đảm bảo dữ liệu đúng định dạng.</p>
                <button 
                  onClick={downloadTemplate}
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
                    isDragging ? 'border-[#1A73E8] bg-blue-50/20' : 'border-slate-300 hover:border-[#1A73E8] hover:bg-white/50 hover:scale-[1.01]'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                  />
                  <div className="w-10 h-10 bg-[#1A73E8]/10 border border-[#1A73E8]/20 rounded-xl flex items-center justify-center mx-auto mb-2 text-[#1A73E8]">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-[#1E293B] mb-1">
                    Kéo và thả tệp vào đây hoặc nhấn để chọn từ máy tính
                  </p>
                  <p className="text-[#64748B] text-[11px]">
                    Chấp nhận tệp .xlsx, .xls, .csv (Tối đa 10MB)
                  </p>
                  {file && (
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 rounded-xl">
                        <FileText size={14} />
                        <span className="font-semibold text-xs max-w-[200px] truncate">{file.name}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setFile(null); }}
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

            {/* Bước 3 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-xl bg-[#1A73E8]/10 border border-[#1A73E8]/20 text-[#1A73E8] flex items-center justify-center text-xs font-bold font-mono">3</div>
                <h3 className="text-xs font-bold text-[#1E293B] tracking-wider uppercase">BƯỚC 3: LƯU Ý QUAN TRỌNG</h3>
              </div>
              <div className="ml-8 bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl flex items-start gap-3 shadow-sm">
                <Info className="text-amber-700 shrink-0 mt-0.5" size={16} />
                <ul className="text-xs text-amber-800 list-disc list-inside space-y-1 font-medium leading-relaxed">
                  <li>Mã lớp (Tên lớp) là duy nhất trong hệ thống.</li>
                  <li>Các trường bắt buộc theo đúng chuẩn tệp mẫu.</li>
                  <li>Giới hạn tệp: Tối đa 5.000 bản ghi mỗi lần import.</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 mt-2">
              <button
                className="px-4 py-2 text-[#64748B] bg-slate-100 hover:bg-slate-200/80 rounded-xl font-semibold text-xs transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm"
                onClick={handleClose}
                disabled={loading}
              >
                Hủy bỏ
              </button>
              <button
                className="px-4 py-2 bg-[#2a216e] text-white rounded-xl hover:bg-opacity-95 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-xs transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm"
                onClick={handlePreview}
                disabled={!file || loading}
              >
                {loading ? "Đang xử lý..." : "Bắt đầu Import"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* KPI grid */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-slate-500/10 backdrop-blur-sm border border-slate-500/20 p-2.5 rounded-xl text-center shadow-sm">
                <p className="text-[11px] text-[#64748B] font-semibold uppercase tracking-wider">Tổng số</p>
                <p className="text-xl font-extrabold text-[#1E293B] mt-0.5 font-mono">{previewData.totalRows}</p>
              </div>
              <div className="bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/20 p-2.5 rounded-xl text-center shadow-sm">
                <p className="text-[11px] text-emerald-600 font-semibold uppercase tracking-wider">Hợp lệ</p>
                <p className="text-xl font-extrabold text-emerald-700 mt-0.5 font-mono">{previewData.validRows}</p>
              </div>
              <div className="bg-amber-500/10 backdrop-blur-sm border border-amber-500/20 p-2.5 rounded-xl text-center shadow-sm">
                <p className="text-[11px] text-amber-600 font-semibold uppercase tracking-wider">Trùng</p>
                <p className="text-xl font-extrabold text-amber-700 mt-0.5 font-mono">{previewData.duplicateRows}</p>
              </div>
              <div className="bg-rose-500/10 backdrop-blur-sm border border-rose-500/20 p-2.5 rounded-xl text-center shadow-sm">
                <p className="text-[11px] text-rose-600 font-semibold uppercase tracking-wider">Lỗi</p>
                <p className="text-xl font-extrabold text-rose-700 mt-0.5 font-mono">{previewData.invalidRows}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2 text-sm text-[#1E293B]">
              <label className="font-semibold text-xs uppercase tracking-wider text-slate-500">Chế độ xử lý trùng lặp:</label>
              <select
                className="border border-slate-200/80 rounded-xl px-3 py-1.5 bg-white/50 backdrop-blur-sm text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 transition-all duration-150 ease-out cursor-pointer hover:bg-white/70 shadow-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
              >
                <option value="skip_duplicates">Bỏ qua dòng trùng (Chỉ thêm mới)</option>
                <option value="fail_on_duplicates">Dừng nếu có trùng lặp</option>
              </select>
            </div>

            <div className="max-h-60 overflow-y-auto border border-slate-200/60 rounded-xl shadow-inner bg-white/30 backdrop-blur-sm overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50/90 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200/80 shadow-[0_1px_0_0_rgba(226,232,240,0.8)]">
                  <tr>
                    <th className="p-3 text-xs font-bold text-[#1E293B] text-center w-16">Dòng</th>
                    <th className="p-3 text-xs font-bold text-[#1E293B] w-28">Trạng thái</th>
                    <th className="p-3 text-xs font-bold text-[#1E293B] w-36">Tên lớp</th>
                    <th className="p-3 text-xs font-bold text-[#1E293B] w-28">Mã khoa</th>
                    <th className="p-3 text-xs font-bold text-[#1E293B]">Chi tiết lỗi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60">
                  {previewData.rows.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-white/40 transition-colors duration-100">
                      <td className="p-3 text-xs text-center text-slate-500 font-mono font-medium">{row.rowNumber}</td>
                      <td className="p-3 text-xs">{getStatusBadge(row.status)}</td>
                      <td className="p-3 text-xs text-[#1E293B] font-semibold">{row.data.class_name || '-'}</td>
                      <td className="p-3 text-xs text-slate-600 font-mono font-medium">{row.data.department_code || '-'}</td>
                      <td className="p-3 text-xs text-rose-600 font-semibold leading-relaxed">{row.errors.join(", ") || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center mt-4 pt-2 border-t border-slate-100">
              <button
                className="text-xs text-[#1A73E8] hover:text-blue-700 flex items-center gap-1.5 font-bold transition-all duration-150 ease-out hover:scale-[1.02]"
                onClick={() => setPreviewData(null)}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Chọn lại file
              </button>
              
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 text-[#64748B] bg-slate-100 hover:bg-slate-200/80 rounded-xl font-semibold text-xs transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm"
                  onClick={handleClose}
                  disabled={loading}
                >
                  Hủy
                </button>
                <button
                  className="px-4 py-2 bg-[#2a216e] text-white rounded-xl hover:bg-opacity-95 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-xs transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm"
                  onClick={handleConfirm}
                  disabled={previewData.validRows === 0 || loading || (mode === 'fail_on_duplicates' && previewData.duplicateRows > 0)}
                >
                  {loading ? "Đang xử lý..." : "Xác nhận Import"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Popup>
  );
}
