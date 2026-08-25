"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, X, ArrowRight } from "lucide-react";
import { studentApi, Student } from "@/api/student-api";
import { ApiError } from "@/api/http-client";

type StudentWithClass = Student & {
  class_id?: { _id?: string; class_name?: string } | string;
};

interface Props {
  onOpenDetail: (student: StudentWithClass) => void;
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

export default function StudentDirectorySearch({ onOpenDetail }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentWithClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StudentWithClass | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dialogCloseRef = useRef<HTMLButtonElement | null>(null);

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
          limit: 8,
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
    if (!selected) return;
    dialogCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  const canOpenDetail = Boolean(selected && classIdOf(selected));

  return (
    <div className="relative w-full">
      <label htmlFor="student-directory-search" className="sr-only">Tìm kiếm sinh viên</label>
      <div className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/60 px-3 py-2 shadow-sm">
        <Search size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
        <input
          id="student-directory-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm kiếm sinh viên..."
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          autoComplete="off"
        />
        {loading && <Loader2 size={15} className="shrink-0 animate-spin text-blue-600" aria-label="Đang tìm kiếm" />}
      </div>

      {query.trim().length >= 2 && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg" aria-live="polite">
          {error ? <p className="px-2 py-3 text-sm text-rose-600">{error}</p> : loading ? <p className="px-2 py-3 text-sm text-slate-500">Đang tìm kiếm...</p> : results.length === 0 ? <p className="px-2 py-3 text-sm text-slate-500">Không tìm thấy sinh viên phù hợp.</p> : (
            <ul className="space-y-1" aria-label="Kết quả tìm kiếm sinh viên">
              {results.map((student) => (
                <li key={student._id}>
                  <button type="button" onClick={() => setSelected(student)} className="w-full rounded-lg px-2 py-2 text-left hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <span className="block truncate text-sm font-semibold text-slate-800">{student.full_name}</span>
                    <span className="block truncate text-xs text-slate-500">{student.student_code} · {classNameOf(student)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="student-preview-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Thông tin cơ bản</p><h2 id="student-preview-title" className="mt-1 text-lg font-bold text-slate-900">{selected.full_name}</h2></div>
              <button ref={dialogCloseRef} type="button" onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Đóng thông tin sinh viên"><X size={18} /></button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className="text-slate-500">Mã sinh viên</dt><dd className="font-semibold text-slate-800">{selected.student_code}</dd></div>
              <div><dt className="text-slate-500">Lớp</dt><dd className="font-semibold text-slate-800">{classNameOf(selected)}</dd></div>
              <div><dt className="text-slate-500">Ngày sinh</dt><dd className="font-semibold text-slate-800">{formatDate(selected.date_bir)}</dd></div>
              <div><dt className="text-slate-500">Giới tính</dt><dd className="font-semibold text-slate-800">{selected.sex || "Chưa cập nhật"}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Email</dt><dd className="break-all font-semibold text-slate-800">{selected.email || "Chưa cập nhật"}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Trạng thái học tập</dt><dd className="font-semibold text-slate-800">{selected.status || "Chưa cập nhật"}</dd></div>
            </dl>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Đóng</button>
              <button type="button" disabled={!canOpenDetail} title={!canOpenDetail ? "Sinh viên chưa có lớp để mở trang chi tiết" : undefined} onClick={() => { if (canOpenDetail) { setSelected(null); onOpenDetail(selected); } }} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">Chi tiết <ArrowRight size={15} /></button>
            </div>
            {!canOpenDetail && <p className="mt-2 text-right text-xs text-amber-700">Sinh viên chưa có lớp để mở trang chi tiết.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
