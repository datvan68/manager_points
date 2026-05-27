'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '../../../components/layout/Sidebar';
import Header from '../../../components/layout/Header';
import TabNavigation from '@/components/ui/TabNavigation';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Check,
  Save,
  RotateCcw,
  History,
  BookOpen,
  AlertTriangle,
  Award,
  CircleAlert,
  ArrowUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { summariesPointApi } from '@/api/summaries-point-api';
import { criteriaApi } from '@/api/criteria-api';
import { categoryApi } from '@/api/category-api';
import { evaluationDetailApi } from '@/api/evaluation-detail-api';
import { semesterApi } from '@/api/semester-api';
import { classApi } from '@/api/class-api';
import { studentApi } from '@/api/student-api';

// Interfaces
interface StudentData {
  id: string;
  name: string;
  email: string;
  dob: string;
  gender: string;
  score: number;
  status: string;
  classId: string;
  avatarUrl?: string;
  colorTheme?: { bg: string; text: string };
}

interface Criteria {
  id: string;
  name: string;
  pointsPerUnit: number;
  type: 'reward' | 'violation';
  maxScore?: number;
  minScore?: number;
}

interface Category {
  id: string;
  code?: string;
  title: string;
  maxPoints: number;
  items: Criteria[];
}

// Bảng tiêu chí và danh mục chuẩn hóa theo Figma
const evaluationCategories: Category[] = [
  {
    id: 'cat-1',
    title: 'Ý thức tham gia học tập',
    maxPoints: 20,
    items: [
      { id: 'cri-1-1', name: 'Điểm chuyên cần và thái độ học tập', pointsPerUnit: 10, type: 'reward' },
      { id: 'cri-1-2', name: 'Tham gia các câu lạc bộ học thuật', pointsPerUnit: 5, type: 'reward' },
      { id: 'cri-1-3', name: 'Kết quả học tập (GPA)', pointsPerUnit: 3, type: 'reward' }
    ]
  },
  {
    id: 'cat-2',
    title: 'Ý thức chấp hành nội quy',
    maxPoints: 25,
    items: [
      { id: 'cri-2-1', name: 'Chấp hành quy định về đồng phục & thẻ sinh viên', pointsPerUnit: 10, type: 'reward' },
      { id: 'cri-2-2', name: 'Chấp hành nội quy Ký túc xá/Cư trú', pointsPerUnit: -10, type: 'violation' }
    ]
  },
  {
    id: 'cat-3',
    title: 'Ý thức tham gia hoạt động chính trị, xã hội',
    maxPoints: 20,
    items: [
      { id: 'cri-3-1', name: 'Tham gia chiến dịch Mùa hè xanh', pointsPerUnit: 20, type: 'reward' }
    ]
  }
];

// Mock Lịch sử ghi nhận
const initialHistoryRecords = [
  { id: 'rec-1', studentId: '20216001', type: 'reward', title: 'Điểm chuyên cần và thái độ học tập', date: '25/05/2026', count: 1, points: 10, session: 'Sáng' },
  { id: 'rec-2', studentId: '20216001', type: 'reward', title: 'Tham gia các câu lạc bộ học thuật', date: '20/05/2026', count: 1, points: 5, session: 'Chiều' },
  { id: 'rec-3', studentId: '20216001', type: 'reward', title: 'Kết quả học tập (GPA)', date: '15/05/2026', count: 1, points: 3, session: 'Sáng' },
  { id: 'rec-4', studentId: '20216001', type: 'violation', title: 'Chấp hành nội quy Ký túc xá/Cư trú', date: '10/05/2026', count: 1, points: -10, session: 'Sáng' },

  { id: 'rec-5', studentId: '20216002', type: 'reward', title: 'Tham gia chiến dịch Mùa hè xanh', date: '24/05/2026', count: 1, points: 20, session: 'Sáng' },
  { id: 'rec-6', studentId: '20216002', type: 'reward', title: 'Điểm chuyên cần và thái độ học tập', date: '22/05/2026', count: 1, points: 10, session: 'Chiều' },
];

function GradingScoreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentIdParam = searchParams.get('studentId');

  // Slider scroll ref
  const sliderRef = useRef<HTMLDivElement>(null);

  // Scroll to Top ref & state
  const mainRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Lắng nghe sự kiện scroll trên thẻ <main>
  const handleScroll = () => {
    if (mainRef.current) {
      if (mainRef.current.scrollTop > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    }
  };

  // Cuộn mượt mà lên đầu trang
  const scrollToTop = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // States
  const [students, setStudents] = useState<StudentData[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<string>('');
  const [subTab, setSubTab] = useState<'category' | 'history'>('category');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // States lưu danh mục & tiêu chí thật từ API
  const [categories, setCategories] = useState<Category[]>(evaluationCategories);
  const [apiSemesters, setApiSemesters] = useState<any[]>([]);
  const [apiClasses, setApiClasses] = useState<any[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Mapping từ MSSV/Student ID sang ID của SummaryPoint
  const [studentSummaryMap, setStudentSummaryMap] = useState<Record<string, string>>({});

  // State lưu trữ số lượng (lần thực hiện) của từng tiêu chí cho từng sinh viên
  // Cấu trúc: { [studentId]: { [criteriaId]: count } }
  const [evaluationCounts, setEvaluationCounts] = useState<Record<string, Record<string, number>>>({});

  // State lưu lịch sử ghi nhận
  const [historyRecords, setHistoryRecords] = useState(initialHistoryRecords);

  // Khởi tạo dữ liệu thực tế từ các API
  useEffect(() => {
    const loadRealData = async () => {
      try {
        setIsInitialLoading(true);

        // 1. Tải danh mục, tiêu chí, học kỳ, lớp và bảng điểm từ backend
        const [backendCats, backendCriteria, backendSemesters, backendClasses, backendSummaries] = await Promise.all([
          categoryApi.getCategories(),
          criteriaApi.getCriteria(),
          semesterApi.getSemesters(),
          classApi.getClasses(),
          summariesPointApi.getSummariesPoints()
        ]);

        setApiSemesters(backendSemesters || []);
        setApiClasses(backendClasses || []);

        // Đọc học kỳ và lớp học đã áp dụng từ sessionStorage
        const savedSem = sessionStorage.getItem('grading_appliedSem') || (backendSemesters[0]?._id || '');
        const savedClass = sessionStorage.getItem('grading_appliedClass') || '';

        setSelectedSemesterId(savedSem);
        setSelectedClassId(savedClass);

        // 2. Map dữ liệu Categories và Criteria
        const categoriesMapped: Category[] = (backendCats || [])
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map(cat => {
            const criteriaForCat = (backendCriteria || [])
              .filter(cri => {
                const catId = typeof cri.category_id === 'object' ? cri.category_id?._id : cri.category_id;
                return catId === cat._id;
              })
              .map(cri => ({
                id: cri._id,
                name: cri.criterion_name,
                pointsPerUnit: cri.score_per_unit || 1,
                type: cri.criterion_type === 'ky_luat' ? ('violation' as const) : ('reward' as const),
                maxScore: cri.max_score || 10,
                minScore: cri.min_score || 0
              }));

            return {
              id: cat._id,
              code: cat.category_code,
              title: cat.category_name,
              maxPoints: cat.max_score || 20,
              items: criteriaForCat
            };
          });

        setCategories(categoriesMapped);

        // 3. Map Students từ summariesPoint
        let filteredSummaries = (backendSummaries || []).filter(summary => {
          const semId = typeof summary.semester_id === 'object' ? summary.semester_id?._id : summary.semester_id;
          return semId === savedSem;
        });

        if (savedClass) {
          filteredSummaries = filteredSummaries.filter(summary => {
            const studentObj = typeof summary.student_id === 'object' ? (summary.student_id as any) : null;
            const studentClassId = studentObj?.class_id?._id || studentObj?.class_id || '';
            return studentClassId === savedClass;
          });
        }

        const colors = [
          { bg: 'bg-[#dbe3f1]', text: 'text-[#141c26]' },
          { bg: 'bg-[#96f8a1]', text: 'text-[#002108]' },
          { bg: 'bg-[#ffdad6]', text: 'text-[#ba1a1a]' },
          { bg: 'bg-[#f3e5f5]', text: 'text-[#7b2cbf]' },
          { bg: 'bg-[#fff4e5]', text: 'text-[#b78103]' },
        ];

        // Lấy danh sách Student đầy đủ để tra cứu thông tin cá nhân
        const backendStudents = await studentApi.getStudents();

        const mappedStudents: StudentData[] = filteredSummaries.map((summary, idx) => {
          const studentObj = typeof summary.student_id === 'object' ? (summary.student_id as any) : null;
          const studentId = studentObj?.student_code || studentObj?.id || studentObj?._id || summary.student_id || '';

          // Tra cứu thông tin chi tiết sinh viên từ API
          const dbStudent = backendStudents.find(s => s.student_code === studentId || s._id === studentId);
          const studentName = dbStudent?.full_name || studentObj?.full_name || studentObj?.name || 'Chưa rõ';
          const studentClassId = (dbStudent?.class_id as any)?._id || dbStudent?.class_id || studentObj?.class_id?._id || studentObj?.class_id || '';

          let avatarUrl = undefined;
          if (studentId === '20216001') {
            avatarUrl = 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&q=80';
          } else if (studentId === '20216002') {
            avatarUrl = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80';
          }

          return {
            id: studentId,
            name: studentName,
            email: dbStudent?.email || studentObj?.email || '',
            dob: dbStudent?.date_bir ? new Date(dbStudent.date_bir).toLocaleDateString('vi-VN') : '',
            gender: dbStudent?.sex === 'Male' ? 'Nam' : dbStudent?.sex === 'Female' ? 'Nữ' : 'Khác',
            score: summary.total_score || 0,
            status: dbStudent?.status || studentObj?.status || 'Studying',
            classId: typeof studentClassId === 'object' ? studentClassId?._id : studentClassId,
            avatarUrl,
            colorTheme: colors[idx % colors.length]
          };
        });

        setStudents(mappedStudents);

        // Tạo map studentId -> summaryPointId
        const summaryMap: Record<string, string> = {};
        filteredSummaries.forEach(summary => {
          const studentObj = typeof summary.student_id === 'object' ? (summary.student_id as any) : null;
          const studentId = studentObj?.student_code || studentObj?.id || studentObj?._id || summary.student_id || '';
          summaryMap[studentId] = summary._id;
        });
        setStudentSummaryMap(summaryMap);

        // Thiết lập Active Student
        let targetActiveId = '';
        if (studentIdParam && mappedStudents.some(s => s.id === studentIdParam)) {
          targetActiveId = studentIdParam;
        } else if (mappedStudents.length > 0) {
          targetActiveId = mappedStudents[0].id;
        }
        setActiveStudentId(targetActiveId);

        // Nạp chi tiết chấm điểm rèn luyện của active student trước
        if (targetActiveId) {
          const activeSummaryId = summaryMap[targetActiveId];
          if (activeSummaryId) {
            const details = await evaluationDetailApi.getEvaluationDetailsBySummary(activeSummaryId);
            const counts: Record<string, number> = {};
            (details || []).forEach(detail => {
              const criId = typeof detail.criterion_id === 'object' ? detail.criterion_id?._id : detail.criterion_id;
              const criterionObj = backendCriteria.find(c => c._id === criId);
              const pointsPerUnit = criterionObj?.score_per_unit || 1;
              counts[criId] = Math.round(detail.student_score / pointsPerUnit);
            });

            setEvaluationCounts(prev => ({
              ...prev,
              [targetActiveId]: counts
            }));
          }
        }

      } catch (error: any) {
        toast.error('Lỗi khi tải dữ liệu rèn luyện thực tế: ' + error.message);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadRealData();
  }, [studentIdParam]);

  // Lazy-load chi tiết chấm điểm của sinh viên khi activeStudentId thay đổi
  useEffect(() => {
    const loadStudentDetails = async () => {
      if (!activeStudentId || evaluationCounts[activeStudentId] || isInitialLoading) return;

      const summaryId = studentSummaryMap[activeStudentId];
      if (!summaryId) return;

      try {
        setIsFetching(true);
        const details = await evaluationDetailApi.getEvaluationDetailsBySummary(summaryId);
        const counts: Record<string, number> = {};

        (details || []).forEach(detail => {
          const criId = typeof detail.criterion_id === 'object' ? detail.criterion_id?._id : detail.criterion_id;
          let pointsPerUnit = 1;
          categories.forEach(cat => {
            const item = cat.items.find(cri => cri.id === criId);
            if (item) {
              pointsPerUnit = item.pointsPerUnit || 1;
            }
          });
          counts[criId] = Math.round(detail.student_score / pointsPerUnit);
        });

        setEvaluationCounts(prev => ({
          ...prev,
          [activeStudentId]: counts
        }));
      } catch (error: any) {
        toast.error('Không thể tải chi tiết chấm điểm của sinh viên này: ' + error.message);
      } finally {
        setIsFetching(false);
      }
    };

    loadStudentDetails();
  }, [activeStudentId, studentSummaryMap, categories, isInitialLoading]);

  // Sinh viên đang active
  const activeStudent = students.find(s => s.id === activeStudentId);

  // Lấy chữ viết tắt tên sinh viên (ví dụ: Lê Công Thành -> LC)
  const getInitials = (name: string) => {
    if (!name) return 'SV';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      const first = parts[parts.length - 2].charAt(0).toUpperCase();
      const last = parts[parts.length - 1].charAt(0).toUpperCase();
      return `${first}${last}`;
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Nút slider di chuyển
  const scrollSlider = (direction: 'left' | 'right') => {
    if (sliderRef.current) {
      const scrollAmount = 300;
      sliderRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Hàm thay đổi số lượng chấm của tiêu chí
  const handleCountChange = (criteriaId: string, delta: number) => {
    if (!activeStudentId) return;

    setEvaluationCounts(prev => {
      const studentCounts = prev[activeStudentId] ? { ...prev[activeStudentId] } : {};
      const currentCount = studentCounts[criteriaId] || 0;
      const newCount = Math.max(0, currentCount + delta); // không âm

      const updatedCounts = {
        ...prev,
        [activeStudentId]: {
          ...studentCounts,
          [criteriaId]: newCount
        }
      };

      // Tự động tính toán lại điểm số realtime của sinh viên này
      calculateRealtimeScore(activeStudentId, updatedCounts[activeStudentId]);

      return updatedCounts;
    });
  };

  // Tính điểm thời gian thực dựa trên các lần thực hiện tiêu chí
  const calculateRealtimeScore = (studentId: string, studentCounts: Record<string, number>) => {
    let finalScore = 0; // Thay đổi bắt đầu từ 0đ thực tế

    categories.forEach(cat => {
      let catScore = 0;
      cat.items.forEach(cri => {
        const count = studentCounts[cri.id] || 0;
        const maxScore = (cri as any).maxScore || 10;
        const minScore = (cri as any).minScore || 0;
        const criterionScore = Math.max(minScore, Math.min(maxScore, count * cri.pointsPerUnit));
        catScore += criterionScore;
      });

      const clampedCatScore = Math.max(0, Math.min(cat.maxPoints, catScore));
      finalScore += clampedCatScore;
    });

    const clampedFinalScore = Math.max(0, Math.min(100, finalScore));

    setStudents(prev =>
      prev.map(std => std.id === studentId ? { ...std, score: clampedFinalScore } : std)
    );
  };

  // Hàm đặt lại điểm số
  const handleReset = () => {
    if (!activeStudentId || !activeStudent) return;

    setEvaluationCounts(prev => ({
      ...prev,
      [activeStudentId]: {}
    }));

    setStudents(prev =>
      prev.map(std => std.id === activeStudentId ? { ...std, score: 0 } : std)
    );

    toast.success(`Đã đặt lại điểm số của sinh viên ${activeStudent.name} về 0!`);
  };

  // Hàm Lưu thay đổi thực tế đồng bộ database qua API
  const handleSave = async () => {
    if (!activeStudent || isFetching) return;

    const summaryId = studentSummaryMap[activeStudentId];
    if (!summaryId) {
      toast.error('Không tìm thấy bảng điểm rèn luyện của sinh viên này trong học kỳ!');
      return;
    }

    try {
      setIsFetching(true);
      toast.loading('Đang lưu kết quả chấm điểm...', { id: 'save-loading' });

      // 1. Tải các chi tiết cũ của summaryId này
      const oldDetails = await evaluationDetailApi.getEvaluationDetailsBySummary(summaryId);

      // 2. Xóa các chi tiết cũ
      await Promise.all((oldDetails || []).map(detail => evaluationDetailApi.deleteEvaluationDetail(detail._id)));

      // 3. Tạo các chi tiết chấm điểm mới
      const counts = evaluationCounts[activeStudentId] || {};
      const createPromises: Promise<any>[] = [];

      categories.forEach(cat => {
        cat.items.forEach(cri => {
          const count = counts[cri.id] || 0;
          if (count > 0) {
            const maxScore = (cri as any).maxScore || 10;
            const minScore = (cri as any).minScore || 0;
            const student_score = Math.max(minScore, Math.min(maxScore, count * cri.pointsPerUnit));
            const advisor_score = student_score; // Gán điểm cố vấn ban đầu bằng điểm tự chấm

            createPromises.push(evaluationDetailApi.createEvaluationDetail({
              summary_id: summaryId,
              criterion_id: cri.id,
              student_score,
              advisor_score
            }));
          }
        });
      });

      await Promise.all(createPromises);

      // 4. Cập nhật lại tổng điểm rèn luyện trong summariesPoint
      await summariesPointApi.updateSummariesPoint(summaryId, {
        total_score: activeStudent.score
      });

      // 5. Thêm các record mới vào lịch sử UI cho đồng bộ hiển thị
      const newRecords: any[] = [];
      let recordIndex = Date.now();
      categories.forEach(cat => {
        cat.items.forEach(cri => {
          const count = counts[cri.id] || 0;
          if (count > 0) {
            newRecords.push({
              id: `rec-new-${recordIndex++}`,
              studentId: activeStudentId,
              type: cri.type,
              title: cri.name,
              date: new Date().toLocaleDateString('vi-VN'),
              count,
              points: cri.pointsPerUnit * count,
              session: new Date().getHours() < 12 ? 'Sáng' : 'Chiều'
            });
          }
        });
      });
      setHistoryRecords(prev => [...newRecords, ...prev]);

      toast.dismiss('save-loading');
      toast.success(`Đã lưu thành công điểm rèn luyện ${activeStudent.score}/100đ cho sinh viên ${activeStudent.name}!`);

    } catch (error: any) {
      toast.dismiss('save-loading');
      toast.error('Lỗi khi lưu kết quả chấm điểm: ' + error.message);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.25);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.4);
        }
      `}</style>
      <div className="flex h-screen bg-[#f6f7f8] font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header />

          <TabNavigation
            tabs={[
              { id: 'list', label: 'Danh sách' },
              { id: 'score', label: 'Chấm điểm' },
              { id: 'reports', label: 'Danh mục' }
            ]}
            activeTab={'score'}
            onTabChange={(id) => {
              if (id === 'list') {
                router.push('/grading');
              } else if (id === 'reports') {
                router.push('/grading/categories');
              }
            }}
          />

          <main
            ref={mainRef}
            onScroll={handleScroll}
            className="flex-1 p-6 flex flex-col gap-6 max-w-[1440px] mx-auto w-full overflow-y-auto custom-scrollbar"
          >

            {/* ================= STUDENT HERO SLIDER ================= */}
            <div className="bg-white border border-[#e5e7eb] rounded-2xl p-5 shadow-sm shrink-0 flex flex-col gap-3.5 relative overflow-hidden">
              <div className="flex items-center justify-between w-full">
                <h3 className="font-sans font-bold text-[#5f6368] text-[11px] tracking-[0.8px] uppercase">
                  SINH VIÊN ĐANG THEO DÕI
                </h3>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => scrollSlider('left')}
                    className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer shadow-sm"
                    title="Trượt sang trái"
                  >
                    <ChevronLeft size={16} strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => scrollSlider('right')}
                    className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer shadow-sm"
                    title="Trượt sang phải"
                  >
                    <ChevronRight size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Slider container */}
              <div
                ref={sliderRef}
                className="flex gap-4 overflow-x-auto pr-10 py-1.5 custom-scrollbar scroll-smooth"
              >
                {isInitialLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <div key={`skel-hero-${idx}`} className="w-[256px] h-[83px] bg-slate-50/60 rounded-xl border border-slate-100 p-3.5 flex items-center gap-3 animate-pulse shrink-0">
                      <Skeleton className="w-12 h-12 rounded-full bg-slate-100 shrink-0 animate-pulse" />
                      <div className="flex-1 flex flex-col gap-1.5">
                        <Skeleton className="h-4 w-3/4 bg-slate-100 rounded" />
                        <Skeleton className="h-3.5 w-1/2 bg-slate-100 rounded" />
                      </div>
                    </div>
                  ))
                ) : (
                  students.map((student) => {
                    const isActive = student.id === activeStudentId;
                    const initials = getInitials(student.name);

                    return (
                      <motion.div
                        key={student.id}
                        layout="position"
                        onClick={() => setActiveStudentId(student.id)}
                        className={`relative bg-white border-2 rounded-xl p-[13px] w-[256px] flex gap-[12px] items-center shrink-0 cursor-pointer transition-all duration-200 select-none shadow-[0px_1px_2px_rgba(0,0,0,0.03)] ${isActive
                          ? 'border-[#005bbf] shadow-[0px_4px_16px_rgba(0,91,191,0.08)] scale-[1.01]'
                          : 'border-[#cbd5e1]/70 hover:border-slate-300'
                          }`}
                      >
                        {/* Avatar container */}
                        <div className="relative shrink-0 w-12 h-12 rounded-full">
                          {student.avatarUrl ? (
                            <div className="absolute inset-0 rounded-full overflow-hidden border border-slate-100/50">
                              <img alt={student.name} className="object-cover w-full h-full" src={student.avatarUrl} />
                            </div>
                          ) : (
                            <div className={`absolute inset-0 rounded-full flex items-center justify-center font-bold text-[15px] border border-slate-100/50 ${student.colorTheme?.bg} ${student.colorTheme?.text}`}>
                              {initials}
                            </div>
                          )}

                          {/* Active Badge Checkmark */}
                          {isActive && (
                            <div className="absolute -bottom-1 -right-1 bg-[#005bbf] text-white border-2 border-white rounded-full w-5 h-5 flex items-center justify-center shadow-[0_2px_4px_rgba(0,91,191,0.2)]">
                              <Check size={11} strokeWidth={3} />
                            </div>
                          )}
                        </div>

                        {/* Student Info & Realtime Progress */}
                        <div className="flex-1 min-w-0 flex flex-col">
                          <h4 className="font-bold text-[#1a1b1e] text-[14.5px] truncate" title={student.name}>
                            {student.name}
                          </h4>
                          <span className="text-[#5f6368] text-[11px] font-medium mt-0.5">
                            MSSV: {student.id}
                          </span>

                          {/* Realtime progress bar */}
                          <div className="flex gap-2.5 items-center mt-1.5">
                            <div className="bg-[#e3e2e6] flex-1 h-[5px] rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${student.score}%` }}
                                transition={{ type: 'spring', stiffness: 80, damping: 15 }}
                                className="bg-[#005bbf] h-full rounded-full"
                              />
                            </div>
                            <span className="font-bold text-[#005bbf] text-[9.5px] tracking-wide shrink-0">
                              {student.score}/100
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ================= NAVIGATION TABS (Danh mục / Lịch sử) ================= */}
            <div className="border-[#e9e7eb] border-b border-solid flex gap-[32px] items-start pb-px shrink-0 ">
              <button
                onClick={() => setSubTab('category')}
                className={`pb-3.5 font-bold text-[18px] transition-all relative cursor-pointer ${subTab === 'category'
                  ? 'text-[#005bbf]'
                  : 'text-[#5f6368] hover:text-slate-700'
                  }`}
              >
                Danh mục
                {subTab === 'category' && (
                  <motion.div
                    layoutId="activeSubTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#005bbf] rounded-full"
                  />
                )}
              </button>
              <button
                onClick={() => setSubTab('history')}
                className={`pb-3.5 font-bold text-[18px] transition-all relative cursor-pointer ${subTab === 'history'
                  ? 'text-[#005bbf]'
                  : 'text-[#5f6368] hover:text-slate-700'
                  }`}
              >
                Lịch sử ghi nhận
                {subTab === 'history' && (
                  <motion.div
                    layoutId="activeSubTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#005bbf] rounded-full"
                  />
                )}
              </button>
            </div>

            {/* ================= TAB CONTENTS ================= */}
            <div className="flex-1 flex flex-col gap-5 min-h-0 shrink-0">

              {/* ───── TAB 1: DANH MỤC (Criteria Evaluation) ───── */}
              {subTab === 'category' && activeStudent && (
                <div className="flex flex-col gap-4">
                  {categories.map((category) => {
                    const studentCounts = evaluationCounts[activeStudentId] || {};

                    // Tính toán tổng điểm danh mục rèn luyện realtime
                    let catScore = 0;
                    category.items.forEach(cri => {
                      const count = studentCounts[cri.id] || 0;
                      const maxScore = (cri as any).maxScore || 10;
                      const minScore = (cri as any).minScore || 0;
                      const criterionScore = Math.max(minScore, Math.min(maxScore, count * cri.pointsPerUnit));
                      catScore += criterionScore;
                    });
                    const clampedCatScore = Math.max(0, Math.min(category.maxPoints, catScore));

                    // Xác định màu sắc badge dựa trên tỷ lệ điểm
                    const ratio = clampedCatScore / category.maxPoints;
                    let badgeClass = 'bg-[#dbe3f1] text-[#5d6571]'; // mặc định xám
                    if (ratio >= 0.8) {
                      badgeClass = 'bg-[#96f8a1]/35 text-[#00531f]'; // xanh lá
                    } else if (ratio >= 0.5) {
                      badgeClass = 'bg-[#d8e2ff] text-[#004493]'; // xanh dương
                    }

                    return (
                      <motion.div
                        key={category.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-[0px_2px_8px_0px_rgba(0,0,0,0.035)] flex flex-col w-full"
                      >
                        {/* Category Header */}
                        <div className="bg-[#f4f3f7] flex items-center justify-between p-5 w-full select-none">
                          <h4 className="font-bold text-[#1a1b1e] text-[17.5px] tracking-wide flex items-center gap-2">
                            {category.code && (
                              <span className="text-[#005bbf] font-mono text-[13px] bg-[#005bbf]/10 px-2 py-0.5 rounded font-bold shrink-0">
                                {category.code}
                              </span>
                            )}
                            <span>{category.title}</span>
                          </h4>
                          <div className={`px-3 py-1 rounded-full font-bold text-[12px] tracking-wider shrink-0 transition-colors duration-300 ${badgeClass}`}>
                            {clampedCatScore} / {category.maxPoints}đ
                          </div>
                        </div>

                        {/* Criteria List Rows */}
                        <div className="flex flex-col w-full divide-y divide-[#e9e7eb]">
                          {category.items.map((item) => {
                            const count = studentCounts[item.id] || 0;
                            const hasViolation = item.type === 'violation';
                            const totalPoints = item.pointsPerUnit * count;

                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-5 w-full hover:bg-slate-50/20 transition-colors"
                              >
                                {/* Title */}
                                <div className="flex flex-col gap-1 w-[40%]">
                                  <h5 className="font-medium text-[#1a1b1e] text-[15px] leading-relaxed">
                                    {item.name}
                                  </h5>
                                </div>

                                {/* Counter Control and Points */}
                                <div className="flex gap-8 items-center shrink-0">

                                  {/* +/- Bộ nút tăng giảm số lượng và đơn giá */}
                                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                                    <div className="bg-[#f4f3f7]/55 border border-[#c1c6d6]/20 rounded-full p-1 flex gap-1 items-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                                      <button
                                        onClick={() => handleCountChange(item.id, -1)}
                                        disabled={count === 0}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${count === 0
                                          ? 'opacity-30 cursor-not-allowed text-slate-400'
                                          : hasViolation
                                            ? 'text-[#d93025] hover:bg-rose-50'
                                            : 'text-[#005bbf] hover:bg-blue-50'
                                          }`}
                                        title="Giảm lần vi phạm/cộng điểm"
                                      >
                                        <Minus size={13} strokeWidth={3} />
                                      </button>
                                      <div className="w-8 flex items-center justify-center font-bold text-[#1a1b1e] text-[15px] select-none">
                                        {count}
                                      </div>
                                      <button
                                        onClick={() => handleCountChange(item.id, 1)}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${hasViolation
                                          ? 'text-[#d93025] hover:bg-rose-50'
                                          : 'text-[#005bbf] hover:bg-blue-50'
                                          }`}
                                        title="Tăng lần vi phạm/cộng điểm"
                                      >
                                        <Plus size={13} strokeWidth={3} />
                                      </button>
                                    </div>
                                    <span className="text-[#5f6368] text-[11px] font-medium tracking-wide">
                                      {item.pointsPerUnit > 0 ? '+' : ''}{item.pointsPerUnit}đ/lần
                                    </span>
                                  </div>

                                  {/* Realtime Points Display */}
                                  <div className="flex flex-col items-end w-[85px] shrink-0 justify-center">
                                    <span className={`font-bold text-[18px] ${hasViolation
                                      ? 'text-[#d93025]'
                                      : 'text-[#006d2b]'
                                      }`}>
                                      {hasViolation ? '' : '+'}{totalPoints}đ
                                    </span>
                                    {item.maxScore !== undefined && (
                                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium mt-1 text-right shrink-0">
                                        Tối đa {item.maxScore}đ
                                      </span>
                                    )}
                                  </div>

                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Nút lưu & đặt lại ở dưới cùng */}
                  <div className="flex items-center justify-end gap-3.5 pt-4 pb-12 w-full">
                    <button
                      onClick={handleReset}
                      className="border border-[#c1c6d6] hover:bg-slate-50 text-[#414754] font-bold text-[14px] px-6 py-2.5 rounded-lg flex items-center gap-2 transition-all active:scale-95 cursor-pointer h-[42px]"
                      title="Đặt lại các tiêu chí"
                    >
                      <RotateCcw size={15} strokeWidth={2.5} />
                      <span>Đặt lại</span>
                    </button>
                    <button
                      onClick={handleSave}
                      className="bg-[#005bbf] hover:bg-[#004797] text-white font-bold text-[14px] px-7 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-[0_4px_12px_rgba(0,91,191,0.2)] active:scale-95 cursor-pointer h-[42px]"
                      title="Lưu điểm rèn luyện"
                    >
                      <Save size={15} strokeWidth={2.5} />
                      <span>Lưu thay đổi</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ───── TAB 2: LỊCH SỬ GHI NHẬN (History Log) ───── */}
              {subTab === 'history' && activeStudent && (() => {
                const records = historyRecords.filter(r => r.studentId === activeStudentId);

                return (
                  <div className="flex flex-col gap-4">
                    {records.length === 0 ? (
                      <div className="bg-white border border-[#f1f5f9] rounded-2xl py-20 flex flex-col items-center justify-center text-center p-8 gap-3 shadow-sm">
                        <div className="p-4 bg-slate-50 rounded-2xl text-slate-300">
                          <History size={36} strokeWidth={1.5} />
                        </div>
                        <h4 className="font-bold text-slate-700 text-[15px]">Chưa có lịch sử chấm điểm</h4>
                        <p className="text-slate-400 text-[12.5px] max-w-[260px] font-medium leading-relaxed">
                          Thực hiện tăng giảm điểm rèn luyện ở tab Danh mục và bấm Lưu để ghi nhận lịch sử.
                        </p>
                      </div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-white border border-[#f1f5f9] rounded-2xl shadow-sm overflow-hidden flex flex-col"
                      >
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-[#f8fafc] border-b border-[#f1f5f9] text-left text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
                                <th className="px-6 py-4">Ngày ghi nhận</th>
                                <th className="px-6 py-4">Loại hình</th>
                                <th className="px-6 py-4">Mô tả tiêu chí</th>
                                <th className="px-6 py-4 text-center">Buổi</th>
                                <th className="px-6 py-4 text-center">Số lần</th>
                                <th className="px-6 py-4 text-right">Tổng điểm</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f1f5f9] text-[13.5px]">
                              {records.map((rec) => {
                                const isViolation = rec.type === 'violation';

                                return (
                                  <tr key={rec.id} className="hover:bg-slate-50/40 transition-colors">
                                    <td className="px-6 py-4 text-[#64748b] font-medium">{rec.date}</td>
                                    <td className="px-6 py-4">
                                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wide border ${isViolation
                                        ? 'bg-rose-50 text-rose-700 border-rose-100/50'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-100/50'
                                        }`}>
                                        {isViolation ? (
                                          <CircleAlert size={11} className="shrink-0" />
                                        ) : (
                                          <Award size={11} className="shrink-0" />
                                        )}
                                        {isViolation ? 'Vi phạm' : 'Khen thưởng'}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-[#0f172a]">{rec.title}</td>
                                    <td className="px-6 py-4 text-center text-[#475569] font-medium">{rec.session}</td>
                                    <td className="px-6 py-4 text-center font-bold text-[#0f172a]">{rec.count}</td>
                                    <td className="px-6 py-4 text-right">
                                      <span className={`font-extrabold text-[14.5px] ${isViolation ? 'text-rose-600' : 'text-emerald-600'
                                        }`}>
                                        {isViolation ? '' : '+'}{rec.points}đ
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })()}

            </div>
          </main>
        </div>
      </div>

      {/* Button Cuộn lên đầu trang (Scroll to Top) */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.1, translateY: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 z-50 bg-[#005bbf] text-white p-3.5 rounded-full shadow-[0px_4px_20px_rgba(0,91,191,0.35)] hover:bg-[#004797] transition-colors cursor-pointer border border-white/10 flex items-center justify-center"
            title="Cuộn lên đầu trang"
          >
            <ArrowUp size={22} strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

// Bọc component trong Suspense để tránh lỗi static generation do useSearchParams ở client-side.
export default function GradingScorePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-[#f6f7f8] font-sans items-center justify-center">
        <div className="text-center flex flex-col items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-full animate-bounce bg-slate-100" />
          <div className="font-bold text-slate-500 text-[14px]">Đang tải giao diện chấm điểm...</div>
        </div>
      </div>
    }>
      <GradingScoreContent />
    </Suspense>
  );
}
