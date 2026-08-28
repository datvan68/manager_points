"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { studentApi, Student } from "@/api/student-api";
import { ApiError } from "@/api/http-client";
import { academicRecordApi } from "@/api/academic-record-api";
import { criteriaApi, Criterion } from "@/api/criteria-api";
import { semesterApi, Semester } from "@/api/semester-api";
import { useAuth } from "@/providers/auth-provider";
import { incrementCriterionUsage, orderCriteriaByUsage, readCriterionUsage, CriterionUsage } from "@/components/grading/criterion-usage";

export type StudentWithClass = Student & {
  class_id?: { _id?: string; class_name?: string } | string;
};

export interface StudentDirectorySearchProps {
  isOpen?: boolean;
  onClose?: () => void;
  onOpenDetail?: (student: StudentWithClass) => void;
  className?: string;
  autoFocus?: boolean;
  usePortal?: boolean;
}

function classNameOf(student: StudentWithClass) {
  return typeof student.class_id === "object" ? student.class_id?.class_name || "Chưa phân lớp" : "Chưa phân lớp";
}

function classIdOf(student: StudentWithClass) {
  return typeof student.class_id === "object" ? student.class_id?._id : student.class_id;
}

function formatDate(value?: string) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa cập nhật" : date.toLocaleDateString("vi-VN");
}

function formatGender(gender?: string) {
  if (!gender) return "Chưa cập nhật";
  if (gender === "Male" || gender.toLowerCase() === "nam") return "Nam";
  if (gender === "Female" || gender.toLowerCase() === "nữ") return "Nữ";
  return gender;
}

function formatStatus(status?: string) {
  if (!status) return "Chưa cập nhật";
  if (status.toLowerCase() === "studying" || status === "Đang học") return "Đang học";
  if (status.toLowerCase() === "reserved" || status === "Bảo lưu") return "Bảo lưu";
  if (status.toLowerCase() === "suspended" || status.toLowerCase() === "dropped" || status === "Thôi học") return "Thôi học";
  if (status.toLowerCase() === "graduated" || status === "Tốt nghiệp") return "Tốt nghiệp";
  return status;
}

function getRecordErrorMessage(error: unknown) {
  const status = error instanceof ApiError ? error.status : (error as any)?.status;
  const message = error instanceof Error ? error.message : (error as any)?.message;
  return status >= 400 && status < 500 && typeof message === "string" && message.trim()
    ? message
    : "Không thể ghi nhận sinh viên. Vui lòng thử lại.";
}

export default function StudentDirectorySearch({
  isOpen = true,
  onClose,
  onOpenDetail,
  className = "",
  autoFocus = true,
  usePortal = false,
}: StudentDirectorySearchProps = {}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentWithClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StudentWithClass | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [criterionUsage, setCriterionUsage] = useState<CriterionUsage>({});
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [selectedCriterionId, setSelectedCriterionId] = useState("");
  const [criterionSearch, setCriterionSearch] = useState("");
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordSaving, setRecordSaving] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordSuccess, setRecordSuccess] = useState<string | null>(null);
  const savingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const dialogCloseRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { user, hasPermission } = useAuth();
  const canCreateRecord = hasPermission("CREATE_STUDENT_RECORD");
  const setInputRef = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (node && isOpen && autoFocus) node.focus();
  }, [isOpen, autoFocus]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && autoFocus) {
      inputRef.current?.focus();
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoFocus]);

  useEffect(() => {
    const trimmed = query.trim();
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();

    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const response = await studentApi.getStudents({
          page: 1,
          limit: 20,
          search: trimmed,
          fields: "slider",
          signal: controller.signal,
        });
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        const data = Array.isArray(response) ? response : response?.data;
        setResults(Array.isArray(data) ? data as StudentWithClass[] : []);
      } catch (requestError) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        const status = requestError instanceof ApiError ? requestError.status : (requestError as any)?.status;
        setError(status === 429 ? "Bạn đang tìm kiếm quá nhanh. Vui lòng thử lại sau." : "Không thể tìm kiếm sinh viên.");
        setResults([]);
      } finally {
        if (!controller.signal.aborted && requestId === requestIdRef.current) setLoading(false);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selected) {
          closePreview();
        } else {
          onClose?.();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, selected, onClose]);

  useEffect(() => {
    if (!selected) return;
    dialogCloseRef.current?.focus();
  }, [selected]);

  useEffect(() => {
    setCriterionUsage(readCriterionUsage(user?.id));
  }, [user?.id]);

  if (!isOpen) return null;

  const canOpenDetail = Boolean(selected && classIdOf(selected));

  const resetRecordControls = () => {
    setCriteria([]);
    setActiveSemester(null);
    setSelectedCriterionId("");
    setCriterionSearch("");
    setRecordLoading(false);
    setRecordSaving(false);
    setRecordError(null);
    setRecordSuccess(null);
    setCriterionSearch("");
    savingRef.current = false;
  };

  const closePreview = () => {
    setSelected(null);
    resetRecordControls();
  };

  const handleStartRecord = async () => {
    if (!selected || !canCreateRecord || recordLoading || recordSaving) return;
    setRecordLoading(true);
    setRecordError(null);
    setRecordSuccess(null);
    try {
      const [loadedCriteria, semesters] = await Promise.all([
        criteriaApi.getCriteria(),
        semesterApi.getSemesters(),
      ]);
      setCriteria(loadedCriteria);
      setActiveSemester(semesters.find((semester) => semester.status === "active") || null);
      if (loadedCriteria.length === 0) setRecordError("Chưa có tiêu chí để ghi nhận.");
      else if (!semesters.some((semester) => semester.status === "active")) {
        setRecordError("Chưa có học kỳ đang hoạt động.");
      }
    } catch {
      setRecordError("Không thể tải tiêu chí và học kỳ.");
    } finally {
      setRecordLoading(false);
    }
  };

  const handleCreateRecord = async () => {
    if (!selected || !selectedCriterionId || !activeSemester || savingRef.current) return;
    const criterion = criteria.find((item) => item._id === selectedCriterionId);
    if (!criterion) return;
    savingRef.current = true;
    setRecordSaving(true);
    setRecordError(null);
    setRecordSuccess(null);
    try {
      await academicRecordApi.createAcademicRecord({
        student_id: selected._id,
        criterion_id: criterion._id,
        semester_id: activeSemester._id,
        record_title: criterion.criterion_name,
        recorded_by: user?.id,
        recorded_at: new Date().toISOString(),
        status: "active",
        idempotency_key: typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${selected._id}-${criterion._id}-${Date.now()}`,
      });
      setRecordSuccess("Đã ghi nhận sinh viên thành công.");
      setCriteria([]);
      setActiveSemester(null);
      setSelectedCriterionId("");
    } catch (error) {
      setRecordError(getRecordErrorMessage(error));
    } finally {
      savingRef.current = false;
      setRecordSaving(false);
    }
  };

  const uniqueCriteria = criteria.filter((criterion, index, allCriteria) => (
    allCriteria.findIndex((item) => item._id === criterion._id) === index
  ));
  const orderedCriteria = orderCriteriaByUsage(uniqueCriteria, criterionUsage);
  const normalizedCriterionSearch = criterionSearch.trim().toLowerCase();
  const frequentCriteria = orderedCriteria.frequent.filter((criterion) => (
    criterion.criterion_name.toLowerCase().includes(normalizedCriterionSearch)
  ));
  const remainingCriteria = orderedCriteria.remaining.filter((criterion) => (
    criterion.criterion_name.toLowerCase().includes(normalizedCriterionSearch)
  ));

  const handleNavigateDetail = () => {
    if (!selected) return;
    const currentSelected = selected;
    closePreview();
    onClose?.();
    if (onOpenDetail) {
      onOpenDetail(currentSelected);
    } else {
      const classId = classIdOf(currentSelected);
      if (classId && currentSelected._id) {
        router.push(`/students/${classId}/${currentSelected._id}`);
      }
    }
  };

  const previewModal = selected ? (
    <div
      data-student-preview="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && closePreview()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-preview-title"
        className="w-full max-w-md rounded-2xl border border-white/80 bg-white/90 p-5 shadow-xl shadow-slate-300/40 backdrop-blur-md"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1A73E8]">Thông tin cơ bản</p>
            <div className="mt-1 flex items-baseline gap-2">
              <h2 id="student-preview-title" className="text-lg font-bold text-[#1E293B]">{selected.full_name}</h2>
              {canOpenDetail && (
                <button
                  type="button"
                  onClick={handleNavigateDetail}
                  className="shrink-0 text-xs font-semibold text-[#1A73E8] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
                >
                  Chi tiết
                </button>
              )}
            </div>
          </div>
          <button
            ref={dialogCloseRef}
            type="button"
            onClick={closePreview}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/70 bg-white/60 text-[#64748B] transition-all duration-150 ease-out hover:scale-[1.02] hover:bg-white/90 hover:text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 cursor-pointer"
            aria-label="Đóng thông tin sinh viên"
          >
            <X size={16} />
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
          <div className="rounded-xl border border-white/70 bg-white/50 p-2.5 backdrop-blur-xs">
            <dt className="text-[11px] font-medium text-[#64748B]">Mã sinh viên</dt>
            <dd className="mt-0.5 text-xs font-semibold text-[#1E293B]">{selected.student_code}</dd>
          </div>
          <div className="rounded-xl border border-white/70 bg-white/50 p-2.5 backdrop-blur-xs">
            <dt className="text-[11px] font-medium text-[#64748B]">Lớp</dt>
            <dd className="mt-0.5 truncate text-xs font-semibold text-[#1E293B]" title={classNameOf(selected)}>{classNameOf(selected)}</dd>
          </div>
          <div className="rounded-xl border border-white/70 bg-white/50 p-2.5 backdrop-blur-xs">
            <dt className="text-[11px] font-medium text-[#64748B]">Ngày sinh</dt>
            <dd className="mt-0.5 text-xs font-semibold text-[#1E293B]">{formatDate(selected.date_bir)}</dd>
          </div>
          <div className="rounded-xl border border-white/70 bg-white/50 p-2.5 backdrop-blur-xs">
            <dt className="text-[11px] font-medium text-[#64748B]">Giới tính</dt>
            <dd className="mt-0.5 text-xs font-semibold text-[#1E293B]">{formatGender(selected.sex)}</dd>
          </div>
          <div className="col-span-2 rounded-xl border border-white/70 bg-white/50 p-2.5 backdrop-blur-xs">
            <dt className="text-[11px] font-medium text-[#64748B]">Email</dt>
            <dd className="mt-0.5 break-all text-xs font-semibold text-[#1E293B]">{selected.email || "Chưa cập nhật"}</dd>
          </div>
          <div className="col-span-2 flex items-center justify-between rounded-xl border border-white/70 bg-white/50 p-2.5 backdrop-blur-xs">
            <div>
              <dt className="text-[11px] font-medium text-[#64748B]">Trạng thái học tập</dt>
              <dd className="mt-0.5 text-xs font-semibold text-[#1E293B]">{formatStatus(selected.status)}</dd>
            </div>
            {selected.status && (
              <span className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-[#1A73E8]">
                {formatStatus(selected.status)}
              </span>
            )}
          </div>
        </dl>

        {canCreateRecord && (
          <div className="mt-3 rounded-xl border border-blue-500/15 bg-blue-500/5 p-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-[#1E293B]">Ghi nhận học vụ</p>
              {!criteria.length && !recordLoading && !recordSuccess && (
                <button type="button" onClick={handleStartRecord} disabled={recordSaving} className="rounded-xl bg-[#1A73E8] px-3.5 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                  Ghi nhận
                </button>
              )}
            </div>
            {(criteria.length > 0 || recordLoading) && (
              <div onMouseDown={(event) => event.target === event.currentTarget && closePreview()} className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/25 p-3 sm:static sm:inset-auto sm:z-auto sm:mt-2 sm:block sm:bg-transparent sm:p-0">
                <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2 shadow-2xl sm:rounded-xl sm:shadow-sm">
                  <label htmlFor="student-record-criterion" className="sr-only">Tìm tiêu chí</label>
                  <input id="student-record-criterion" value={criterionSearch} onChange={(event) => setCriterionSearch(event.target.value)} disabled={recordLoading || recordSaving} placeholder="Tìm tiêu chí..." className="m-1 w-[calc(100%-0.5rem)] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#1E293B] outline-none placeholder:text-slate-400 focus:border-[#1A73E8]" />
                  {frequentCriteria.length > 0 && (
                    <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Sử dụng nhiều</p>
                  )}
                  <div className="max-h-56 overflow-y-auto px-1 pb-1">
                    {frequentCriteria.map((criterion) => {
                      const score = criterion.score_per_unit || criterion.min_score || 0;
                      return (
                        <button key={criterion._id} type="button" onClick={() => { setSelectedCriterionId(criterion._id); setCriterionUsage(incrementCriterionUsage(user?.id, criterion._id)); }} disabled={recordLoading || recordSaving} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-blue-50 disabled:cursor-not-allowed ${selectedCriterionId === criterion._id ? "bg-blue-50 text-[#1A73E8]" : "text-[#334155]"}`}>
                          <span className="truncate font-semibold">{criterion.criterion_name}</span>
                          <span className="shrink-0 text-[11px] font-bold text-slate-400">({score > 0 ? "+" : ""}{score}đ)</span>
                        </button>
                      );
                    })}
                    {frequentCriteria.length > 0 && remainingCriteria.length > 0 && <div className="my-1 border-t border-slate-100" />}
                    {remainingCriteria.map((criterion) => {
                      const score = criterion.score_per_unit || criterion.min_score || 0;
                      return (
                        <button key={criterion._id} type="button" onClick={() => { setSelectedCriterionId(criterion._id); setCriterionUsage(incrementCriterionUsage(user?.id, criterion._id)); }} disabled={recordLoading || recordSaving} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-blue-50 disabled:cursor-not-allowed ${selectedCriterionId === criterion._id ? "bg-blue-50 text-[#1A73E8]" : "text-[#334155]"}`}>
                          <span className="truncate font-semibold">{criterion.criterion_name}</span>
                          <span className="shrink-0 text-[11px] font-bold text-slate-400">({score > 0 ? "+" : ""}{score}đ)</span>
                        </button>
                      );
                    })}
                  </div>
                  {recordError && <p className="mt-1 px-2 text-xs font-medium text-rose-700">{recordError}</p>}
                  <div className="mt-2 flex justify-end gap-2 border-t border-slate-100 px-1 pt-2">
                    <button type="button" onClick={closePreview} className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#64748B] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30">
                      Đóng
                    </button>
                    <button type="button" onClick={handleCreateRecord} disabled={!selectedCriterionId || !activeSemester || recordSaving || recordLoading} className="rounded-xl bg-[#1A73E8] px-3.5 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                      {recordSaving ? "Đang lưu..." : "Xác nhận ghi nhận"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {recordError && !criteria.length && !recordLoading && <p className="mt-2 text-xs font-medium text-rose-700">{recordError}</p>}
            {recordSuccess && <p className="mt-2 text-xs font-medium text-emerald-700">{recordSuccess}</p>}
          </div>
        )}

        {!canOpenDetail && (
          <p className="mt-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-right text-xs font-medium text-amber-700">
            Sinh viên chưa có lớp để mở trang chi tiết.
          </p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <div ref={containerRef} className={`relative w-full ${className}`}>
        <label htmlFor="student-directory-search" className="sr-only">Tìm kiếm sinh viên</label>
        <div className="flex items-center gap-2 rounded-2xl border border-indigo-200/70 bg-white/75 px-3.5 py-1.5 shadow-xs backdrop-blur-md transition-all duration-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100/50">
          <Search size={16} className="shrink-0 text-[#64748B]" aria-hidden="true" />
          <input
            ref={setInputRef}
            id="student-directory-search"
            autoFocus={autoFocus}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm kiếm sinh viên..."
            className="min-w-0 flex-1 bg-transparent text-sm text-[#1E293B] outline-none placeholder:text-[#64748B]"
            autoComplete="off"
          />
          {loading && <Loader2 size={15} className="shrink-0 animate-spin text-[#1A73E8]" aria-label="Đang tìm kiếm" />}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng tìm kiếm"
              className="shrink-0 text-[#64748B] hover:text-[#1E293B] p-1 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>

      {query.trim().length >= 2 && !selected && (
        <div
          className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-white/80 bg-[#edf4fc]/95 p-2 shadow-xl shadow-slate-400/20 backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
          aria-live="polite"
        >
          {error ? (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-3.5 text-xs font-medium text-[#64748B]">
              <Loader2 size={15} className="animate-spin text-[#1A73E8]" />
              <span>Đang tìm kiếm...</span>
            </div>
          ) : results.length === 0 ? (
            <p className="rounded-xl border border-white/60 bg-white/40 px-3 py-3 text-center text-xs font-medium text-[#64748B] backdrop-blur-xs">
              Không tìm thấy sinh viên phù hợp.
            </p>
          ) : (
            <ul
              className="space-y-1 max-h-[384px] overflow-y-auto overflow-x-hidden scrollbar-hover"
              aria-label="Kết quả tìm kiếm sinh viên"
            >
              {results.map((student) => (
                <li key={student._id}>
                  <button
                    type="button"
                    onClick={() => setSelected(student)}
                    className="group w-full rounded-2xl border border-transparent bg-transparent px-4 py-2.5 text-left transition-all duration-150 ease-out hover:bg-white/45 hover:border-white/60 hover:backdrop-blur-sm focus:outline-none focus:bg-white/45 focus:border-white/60 focus:backdrop-blur-sm active:bg-white/55 cursor-pointer"
                  >
                    <span className="block truncate text-sm font-bold text-[#1E293B] group-hover:text-[#1A73E8] transition-colors">
                      {student.full_name}
                    </span>
                    <span className="block truncate text-xs font-medium text-[#64748B] group-hover:text-[#475569] mt-0.5">
                      {student.student_code} · {classNameOf(student)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!usePortal && previewModal}
    </div>
    {usePortal && mounted && typeof document !== "undefined" && previewModal
      ? createPortal(previewModal, document.body)
      : null}
    </>
  );
}
