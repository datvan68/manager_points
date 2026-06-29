import React, { useState, useMemo } from "react";
import {
  X,
  Search,
  Check,
  AlertTriangle,
  AlertCircle,
  Copy,
  User,
  Lock,
  Loader2,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import type { GradingStatus, StudentData } from "../_types";

interface CopyResult {
  studentId: string;
  studentName: string;
  status: "success" | "error";
  message?: string;
}

interface CopyScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceStudent: StudentData | undefined;
  students: StudentData[];
  studentSummaryMap: Record<string, string>;
  apiSummariesPoints: any[];
  semesterName: string;
  className: string;
  onCopyConfirm: (
    targetStudentIds: string[],
    onProgress: (current: number, total: number) => void
  ) => Promise<CopyResult[]>;
}

export default function CopyScoreModal({
  isOpen,
  onClose,
  sourceStudent,
  students,
  studentSummaryMap,
  apiSummariesPoints,
  semesterName,
  className,
  onCopyConfirm,
}: CopyScoreModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCopying, setIsCopying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [copyResults, setCopyResults] = useState<CopyResult[] | null>(null);
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
      const isSource = sourceStudent && student.id === sourceStudent.id;

      let isDisabled = false;
      let reason = "";

      if (isSource) {
        isDisabled = true;
        reason = "Sinh viên nguồn";
      } else if (hasNoSummary) {
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
  }, [students, studentSummaryMap, apiSummariesPoints, sourceStudent]);

  // Lọc sinh viên theo từ khóa tìm kiếm
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return targetStudents;
    const term = searchTerm.toLowerCase().trim();
    return targetStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.id.toLowerCase().includes(term) ||
        (s.studentCode && s.studentCode.toLowerCase().includes(term))
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
      // Hủy chọn tất cả các sinh viên đang hiển thị và chọn được
      selectableVisibleIds.forEach((id) => next.delete(id));
    } else {
      // Chọn tất cả các sinh viên đang hiển thị và chọn được
      selectableVisibleIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
  };

  const handleToggleSelect = (studentId: string, isDisabled: boolean) => {
    if (isDisabled || isCopying || copyResults) return;
    const next = new Set(selectedIds);
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      next.add(studentId);
    }
    setSelectedIds(next);
  };

  const handleConfirmCopy = async () => {
    if (selectedIds.size === 0 || isCopying) return;

    setIsCopying(true);
    setCopyResults(null);
    setModalError(null);
    setProgress({ current: 0, total: selectedIds.size });

    try {
      const targetsArray = Array.from(selectedIds);
      const results = await onCopyConfirm(targetsArray, (current, total) => {
        setProgress({ current, total });
      });
      setCopyResults(results);
    } catch (err: any) {
      console.error("Copy error:", err);
      setModalError(err.message || "Đã xảy ra lỗi ngoài dự kiến trong quá trình sao chép.");
    } finally {
      setIsCopying(false);
    }
  };

  const handleCloseModal = () => {
    if (isCopying) return; // Không cho phép đóng khi đang copy
    onClose();
    // Reset states
    setSearchTerm("");
    setSelectedIds(new Set());
    setCopyResults(null);
    setModalError(null);
    setProgress({ current: 0, total: 0 });
  };

  // Tính toán tóm tắt kết quả
  const resultsSummary = useMemo(() => {
    if (!copyResults || copyResults.length === 0) return null;
    const successCount = copyResults.filter((r) => r.status === "success").length;
    const failedCount = copyResults.filter((r) => r.status === "error").length;
    const totalCount = copyResults.length;

    let severity: "success" | "warning" | "error" = "success";
    let title = "Sao chép thành công!";
    let desc = `Đã sao chép điểm rèn luyện thành công cho ${successCount}/${totalCount} sinh viên.`;

    if (failedCount === totalCount) {
      severity = "error";
      title = "Sao chép thất bại!";
      desc = `Không thể sao chép điểm rèn luyện cho bất kỳ sinh viên nào trong ${totalCount} sinh viên đã chọn.`;
    } else if (failedCount > 0) {
      severity = "warning";
      title = "Sao chép thành công một phần!";
      desc = `Đã sao chép thành công cho ${successCount} sinh viên, nhưng thất bại ở ${failedCount} sinh viên.`;
    }

    return { severity, title, desc };
  }, [copyResults]);

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
              <h3 className="text-[18px] font-bold text-[#1E293B] flex items-center gap-2">
                <Sparkles size={18} className="text-[#1A73E8]" />
                Sao chép điểm rèn luyện
              </h3>
              <p className="text-[12.5px] text-[#64748B] font-medium">
                {className} • Học kỳ: {semesterName}
              </p>
            </div>
            {!isCopying && (
              <button
                onClick={handleCloseModal}
                className="p-1.5 hover:bg-slate-100 rounded-full text-[#64748B] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Nội dung chính */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
            {/* Nếu có lỗi ngoài dự kiến */}
            {modalError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3">
                <div className="p-2 bg-rose-500 text-white rounded-full">
                  <AlertCircle size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-rose-800 text-[14.5px]">
                    Lỗi hệ thống ngoài dự kiến
                  </h4>
                  <p className="text-rose-700 text-[12px] font-medium">
                    {modalError}
                  </p>
                </div>
              </div>
            )}

            {/* Nếu đang hiển thị kết quả copy */}
            {copyResults && resultsSummary ? (
              <div className="flex flex-col gap-4">
                <div
                  className={`p-4 rounded-2xl flex items-center gap-3 border ${
                    resultsSummary.severity === "success"
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : resultsSummary.severity === "warning"
                      ? "bg-amber-500/10 border-amber-500/20"
                      : "bg-rose-500/10 border-rose-500/20"
                  }`}
                >
                  <div
                    className={`p-2 text-white rounded-full ${
                      resultsSummary.severity === "success"
                        ? "bg-emerald-500"
                        : resultsSummary.severity === "warning"
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                  >
                    {resultsSummary.severity === "success" ? (
                      <Check size={16} strokeWidth={3} />
                    ) : resultsSummary.severity === "warning" ? (
                      <AlertTriangle size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                  </div>
                  <div>
                    <h4
                      className={`font-bold text-[14.5px] ${
                        resultsSummary.severity === "success"
                          ? "text-emerald-800"
                          : resultsSummary.severity === "warning"
                          ? "text-amber-800"
                          : "text-rose-800"
                      }`}
                    >
                      {resultsSummary.title}
                    </h4>
                    <p
                      className={`text-[12px] font-medium ${
                        resultsSummary.severity === "success"
                          ? "text-emerald-700"
                          : resultsSummary.severity === "warning"
                          ? "text-amber-700"
                          : "text-rose-700"
                      }`}
                    >
                      {resultsSummary.desc}
                    </p>
                  </div>
                </div>

                <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-slate-50/50">
                  <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                    {copyResults.map((res) => (
                      <div
                        key={res.studentId}
                        className="p-3.5 flex justify-between items-center gap-4 hover:bg-white transition-colors"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-[#1E293B] text-[13.5px]">
                            {res.studentName}
                          </span>
                          <span className="text-[11px] text-[#64748B] font-medium font-mono">
                            MSSV: {res.studentId}
                          </span>
                        </div>
                        {res.status === "success" ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold">
                            <Check size={12} strokeWidth={2.5} />
                            Thành công
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold"
                            title={res.message}
                          >
                            <AlertCircle size={12} />
                            Lỗi: {res.message || "Không xác định"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : isCopying ? (
              /* Màn hình loading khi đang copy */
              <div className="py-16 flex flex-col items-center justify-center gap-5 text-center">
                <Loader2 size={44} className="text-[#1A73E8] animate-spin" />
                <div className="flex flex-col gap-2">
                  <h4 className="font-bold text-[#1E293B] text-[16px]">
                    Đang thực hiện sao chép điểm...
                  </h4>
                  <p className="text-[#64748B] text-[13px] font-medium">
                    Vui lòng không đóng trình duyệt hoặc làm mới trang.
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full max-w-xs mt-2">
                  <div className="flex justify-between text-[11.5px] text-[#64748B] font-bold mb-1.5 font-mono">
                    <span>Tiến trình</span>
                    <span>
                      {progress.current}/{progress.total} sinh viên
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#1A73E8] to-blue-500 rounded-full"
                      style={{
                        width: `${
                          progress.total > 0
                            ? (progress.current / progress.total) * 100
                            : 0
                        }%`,
                      }}
                      layout
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Giao diện chọn sinh viên bình thường */
              <>
                {/* Sinh viên nguồn */}
                {sourceStudent && (
                  <div className="p-4 bg-slate-100/40 border border-slate-200/50 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-[#1A73E8]/10 text-[#1A73E8] rounded-xl">
                        <User size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">
                          Sinh viên nguồn (Sao chép từ)
                        </span>
                        <span className="font-bold text-[#1E293B] text-[14.5px]">
                          {sourceStudent.name}
                        </span>
                        <span className="text-[11px] text-[#64748B] font-medium font-mono mt-0.5">
                          MSSV: {sourceStudent.studentCode || sourceStudent.id}
                        </span>
                      </div>
                    </div>
                    <div className="bg-white/80 border border-slate-200/40 px-4 py-2 rounded-xl text-center self-start sm:self-auto min-w-[90px] shadow-sm">
                      <span className="text-[18px] font-extrabold text-[#1A73E8]">
                        {sourceStudent.score}
                      </span>
                      <span className="text-[9px] text-[#64748B] font-bold block">
                        Đang hiển thị
                      </span>
                    </div>
                  </div>
                )}

                {/* Tìm kiếm và nút Select All */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  <div className="relative flex-1">
                    <Search
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Tìm sinh viên theo tên hoặc MSSV..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-100/60 border border-slate-200/60 rounded-xl text-[13px] font-medium text-[#1E293B] placeholder-slate-400 focus:outline-none focus:border-[#1A73E8] focus:bg-white transition-all h-[38px]"
                    />
                  </div>

                  {selectableVisibleIds.length > 0 && (
                    <button
                      onClick={handleToggleSelectAll}
                      className="h-[38px] px-4 rounded-xl text-[12.5px] font-bold border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 text-[#64748B] cursor-pointer shrink-0"
                    >
                      <Check size={14} strokeWidth={2.5} />
                      {isAllVisibleSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                    </button>
                  )}
                </div>

                {/* Danh sách sinh viên đích */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11.5px] text-[#64748B] font-bold uppercase tracking-wider pl-1">
                    Sinh viên đích ({filteredStudents.length} kết quả)
                  </span>

                  <div className="border border-slate-200/60 rounded-2xl bg-slate-50/30 overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                      {filteredStudents.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-[13px] font-medium">
                          Không tìm thấy sinh viên nào phù hợp
                        </div>
                      ) : (
                        filteredStudents.map((student) => {
                          const isSelected = selectedIds.has(student.id);

                          return (
                            <div
                              key={student.id}
                              onClick={() =>
                                handleToggleSelect(student.id, student.isDisabled)
                              }
                              className={`p-3.5 flex justify-between items-center gap-4 transition-all ${
                                student.isDisabled
                                  ? "opacity-50 cursor-not-allowed bg-slate-50/20"
                                  : "hover:bg-white cursor-pointer"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {/* Custom Checkbox */}
                                {!student.isDisabled && (
                                  <div
                                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                      isSelected
                                        ? "bg-[#1A73E8] border-[#1A73E8] text-white"
                                        : "border-slate-300 bg-white hover:border-[#1A73E8]"
                                    }`}
                                  >
                                    {isSelected && (
                                      <Check size={12} strokeWidth={3} />
                                    )}
                                  </div>
                                )}

                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-[#1E293B] text-[13.5px] truncate">
                                    {student.name}
                                  </span>
                                  <span className="text-[11px] text-[#64748B] font-medium font-mono mt-0.5">
                                    MSSV: {student.studentCode || student.id}
                                  </span>
                                </div>
                              </div>

                              {/* Điểm hiện tại / Trạng thái */}
                              <div className="flex items-center gap-2 shrink-0">
                                {student.isDisabled ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200/60 px-2.5 py-1 rounded-full">
                                    {student.reason === "Bảng điểm đã chốt" ? (
                                      <Lock size={10} />
                                    ) : (
                                      <AlertTriangle size={10} />
                                    )}
                                    {student.reason}
                                  </span>
                                ) : (
                                  <div className="text-right">
                                    <span className="font-extrabold text-[#1E293B] text-[14px]">
                                      {student.score}đ
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
            {copyResults ? (
              <button
                onClick={handleCloseModal}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[#1E293B] rounded-xl font-bold text-[13.5px] transition-colors cursor-pointer text-center hover:scale-[1.01]"
              >
                Đóng modal
              </button>
            ) : isCopying ? (
              <span className="text-[12px] text-[#64748B] font-medium">
                Đang lưu dữ liệu điểm rèn luyện...
              </span>
            ) : (
              <>
                <span className="text-[12.5px] text-[#64748B] font-bold">
                  Đã chọn:{" "}
                  <span className="text-[#1A73E8] font-extrabold text-[13.5px]">
                    {selectedIds.size}
                  </span>{" "}
                  sinh viên
                </span>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCloseModal}
                    className="px-5 py-2.5 border border-slate-200 text-[#64748B] hover:bg-slate-50 rounded-xl font-bold text-[13px] transition-colors cursor-pointer h-[38px] flex items-center justify-center"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={handleConfirmCopy}
                    disabled={selectedIds.size === 0}
                    className="px-6 py-2.5 bg-[#1A73E8] text-white rounded-xl font-bold text-[13px] hover:bg-[#155cc4] transition-all shadow-md shadow-blue-500/10 cursor-pointer flex items-center gap-1.5 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 h-[38px]"
                  >
                    <Copy size={13} />
                    <span>Xác nhận sao chép</span>
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
