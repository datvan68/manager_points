'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { StudentAvatar } from '@/components/ui/StudentAvatar';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Check,
  Pen,
  ChevronDown,
  ShieldCheck,
  MinusCircle,
  Settings,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { classApi, Class } from '@/api/class-api';
import { studentApi, Student } from '@/api/student-api';
import { academicRecordApi, AcademicRecord } from '@/api/academic-record-api';
import { useAuth } from '@/providers/auth-provider';
import { semesterApi } from '@/api/semester-api';
import { summariesPointApi } from '@/api/summaries-point-api';
import { resolveDrlScore } from '@/lib/drl-score';
import { HeaderCustomMappings } from '@/providers/header-provider';

// ─── Kiểu dữ liệu nội bộ cho danh mục kèm tiêu chí ───
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
  const [records, setRecords] = useState<AcademicRecord[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);
  const [resolvedDrl, setResolvedDrl] = useState<number | null>(null);
  const activeTab = 'history' as const;
  const isTabLoading = false;
  const categories: any[] = [];
  const expandedCategory: string | null = null;
  const setExpandedCategory = (_value: string | null) => undefined;

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

  // ─── Tải dữ liệu hồ sơ và toàn bộ ghi nhận ───
  useEffect(() => {
    setIsLoading(true);
    setDataError(null);

    Promise.all([
      classApi.getClass(classId),
      studentApi.getStudent(studentId),
      semesterApi.getSemesters(),
      summariesPointApi.getSummariesPoints({ studentId }),
      academicRecordApi.getAcademicRecordsByStudent(studentId),
    ])
      .then(([classData, studentData, semestersData, summariesDataRes, recordsData]) => {
        setTargetClass(classData);
        setStudent(studentData);

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

        const scoreVal = resolveDrlScore(activeSummary) ?? resolveDrlScore(studentData.training_point_id);
        setResolvedDrl(scoreVal);

        setRecords(recordsData);
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
        setIsLoading(false);
      });
  }, [classId, studentId]);

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
    ...(student?.has_dormitory_registration ? [{ label: 'KTX', value: 'Đã đăng ký' }] : []),
  ];

  // ─── LOADING STATE ───
  if (isLoading) {
    return (
      <>
        <HeaderCustomMappings mappings={{ [classId]: targetClass ? targetClass.class_name : classId, [studentId]: student ? student.full_name : studentId }} />
        <main className="flex-1 overflow-y-auto flex flex-col items-center pb-[40px]">
          <div className="w-full px-[24px] pt-[24px] pb-[17px] flex items-center justify-between">
            <div className="flex gap-[16px] items-center">
              <Skeleton className="w-[40px] h-[40px] rounded-full" />
              <div className="flex flex-col gap-2">
                <Skeleton className="w-[160px] h-[28px] rounded-md" />
                <Skeleton className="w-[120px] h-[20px] rounded-md" />
              </div>
            </div>
            <Skeleton className="w-[183px] h-[44px] rounded-xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4 w-full max-w-7xl px-4 sm:px-6 mt-[40px]">
            <div className="flex flex-col gap-4">
              <Skeleton className="w-full h-[144px] rounded-2xl" />
              <Skeleton className="w-full h-[271px] rounded-2xl" />
              <Skeleton className="w-full h-[198px] rounded-2xl" />
            </div>
            <div className="flex flex-col gap-4">
              <Skeleton className="w-full h-[80px] rounded-2xl" />
              <div className="bg-white/40 backdrop-blur-md border border-white/70 flex flex-col rounded-2xl shadow-sm overflow-hidden w-full h-[722px]">
                <div className="border-b border-white/50 px-[32px] pt-[32px] flex gap-[24px]">
                  <Skeleton className="w-[80px] h-[20px] mb-[16px]" />
                  <Skeleton className="w-[120px] h-[20px] mb-[16px]" />
                </div>
                <div className="flex flex-col gap-[16px] p-[24px]">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="w-full h-[100px] rounded-xl" />
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
        <main className="flex-1 overflow-y-auto flex items-center justify-center">
          <div className="text-center flex flex-col items-center gap-4 bg-white/40 backdrop-blur-md border border-white/70 rounded-2xl p-8 shadow-sm shadow-slate-300/40 max-w-md">
            <AlertCircle className="w-12 h-12 text-[#64748B]" />
            <p className="text-[20px] font-bold text-[#1E293B]">
              {dataError || 'Không tìm thấy sinh viên'}
            </p>
            <p className="text-[14px] text-[#64748B]">
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
          className="flex-1 overflow-y-auto flex flex-col items-center pb-[73px]"
        >
          {/* ═══ MainHeader ═══ */}
          <div className="sticky top-0 z-10 backdrop-blur-md bg-white/45 border-b border-white/70 flex items-center justify-between py-[16px] px-[24px] w-full">
            <div className="flex gap-[16px] items-center">
              {!isSelfStudent && (
                <button
                  onClick={() => router.push(`/students/${classId}`)}
                  className="w-[36px] h-[36px] flex items-center justify-center rounded-xl bg-white/50 border border-white/80 hover:bg-white/70 hover:scale-[1.01] transition-all duration-150 ease-out shadow-sm cursor-pointer"
                >
                  <ArrowLeft className="w-[20px] h-[20px] text-[#1E293B]" />
                </button>
              )}
              <div className="flex flex-col">
                <h1 className="font-sans font-bold text-[#1E293B] text-[20px] leading-[28px]">
                  {student.full_name}
                </h1>
                <p className="font-sans font-normal text-[#64748B] text-[13px] leading-[18px]">
                  MSSV: {student.student_code}
                </p>
              </div>
            </div>

            {!isSelfStudent && (
              <Button 
                onClick={handleSave}
                className="rounded-xl bg-[#1A73E8] hover:bg-[#1A73E8]/90 hover:scale-[1.01] transition-all duration-150 ease-out text-white shadow-sm font-semibold"
              >
                <Check className="w-[18px] h-[18px]" />
                Lưu Thay Đổi
              </Button>
            )}
          </div>

          {/* ═══ Main Content ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4 w-full max-w-7xl px-4 sm:px-6 mt-[12px]">

            {/* ═══ LEFT COLUMN ═══ */}
            <div className="flex flex-col gap-4 pb-[40px]">

              {/* ── Profile Picture Upload Area ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="bg-white/40 backdrop-blur-md border border-white/70 p-[24px] rounded-2xl shadow-sm shadow-slate-300/40 flex items-center gap-[24px] w-full"
              >
                <div className="relative shrink-0">
                  <div className="relative rounded-full shadow-[0px_0px_0px_4px_white,0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] w-[96px] h-[96px] overflow-hidden group cursor-pointer">
                    <StudentAvatar
                      fullName={student.full_name}
                      sizeClass="w-full h-full"
                      textClassName="text-3xl font-extrabold"
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

                <div className="flex flex-col">
                  <h3 className="font-sans font-bold text-[#1E293B] text-[18px] leading-[26px]">
                    {student.full_name}
                  </h3>
                  <p className="font-sans font-medium text-[#64748B] text-[13px] leading-[18px]">
                    MSSV: {student.student_code}
                  </p>
                  {!isSelfStudent && (
                    <button className="mt-[6px] text-left cursor-pointer hover:underline">
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
                className="bg-white/40 backdrop-blur-md border border-white/70 p-[24px] rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col gap-[20px] w-full"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-[8px]">
                    <div className="bg-[#1A73E8] h-[20px] w-[5px] rounded-full" />
                    <h2 className="font-sans font-bold text-[#1E293B] text-[16px] tracking-tight leading-[24px]">
                      Thông tin cá nhân
                    </h2>
                  </div>
                  {!isSelfStudent && (
                    <button className="w-[28px] h-[28px] flex items-center justify-center rounded-xl bg-white/50 border border-white/80 hover:bg-white/70 hover:scale-[1.01] transition-all duration-150 ease-out shadow-sm cursor-pointer">
                      <Settings className="w-[14px] h-[14px] text-[#64748B]" />
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-[12px] w-full">
                  {personalInfoRows.map((row, idx) => (
                    <div key={idx} className="flex items-center justify-between w-full border-b border-white/40 pb-2 last:border-b-0 last:pb-0">
                      <span className="font-sans font-medium text-[#64748B] text-[12px] leading-[18px]">
                        {row.label}
                      </span>
                      <span className="font-sans font-bold text-[#1E293B] text-[13px] leading-[18px]">
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
                className="bg-white/40 backdrop-blur-md border border-white/70 p-[24px] rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col gap-[20px] w-full"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-[8px]">
                    <div className="bg-[#1A73E8] h-[20px] w-[5px] rounded-full" />
                    <h2 className="font-sans font-bold text-[#1E293B] text-[16px] tracking-tight leading-[24px]">
                      Thông tin học tập
                    </h2>
                  </div>
                  {!isSelfStudent && (
                    <button className="w-[28px] h-[28px] flex items-center justify-center rounded-xl bg-white/50 border border-white/80 hover:bg-white/70 hover:scale-[1.01] transition-all duration-150 ease-out shadow-sm cursor-pointer">
                      <Settings className="w-[14px] h-[14px] text-[#64748B]" />
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-[12px] w-full">
                  {academicInfoRows.map((row, idx) => (
                    <div key={idx} className="flex items-center justify-between w-full border-b border-white/40 pb-2 last:border-b-0 last:pb-0">
                      <span className="font-sans font-medium text-[#64748B] text-[12px] leading-[18px]">
                        {row.label}
                      </span>
                      <span className="font-sans font-bold text-[#1E293B] text-[13px] leading-[18px]">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>

            </div>

            {/* ═══ RIGHT COLUMN ═══ */}
            <div className="flex flex-col gap-[24px]">

              {/* ── Summary Stats Cards ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
              className="grid grid-cols-2 gap-3 w-full"
              >
                {/* Card 1 — Điểm rèn luyện */}
                <div className="bg-white/40 backdrop-blur-md border border-white/70 flex gap-[12px] items-center p-[16px] rounded-2xl h-[80px] shadow-sm shadow-slate-300/40 hover:scale-[1.01] transition-all duration-150 ease-out">
                  <div className="bg-white/60 backdrop-blur-sm border border-white/80 flex items-center justify-center rounded-xl shadow-sm w-[36px] h-[36px] shrink-0">
                    <ShieldCheck className="w-[18px] h-[18px] text-[#1A73E8]" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="font-sans font-bold text-[#64748B] text-[9px] tracking-wider uppercase leading-none">Rèn luyện (điểm)</p>
                    <p className="font-sans font-bold text-[#1E293B] text-[20px] leading-tight mt-1 truncate">
                      {resolvedDrl !== null ? `${resolvedDrl}/100` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Card 3 — Vi phạm (tính từ records thật) */}
                <div className="bg-white/40 backdrop-blur-md border border-white/70 flex gap-[12px] items-center p-[16px] rounded-2xl h-[80px] shadow-sm shadow-slate-300/40 hover:scale-[1.01] transition-all duration-150 ease-out">
                  <div className="bg-white/60 backdrop-blur-sm border border-white/80 flex items-center justify-center rounded-xl shadow-sm w-[36px] h-[36px] shrink-0">
                    <MinusCircle className="w-[18px] h-[18px] text-rose-500" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="font-sans font-bold text-rose-700 text-[9px] tracking-wider uppercase leading-none">Vi phạm (số lần)</p>
                    <p className="font-sans font-bold text-rose-600 text-[20px] leading-tight mt-1 truncate">
                      {violationCount}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* ── Ghi nhận ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.25 }}
                className="bg-white/40 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col overflow-hidden w-full h-[722px]"
              >
                <div className="border-b border-white/50 px-[24px] pt-[24px] w-full shrink-0">
                  <h3 className="font-sans text-[15px] leading-[22px] font-bold text-[#1A73E8]">Ghi nhận</h3>
                </div>

                {/* ─ Content Area ─ */}
                <div
                  className="flex flex-col gap-[16px] px-[24px] pt-[24px] pb-[24px] w-full flex-1 min-h-0 overflow-y-auto"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) transparent' }}
                >
                  {isTabLoading ? (
                    <div className="flex flex-col gap-[16px] w-full">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="w-full h-[100px] rounded-[16px]" />
                      ))}
                    </div>
                  ) : false ? (
                    /* ─── Tab Danh Mục: dữ liệu thật từ API ─── */
                    categories.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
                        <AlertCircle className="w-10 h-10 text-[#64748B]" />
                        <p className="text-[13px] text-[#64748B]">Chưa có danh mục nào được cấu hình.</p>
                      </div>
                    ) : (
                      categories.map((cat, idx) => (
                        <motion.div
                          key={cat._id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15, delay: 0.1 + idx * 0.05 }}
                          className="bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm shadow-blue-900/5 hover:scale-[1.01] transition-all duration-150 ease-out w-full"
                        >
                          {/* Card Header */}
                          <div
                            className="flex items-center justify-between px-[16px] pt-[16px] pb-[12px] cursor-pointer hover:bg-white/30 transition-colors"
                            onClick={() => setExpandedCategory(expandedCategory === cat._id ? null : cat._id)}
                          >
                            <div className="flex items-center gap-[8px]">
                              <h4 className="font-sans font-bold text-[#1E293B] text-[15px] leading-[22px]">
                                {cat.category_name}
                              </h4>
                              <ChevronDown className={`w-[12px] h-[12px] text-[#64748B] transition-transform duration-300 ${expandedCategory === cat._id ? 'rotate-180' : ''}`} />
                            </div>
                            <div className="bg-[#1A73E8]/10 border border-[#1A73E8]/20 px-[10px] py-[3px] rounded-xl shrink-0">
                              <span className="font-sans font-bold text-[#1A73E8] text-[11px] tracking-wide">
                                Tối đa: {cat.max_score}đ
                              </span>
                            </div>
                          </div>

                          {/* Code danh mục — luôn hiển thị */}
                          <div className="px-[16px] pb-[16px]">
                            <p className="font-sans font-normal text-[#64748B] text-[12px] leading-[18px]">
                              Mã danh mục: <span className="font-semibold text-[#1E293B]">{cat.category_code}</span>
                              {cat.criteria.length > 0 && (
                                <span className="ml-2 text-[#64748B]">· {cat.criteria.length} tiêu chí</span>
                              )}
                            </p>
                          </div>

                          {/* Accordion: danh sách tiêu chí */}
                          <motion.div
                            initial={false}
                            animate={{
                              height: expandedCategory === cat._id ? 'auto' : 0,
                              opacity: expandedCategory === cat._id ? 1 : 0
                            }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="flex flex-col gap-[8px] px-[16px] pb-[16px] pt-[16px] border-t border-white/50 bg-white/20">
                              {cat.criteria.length === 0 ? (
                                <p className="text-[12px] text-[#64748B] italic">Chưa có tiêu chí nào.</p>
                              ) : (
                                cat.criteria.map((criterion) => {
                                  const isPositive = criterion.criterion_type !== 'ky_luat';
                                  const scoreDisplay = isPositive
                                    ? `+${criterion.score_per_unit}đ`
                                    : `${criterion.score_per_unit}đ`;
                                  return (
                                    <div
                                      key={criterion._id}
                                      className="flex items-center justify-between px-[14px] py-[10px] bg-white/40 backdrop-blur-xs rounded-xl border border-white/60 shadow-sm"
                                    >
                                      <div className="flex flex-col gap-[2px]">
                                        <span className="font-sans font-medium text-[#1E293B] text-[13px] leading-[18px]">
                                          {criterion.criterion_name}
                                        </span>
                                        <span className="font-sans text-[11px] text-[#64748B]">
                                          {criterion.criterion_type === 'khen_thuong' && 'Khen thưởng'}
                                          {criterion.criterion_type === 'cong_diem' && 'Cộng điểm'}
                                          {criterion.criterion_type === 'ky_luat' && 'Kỷ luật'}
                                          {' · '}Max: {criterion.max_score}đ
                                        </span>
                                      </div>
                                      <span className={`font-sans font-bold text-[13px] leading-[18px] ${isPositive ? 'text-[#1A73E8]' : 'text-rose-600'}`}>
                                        {scoreDisplay}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </motion.div>
                        </motion.div>
                      ))
                    )
                  ) : (
                    /* ─── Tab Lịch Sử Ghi Nhận: dữ liệu thật từ API ─── */
                    records.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
                        <AlertCircle className="w-10 h-10 text-[#64748B]" />
                        <p className="text-[13px] text-[#64748B]">Sinh viên chưa có ghi nhận rèn luyện nào.</p>
                      </div>
                    ) : (
                      records.map((record, idx) => {
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
                          <motion.div
                            key={record._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15, delay: 0.1 + idx * 0.04 }}
                            className="bg-white/50 backdrop-blur-sm border border-white/80 flex items-center justify-between p-[16px] rounded-xl w-full shadow-sm hover:scale-[1.01] transition-all duration-150 ease-out"
                          >
                            <div className="flex flex-col gap-[6px] flex-1 min-w-0">
                              {/* Row 1: Title + Badge */}
                              <div className="flex items-center gap-[12px] flex-wrap">
                                <h4 className="font-sans font-bold text-[#1E293B] text-[15px] leading-[22px] truncate">
                                  {title}
                                </h4>
                                <div className={`px-[8px] py-[2px] rounded-xl border shrink-0 ${type === 'reward' ? 'bg-blue-500/10 border-blue-500/20 text-[#1A73E8]' : 'bg-rose-500/10 border-rose-500/20 text-rose-700'}`}>
                                  <span className="font-sans font-bold text-[9px] tracking-wider uppercase">
                                    {label}
                                  </span>
                                </div>
                              </div>

                              {/* Row 2: Metadata */}
                              <div className="flex items-center gap-[16px] flex-wrap">
                                <div className="flex items-center gap-[4px]">
                                  <Calendar className="w-[12px] h-[12px] text-[#64748B]" />
                                  <span className="font-sans font-medium text-[#64748B] text-[12px]">
                                    {date}
                                  </span>
                                </div>
                                {criterion?.criterion_name && (
                                  <span className="font-sans font-medium text-[#64748B] text-[12px]">
                                    Tiêu chí: {criterion.criterion_name}
                                  </span>
                                )}
                                {semesterName && (
                                  <span className="font-sans font-medium text-[#64748B] text-[12px]">
                                    {semesterName}
                                  </span>
                                )}
                                {record.description && (
                                  <span className="font-sans font-medium text-[#64748B]/70 text-[12px] truncate max-w-[200px]" title={record.description}>
                                    {record.description}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Points Display */}
                            <div className="flex flex-col items-end gap-[1px] shrink-0 ml-4">
                              <span className="font-sans font-bold text-[#64748B] text-[9px] leading-none uppercase tracking-wider">
                                Điểm
                              </span>
                              <span className={`font-sans font-bold text-[15px] leading-tight mt-1 ${type === 'reward' ? 'text-[#1A73E8]' : 'text-rose-600'}`}>
                                {points}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })
                    )
                  )}
                </div>

                {/* ─ Footer Note ─ */}
                <div className="bg-white/20 border-t border-white/50 px-[24px] py-[20px] w-full shrink-0">
                  <div className="flex justify-center">
                    <span className="font-['Lexend',sans-serif] font-medium text-[#64748B] text-[12px] text-center">
                      {records.length > 0
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
