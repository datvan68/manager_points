"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, X, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { studentApi, Student } from "@/api/student-api";
import { ApiError } from "@/api/http-client";

export type StudentWithClass = Student & {
  class_id?: { _id?: string; class_name?: string } | string;
};

export interface StudentDirectorySearchProps {
  isOpen?: boolean;
  onClose?: () => void;
  onOpenDetail?: (student: StudentWithClass) => void;
  className?: string;
  autoFocus?: boolean;
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

export default function StudentDirectorySearch({
  isOpen = true,
  onClose,
  onOpenDetail,
  className = "",
  autoFocus = true,
}: StudentDirectorySearchProps = {}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentWithClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StudentWithClass | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dialogCloseRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && autoFocus) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoFocus]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      abortRef.current?.abort();
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
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
        if (controller.signal.aborted) return;
        setResults(Array.isArray(response) ? response as StudentWithClass[] : response.data as StudentWithClass[]);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        const status = requestError instanceof ApiError ? requestError.status : (requestError as any)?.status;
        setError(status === 429 ? "Bạn đang tìm kiếm quá nhanh. Vui lòng thử lại sau." : "Không thể tìm kiếm sinh viên.");
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selected) {
          setSelected(null);
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

  if (!isOpen) return null;

  const canOpenDetail = Boolean(selected && classIdOf(selected));

  const handleNavigateDetail = () => {
    if (!selected) return;
    const currentSelected = selected;
    setSelected(null);
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

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <label htmlFor="student-directory-search" className="sr-only">Tìm kiếm sinh viên</label>
      <div className="flex items-center gap-2 rounded-2xl border border-indigo-200/70 bg-white/75 px-3.5 py-1.5 shadow-xs backdrop-blur-md transition-all duration-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100/50">
        <Search size={16} className="shrink-0 text-[#64748B]" aria-hidden="true" />
        <input
          ref={inputRef}
          id="student-directory-search"
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

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}
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
                <h2 id="student-preview-title" className="mt-1 text-lg font-bold text-[#1E293B]">{selected.full_name}</h2>
              </div>
              <button
                ref={dialogCloseRef}
                type="button"
                onClick={() => setSelected(null)}
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

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border border-white/75 bg-white/50 px-4 py-2 text-xs font-semibold text-[#64748B] shadow-xs transition-all duration-150 ease-out hover:scale-[1.01] hover:bg-white/80 hover:text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={!canOpenDetail}
                title={!canOpenDetail ? "Sinh viên chưa có lớp để mở trang chi tiết" : undefined}
                onClick={handleNavigateDetail}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A73E8] px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/20 transition-all duration-150 ease-out hover:scale-[1.01] hover:bg-[#1557b0] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:hover:scale-100 cursor-pointer"
              >
                Chi tiết <ArrowRight size={14} />
              </button>
            </div>
            {!canOpenDetail && (
              <p className="mt-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-right text-xs font-medium text-amber-700">
                Sinh viên chưa có lớp để mở trang chi tiết.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
