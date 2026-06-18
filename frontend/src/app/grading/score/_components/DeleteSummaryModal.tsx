import React, { useState, useMemo } from "react";
import {
  X,
  Search,
  Check,
  AlertTriangle,
  AlertCircle,
  Trash2,
  Lock,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import type { StudentData } from "../_types";

interface DeleteResult {
  studentId: string;
  studentName: string;
  status: "success" | "error";
  message?: string;
}

interface DeleteSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeStudent: StudentData | undefined;
  students: StudentData[];
  studentSummaryMap: Record<string, string>;
  apiSummariesPoints: any[];
  semesterName: string;
  className: string;
  onDeleteConfirm: (
    targetSummaryIds: string[],
    onProgress: (current: number, total: number) => void
  ) => Promise<DeleteResult[]>;
}

export default function DeleteSummaryModal({
  isOpen,
  onClose,
  activeStudent,
  students,
  studentSummaryMap,
  apiSummariesPoints,
  semesterName,
  className,
  onDeleteConfirm,
}: DeleteSummaryModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(activeStudent ? [activeStudent.id] : [])
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [deleteResults, setDeleteResults] = useState<DeleteResult[] | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Phân tích trạng thái của từng sinh viên đích
  const targetStudents = useMemo(() => {
    const summaryMapById = new Map<string, any>();
    apiSummariesPoints.forEach((s) => {
      if (s && s._id) {
        summaryMapById.set(s._id, s);
      }
    });

    return students.map((student) => {
      const summaryId = studentSummaryMap[student.id];
      const summary = summaryId ? summaryMapById.get(summaryId) : undefined;
      const isLocked = summary?.status === "locked" || student.gradingStatus === "locked";
      const hasNoSummary = !summaryId;

      let isDisabled = false;
      let reason = "";

      if (hasNoSummary) {
        isDisabled = true;
        reason = "Chưa tạo bảng điểm";
      } else if (isLocked) {
        isDisabled = true;
        reason = "Bảng điểm đã chốt";
      }

      return {
        ...student,
        isDisabled,
        reason,
        summaryId,
      };
    });
  }, [students, studentSummaryMap, apiSummariesPoints]);

  // Lọc sinh viên theo từ khóa tìm kiếm
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return targetStudents;
    const term = searchTerm.toLowerCase().trim();
    return targetStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.id.toLowerCase().includes(term)
    );
  }, [targetStudents, searchTerm]);

  // Danh sách các sinh viên có thể chọn được trong danh sách hiển thị
  const selectableVisibleIds = useMemo(() => {
    return filteredStudents
      .filter((s) => !s.isDisabled)
      .map((s) => s.id);
  }, [filteredStudents]);

  const isAllVisibleSelected = useMemo(() => {
    if (selectableVisibleIds.length === 0) return false;
    return selectableVisibleIds.every((id) => selectedIds.has(id));
  }, [selectableVisibleIds, selectedIds]);

  const handleToggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (isAllVisibleSelected) {
      selectableVisibleIds.forEach((id) => next.delete(id));
    } else {
      selectableVisibleIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
  };

  const handleToggleSelect = (studentId: string, isDisabled: boolean) => {
    if (isDisabled || isDeleting || deleteResults) return;
    const next = new Set(selectedIds);
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      next.add(studentId);
    }
    setSelectedIds(next);
  };

  const handleConfirmDelete = async () => {
    if (selectedIds.size === 0 || isDeleting) return;

    setIsDeleting(true);
    setDeleteResults(null);
    setModalError(null);
    setProgress({ current: 0, total: selectedIds.size });

    try {
      const targetSummaryIds = Array.from(selectedIds)
        .map(id => targetStudents.find(s => s.id === id)?.summaryId)
        .filter(Boolean) as string[];

      const results = await onDeleteConfirm(targetSummaryIds, (current, total) => {
        setProgress({ current, total });
      });
      setDeleteResults(results);
    } catch (err: any) {
      console.error("Delete error:", err);
      setModalError(err.message || "Đã xảy ra lỗi ngoài dự kiến trong quá trình xóa.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseModal = () => {
    if (isDeleting) return;
    onClose();
    setSearchTerm("");
    setSelectedIds(new Set(activeStudent ? [activeStudent.id] : []));
    setDeleteResults(null);
    setModalError(null);
    setProgress({ current: 0, total: 0 });
  };

  const resultsSummary = useMemo(() => {
    if (!deleteResults || deleteResults.length === 0) return null;
    const successCount = deleteResults.filter((r) => r.status === "success").length;
    const failedCount = deleteResults.filter((r) => r.status === "error").length;
    const totalCount = deleteResults.length;

    let severity: "success" | "warning" | "error" = "success";
    let title = "Xóa thành công!";
    let desc = `Đã xóa bảng điểm rèn luyện thành công cho ${successCount}/${totalCount} sinh viên.`;

    if (failedCount === totalCount) {
      severity = "error";
      title = "Xóa thất bại!";
      desc = `Không thể xóa bảng điểm rèn luyện cho bất kỳ sinh viên nào trong ${totalCount} sinh viên đã chọn.`;
    } else if (failedCount > 0) {
      severity = "warning";
      title = "Xóa thành công một phần!";
      desc = `Đã xóa thành công cho ${successCount} sinh viên, nhưng thất bại ở ${failedCount} sinh viên.`;
    }

    return { severity, title, desc };
  }, [deleteResults]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#1E293B]/45 backdrop-blur-[5px] z-50 flex items-center justify-center p-4">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="bg-white/95 backdrop-blur-md rounded-[28px] border border-white/80 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col font-sans overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <h3 className="text-[18px] font-bold text-rose-600 flex items-center gap-2">
                <Trash2 size={18} className="text-rose-600" />
                Xóa bảng điểm rèn luyện
              </h3>
              <p className="text-[12.5px] text-[#64748B] font-medium">
                {className} • Học kỳ: {semesterName}
              </p>
            </div>
            {!isDeleting && (
              <button
                onClick={handleCloseModal}
                className="p-1.5 hover:bg-slate-100 rounded-full text-[#64748B] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
            {modalError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3">
                <div className="p-2 bg-rose-500 text-white rounded-full">
                  <AlertCircle size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-rose-800 text-[14.5px]">Lỗi hệ thống</h4>
                  <p className="text-rose-700 text-[12px] font-medium">{modalError}</p>
                </div>
              </div>
            )}

            {deleteResults && resultsSummary ? (
              <div className="flex flex-col gap-4">
                <div className={`p-4 rounded-2xl flex items-center gap-3 border ${resultsSummary.severity === 'success' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                  <div className={`p-2 text-white rounded-full ${resultsSummary.severity === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                    {resultsSummary.severity === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  </div>
                  <div>
                    <h4 className={`font-bold text-[14.5px] ${resultsSummary.severity === 'success' ? 'text-emerald-800' : 'text-rose-800'}`}>
                      {resultsSummary.title}
                    </h4>
                    <p className={`text-[12px] font-medium ${resultsSummary.severity === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {resultsSummary.desc}
                    </p>
                  </div>
                </div>
              </div>
            ) : isDeleting ? (
              <div className="py-16 flex flex-col items-center justify-center gap-5 text-center">
                <Loader2 size={44} className="text-rose-600 animate-spin" />
                <div className="flex flex-col gap-2">
                  <h4 className="font-bold text-[#1E293B] text-[16px]">Đang xóa điểm rèn luyện...</h4>
                </div>
                <div className="w-full max-w-xs mt-2">
                  <div className="flex justify-between text-[11.5px] text-[#64748B] font-bold mb-1.5 font-mono">
                    <span>Tiến trình</span>
                    <span>{progress.current}/{progress.total} sinh viên</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                      layout
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm sinh viên..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-100/60 border border-slate-200/60 rounded-xl text-[13px] focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  {selectableVisibleIds.length > 0 && (
                    <button
                      onClick={handleToggleSelectAll}
                      className="h-[38px] px-4 rounded-xl text-[12.5px] font-bold border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check size={14} />
                      {isAllVisibleSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[11.5px] text-[#64748B] font-bold uppercase tracking-wider pl-1">Danh sách sinh viên</span>
                  <div className="border border-slate-200/60 rounded-2xl bg-slate-50/30 overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                      {filteredStudents.map((student) => {
                        const isSelected = selectedIds.has(student.id);
                        return (
                          <div
                            key={student.id}
                            onClick={() => handleToggleSelect(student.id, student.isDisabled)}
                            className={`p-3.5 flex justify-between items-center gap-4 transition-all ${student.isDisabled ? 'opacity-50 cursor-not-allowed bg-slate-50/20' : 'hover:bg-white cursor-pointer'}`}
                          >
                            <div className="flex items-center gap-3">
                              {!student.isDisabled && (
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-300'}`}>
                                  {isSelected && <Check size={12} strokeWidth={3} />}
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="font-bold text-[13.5px]">{student.name}</span>
                                <span className="text-[11px] text-[#64748B]">MSSV: {student.id}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {student.isDisabled ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                                  {student.reason === 'Bảng điểm đã chốt' ? <Lock size={10} /> : <AlertTriangle size={10} />}
                                  {student.reason}
                                </span>
                              ) : (
                                <span className="font-extrabold text-[14px]">{student.score}đ</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
            {deleteResults ? (
              <button onClick={handleCloseModal} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold">Đóng modal</button>
            ) : isDeleting ? (
              <span className="text-[12px] text-[#64748B]">Đang xóa dữ liệu...</span>
            ) : (
              <>
                <span className="text-[12.5px] text-[#64748B] font-bold">Đã chọn: <span className="text-rose-600 font-extrabold text-[13.5px]">{selectedIds.size}</span> sinh viên</span>
                <div className="flex items-center gap-3">
                  <button onClick={handleCloseModal} className="px-5 py-2.5 border rounded-xl font-bold text-[13px]">Hủy bỏ</button>
                  <button onClick={handleConfirmDelete} disabled={selectedIds.size === 0} className="px-6 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-[13px] flex items-center gap-1.5 disabled:opacity-50 h-[38px] cursor-pointer">
                    <Trash2 size={13} /> Xác nhận xóa
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
