'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { StudentAvatar } from '@/components/ui/StudentAvatar';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Check,
  Pen,
  ShieldCheck,
  MinusCircle,
  Settings,
  Calendar,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useVirtualizer } from '@tanstack/react-virtual';
import { classApi, Class } from '@/api/class-api';
import { studentApi, Student } from '@/api/student-api';
import { academicRecordApi, AcademicRecord } from '@/api/academic-record-api';
import { dormitoryApi, SelfDormitoryRosterResponse } from '@/api/dormitory-api';
import StudentDormitoryCard from '@/components/students/StudentDormitoryCard';
import { useAuth } from '@/providers/auth-provider';
import { semesterApi } from '@/api/semester-api';
import { summariesPointApi } from '@/api/summaries-point-api';
import { resolveDrlScore } from '@/lib/drl-score';
import { HeaderCustomMappings } from '@/providers/header-provider';

// ─── Helper: xác định loại criterion ───
function getCriterionType(record: AcademicRecord): 'reward' | 'violation' {
  const criterion = record.criterion_id as any;
  if (!criterion) return 'reward';
  const t = criterion.criterion_type as string;
  return t === 'ky_luat' ? 'violation' : 'reward';
}

function getRecordLabel(record: AcademicRecord): string {
  return getCriterionType(record) === 'reward' ? 'Khen thưởng / Cộng điểm' : 'Kỷ luật / Trừ điểm';
}

function getRecordTitle(record: AcademicRecord): string {
  if (record.record_title) return record.record_title;
  const criterion = record.criterion_id as any;
  return criterion?.criterion_name || 'Ghi nhận rèn luyện';
}

function getRecordPoints(record: AcademicRecord): string {
  const criterion = record.criterion_id as any;
  if (!criterion) return '0';
  const score = criterion.score_per_unit ?? 0;
  return score >= 0 ? `+${score}` : `${score}`;
}

function useMobileCardExpanded() {
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 640px)').matches === false) {
      setExpanded(false);
    }
  }, []);
  return [expanded, setExpanded] as const;
}

function formatRecordDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export default function StudentProfilePage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;
  const classId = params.classId as string;
  const { user } = useAuth();
  
  const role = (user?.role || user?.roleName || '').toLowerCase();
  const isStudent = role.includes('student') || role.includes('sinh vien') || role.includes('hoc sinh');

  const [isLoading, setIsLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [targetClass, setTargetClass] = useState<Class | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [resolvedDrl, setResolvedDrl] = useState<number | null>(null);

  // ─── Paginated Academic Records State ───
  const [records, setRecords] = useState<AcademicRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  // ─── Dormitory State ───
  const [dormData, setDormData] = useState<SelfDormitoryRosterResponse | null>(null);
  const [personalExpanded, setPersonalExpanded] = useMobileCardExpanded();
  const [academicExpanded, setAcademicExpanded] = useMobileCardExpanded();

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: records.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 88,
    overscan: 3,
  });

  const getLinkedUserId = (studentObj: any) => {
    if (!studentObj?.user_id) return '';
    if (typeof studentObj.user_id === 'object') {
      return studentObj.user_id?._id || studentObj.user_id?.id || '';
    }
    return studentObj.user_id.toString();
  };

  const isSelfStudent = isStudent && (
    (student && getLinkedUserId(student) === user?.id) ||
    studentId === user?.studentId
  );

  const loadDormitoryData = useCallback(async () => {
    if (!studentId) return;
    try {
      const res = await dormitoryApi.roster.getByStudent(studentId);
      setDormData(res);
    } catch {
      setDormData(null);
    }
  }, [studentId]);

  // ─── Tải dữ liệu hồ sơ sinh viên ban đầu ───
  useEffect(() => {
    setIsLoading(true);
    setDataError(null);
    setIsLoadingRecords(true);
    setRecords([]);
    setPage(1);
    setHasMore(false);
    setRecordsError(null);

    Promise.all([
      classApi.getClass(classId),
      studentApi.getStudent(studentId),
      semesterApi.getSemesters(),
      summariesPointApi.getSummariesPoints({ studentId }),
      academicRecordApi.getAcademicRecordsByStudent(studentId, { page: 1, limit: 10 }),
      dormitoryApi.roster.getByStudent(studentId).catch(() => ({ has_dormitory_roster: false, roster_entry: null, history: [] })),
    ])
      .then(([classData, studentData, semestersData, summariesDataRes, recordsRes, dormRes]) => {
        setTargetClass(classData);
        setStudent(studentData);
        setDormData(dormRes as SelfDormitoryRosterResponse);

        // Tìm học kỳ active và điểm rèn luyện tương ứng
        const activeSemester = semestersData.find(s => s.status === 'active');
        const summariesList = summariesDataRes?.data || [];
        let activeSummary = null;
        if (activeSemester) {
          activeSummary = summariesList.find((item: any) => {
            const semId = typeof item.semester_id === 'object' ? item.semester_id?._id : item.semester_id;
            return semId === activeSemester._id;
          });
        }

        if (!activeSummary && summariesList.length > 0) {
          const sorted = [...summariesList].sort((a: any, b: any) => {
            const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return dateB - dateA;
          });
          activeSummary = sorted[0];
        }

        const latestSnapshot = [...(studentData.training_point_history || [])].sort((a, b) => new Date(b.locked_at).getTime() - new Date(a.locked_at).getTime())[0];
        const scoreVal = resolveDrlScore(activeSummary) ?? resolveDrlScore(latestSnapshot) ?? resolveDrlScore(studentData.training_point_id);
        setResolvedDrl(scoreVal);

        // Handle initial records
        if (Array.isArray(recordsRes)) {
          setRecords(recordsRes);
          setTotalRecords(recordsRes.length);
          setHasMore(false);
        } else {
          setRecords(recordsRes.data || []);
          setTotalRecords(recordsRes.total || 0);
          setHasMore(recordsRes.has_more ?? false);
        }
        setPage(1);
        setIsLoadingRecords(false);
        setIsLoading(false);
      })
      .catch((err: any) => {
        console.error('Lỗi khi tải thông tin sinh viên:', err);
        if (err.status === 403) {
          setDataError('Bạn không có quyền truy cập hồ sơ sinh viên này.');
        } else if (err.status === 404) {
          setDataError('Không tìm thấy sinh viên trong hệ thống.');
        } else {
          setDataError('Không thể tải dữ liệu. Vui lòng thử lại.');
        }
        setIsLoadingRecords(false);
        setIsLoading(false);
      });
  }, [classId, studentId]);

  // ─── Tải trang tiếp theo (Infinite Scroll) ───
  const loadNextPage = useCallback(async () => {
    if (isLoadingMore || !hasMore || isLoadingRecords || recordsError) return;

    setIsLoadingMore(true);
    setRecordsError(null);
    const nextPage = page + 1;

    try {
      const res = await academicRecordApi.getAcademicRecordsByStudent(studentId, { page: nextPage, limit: 10 });
      if (Array.isArray(res)) {
        setHasMore(false);
      } else {
        const newItems = res.data || [];
        setRecords((prev) => {
          const existingIds = new Set(prev.map((r) => r._id));
          const filteredNew = newItems.filter((r) => !existingIds.has(r._id));
          return [...prev, ...filteredNew];
        });
        setTotalRecords(res.total);
        setHasMore(res.has_more);
        setPage(nextPage);
      }
    } catch (err: any) {
      console.error('Lỗi khi tải thêm ghi nhận:', err);
      setRecordsError(err.message || 'Không thể tải thêm ghi nhận.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, isLoadingRecords, recordsError, page, studentId]);

  // ─── Quan sát ngưỡng danh sách ảo để tải trang tiếp theo ───
  const virtualItems = rowVirtualizer.getVirtualItems();
  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (
      lastItem &&
      lastItem.index >= records.length - 2 &&
      hasMore &&
      !isLoadingMore &&
      !isLoadingRecords &&
      !recordsError
    ) {
      loadNextPage();
    }
  }, [virtualItems, records.length, hasMore, isLoadingMore, isLoadingRecords, recordsError, loadNextPage]);

  const handleSave = () => {
    toast.success('Thông tin đã được lưu thành công!');
  };

  // ─── Tính toán stats từ records ───
  const violationCount = records.filter((r) => getCriterionType(r) === 'violation').length;

  const formatDob = (dobString?: string) => {
    if (!dobString) return 'N/A';
    try {
      const date = new Date(dobString);
      if (isNaN(date.getTime())) return dobString;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dobString;
    }
  };

  const formatGender = (gender?: string) => {
    if (!gender) return 'N/A';
    if (gender === 'Male') return 'Nam';
    if (gender === 'Female') return 'Nữ';
    return 'Khác';
  };

  const personalInfoRows = [
    { label: 'Họ và Tên', value: student?.full_name || '' },
    { label: 'Ngày sinh', value: formatDob(student?.date_bir) },
    { label: 'Giới tính', value: formatGender(student?.sex) },
    { label: 'Email', value: student?.email || 'N/A' },
  ];

  const academicInfoRows = [
    { label: 'Mã số sinh viên (MSSV)', value: student?.student_code || 'N/A' },
    { label: 'Khoa', value: typeof student?.class_id === 'object' ? (student.class_id as any)?.dept_id?.name : 'N/A' },
    { label: 'Lớp', value: typeof student?.class_id === 'object' ? (student.class_id as any)?.class_name : (targetClass ? targetClass.class_name : 'N/A') },
  ];

  // ─── LOADING STATE ───
  if (isLoading) {
    return (
      <>
        <HeaderCustomMappings mappings={{ [classId]: targetClass ? targetClass.class_name : classId, [studentId]: student ? student.full_name : studentId }} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center pb-[40px] w-full min-w-0">
          <div className="w-full px-4 sm:px-6 pt-4 sm:pt-6 pb-4 flex items-center justify-between gap-4">
            <div className="flex gap-3 sm:gap-4 items-center min-w-0 flex-1">
              <Skeleton className="w-[40px] h-[40px] rounded-full shrink-0" />
              <div className="flex flex-col gap-2 min-w-0">
                <Skeleton className="w-[160px] h-[28px] rounded-md max-w-full" />
                <Skeleton className="w-[120px] h-[20px] rounded-md max-w-full" />
              </div>
            </div>
            <Skeleton className="w-[140px] sm:w-[183px] h-[44px] rounded-xl shrink-0" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr] gap-4 sm:gap-5 w-full max-w-7xl px-4 sm:px-6 mt-3 sm:mt-4">
            <div className="flex flex-col gap-4 min-w-0 w-full">
              <Skeleton className="w-full h-[144px] rounded-2xl" />
              <Skeleton className="w-full h-[271px] rounded-2xl" />
              <Skeleton className="w-full h-[198px] rounded-2xl" />
            </div>
            <div className="flex flex-col gap-4 min-w-0 w-full">
              <Skeleton className="w-full h-[80px] rounded-2xl" />
              <div className="bg-white/40 backdrop-blur-md border border-white/70 flex flex-col rounded-2xl shadow-sm overflow-hidden w-full min-h-[460px] lg:min-h-[540px]">
                <div className="border-b border-white/50 px-4 sm:px-6 pt-4 sm:pt-6 pb-4 flex gap-4">
                  <Skeleton className="w-[80px] h-[20px]" />
                </div>
                <div className="flex flex-col gap-3 sm:gap-4 p-4 sm:p-6">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="w-full h-[88px] rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  // ─── NOT FOUND ───
  if (!student) {
    return (
      <>
        <HeaderCustomMappings mappings={{ [classId]: targetClass ? targetClass.class_name : classId, [studentId]: studentId }} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden flex items-center justify-center p-4 w-full min-w-0">
          <div className="text-center flex flex-col items-center gap-4 bg-white/40 backdrop-blur-md border border-white/70 rounded-2xl p-6 sm:p-8 shadow-sm shadow-slate-300/40 max-w-md w-full">
            <AlertCircle className="w-12 h-12 text-[#64748B]" />
            <p className="text-[18px] sm:text-[20px] font-bold text-[#1E293B]">
              {dataError || 'Không tìm thấy sinh viên'}
            </p>
            <p className="text-[13px] sm:text-[14px] text-[#64748B] break-words">
              Mã sinh viên <strong>{studentId}</strong> không tồn tại trong hệ thống.
            </p>
            <button
              onClick={() => router.push(isStudent ? '/profile' : `/students/${classId}`)}
              className="mt-4 px-6 py-3 bg-[#1A73E8] text-white rounded-xl font-semibold hover:bg-[#1A73E8]/90 hover:scale-[1.01] transition-all duration-150 ease-out shadow-sm cursor-pointer"
            >
              {isStudent ? 'Quay lại hồ sơ tài khoản' : 'Quay lại danh sách lớp'}
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <HeaderCustomMappings mappings={{ [classId]: targetClass ? targetClass.class_name : classId, [studentId]: student ? student.full_name : studentId }} />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center pb-[73px] w-full min-w-0"
      >
        {/* ═══ MainHeader ═══ */}
        <div className="sticky top-0 z-10 backdrop-blur-md bg-white/45 border-b border-white/70 flex items-center justify-between py-3.5 sm:py-4 px-4 sm:px-6 w-full gap-3">
          <div className="flex gap-3 sm:gap-4 items-center min-w-0 flex-1">
            {!isSelfStudent && (
              <button
                onClick={() => router.push(`/students/${classId}`)}
                className="w-[36px] h-[36px] shrink-0 flex items-center justify-center rounded-xl bg-white/50 border border-white/80 hover:bg-white/70 hover:scale-[1.01] transition-all duration-150 ease-out shadow-sm cursor-pointer"
              >
                <ArrowLeft className="w-[20px] h-[20px] text-[#1E293B]" />
              </button>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <h1 className="font-sans font-bold text-[#1E293B] text-[18px] sm:text-[20px] leading-[26px] sm:leading-[28px] truncate" title={student.full_name}>
                {student.full_name}
              </h1>
              <p className="font-sans font-normal text-[#64748B] text-[12px] sm:text-[13px] leading-[18px] truncate">
                MSSV: {student.student_code}
              </p>
            </div>
          </div>

          {!isSelfStudent && (
            <Button
              onClick={handleSave}
              className="rounded-xl bg-[#1A73E8] hover:bg-[#1A73E8]/90 hover:scale-[1.01] transition-all duration-150 ease-out text-white shadow-sm font-semibold shrink-0"
            >
              <Check className="w-[18px] h-[18px]" />
              <span className="hidden sm:inline">Lưu Thay Đổi</span>
              <span className="sm:hidden">Lưu</span>
            </Button>
          )}
        </div>

        {/* ═══ Main Content ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr] gap-4 sm:gap-5 w-full max-w-7xl px-4 sm:px-6 mt-3 sm:mt-4">

          {/* ═══ LEFT COLUMN ═══ */}
          <div className="flex flex-col gap-4 pb-4 lg:pb-10 min-w-0 w-full">

            {/* ── Profile Picture Upload Area ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-white/40 backdrop-blur-md border border-white/70 p-4 sm:p-6 rounded-2xl shadow-sm shadow-slate-300/40 flex items-center gap-4 sm:gap-6 w-full min-w-0"
            >
              <div className="relative shrink-0">
                <div className="relative rounded-full shadow-[0px_0px_0px_4px_white,0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] w-[84px] h-[84px] sm:w-[96px] sm:h-[96px] overflow-hidden group cursor-pointer">
                  <StudentAvatar
                    fullName={student.full_name}
                    sizeClass="w-full h-full"
                    textClassName="text-2xl sm:text-3xl font-extrabold"
                  />
                  {!isSelfStudent && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                      <Pen className="w-[24px] h-[24px] text-white" />
                    </div>
                  )}
                </div>
                {!isSelfStudent && (
                  <button className="absolute bottom-0 right-0 bg-[#1A73E8] p-[6px] rounded-full shadow-md hover:bg-[#1A73E8]/90 hover:scale-[1.01] transition-all duration-150 ease-out cursor-pointer border border-white/70">
                    <Pen className="w-[12px] h-[12px] text-white" strokeWidth={2} />
                  </button>
                )}
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <h3 className="font-sans font-bold text-[#1E293B] text-[16px] sm:text-[18px] leading-[24px] sm:leading-[26px] truncate" title={student.full_name}>
                  {student.full_name}
                </h3>
                <p className="font-sans font-medium text-[#64748B] text-[12px] sm:text-[13px] leading-[18px] truncate">
                  MSSV: {student.student_code}
                </p>
                {!isSelfStudent && (
                  <button className="mt-[6px] text-left cursor-pointer hover:underline truncate">
                    <span className="font-sans font-semibold text-[#1A73E8] text-[12px] leading-[18px]">
                      Thay đổi ảnh chân dung
                    </span>
                  </button>
                )}
              </div>
            </motion.div>

            {/* ── Personal Information Section ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-white/40 backdrop-blur-md border border-white/70 p-4 sm:p-6 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col gap-4 sm:gap-5 w-full min-w-0"
            >
              <div role="button" tabIndex={0} aria-expanded={personalExpanded} aria-controls="student-personal-information" onClick={() => setPersonalExpanded(value => !value)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPersonalExpanded(value => !value); } }} className="flex cursor-pointer items-center justify-between w-full">
                <div className="flex items-center gap-[8px]">
                  <div className="bg-[#1A73E8] h-[20px] w-[5px] rounded-full" />
                  <h2 className="font-sans font-bold text-[#1E293B] text-[15px] sm:text-[16px] tracking-tight leading-[24px]">
                    Thông tin cá nhân
                  </h2>
                </div>
                {!isSelfStudent && (
                  <button type="button" onClick={event => event.stopPropagation()} className="w-[28px] h-[28px] flex items-center justify-center rounded-xl bg-white/50 border border-white/80 hover:bg-white/70 hover:scale-[1.01] transition-all duration-150 ease-out shadow-sm cursor-pointer shrink-0">
                    <Settings className="w-[14px] h-[14px] text-[#64748B]" />
                  </button>
                )}
              </div>

              <div id="student-personal-information" className={`${personalExpanded ? 'flex' : 'hidden'} sm:flex flex-col gap-[12px] w-full min-w-0`}>
                {personalInfoRows.map((row, idx) => (
                  <div key={idx} className="flex items-center justify-between w-full border-b border-white/40 pb-2 last:border-b-0 last:pb-0 gap-3">
                    <span className="font-sans font-medium text-[#64748B] text-[12px] leading-[18px] shrink-0">
                      {row.label}
                    </span>
                    <span className="font-sans font-bold text-[#1E293B] text-[13px] leading-[18px] text-right truncate min-w-0 flex-1" title={String(row.value)}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ── Academic Information Section ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="bg-white/40 backdrop-blur-md border border-white/70 p-4 sm:p-6 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col gap-4 sm:gap-5 w-full min-w-0"
            >
              <div role="button" tabIndex={0} aria-expanded={academicExpanded} aria-controls="student-academic-information" onClick={() => setAcademicExpanded(value => !value)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setAcademicExpanded(value => !value); } }} className="flex cursor-pointer items-center justify-between w-full">
                <div className="flex items-center gap-[8px]">
                  <div className="bg-[#1A73E8] h-[20px] w-[5px] rounded-full" />
                  <h2 className="font-sans font-bold text-[#1E293B] text-[15px] sm:text-[16px] tracking-tight leading-[24px]">
                    Thông tin học tập
                  </h2>
                </div>
                {!isSelfStudent && (
                  <button type="button" onClick={event => event.stopPropagation()} className="w-[28px] h-[28px] flex items-center justify-center rounded-xl bg-white/50 border border-white/80 hover:bg-white/70 hover:scale-[1.01] transition-all duration-150 ease-out shadow-sm cursor-pointer shrink-0">
                    <Settings className="w-[14px] h-[14px] text-[#64748B]" />
                  </button>
                )}
              </div>

              <div id="student-academic-information" className={`${academicExpanded ? 'flex' : 'hidden'} sm:flex flex-col gap-[12px] w-full min-w-0`}>
                {academicInfoRows.map((row, idx) => (
                  <div key={idx} className="flex items-center justify-between w-full border-b border-white/40 pb-2 last:border-b-0 last:pb-0 gap-3">
                    <span className="font-sans font-medium text-[#64748B] text-[12px] leading-[18px] shrink-0">
                      {row.label}
                    </span>
                    <span className="font-sans font-bold text-[#1E293B] text-[13px] leading-[18px] text-right truncate min-w-0 flex-1" title={String(row.value)}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ── Thông tin KTX (AC4: only rendered when linked registration exists) ── */}
            <StudentDormitoryCard
              registrationData={dormData}
              student={student}
              onRefresh={loadDormitoryData}
            />

          </div>

          {/* ═══ RIGHT COLUMN ═══ */}
          <div className="flex flex-col gap-4 sm:gap-5 min-w-0 w-full">

            {/* ── Summary Stats Cards ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full min-w-0"
            >
              {/* Card 1 — Điểm rèn luyện */}
              <div className="bg-white/40 backdrop-blur-md border border-white/70 flex gap-3 items-center p-3.5 sm:p-4 rounded-2xl min-h-[76px] sm:h-[80px] shadow-sm shadow-slate-300/40 hover:scale-[1.01] transition-all duration-150 ease-out min-w-0">
                <div className="bg-white/60 backdrop-blur-sm border border-white/80 flex items-center justify-center rounded-xl shadow-sm w-[36px] h-[36px] shrink-0">
                  <ShieldCheck className="w-[18px] h-[18px] text-[#1A73E8]" strokeWidth={2} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="font-sans font-bold text-[#64748B] text-[9px] sm:text-[10px] tracking-wider uppercase leading-none truncate">Rèn luyện (điểm)</p>
                  <p className="font-sans font-bold text-[#1E293B] text-[18px] sm:text-[20px] leading-tight mt-1 truncate">
                    {resolvedDrl !== null ? `${resolvedDrl}/100` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Card 2 — Vi phạm (tính từ records) */}
              <div className="bg-white/40 backdrop-blur-md border border-white/70 flex gap-3 items-center p-3.5 sm:p-4 rounded-2xl min-h-[76px] sm:h-[80px] shadow-sm shadow-slate-300/40 hover:scale-[1.01] transition-all duration-150 ease-out min-w-0">
                <div className="bg-white/60 backdrop-blur-sm border border-white/80 flex items-center justify-center rounded-xl shadow-sm w-[36px] h-[36px] shrink-0">
                  <MinusCircle className="w-[18px] h-[18px] text-rose-500" strokeWidth={2} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="font-sans font-bold text-rose-700 text-[9px] sm:text-[10px] tracking-wider uppercase leading-none truncate">Vi phạm (số lần)</p>
                  <p className="font-sans font-bold text-rose-600 text-[18px] sm:text-[20px] leading-tight mt-1 truncate">
                    {violationCount}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* ── Ghi nhận rèn luyện (AC1 & AC2: Virtualized Infinite List) ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.25 }}
              className="bg-white/40 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col overflow-hidden w-full flex-1 min-h-[460px] lg:min-h-[540px]"
            >
              <div className="border-b border-white/50 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 w-full shrink-0 flex items-center justify-between">
                <h3 className="font-sans text-[15px] leading-[22px] font-bold text-[#1A73E8]">Ghi nhận rèn luyện</h3>
                <span className="font-sans text-[12px] font-medium text-[#64748B]">
                  {totalRecords > 0 ? `${totalRecords} bản ghi` : `${records.length} bản ghi`}
                </span>
              </div>

              {/* ─ Virtualized Scroll Viewport (AC1: ~5 rows visible before scrolling) ─ */}
              <div
                ref={scrollContainerRef}
                tabIndex={0}
                role="region"
                aria-label="Danh sách ghi nhận rèn luyện"
                className="px-4 sm:px-6 pt-4 pb-4 w-full flex-1 min-h-[460px] max-h-[500px] overflow-y-auto relative outline-none focus:ring-1 focus:ring-[#1A73E8]/30 rounded-b-2xl"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) transparent' }}
              >
                {isLoadingRecords ? (
                  <div className="flex flex-col gap-3 sm:gap-4 w-full">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="w-full h-[88px] rounded-xl" />
                    ))}
                  </div>
                ) : records.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[220px] gap-3 text-center py-12">
                    <AlertCircle className="w-10 h-10 text-[#64748B]" />
                    <p className="text-[13px] text-[#64748B]">Sinh viên chưa có ghi nhận rèn luyện nào.</p>
                  </div>
                ) : (
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const record = records[virtualRow.index];
                      if (!record) return null;

                      const type = getCriterionType(record);
                      const label = getRecordLabel(record);
                      const title = getRecordTitle(record);
                      const points = getRecordPoints(record);
                      const date = formatRecordDate(record.recorded_at || record.createdAt);
                      const criterion = record.criterion_id as any;
                      const semesterName = record.semester_id
                        ? (typeof record.semester_id === 'object'
                          ? (record.semester_id as any)?.semester_name || ''
                          : '')
                        : '';

                      return (
                        <div
                          key={record._id || virtualRow.index}
                          data-index={virtualRow.index}
                          ref={rowVirtualizer.measureElement}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                            paddingBottom: '12px',
                          }}
                        >
                          <div className="bg-white/50 backdrop-blur-sm border border-white/80 flex items-center justify-between p-3.5 sm:p-4 rounded-xl w-full shadow-sm hover:scale-[1.005] transition-all duration-150 ease-out gap-3 min-w-0">
                            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                              {/* Row 1: Title + Badge */}
                              <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                                <h4 className="font-sans font-bold text-[#1E293B] text-[14px] sm:text-[15px] leading-[20px] sm:leading-[22px] truncate min-w-0" title={title}>
                                  {title}
                                </h4>
                                <div className={`px-2 py-0.5 rounded-xl border shrink-0 ${type === 'reward' ? 'bg-blue-500/10 border-blue-500/20 text-[#1A73E8]' : 'bg-rose-500/10 border-rose-500/20 text-rose-700'}`}>
                                  <span className="font-sans font-bold text-[9px] tracking-wider uppercase">
                                    {label}
                                  </span>
                                </div>
                              </div>

                              {/* Row 2: Metadata */}
                              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap min-w-0">
                                <div className="flex items-center gap-1 shrink-0">
                                  <Calendar className="w-[12px] h-[12px] text-[#64748B]" />
                                  <span className="font-sans font-medium text-[#64748B] text-[12px]">
                                    {date}
                                  </span>
                                </div>
                                {criterion?.criterion_name && (
                                  <span className="font-sans font-medium text-[#64748B] text-[12px] truncate max-w-[220px]" title={criterion.criterion_name}>
                                    Tiêu chí: {criterion.criterion_name}
                                  </span>
                                )}
                                {semesterName && (
                                  <span className="font-sans font-medium text-[#64748B] text-[12px] shrink-0">
                                    {semesterName}
                                  </span>
                                )}
                                {record.description && (
                                  <span className="font-sans font-medium text-[#64748B]/70 text-[12px] truncate max-w-[240px]" title={record.description}>
                                    {record.description}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Points Display */}
                            <div className="flex flex-col items-end gap-[1px] shrink-0 ml-2 sm:ml-4">
                              <span className="font-sans font-bold text-[#64748B] text-[9px] leading-none uppercase tracking-wider">
                                Điểm
                              </span>
                              <span className={`font-sans font-bold text-[14px] sm:text-[15px] leading-tight mt-1 ${type === 'reward' ? 'text-[#1A73E8]' : 'text-rose-600'}`}>
                                {points}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ─ Infinite Scroll Loading & Error States (AC2) ─ */}
                {isLoadingMore && (
                  <div className="flex items-center justify-center gap-2 py-3 text-xs text-[#1A73E8]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang tải thêm bản ghi...</span>
                  </div>
                )}

                {recordsError && (
                  <div className="flex items-center justify-center gap-2 py-3 text-xs text-rose-600">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{recordsError}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadNextPage}
                      className="ml-2 h-7 text-xs rounded-lg gap-1 border-rose-200 hover:bg-rose-50 text-rose-700"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Thử lại
                    </Button>
                  </div>
                )}

                {!hasMore && !isLoadingRecords && records.length > 0 && (
                  <div className="flex items-center justify-center py-2 text-[11px] text-[#64748B]/80 italic">
                    Đã hiển thị tất cả ghi nhận
                  </div>
                )}
              </div>

              {/* ─ Footer Note ─ */}
              <div className="bg-white/20 border-t border-white/50 px-4 sm:px-6 py-3.5 sm:py-4 w-full shrink-0">
                <div className="flex justify-center">
                  <span className="font-sans font-medium text-[#64748B] text-[12px] text-center">
                    {totalRecords > 0
                      ? `Hiển thị ${records.length}/${totalRecords} bản ghi ghi nhận rèn luyện của sinh viên.`
                      : records.length > 0
                      ? `Hiển thị ${records.length} bản ghi ghi nhận rèn luyện của sinh viên.`
                      : 'Chưa có bản ghi ghi nhận nào.'}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.main>
    </>
  );
}
