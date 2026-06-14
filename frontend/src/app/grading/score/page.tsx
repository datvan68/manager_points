"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "../../../components/layout/Sidebar";
import Header from "../../../components/layout/Header";
import TabNavigation from "@/components/ui/TabNavigation";
import { Skeleton } from "@/components/ui/skeleton";
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
  ArrowUp,
  Trash2,
  Eye,
  Settings,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CustomPagination } from "@/components/ui/pagination";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { summariesPointApi } from "@/api/summaries-point-api";
import { criteriaApi } from "@/api/criteria-api";
import { categoryApi } from "@/api/category-api";
import { evaluationDetailApi } from "@/api/evaluation-detail-api";
import { semesterApi } from "@/api/semester-api";
import { classApi } from "@/api/class-api";
import { studentApi } from "@/api/student-api";
import { tokenStorage } from "@/api/auth-api";
import { evaluationPeriodApi } from "@/api/evaluation-period-api";
import SemesterModal from "@/components/grading/SemesterModal";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { useLinkedTaskProgress } from "@/hooks/useLinkedTaskProgress";
import { studentTaskApi } from "@/api/task-api";
import { normalizeLinkedPath, getLinkedTaskMode } from "@/lib/task-linked-page";
import dynamic from "next/dynamic";
import { isStudentRole, isAdminRole } from "@/utils/role.util";

const ActiveStudentRankCard = dynamic(
  () => import("@/components/grading/ActiveStudentRankCard"),
  {
    ssr: false,
    loading: () => <div className="h-[110px] w-full bg-slate-100/50 rounded-2xl animate-pulse" />,
  }
);



// Interfaces
interface StudentData {
  id: string;
  name: string;
  email: string;
  dob: string;
  gender: string;
  score: number;
  status: string;
  gradingStatus: "draft" | "sv_submitted" | "gv_reviewed" | "locked";
  classId: string;
  avatarUrl?: string;
  colorTheme?: { bg: string; text: string };
}

interface Criteria {
  id: string;
  name: string;
  pointsPerUnit: number;
  type: "reward" | "violation";
  maxScore?: number;
  minScore?: number;
  is_locked?: boolean;
}

interface Category {
  id: string;
  code?: string;
  title: string;
  maxPoints: number;
  items: Criteria[];
}

const calculateCriterionScore = (criterion: Criteria, count: number) => {
  const maxScore = criterion.maxScore ?? 10;
  const minScore = criterion.minScore ?? 0;
  const rawScore = count * criterion.pointsPerUnit;

  return criterion.pointsPerUnit >= 0
    ? Math.max(minScore, Math.min(maxScore, rawScore))
    : Math.max(-maxScore, Math.min(0, rawScore));
};

const formatScoreLabel = (score?: number | null) => {
  if (score === null || score === undefined) return "Chưa chấm";
  return `${score > 0 ? "+" : ""}${score}đ`;
};

// Component CriteriaTooltip dùng để hiển thị text dài của tiêu chí
const CriteriaTooltip = ({ content }: { content: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Click ra ngoài để đóng tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={tooltipRef} className="relative inline-flex items-center ml-1 z-20">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-slate-400 hover:text-[#1A73E8] transition-colors focus:outline-none p-0.5"
      >
        <Info size={14} className="shrink-0" />
      </button>
      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-slate-900/95 backdrop-blur-md text-white text-xs rounded-xl shadow-xl border border-white/10 z-50 text-left">
          <div className="font-semibold mb-1 text-white/90">Nội dung đầy đủ:</div>
          <div className="leading-relaxed text-slate-300 font-medium">{content}</div>
          {/* Mũi tên chỉ lên trên */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900/95" />
        </div>
      )}
    </div>
  );
};

// Component CupertinoHorizontalPicker dùng cho việc kéo/cuộn trượt số chấm điểm
interface CupertinoPickerProps {
  count: number;
  minCount: number;
  maxCount: number;
  onChange: (val: number) => void;
  isLocked: boolean;
  canModifyScore: boolean;
  hasViolation: boolean;
}

const CupertinoHorizontalPicker: React.FC<CupertinoPickerProps> = ({
  count,
  minCount,
  maxCount,
  onChange,
  isLocked,
  canModifyScore,
  hasViolation,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const numbers = [];
  for (let i = minCount; i <= maxCount; i++) {
    numbers.push(i);
  }

  // Khi count thay đổi từ bên ngoài (nút +/- hoặc click)
  useEffect(() => {
    if (containerRef.current) {
      const targetScrollLeft = (count - minCount) * 36;
      if (Math.abs(containerRef.current.scrollLeft - targetScrollLeft) > 1) {
        isProgrammaticScroll.current = true;
        containerRef.current.scrollTo({
          left: targetScrollLeft,
          behavior: "smooth",
        });
        
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 150);
      }
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [count, minCount]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScroll.current || isLocked || !canModifyScore) return;
    
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const activeIndex = Math.round(scrollLeft / 36);
    const targetVal = minCount + activeIndex;

    if (targetVal !== count && targetVal >= minCount && targetVal <= maxCount) {
      onChange(targetVal);
    }
  };

  return (
    <div 
      className={`relative w-[130px] sm:w-[150px] md:w-[162px] h-9 overflow-hidden flex items-center justify-center select-none bg-slate-100/40 border border-slate-200/40 rounded-xl ${
        isLocked || !canModifyScore ? "opacity-50" : ""
      }`}
    >
      {/* Highlight Bar ở giữa */}
      <div 
        className={`absolute inset-y-1 w-9 border-l border-r rounded-md pointer-events-none z-10 ${
          hasViolation
            ? "bg-rose-500/10 border-rose-500/25"
            : "bg-[#1A73E8]/10 border-[#1A73E8]/25"
        }`}
      />

      {/* Scroll Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`w-full h-full flex items-center scrollbar-none snap-x snap-mandatory touch-pan-x ${
          isLocked || !canModifyScore ? "overflow-x-hidden pointer-events-none" : "overflow-x-auto"
        }`}
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {/* Padding 2 đầu để item đầu/cuối căn giữa */}
        <div className="w-[47px] sm:w-[57px] md:w-[63px] shrink-0" />

        {numbers.map((num) => {
          const diff = Math.abs(num - count);
          const scale = diff === 0 ? 1.25 : diff === 1 ? 0.95 : 0.7;
          const opacity = diff === 0 ? 1 : diff === 1 ? 0.6 : 0.25;
          const isSelected = diff === 0;

          return (
            <button
              key={num}
              type="button"
              onClick={() => {
                if (!isLocked && canModifyScore) {
                  onChange(num);
                }
              }}
              disabled={isLocked || !canModifyScore}
              className={`w-9 h-9 shrink-0 snap-center flex items-center justify-center font-bold tracking-tight transition-all focus:outline-none ${
                isSelected
                  ? (hasViolation ? "text-rose-600 font-extrabold" : "text-[#1A73E8] font-extrabold")
                  : "text-[#64748B]"
              }`}
              style={{
                transform: `scale(${scale})`,
                opacity: opacity,
              }}
            >
              {String(num).padStart(2, "0")}
            </button>
          );
        })}

        <div className="w-[47px] sm:w-[57px] md:w-[63px] shrink-0" />
      </div>
    </div>
  );
};

// Bảng tiêu chí và danh mục chuẩn hóa theo Figma
const evaluationCategories: Category[] = [
  {
    id: "cat-1",
    title: "Ý thức tham gia học tập",
    maxPoints: 20,
    items: [
      {
        id: "cri-1-1",
        name: "Điểm chuyên cần và thái độ học tập",
        pointsPerUnit: 10,
        type: "reward",
      },
      {
        id: "cri-1-2",
        name: "Tham gia các câu lạc bộ học thuật",
        pointsPerUnit: 5,
        type: "reward",
      },
      {
        id: "cri-1-3",
        name: "Kết quả học tập (GPA)",
        pointsPerUnit: 3,
        type: "reward",
      },
    ],
  },
  {
    id: "cat-2",
    title: "Ý thức chấp hành nội quy",
    maxPoints: 25,
    items: [
      {
        id: "cri-2-1",
        name: "Chấp hành quy định về đồng phục & thẻ sinh viên",
        pointsPerUnit: 10,
        type: "reward",
      },
      {
        id: "cri-2-2",
        name: "Chấp hành nội quy Ký túc xá/Cư trú",
        pointsPerUnit: -10,
        type: "violation",
      },
    ],
  },
  {
    id: "cat-3",
    title: "Ý thức tham gia hoạt động chính trị, xã hội",
    maxPoints: 20,
    items: [
      {
        id: "cri-3-1",
        name: "Tham gia chiến dịch Mùa hè xanh",
        pointsPerUnit: 20,
        type: "reward",
      },
    ],
  },
];

interface HistoryRecord {
  id: string;
  studentId: string;
  type: string;
  title: string;
  date: string;
  count: number;
  points: number;
  session: string;
  role?: "student" | "teacher" | "supervisor" | "admin";
  updated_by?: string;
  status?: string;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "Chưa thiết lập";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "Chưa thiết lập";
  }
};

const getEntityId = (value: any) => {
  if (!value) return "";
  if (typeof value === "object") {
    return value._id || value.id || "";
  }
  return value;
};

const getSummaryStudentCode = (summary: any) => {
  const studentObj =
    typeof summary?.student_id === "object" ? summary.student_id : null;
  return (
    studentObj?.student_code ||
    studentObj?.id ||
    studentObj?._id ||
    (typeof summary?.student_id === "string" ? summary.student_id : "") ||
    ""
  );
};

const getSummaryStudentKey = (summary: any, index?: number) => {
  return (
    getSummaryStudentCode(summary) ||
    getEntityId(summary?.student_id) ||
    getEntityId(summary?._id) ||
    `student-${index ?? "unknown"}`
  );
};

const getRoleKey = (role?: string) => {
  const normalizedRole = role?.toLowerCase() || "";
  if (normalizedRole.includes("admin")) return "admin";
  if (
    normalizedRole.includes("supervisor") ||
    normalizedRole.includes("quản sinh")
  ) {
    return "supervisor";
  }
  if (
    normalizedRole.includes("teacher") ||
    normalizedRole.includes("advisor")
  ) {
    return "teacher";
  }
  return "student";
};

const matchesCurrentStudent = ({
  currentUser,
  studentIdParam,
  studentId,
  studentObj,
  dbStudent,
}: {
  currentUser: any;
  studentIdParam: string | null;
  studentId: string;
  studentObj?: any;
  dbStudent?: any;
}) => {
  if (studentIdParam) {
    return (
      studentId === studentIdParam ||
      getEntityId(dbStudent?._id) === studentIdParam
    );
  }

  const currentUserId = currentUser?.id || currentUser?._id || "";
  const currentUserEmail = (currentUser?.email || "").trim().toLowerCase();
  const currentUsername = (
    currentUser?.username ||
    currentUser?.user_name ||
    ""
  )
    .trim()
    .toLowerCase();

  const studentEmail = (dbStudent?.email || studentObj?.email || "")
    .trim()
    .toLowerCase();
  const studentUserId = getEntityId(dbStudent?.user_id || studentObj?.user_id);
  const studentName = (
    dbStudent?.full_name ||
    studentObj?.full_name ||
    studentObj?.name ||
    ""
  )
    .trim()
    .toLowerCase();
  const studentDbId = getEntityId(dbStudent?._id || studentObj?._id);

  return Boolean(
    (currentUserId &&
      (currentUserId === studentUserId || currentUserId === studentDbId)) ||
    (currentUserEmail && currentUserEmail === studentEmail) ||
    (currentUsername && currentUsername === studentName),
  );
};

interface HistoryCardProps {
  rec: HistoryRecord;
  index: number;
  total: number;
  onDelete: () => void;
}

const HistoryCard: React.FC<HistoryCardProps> = ({ rec, index, onDelete }) => {
  const isViolation = rec.type === "violation";

  let statusLabel = "Bản nháp";
  let statusStyle = "bg-slate-500/10 text-[#64748B] border-slate-500/10";
  if (rec.status === "teacher_evaluated") {
    statusLabel = "Cố vấn đã chấm";
    statusStyle = "bg-sky-500/10 text-sky-700 border-sky-500/25";
  } else if (rec.status === "supervisor_evaluated") {
    statusLabel = "Quản sinh đã chấm";
    statusStyle = "bg-amber-500/10 text-amber-700 border-amber-500/25";
  } else if (rec.status === "finalized") {
    statusLabel = "Đã phê duyệt";
    statusStyle = "bg-emerald-500/10 text-emerald-700 border-emerald-500/25";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="relative flex flex-col gap-3.5 p-4.5 md:p-5 w-full bg-white/70 backdrop-blur-md border border-white/85 rounded-[24px] transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.015)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:-translate-y-1"
    >
      {/* Header: Tiêu chí và Tổng điểm */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h5 className="font-bold text-[#1E293B] text-[14.5px] leading-snug break-words">
            {rec.title}
          </h5>
          <span
            className={`inline-flex items-center gap-1 self-start px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
              isViolation
                ? "bg-rose-500/10 text-rose-700 border-rose-500/20"
                : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
            }`}
          >
            {isViolation ? "Vi phạm" : "Khen thưởng"}
          </span>
        </div>

        <div className="flex flex-col items-end shrink-0 text-right">
          <span
            className={`font-extrabold text-[17.5px] leading-none ${
              isViolation ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            {isViolation ? "" : "+"}
            {rec.points}đ
          </span>
          <span className="text-[10px] text-[#64748B] font-bold mt-1.5 bg-slate-100/50 px-2 py-0.5 rounded-md border border-slate-200/20 font-sans">
            Đã chấm: {rec.count} lần
          </span>
        </div>
      </div>

      {/* Footer: Thông tin phụ & Nút xóa */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 pt-2.5 border-t border-slate-100/50 mt-1">
        <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-[#64748B] font-medium">
          {/* Ngày & Buổi */}
          <span className="bg-slate-100/70 border border-slate-200/30 px-2 py-0.5 rounded-lg shrink-0 font-bold font-sans">
            {rec.date} ({rec.session})
          </span>

          {/* Vai trò người chấm */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold ${
              rec.role === "admin"
                ? "bg-purple-500/10 text-purple-700 border-purple-500/20"
                : rec.role === "teacher"
                  ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                  : rec.role === "supervisor"
                    ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                    : "bg-slate-500/10 text-[#64748B] border-slate-500/20"
            }`}
          >
            Người chấm: {
              rec.role === "admin"
                ? "Quản trị viên"
                : rec.role === "teacher"
                  ? "Cố vấn"
                  : rec.role === "supervisor"
                    ? "Quản sinh"
                    : "Sinh viên"
            }
          </span>

          {/* Trạng thái duyệt */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold ${statusStyle}`}
          >
            {statusLabel}
          </span>
        </div>

        {/* Nút xóa lịch sử */}
        <button
          onClick={onDelete}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer shadow-sm hover:scale-[1.05]"
          title="Xóa lịch sử ghi nhận này"
        >
          <Trash2 size={13} strokeWidth={2.5} />
        </button>
      </div>
    </motion.div>
  );
};

function GradingScoreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentIdParam = searchParams.get("studentId");
  const taskId = searchParams.get("taskId");

  const { markStarted, markCompleted } = useLinkedTaskProgress({
    taskId,
    linkedPage: "/grading/score",
    sourceType: "grading_score",
  });

  // Slider scroll ref
  const sliderRef = useRef<HTMLDivElement>(null);

  // Slider drag to scroll refs & handlers
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const handleSliderMouseDown = (e: React.MouseEvent) => {
    if (!sliderRef.current) return;
    isDownRef.current = true;
    sliderRef.current.style.scrollBehavior = "auto"; // Tắt smooth scroll tạm thời để kéo chuột nhạy hơn
    sliderRef.current.style.cursor = "grabbing";
    startXRef.current = e.pageX - sliderRef.current.offsetLeft;
    scrollLeftRef.current = sliderRef.current.scrollLeft;
  };

  const handleSliderMouseUpOrLeave = () => {
    isDownRef.current = false;
    if (sliderRef.current) {
      sliderRef.current.style.scrollBehavior = "smooth"; // Bật lại smooth scroll
      sliderRef.current.style.cursor = "grab";
    }
  };

  const handleSliderMouseMove = (e: React.MouseEvent) => {
    if (!isDownRef.current || !sliderRef.current) return;
    e.preventDefault();
    const x = e.pageX - sliderRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5; // Tốc độ kéo
    sliderRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

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
        behavior: "smooth",
      });
    }
  };

  // States
  const [students, setStudents] = useState<StudentData[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<string>("");
  const [subTab, setSubTab] = useState<"category" | "history">("category");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // States lưu danh mục & tiêu chí thật từ API
  const [categories, setCategories] =
    useState<Category[]>(evaluationCategories);
  const [apiSemesters, setApiSemesters] = useState<any[]>([]);
  const [apiClasses, setApiClasses] = useState<any[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  // States cho Kỳ đánh giá (Evaluation Periods)
  const [apiEvaluationPeriods, setApiEvaluationPeriods] = useState<any[]>([]);
  const [activePeriod, setActivePeriod] = useState<any | null>(null);
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);
  const [evaluationDetailsMap, setEvaluationDetailsMap] = useState<
    Record<string, any>
  >({});
  const [apiSummariesPoints, setApiSummariesPoints] = useState<any[]>([]);

  // Mapping từ MSSV/Student ID sang ID của SummaryPoint
  const [studentSummaryMap, setStudentSummaryMap] = useState<
    Record<string, string>
  >({});

  const syncLinkedTaskCompleted = async (summaryId: string) => {
    if (!taskId) return;
    try {
      await markCompleted(summaryId, { studentId: activeStudentId });
    } catch (syncErr) {
      toast.warning("Nghiệp vụ đã lưu nhưng trạng thái nhiệm vụ chưa được đồng bộ!");
      console.warn("Failed to sync task completed status. Debug info:", {
        taskId,
        summaryId,
        activeStudentId,
        sourceType: "grading_score",
        error: syncErr
      });
    }
  };

  // State lưu trữ số lượng (lần thực hiện) của từng tiêu chí cho từng sinh viên
  // Cấu trúc: { [studentId]: { [criteriaId]: count } }
  const [evaluationCounts, setEvaluationCounts] = useState<
    Record<string, Record<string, number>>
  >({});

  // State lưu lại giá trị gốc có sẵn (pre-existing) — { studentId: { criterionId: { original_count, current_count } } }
  const [preExistingCountsState, setPreExistingCountsState] = useState<
    Record<
      string,
      Record<string, { original_count: number; current_count: number }>
    >
  >({});

  // State lưu lịch sử ghi nhận
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [isHistoryFetching, setIsHistoryFetching] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<HistoryRecord | null>(
    null,
  );

  const currentSemester = apiSemesters.find(
    (sem) => sem._id === selectedSemesterId,
  );
  const isSemesterActive = currentSemester
    ? currentSemester.status === "active"
    : false;

  // Tự động tìm kỳ đánh giá (Evaluation Period) hoạt động tương ứng với học kỳ được chọn
  useEffect(() => {
    const period = apiEvaluationPeriods.find((p) => {
      const semId =
        typeof p.semester_id === "object" ? p.semester_id?._id : p.semester_id;
      return semId === selectedSemesterId;
    });
    setActivePeriod(period || null);
  }, [selectedSemesterId, apiEvaluationPeriods]);

  const currentUser = tokenStorage.getUser();
  const currentUserRoleLegacy = (() => {
    const role = currentUser?.role?.toLowerCase() || "";
    if (role.includes("admin")) return "admin";
    if (role.includes("supervisor") || role.includes("quản sinh"))
      return "supervisor";
    if (role.includes("teacher") || role.includes("advisor")) return "teacher";
    return "student";
  })();
  void currentUserRoleLegacy;
  const currentUserRole = getRoleKey(currentUser?.role);
  const isAdminOrSupervisor =
    currentUserRole === "admin" || currentUserRole === "supervisor";
  const gradingTabs = [
    ...(currentUserRole === "student"
      ? []
      : [{ id: "list", label: "Danh sách" }]),
    { id: "score", label: "Chấm điểm" },
    ...(isAdminOrSupervisor
      ? [{ id: "reports", label: "Danh mục" }]
      : []),
  ];
  const shouldShowStudentSlider = currentUserRole !== "student";
  const roleDeadline =
    currentUserRole === "student"
      ? activePeriod?.sv_deadline
      : currentUserRole === "teacher"
        ? activePeriod?.gv_deadline
        : activePeriod?.admin_deadline;

  const shouldShowEvaluationProgress =
    !!activePeriod &&
    (currentUserRole !== "student" || activePeriod.status === "sv_phase");

  const handleCloseSemesterModal = async () => {
    setIsSemesterModalOpen(false);

    try {
      const periods = await evaluationPeriodApi.getEvaluationPeriods();
      setApiEvaluationPeriods(periods || []);
    } catch {
      // Do not block closing the modal if period refresh fails.
    }
  };

  // Kiểm tra quyền chấm điểm theo vai trò và trạng thái kỳ đánh giá
  const canModifyScore = (() => {
    if (isInitialLoading || isFetching) return false;

    if (!isSemesterActive) return false;

    const summaryId = studentSummaryMap[activeStudentId];
    const summary = apiSummariesPoints.find((s) => s._id === summaryId);
    const summaryStatus = summary?.status || "draft";
    if (summaryStatus === "locked") return false;

    if (!activePeriod) return isSemesterActive;

    // Nếu kỳ đánh giá đã đóng hoặc chưa mở cổng
    if (activePeriod.status === "closed" || activePeriod.status === "pending")
      return false;

    const role = currentUser?.role?.toLowerCase() || "";

    if (role.includes("admin")) {
      return true; // Admin có quyền chấm trong kỳ đánh giá
    }

    if (role.includes("teacher") || role.includes("advisor")) {
      // Cố vấn học tập chấm điểm ở giai đoạn gv_phase
      return activePeriod.status === "gv_phase";
    }

    if (role.includes("student")) {
      return activePeriod.status === "sv_phase" && summaryStatus === "draft";
    }

    return false;
  })();

  const rolePermissionLabel = canModifyScore
    ? currentUserRole === "student"
      ? "Bạn đang được phép tự chấm điểm trong giai đoạn hiện tại."
      : "Bạn đang được phép chấm điểm trong giai đoạn hiện tại."
    : currentUserRole === "student"
      ? "Hiện tại bạn chưa được phép tự chấm điểm."
      : "Hiện tại bạn chưa được phép chấm điểm.";

  // Khởi tạo dữ liệu thực tế từ các API
  useEffect(() => {
    const loadRealData = async () => {
      try {
        setIsInitialLoading(true);

        // 1. Tải danh mục, tiêu chí, học kỳ, lớp, bảng điểm và kỳ đánh giá từ backend
        const [
          backendCats,
          backendCriteria,
          backendSemesters,
          backendClasses,
          backendSummaries,
          backendPeriods,
        ] = await Promise.all([
          categoryApi.getCategories(),
          criteriaApi.getCriteria(),
          semesterApi.getSemesters(),
          classApi.getClasses(),
          summariesPointApi.getSummariesPoints(),
          evaluationPeriodApi.getEvaluationPeriods().catch(() => []),
        ]);

        setApiSemesters(backendSemesters || []);
        setApiClasses(backendClasses || []);
        setApiEvaluationPeriods(backendPeriods || []);
        const summariesData = Array.isArray(backendSummaries)
          ? backendSummaries
          : (backendSummaries as any)?.data || [];
        setApiSummariesPoints(summariesData);

        const currentUserId = currentUser?.id || currentUser?._id || "";
        const roleScopedClasses =
          currentUserRole === "teacher"
            ? (backendClasses || []).filter((cls) => {
                const advisorId = getEntityId(
                  (cls as any)?.advisor_id || cls?.user_id,
                );
                return advisorId === currentUserId;
              })
            : backendClasses || [];

        setApiClasses(roleScopedClasses);

        // Đọc học kỳ và lớp học đã áp dụng từ sessionStorage
        const savedSem =
          sessionStorage.getItem("grading_appliedSem") ||
          backendSemesters[0]?._id ||
          "";
        const savedClass = sessionStorage.getItem("grading_appliedClass") || "";
        const effectiveClassId =
          currentUserRole === "student"
            ? ""
            : currentUserRole === "teacher"
              ? roleScopedClasses.some((cls) => cls._id === savedClass)
                ? savedClass
                : roleScopedClasses[0]?._id || ""
              : savedClass;

        setSelectedSemesterId(savedSem);
        setSelectedClassId(effectiveClassId);

        // 2. Map dữ liệu Categories và Criteria
        const categoriesMapped: Category[] = (backendCats || [])
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map((cat) => {
            const criteriaForCat = (backendCriteria || [])
              .filter((cri) => {
                const catId =
                  typeof cri.category_id === "object"
                    ? cri.category_id?._id
                    : cri.category_id;
                return catId === cat._id;
              })
              .map((cri) => ({
                id: cri._id,
                name: cri.criterion_name,
                pointsPerUnit: cri.score_per_unit || 1,
                type:
                  cri.criterion_type === "ky_luat"
                    ? ("violation" as const)
                    : ("reward" as const),
                maxScore: cri.max_score || 10,
                minScore: cri.min_score || 0,
                is_locked: !!cri.is_locked,
              }));

            return {
              id: cat._id,
              code: cat.category_code,
              title: cat.category_name,
              maxPoints: cat.max_score || 20,
              items: criteriaForCat,
            };
          });

        setCategories(categoriesMapped);

        // 3. Map Students từ summariesPoint
        let filteredSummaries = (summariesData || []).filter((summary) => {
          const semId =
            typeof summary.semester_id === "object"
              ? summary.semester_id?._id
              : summary.semester_id;
          return semId === savedSem;
        });

        if (currentUserRole === "teacher") {
          const teacherClassIds = new Set(
            roleScopedClasses.map((cls) => cls._id),
          );
          filteredSummaries = filteredSummaries.filter((summary) => {
            const studentObj =
              typeof summary.student_id === "object"
                ? (summary.student_id as any)
                : null;
            const studentClassId = getEntityId(studentObj?.class_id);
            return teacherClassIds.has(studentClassId);
          });
        }

        if (effectiveClassId) {
          filteredSummaries = filteredSummaries.filter((summary) => {
            const studentObj =
              typeof summary.student_id === "object"
                ? (summary.student_id as any)
                : null;
            const studentClassId =
              studentObj?.class_id?._id || studentObj?.class_id || "";
            return studentClassId === effectiveClassId;
          });
        }

        const colors = [
          { bg: "bg-[#dbe3f1]", text: "text-[#141c26]" },
          { bg: "bg-[#96f8a1]", text: "text-[#002108]" },
          { bg: "bg-[#ffdad6]", text: "text-[#ba1a1a]" },
          { bg: "bg-[#f3e5f5]", text: "text-[#7b2cbf]" },
          { bg: "bg-[#fff4e5]", text: "text-[#b78103]" },
        ];

        // Lấy danh sách Student đầy đủ để tra cứu thông tin cá nhân
        const backendStudentsResult = await studentApi.getStudents();
        const backendStudents = Array.isArray(backendStudentsResult)
          ? backendStudentsResult
          : (backendStudentsResult as any)?.data || [];

        if (currentUserRole === "student") {
          filteredSummaries = filteredSummaries.filter((summary) => {
            const studentObj =
              typeof summary.student_id === "object"
                ? (summary.student_id as any)
                : null;
            const studentId = getSummaryStudentKey(summary);
            const dbStudent = backendStudents.find(
              (s) => s.student_code === studentId || s._id === studentId,
            );

            return matchesCurrentStudent({
              currentUser,
              studentIdParam,
              studentId,
              studentObj,
              dbStudent,
            });
          });
        }

        const mappedStudents: StudentData[] = filteredSummaries.map(
          (summary, idx) => {
            const studentObj =
              typeof summary.student_id === "object"
                ? (summary.student_id as any)
                : null;
            const studentId = getSummaryStudentKey(summary, idx);

            // Tra cứu thông tin chi tiết sinh viên từ API
            const dbStudent = backendStudents.find(
              (s) => s.student_code === studentId || s._id === studentId,
            );
            const studentName =
              dbStudent?.full_name ||
              studentObj?.full_name ||
              studentObj?.name ||
              "Chưa rõ";
            const studentClassId =
              (dbStudent?.class_id as any)?._id ||
              dbStudent?.class_id ||
              studentObj?.class_id?._id ||
              studentObj?.class_id ||
              "";

            let avatarUrl = undefined;
            if (studentId === "20216001") {
              avatarUrl =
                "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&q=80";
            } else if (studentId === "20216002") {
              avatarUrl =
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80";
            }

            return {
              id: studentId,
              name: studentName,
              email: dbStudent?.email || studentObj?.email || "",
              dob: dbStudent?.date_bir
                ? new Date(dbStudent.date_bir).toLocaleDateString("vi-VN")
                : "",
              gender:
                dbStudent?.sex === "Male"
                  ? "Nam"
                  : dbStudent?.sex === "Female"
                    ? "Nữ"
                    : "Khác",
              score: summary.total_score || 0,
              status: dbStudent?.status || studentObj?.status || "Studying",
              gradingStatus: summary.status || "draft",
              classId:
                typeof studentClassId === "object"
                  ? studentClassId?._id
                  : studentClassId,
              avatarUrl,
              colorTheme: colors[idx % colors.length],
            };
          },
        );

        setStudents(mappedStudents);

        // Tạo map studentId -> summaryPointId
        const summaryMap: Record<string, string> = {};
        filteredSummaries.forEach((summary) => {
          const studentObj =
            typeof summary.student_id === "object"
              ? (summary.student_id as any)
              : null;
          const studentId = getSummaryStudentKey(summary);
          summaryMap[studentId] = summary._id;
        });
        setStudentSummaryMap(summaryMap);

        // Thiết lập Active Student
        let targetActiveId = "";
        if (
          studentIdParam &&
          mappedStudents.some((s) => s.id === studentIdParam)
        ) {
          targetActiveId = studentIdParam;
        } else if (currentUserRole === "student" && mappedStudents.length > 0) {
          targetActiveId = mappedStudents[0].id;
        } else if (mappedStudents.length > 0) {
          targetActiveId = mappedStudents[0].id;
        }
        setActiveStudentId(targetActiveId);

        if (currentUserRole === "student" && !targetActiveId) {
          toast.error("Không thể xác định thông tin sinh viên của bạn để chấm điểm!");
        }

        // Nạp chi tiết chấm điểm rèn luyện của active student trước
        if (targetActiveId) {
          const activeSummaryId = summaryMap[targetActiveId];
          if (activeSummaryId) {
            const [details, preExistingCounts] = await Promise.all([
              evaluationDetailApi.getEvaluationDetailsBySummary(
                activeSummaryId,
              ),
              evaluationDetailApi.getPreExistingCounts(activeSummaryId),
            ]);
            const counts: Record<string, number> = {};
            const detailsMap: Record<string, any> = {};
            const activeHistory: any[] = [];

            // Ghi nhận criteria đã có evaluation_detail
            const evaluatedCriteriaIds = new Set<string>();

            (details || []).forEach((detail) => {
              const cri =
                typeof detail.criterion_id === "object"
                  ? detail.criterion_id
                  : null;
              const criId = cri?._id || detail.criterion_id;
              counts[criId] = detail.current_count || 0;
              detailsMap[criId] = detail;
              evaluatedCriteriaIds.add(criId);

              const criName = cri?.criterion_name || "Tiêu chí";
              const criType =
                cri?.criterion_type === "ky_luat" ? "violation" : "reward";
              const pointsPerUnit = cri?.score_per_unit || 1;

              (detail.log || []).forEach((log: any, index: number) => {
                const countVal =
                  log.count !== undefined
                    ? log.count
                    : Math.round((log.score_after || 0) / pointsPerUnit);
                activeHistory.push({
                  id: `${detail._id}-log-${index}`,
                  studentId: targetActiveId,
                  type: criType,
                  title: criName,
                  date: log.updated_at
                    ? new Date(log.updated_at).toLocaleDateString("vi-VN")
                    : new Date().toLocaleDateString("vi-VN"),
                  count: countVal,
                  points:
                    log.score_after !== undefined
                      ? log.score_after
                      : pointsPerUnit * countVal,
                  session: log.updated_at
                    ? new Date(log.updated_at).getHours() < 12
                      ? "Sáng"
                      : "Chiều"
                    : "Sáng",
                  role: log.role || "admin",
                  updated_by: log.updated_by,
                  status: detail.status || "draft",
                });
              });
            });

            setEvaluationDetailsMap(detailsMap);

            // Merge pre-existing counts cho tiêu chí chưa có evaluation_detail
            if (preExistingCounts) {
              setPreExistingCountsState((prev) => ({
                ...prev,
                [targetActiveId]: preExistingCounts,
              }));
              Object.entries(preExistingCounts).forEach(
                ([criId, preCountObj]) => {
                  const preCount =
                    typeof preCountObj === "object"
                      ? preCountObj.current_count
                      : preCountObj;
                  if (!evaluatedCriteriaIds.has(criId) && preCount > 0) {
                    counts[criId] = preCount;
                  }
                },
              );
            }

            setEvaluationCounts((prev) => ({
              ...prev,
              [targetActiveId]: counts,
            }));

            // Sắp xếp lịch sử mới nhất lên trước
            setHistoryRecords(activeHistory.reverse());
          }
        }
      } catch (error: any) {
        toast.error("Lỗi khi tải dữ liệu rèn luyện thực tế: " + error.message);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadRealData();
  }, [studentIdParam]);

  // Lazy-load chi tiết chấm điểm của sinh viên khi activeStudentId thay đổi
  useEffect(() => {
    setHistoryPage(1);
    const loadStudentDetails = async () => {
      if (!activeStudentId || isInitialLoading) return;

      const summaryId = studentSummaryMap[activeStudentId];
      if (!summaryId) return;

      try {
        setIsFetching(true);
        const [details, preExistingCounts] = await Promise.all([
          evaluationDetailApi.getEvaluationDetailsBySummary(summaryId),
          evaluationDetailApi.getPreExistingCounts(summaryId),
        ]);
        const counts: Record<string, number> = {};
        const detailsMap: Record<string, any> = {};
        const activeHistory: any[] = [];

        // Ghi nhận criteria đã có evaluation_detail
        const evaluatedCriteriaIds = new Set<string>();

        (details || []).forEach((detail) => {
          const cri =
            typeof detail.criterion_id === "object"
              ? detail.criterion_id
              : null;
          const criId = cri?._id || detail.criterion_id;
          counts[criId] = detail.current_count || 0;
          detailsMap[criId] = detail;
          evaluatedCriteriaIds.add(criId);

          const criName = cri?.criterion_name || "Tiêu chí";
          const criType =
            cri?.criterion_type === "ky_luat" ? "violation" : "reward";
          const pointsPerUnit = cri?.score_per_unit || 1;

          (detail.log || []).forEach((log: any, index: number) => {
            const countVal =
              log.count !== undefined
                ? log.count
                : Math.round((log.score_after || 0) / pointsPerUnit);
            activeHistory.push({
              id: `${detail._id}-log-${index}`,
              studentId: activeStudentId,
              type: criType,
              title: criName,
              date: log.updated_at
                ? new Date(log.updated_at).toLocaleDateString("vi-VN")
                : new Date().toLocaleDateString("vi-VN"),
              count: countVal,
              points:
                log.score_after !== undefined
                  ? log.score_after
                  : pointsPerUnit * countVal,
              session: log.updated_at
                ? new Date(log.updated_at).getHours() < 12
                  ? "Sáng"
                  : "Chiều"
                : "Sáng",
              role: log.role || "admin",
              updated_by: log.updated_by,
              status: detail.status || "draft",
            });
          });
        });

        setEvaluationDetailsMap(detailsMap);

        // Merge pre-existing counts cho tiêu chí chưa có evaluation_detail
        if (preExistingCounts) {
          setPreExistingCountsState((prev) => ({
            ...prev,
            [activeStudentId]: preExistingCounts,
          }));
          Object.entries(preExistingCounts).forEach(([criId, preCountObj]) => {
            const preCount =
              typeof preCountObj === "object"
                ? preCountObj.current_count
                : preCountObj;
            if (!evaluatedCriteriaIds.has(criId) && preCount > 0) {
              counts[criId] = preCount;
            }
          });
        }

        setEvaluationCounts((prev) => ({
          ...prev,
          [activeStudentId]: counts,
        }));

        setHistoryRecords(activeHistory.reverse());
      } catch (error: any) {
        toast.error(
          "Không thể tải chi tiết chấm điểm của sinh viên này: " +
            error.message,
        );
      } finally {
        setIsFetching(false);
      }
    };

    loadStudentDetails();
  }, [activeStudentId, studentSummaryMap, categories, isInitialLoading]);

  // Tự động cuộn slider ngang đến vị trí sinh viên đang được active
  useEffect(() => {
    if (!activeStudentId || students.length === 0 || !sliderRef.current) return;

    // Sử dụng setTimeout nhẹ để đảm bảo DOM đã render xong các thẻ sinh viên
    const timer = setTimeout(() => {
      const slider = sliderRef.current;
      const card = document.getElementById(`student-card-${activeStudentId}`);
      if (slider && card) {
        const offsetLeft = card.offsetLeft;
        const cardWidth = card.clientWidth;
        const sliderWidth = slider.clientWidth;

        // Căn giữa thẻ sinh viên đang active trong lòng slider ngang
        slider.scrollTo({
          left: offsetLeft - sliderWidth / 2 + cardWidth / 2,
          behavior: "smooth",
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeStudentId, students]);

  // Sinh viên đang active
  const activeStudent = students.find((s) => s.id === activeStudentId);

  const shouldShowActiveStudentRankCard = isStudentRole(currentUser) || isAdminRole(currentUser);


  // Lấy chữ viết tắt tên sinh viên (ví dụ: Lê Công Thành -> LC)
  const getInitials = (name: string) => {
    if (!name) return "SV";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      const first = parts[parts.length - 2].charAt(0).toUpperCase();
      const last = parts[parts.length - 1].charAt(0).toUpperCase();
      return `${first}${last}`;
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Nút slider di chuyển
  const scrollSlider = (direction: "left" | "right") => {
    if (sliderRef.current) {
      const scrollAmount = 300;
      sliderRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Hàm thay đổi số lượng chấm của tiêu chí
  const handleCountChange = (criteriaId: string, delta: number) => {
    if (!activeStudentId) return;

    const summaryId = studentSummaryMap[activeStudentId];
    if (taskId && summaryId) {
      markStarted(summaryId, { studentId: activeStudentId }).catch((err) => {
        toast.warning("Không thể tự động đồng bộ trạng thái nhiệm vụ sang 'Đang làm'!");
        console.warn("Failed to sync task in_progress status:", err);
      });
    }

    // Lấy min count từ pre-existing records (không cho giảm dưới giá trị gốc)
    const studentPreCounts = preExistingCountsState[activeStudentId] || {};
    const minCount = studentPreCounts[criteriaId]?.original_count || 0;

    setEvaluationCounts((prev) => {
      const studentCounts = prev[activeStudentId]
        ? { ...prev[activeStudentId] }
        : {};
      const currentCount = studentCounts[criteriaId] || 0;
      const newCount = Math.max(minCount, currentCount + delta); // không giảm dưới giá trị gốc

      const updatedCounts = {
        ...prev,
        [activeStudentId]: {
          ...studentCounts,
          [criteriaId]: newCount,
        },
      };

      // Tự động tính toán lại điểm số realtime của sinh viên này
      calculateRealtimeScore(activeStudentId, updatedCounts[activeStudentId]);

      return updatedCounts;
    });
  };

  // Hàm gán trực tiếp số lượng chấm của tiêu chí (dùng cho thanh trượt Slider)
  const handleCountSet = (criteriaId: string, value: number) => {
    if (!activeStudentId) return;

    const summaryId = studentSummaryMap[activeStudentId];
    if (taskId && summaryId) {
      markStarted(summaryId, { studentId: activeStudentId }).catch((err) => {
        toast.warning("Không thể tự động đồng bộ trạng thái nhiệm vụ sang 'Đang làm'!");
        console.warn("Failed to sync task in_progress status:", err);
      });
    }

    const studentPreCounts = preExistingCountsState[activeStudentId] || {};
    const minCount = studentPreCounts[criteriaId]?.original_count || 0;

    setEvaluationCounts((prev) => {
      const studentCounts = prev[activeStudentId]
        ? { ...prev[activeStudentId] }
        : {};
      const newCount = Math.max(minCount, value); // không giảm dưới giá trị gốc

      const updatedCounts = {
        ...prev,
        [activeStudentId]: {
          ...studentCounts,
          [criteriaId]: newCount,
        },
      };

      // Tự động tính toán lại điểm số realtime của sinh viên này
      calculateRealtimeScore(activeStudentId, updatedCounts[activeStudentId]);

      return updatedCounts;
    });
  };

  // Tính điểm thời gian thực dựa trên các lần thực hiện tiêu chí
  const calculateRealtimeScore = (
    studentId: string,
    studentCounts: Record<string, number>,
  ) => {
    let finalScore = 0; // Thay đổi bắt đầu từ 0đ thực tế

    categories.forEach((cat) => {
      let catScore = 0;
      cat.items.forEach((cri) => {
        const count = studentCounts[cri.id] || 0;
        catScore += calculateCriterionScore(cri, count);
      });

      const clampedCatScore = Math.max(0, Math.min(cat.maxPoints, catScore));
      finalScore += clampedCatScore;
    });

    const clampedFinalScore = Math.max(0, Math.min(100, finalScore));

    setStudents((prev) =>
      prev.map((std) =>
        std.id === studentId ? { ...std, score: clampedFinalScore } : std,
      ),
    );
  };

  // Hàm đặt lại điểm số
  const handleReset = () => {
    if (!activeStudentId || !activeStudent) return;
    if (!canModifyScore) {
      toast.error("Không có quyền sửa đổi điểm rèn luyện trong giai đoạn này!");
      return;
    }

    // Chỉ đặt lại các tiêu chí không bị khóa, giữ nguyên các tiêu chí bị khóa (is_locked)
    const currentCounts = evaluationCounts[activeStudentId] || {};
    const newCounts: Record<string, number> = {};

    categories.forEach((cat) => {
      cat.items.forEach((cri) => {
        if (cri.is_locked) {
          // Giữ nguyên giá trị của tiêu chí bị khóa
          if (currentCounts[cri.id] !== undefined) {
            newCounts[cri.id] = currentCounts[cri.id];
          }
        } else {
          // Lấy lại giá trị pre-existing nếu có, nếu không thì = 0 (tránh xoá record ghi nhận hàng ngày)
          const studentPreCounts =
            preExistingCountsState[activeStudentId] || {};
          if (studentPreCounts[cri.id]) {
            newCounts[cri.id] = studentPreCounts[cri.id].current_count;
          }
        }
      });
    });

    setEvaluationCounts((prev) => ({
      ...prev,
      [activeStudentId]: newCounts,
    }));

    // Tính toán lại điểm số dựa trên các tiêu chí được giữ lại (tiêu chí bị khóa)
    calculateRealtimeScore(activeStudentId, newCounts);

    toast.success(
      `Đã đặt lại các tiêu chí được phép sửa đổi của sinh viên ${activeStudent.name}!`,
    );
  };

  // Hàm Lưu thay đổi thực tế đồng bộ database qua API
  const handleSave = async () => {
    if (!activeStudent || isFetching) return;
    if (!canModifyScore) {
      toast.error("Không có quyền sửa đổi điểm rèn luyện trong giai đoạn này!");
      return;
    }

    const summaryId = studentSummaryMap[activeStudentId];
    if (!summaryId) {
      toast.error(
        "Không tìm thấy bảng điểm rèn luyện của sinh viên này trong học kỳ!",
      );
      return;
    }

    try {
      setIsFetching(true);
      toast.loading("Đang lưu kết quả chấm điểm...", { id: "save-loading" });

      // Lấy thông tin user hiện tại và ánh xạ sang role
      const currentUser = tokenStorage.getUser();
      let userRole: "student" | "teacher" | "supervisor" | "admin" = "student";
      if (currentUser?.role) {
        const r = currentUser.role.toLowerCase();
        if (r.includes("admin")) {
          userRole = "admin";
        } else if (r.includes("teacher") || r.includes("advisor")) {
          userRole = "teacher";
        } else if (r.includes("supervisor") || r.includes("quản sinh")) {
          userRole = "supervisor";
        }
      }

      // Mặc định khi thực hiện Lưu thay đổi status trong EvaluationDetail là bản nháp ('draft') kể cả Admin
      const detailStatus = "draft";

      // 1. Tải các chi tiết cũ của summaryId này
      const oldDetails =
        await evaluationDetailApi.getEvaluationDetailsBySummary(summaryId);

      // 2. Tạo hoặc cập nhật các chi tiết chấm điểm
      const counts = evaluationCounts[activeStudentId] || {};
      const promises: Promise<any>[] = [];

      categories.forEach((cat) => {
        cat.items.forEach((cri) => {
          const count = counts[cri.id] || 0;
          // Tìm xem tiêu chí này đã có EvaluationDetail cũ chưa
          const existingDetail = (oldDetails || []).find((d) => {
            const detailCriId =
              typeof d.criterion_id === "object"
                ? d.criterion_id?._id
                : d.criterion_id;
            return detailCriId === cri.id;
          });

          if (existingDetail) {
            // Nếu số lần khác nhau (có thay đổi)
            if (existingDetail.current_count !== count) {
              // Tính điểm tương ứng dựa trên count và pointsPerUnit
              let calculatedScore = count * cri.pointsPerUnit;
              if (cri.pointsPerUnit >= 0) {
                calculatedScore = Math.max(
                  cri.minScore || 0,
                  Math.min(cri.maxScore || 10, calculatedScore),
                );
              } else {
                calculatedScore = Math.max(
                  -(cri.maxScore || 10),
                  Math.min(cri.minScore || 0, calculatedScore),
                );
              }

              const updatedHistory = [...(existingDetail.log || [])];
              updatedHistory.push({
                from_status: existingDetail.status || "draft",
                to_status: detailStatus,
                score_before: existingDetail.system_score || 0,
                score_after: calculatedScore,
                count,
                updated_by: currentUser?.id,
                reason: "Cập nhật điểm rèn luyện",
              });

              // Lọc sạch lịch sử để khớp chính xác DTO ở Backend
              const cleanLog = updatedHistory.map((log: any) => ({
                from_status: log.from_status || "draft",
                to_status: log.to_status || "draft",
                score_before:
                  log.score_before !== undefined ? log.score_before : 0,
                score_after:
                  log.score_after !== undefined ? log.score_after : 0,
                count:
                  log.count !== undefined
                    ? log.count
                    : Math.round((log.score_after || 0) / cri.pointsPerUnit),
                updated_by:
                  typeof log.updated_by === "object"
                    ? log.updated_by?._id
                    : log.updated_by,
                reason: log.reason || "Cập nhật điểm rèn luyện",
              }));

              const scorePayload: any = {};
              if (userRole === "student") {
                scorePayload.sv_score = calculatedScore;
                scorePayload.sv_submitted_at = new Date();
              } else if (userRole === "teacher" || userRole === "supervisor") {
                scorePayload.gv_score = calculatedScore;
                scorePayload.gv_reviewed_at = new Date();
                scorePayload.gv_reviewed_by = currentUser?.id;
              } else if (userRole === "admin") {
                scorePayload.gv_score = calculatedScore;
                scorePayload.gv_reviewed_at = new Date();
                scorePayload.gv_reviewed_by = currentUser?.id;
              }

              promises.push(
                evaluationDetailApi.updateEvaluationDetail(existingDetail._id, {
                  current_count: count,
                  log: cleanLog,
                  status: detailStatus,
                  ...scorePayload,
                }),
              );
            }
          } else {
            // Nếu chưa có và count > 0, ta tiến hành tạo mới
            if (count > 0) {
              let calculatedScore = count * cri.pointsPerUnit;
              if (cri.pointsPerUnit >= 0) {
                calculatedScore = Math.max(
                  cri.minScore || 0,
                  Math.min(cri.maxScore || 10, calculatedScore),
                );
              } else {
                calculatedScore = Math.max(
                  -(cri.maxScore || 10),
                  Math.min(cri.minScore || 0, calculatedScore),
                );
              }

              const scorePayload: any = {};
              if (userRole === "student") {
                scorePayload.sv_score = calculatedScore;
                scorePayload.sv_submitted_at = new Date();
              } else if (userRole === "teacher" || userRole === "supervisor") {
                scorePayload.gv_score = calculatedScore;
                scorePayload.gv_reviewed_at = new Date();
                scorePayload.gv_reviewed_by = currentUser?.id;
              } else if (userRole === "admin") {
                scorePayload.gv_score = calculatedScore;
                scorePayload.gv_reviewed_at = new Date();
                scorePayload.gv_reviewed_by = currentUser?.id;
              }

              promises.push(
                evaluationDetailApi.createEvaluationDetail({
                  summary_id: summaryId,
                  criterion_id: cri.id,
                  current_count: count,
                  log: [
                    {
                      from_status: "draft",
                      to_status: detailStatus,
                      score_before: 0,
                      score_after: calculatedScore,
                      count,
                      updated_by: currentUser?.id,
                      reason: "Khởi tạo điểm rèn luyện",
                    },
                  ],
                  status: detailStatus,
                  ...scorePayload,
                }),
              );
            }
          }
        });
      });

      await Promise.all(promises);

      const [freshDetails, freshPreExistingCounts] = await Promise.all([
        evaluationDetailApi.getEvaluationDetailsBySummary(summaryId),
        evaluationDetailApi.getPreExistingCounts(summaryId),
      ]);

      const freshCounts: Record<string, number> = {};
      const freshDetailsMap: Record<string, any> = {};
      const freshHistory: HistoryRecord[] = [];

      (freshDetails || []).forEach((detail) => {
        const cri =
          typeof detail.criterion_id === "object" ? detail.criterion_id : null;
        const criId = cri?._id || detail.criterion_id;
        const criterion = categories
          .flatMap((cat) => cat.items)
          .find((item) => item.id === criId);
        const pointsPerUnit =
          cri?.score_per_unit || criterion?.pointsPerUnit || 1;
        const criName = cri?.criterion_name || criterion?.name || "Tiêu chí";
        const criType =
          cri?.criterion_type === "ky_luat" || criterion?.type === "violation"
            ? "violation"
            : "reward";

        freshCounts[criId] = detail.current_count || 0;
        freshDetailsMap[criId] = detail;

        (detail.log || []).forEach((log: any, index: number) => {
          const countVal =
            log.count !== undefined
              ? log.count
              : Math.round((log.score_after || 0) / pointsPerUnit);
          freshHistory.push({
            id: `${detail._id}-log-${index}`,
            studentId: activeStudentId,
            type: criType,
            title: criName,
            date: log.updated_at
              ? new Date(log.updated_at).toLocaleDateString("vi-VN")
              : new Date().toLocaleDateString("vi-VN"),
            count: countVal,
            points:
              log.score_after !== undefined
                ? log.score_after
                : pointsPerUnit * countVal,
            session: log.updated_at
              ? new Date(log.updated_at).getHours() < 12
                ? "Sáng"
                : "Chiều"
              : "Sáng",
            role: log.role || userRole,
            updated_by: log.updated_by,
            status: detail.status || "draft",
          });
        });
      });

      setEvaluationCounts((prev) => ({
        ...prev,
        [activeStudentId]: freshCounts,
      }));
      setEvaluationDetailsMap(freshDetailsMap);
      setPreExistingCountsState((prev) => ({
        ...prev,
        [activeStudentId]: freshPreExistingCounts || {},
      }));
      setHistoryRecords((prev) => [
        ...freshHistory,
        ...prev.filter((record) => record.studentId !== activeStudentId),
      ]);

      let finalScore = 0;
      categories.forEach((cat) => {
        let catScore = 0;
        cat.items.forEach((cri) => {
          catScore += calculateCriterionScore(cri, freshCounts[cri.id] || 0);
        });
        finalScore += Math.max(0, Math.min(cat.maxPoints, catScore));
      });
      const clampedFinalScore = Math.max(0, Math.min(100, finalScore));

      setStudents((prev) =>
        prev.map((std) =>
          std.id === activeStudentId
            ? { ...std, score: clampedFinalScore }
            : std,
        ),
      );

      // 3. Cập nhật lại tổng điểm rèn luyện trong summariesPoint theo dữ liệu backend đã chấp nhận
      const summaryPayload: any = {
        total_score: clampedFinalScore,
      };
      if (clampedFinalScore === 0) {
        summaryPayload.grading = "CHƯA XẾP LOẠI";
      }
      await summariesPointApi.updateSummariesPoint(summaryId, summaryPayload);

      toast.dismiss("save-loading");
      toast.success(
        `Đã lưu thành công điểm rèn luyện ${clampedFinalScore}/100đ cho sinh viên ${activeStudent.name}!`,
      );

      if (taskId) {
        await syncLinkedTaskCompleted(summaryId);
      }
    } catch (error: any) {
      toast.dismiss("save-loading");
      toast.error("Lỗi khi lưu kết quả chấm điểm: " + error.message);
    } finally {
      setIsFetching(false);
    }
  };

  // Hàm xóa một bản ghi lịch sử rèn luyện và cập nhật database/realtime score
  const handleDeleteHistoryRecord = async () => {
    if (!recordToDelete) return;

    try {
      setIsFetching(true);
      toast.loading("Đang xóa lịch sử chấm điểm...", { id: "delete-loading" });

      // Trích xuất detailId và logIndex
      const parts = recordToDelete.id.split("-log-");
      const detailId = parts[0];
      const logIndex = parseInt(parts[1], 10);

      // 1. Tải chi tiết EvaluationDetail từ API
      const detail = await evaluationDetailApi.getEvaluationDetail(detailId);
      if (!detail) {
        throw new Error("Không tìm thấy chi tiết chấm điểm tương ứng");
      }

      // 2. Xóa log tại logIndex khỏi mảng history/log
      const updatedHistory = [...(detail.log || [])];
      updatedHistory.splice(logIndex, 1);

      // 3. Tính toán lại số lần hiện tại (current_count)
      const lastLog =
        updatedHistory.length > 0
          ? updatedHistory[updatedHistory.length - 1]
          : null;
      let newCount = 0;
      if (lastLog) {
        if (lastLog.count !== undefined) {
          newCount = lastLog.count;
        } else {
          const cri =
            typeof detail.criterion_id === "object"
              ? detail.criterion_id
              : null;
          const pointsPerUnit = cri?.score_per_unit || 1;
          newCount = Math.round((lastLog.score_after || 0) / pointsPerUnit);
        }
      }

      // 4. Lọc sạch mảng lịch sử trước khi gửi lên API
      const cleanLog = updatedHistory.map((log: any) => ({
        from_status: log.from_status || "draft",
        to_status: log.to_status || "draft",
        score_before: log.score_before !== undefined ? log.score_before : 0,
        score_after: log.score_after !== undefined ? log.score_after : 0,
        count: log.count !== undefined ? log.count : undefined,
        updated_by:
          typeof log.updated_by === "object"
            ? log.updated_by?._id
            : log.updated_by,
        reason: log.reason || "Xóa lịch sử chấm điểm",
      }));

      // 5. Cập nhật detail lên Backend (hoặc xóa detail nếu history trống và current_count = 0)
      if (cleanLog.length === 0) {
        await evaluationDetailApi.deleteEvaluationDetail(detail._id);
      } else {
        await evaluationDetailApi.updateEvaluationDetail(detail._id, {
          current_count: newCount,
          log: cleanLog,
          status: "draft", // Chuyển về bản nháp sau khi xóa log cũ
        });
      }

      const summaryId = studentSummaryMap[activeStudentId];
      const [freshDetails, freshPreExistingCounts] = summaryId
        ? await Promise.all([
            evaluationDetailApi.getEvaluationDetailsBySummary(summaryId),
            evaluationDetailApi.getPreExistingCounts(summaryId),
          ])
        : [[], {}];

      const freshCounts: Record<string, number> = {};
      const freshDetailsMap: Record<string, any> = {};
      const freshHistory: HistoryRecord[] = [];

      (freshDetails || []).forEach((freshDetail) => {
        const cri =
          typeof freshDetail.criterion_id === "object"
            ? freshDetail.criterion_id
            : null;
        const criId = cri?._id || freshDetail.criterion_id;
        const criterion = categories
          .flatMap((cat) => cat.items)
          .find((item) => item.id === criId);
        const pointsPerUnit =
          cri?.score_per_unit || criterion?.pointsPerUnit || 1;
        const criName = cri?.criterion_name || criterion?.name || "Tiêu chí";
        const criType =
          cri?.criterion_type === "ky_luat" || criterion?.type === "violation"
            ? "violation"
            : "reward";

        freshCounts[criId] = freshDetail.current_count || 0;
        freshDetailsMap[criId] = freshDetail;

        (freshDetail.log || []).forEach((log: any, index: number) => {
          const countVal =
            log.count !== undefined
              ? log.count
              : Math.round((log.score_after || 0) / pointsPerUnit);
          freshHistory.push({
            id: `${freshDetail._id}-log-${index}`,
            studentId: activeStudentId,
            type: criType,
            title: criName,
            date: log.updated_at
              ? new Date(log.updated_at).toLocaleDateString("vi-VN")
              : new Date().toLocaleDateString("vi-VN"),
            count: countVal,
            points:
              log.score_after !== undefined
                ? log.score_after
                : pointsPerUnit * countVal,
            session: log.updated_at
              ? new Date(log.updated_at).getHours() < 12
                ? "Sáng"
                : "Chiều"
              : "Sáng",
            role: log.role || "student",
            updated_by: log.updated_by,
            status: freshDetail.status || "draft",
          });
        });
      });

      setEvaluationCounts((prev) => ({
        ...prev,
        [activeStudentId]: freshCounts,
      }));
      setEvaluationDetailsMap(freshDetailsMap);
      setPreExistingCountsState((prev) => ({
        ...prev,
        [activeStudentId]: freshPreExistingCounts || {},
      }));
      setHistoryRecords((prev) => [
        ...freshHistory,
        ...prev.filter((record) => record.studentId !== activeStudentId),
      ]);

      let finalScore = 0;
      categories.forEach((cat) => {
        let catScore = 0;
        cat.items.forEach((cri) => {
          catScore += calculateCriterionScore(cri, freshCounts[cri.id] || 0);
        });
        finalScore += Math.max(0, Math.min(cat.maxPoints, catScore));
      });

      const clampedFinalScore = Math.max(0, Math.min(100, finalScore));

      // Cập nhật state học sinh
      setStudents((prev) =>
        prev.map((std) =>
          std.id === activeStudentId
            ? { ...std, score: clampedFinalScore }
            : std,
        ),
      );

      if (summaryId) {
        const deletePayload: any = {
          total_score: clampedFinalScore,
        };
        if (clampedFinalScore === 0) {
          deletePayload.grading = "CHƯA XẾP LOẠI";
        }
        await summariesPointApi.updateSummariesPoint(summaryId, deletePayload);
      }

      toast.dismiss("delete-loading");
      toast.success("Đã xóa lịch sử ghi nhận điểm rèn luyện thành công!");
    } catch (error: any) {
      toast.dismiss("delete-loading");
      toast.error("Lỗi khi xóa lịch sử: " + error.message);
    } finally {
      setIsConfirmDeleteOpen(false);
      setRecordToDelete(null);
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
      <div className="flex h-screen bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header />

          <TabNavigation
            tabs={gradingTabs}
            activeTab={"score"}
            onTabChange={(id) => {
              if (id === "list") {
                router.push("/grading");
              } else if (id === "reports") {
                router.push("/grading/categories");
              }
            }}
          />

          <main
            ref={mainRef}
            onScroll={handleScroll}
            className="flex-1 p-6 md:px-8 flex flex-col gap-6 w-full overflow-y-auto custom-scrollbar"
          >
            {/* Banner cảnh báo học kỳ đã đóng (Chế độ chỉ xem) - Glassmorphic Pill */}
            {!isSemesterActive && !isInitialLoading && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-500/10 backdrop-blur-md border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4 shrink-0 shadow-sm"
              >
                <div className="bg-amber-500/20 text-amber-700 p-2.5 rounded-xl shrink-0">
                  <Eye size={18} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-amber-900 text-[14px]">
                    Hệ thống chấm điểm chưa được mở
                  </h4>
                  <p className="text-amber-700/90 text-[12.5px] mt-0.5 font-medium leading-relaxed">
                    Bạn hiện chỉ có quyền **xem chi tiết** điểm số rèn luyện
                    trong học kỳ này. Mọi thao tác chấm điểm hoặc thay đổi đã bị
                    vô hiệu hóa.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ================= EVALUATION PERIOD STEPPER ================= */}
            {!isInitialLoading &&
              (activePeriod ? (
                shouldShowEvaluationProgress ? (
                  <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl p-6 shadow-sm shadow-slate-300/40 shrink-0 flex flex-col gap-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/50 pb-4">
                    <div>
                      <h3 className="font-sans font-bold text-[#1E293B] text-[15px] flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#1A73E8] animate-pulse" />
                        Tiến trình kỳ đánh giá rèn luyện
                      </h3>
                      <p className="text-[#64748B] text-[12.5px] mt-0.5">
                        Học kỳ:{" "}
                        <span className="font-semibold text-[#1E293B]">
                          {currentSemester?.semester_name || "Chưa rõ"}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-[#64748B] font-medium">
                        Giai đoạn hiện tại:
                      </span>
                      <span
                        className={`px-3.5 py-1 rounded-xl text-[11px] font-bold border uppercase tracking-wider ${
                          activePeriod.status === "sv_phase"
                            ? "bg-blue-500/10 text-[#1A73E8] border-blue-500/20"
                            : activePeriod.status === "gv_phase"
                              ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                              : activePeriod.status === "admin_phase"
                                ? "bg-purple-500/10 text-purple-700 border-purple-500/20"
                                : activePeriod.status === "closed"
                                  ? "bg-rose-500/10 text-rose-700 border-rose-500/20"
                                  : "bg-slate-500/10 text-[#64748B] border-slate-500/20"
                        }`}
                      >
                        {activePeriod.status === "sv_phase"
                          ? "Sinh viên tự chấm"
                          : activePeriod.status === "gv_phase"
                            ? "Cố vấn đánh giá"
                            : activePeriod.status === "admin_phase"
                              ? "Hội đồng phê duyệt"
                              : activePeriod.status === "closed"
                                ? "Đã đóng"
                                : "Chưa bắt đầu"}
                      </span>
                      {isAdminOrSupervisor && (
                        <button
                          type="button"
                          onClick={() => setIsSemesterModalOpen(true)}
                          className="w-9 h-9 rounded-xl bg-white/50 hover:bg-[#1A73E8] text-[#64748B] hover:text-white border border-slate-200/70 shadow-sm flex items-center justify-center transition-all cursor-pointer active:scale-95"
                          title="Cấu hình nhanh học kỳ"
                          aria-label="Cấu hình nhanh học kỳ"
                        >
                          <Settings size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stepper Steps */}
                  {isAdminOrSupervisor ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative mt-2">
                      {/* Step 1: SV Phase */}
                      <div className="flex flex-col gap-2 relative">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-[13px] border-2 transition-all ${
                              activePeriod.status === "sv_phase"
                                ? "bg-[#1A73E8] text-white border-[#1A73E8] ring-4 ring-blue-100 animate-pulse"
                                : [
                                      "gv_phase",
                                      "admin_phase",
                                      "closed",
                                    ].includes(activePeriod.status)
                                  ? "bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/10"
                                  : "bg-white text-slate-400 border-slate-200"
                            }`}
                          >
                            {["gv_phase", "admin_phase", "closed"].includes(
                              activePeriod.status,
                            ) ? (
                              <Check size={14} strokeWidth={3} />
                            ) : (
                              "1"
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span
                              className={`text-[13.5px] font-bold ${
                                activePeriod.status === "sv_phase"
                                  ? "text-[#1A73E8]"
                                  : [
                                        "gv_phase",
                                        "admin_phase",
                                        "closed",
                                      ].includes(activePeriod.status)
                                    ? "text-emerald-600"
                                    : "text-[#64748B]"
                              }`}
                            >
                              Sinh viên tự chấm
                            </span>
                            <span className="text-[11px] text-[#64748B] font-medium mt-0.5">
                              Hạn: {formatDate(activePeriod.sv_deadline)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Step 2: GV Phase */}
                      <div className="flex flex-col gap-2 relative">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-[13px] border-2 transition-all ${
                              activePeriod.status === "gv_phase"
                                ? "bg-amber-500 text-white border-amber-500 ring-4 ring-amber-100 animate-pulse"
                                : ["admin_phase", "closed"].includes(
                                      activePeriod.status,
                                    )
                                  ? "bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/10"
                                  : "bg-white text-slate-400 border-slate-200"
                            }`}
                          >
                            {["admin_phase", "closed"].includes(
                              activePeriod.status,
                            ) ? (
                              <Check size={14} strokeWidth={3} />
                            ) : (
                              "2"
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span
                              className={`text-[13.5px] font-bold ${
                                activePeriod.status === "gv_phase"
                                  ? "text-amber-600 font-extrabold"
                                  : ["admin_phase", "closed"].includes(
                                        activePeriod.status,
                                      )
                                    ? "text-emerald-600"
                                    : "text-[#64748B]"
                              }`}
                            >
                              Cố vấn đánh giá
                            </span>
                            <span className="text-[11px] text-[#64748B] font-medium mt-0.5">
                              Hạn: {formatDate(activePeriod.gv_deadline)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Step 3: Admin Phase */}
                      <div className="flex flex-col gap-2 relative">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-[13px] border-2 transition-all ${
                              activePeriod.status === "admin_phase"
                                ? "bg-purple-600 text-white border-purple-600 ring-4 ring-purple-100 animate-pulse"
                                : ["closed"].includes(activePeriod.status)
                                  ? "bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/10"
                                  : "bg-white text-slate-400 border-slate-200"
                            }`}
                          >
                            {["closed"].includes(activePeriod.status) ? (
                              <Check size={14} strokeWidth={3} />
                            ) : (
                              "3"
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span
                              className={`text-[13.5px] font-bold ${
                                activePeriod.status === "admin_phase"
                                  ? "text-purple-600 font-extrabold"
                                  : ["closed"].includes(activePeriod.status)
                                    ? "text-emerald-600"
                                    : "text-[#64748B]"
                              }`}
                            >
                              P.HSSV phê duyệt
                            </span>
                            <span className="text-[11px] text-[#64748B] font-medium mt-0.5">
                              Hạn: {formatDate(activePeriod.admin_deadline)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Step 4: Closed */}
                      <div className="flex flex-col gap-2 relative">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-[13px] border-2 transition-all ${
                              activePeriod.status === "closed"
                                ? "bg-rose-600 text-white border-rose-600 ring-4 ring-rose-100 shadow-sm"
                                : "bg-white text-slate-400 border-slate-200"
                            }`}
                          >
                            {activePeriod.status === "closed" ? (
                              <Check size={14} strokeWidth={3} />
                            ) : (
                              "4"
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span
                              className={`text-[13.5px] font-bold ${
                                activePeriod.status === "closed"
                                  ? "text-rose-600 font-extrabold"
                                  : "text-[#64748B]"
                              }`}
                            >
                              Khóa điểm
                            </span>
                            <span className="text-[11px] text-[#64748B] font-medium mt-0.5">
                              Đóng cổng đánh giá
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="rounded-2xl border border-white/70 bg-white/55 px-4 py-4 shadow-sm">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                          Thời hạn của bạn
                        </span>
                        <p className="mt-2 text-[16px] font-bold text-[#1E293B]">
                          {formatDate(roleDeadline)}
                        </p>
                        <p className="mt-1 text-[12px] font-medium text-[#64748B]">
                          {currentUserRole === "student"
                            ? "Bạn tự chấm trong giai đoạn sinh viên."
                            : "Bạn chấm điểm trong giai đoạn cố vấn đánh giá."}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white/55 px-4 py-4 shadow-sm">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                          Quyền thao tác
                        </span>
                        <p
                          className={`mt-2 text-[16px] font-bold ${
                            canModifyScore
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }`}
                        >
                          {canModifyScore
                            ? "Được phép chấm điểm"
                            : "Chưa được phép chấm điểm"}
                        </p>
                        <p className="mt-1 text-[12px] font-medium text-[#64748B]">
                          {rolePermissionLabel}
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
                ) : null
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl p-5 shadow-sm shadow-slate-300/40 shrink-0 flex items-center gap-3"
                >
                  <div className="p-2 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-xl shrink-0">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1E293B] text-[14px]">
                      Chưa cấu hình kỳ đánh giá
                    </h4>
                    <p className="text-[#64748B] text-[12px] mt-0.5">
                      Học kỳ hiện tại chưa được thiết lập các giai đoạn và thời
                      hạn chấm điểm cụ thể.
                    </p>
                  </div>
                  {isAdminOrSupervisor && (
                    <button
                      type="button"
                      onClick={() => setIsSemesterModalOpen(true)}
                      className="ml-auto w-9 h-9 rounded-xl bg-white/50 hover:bg-[#1A73E8] text-[#64748B] hover:text-white border border-slate-200/70 shadow-sm flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
                      title="Cấu hình nhanh học kỳ"
                      aria-label="Cấu hình nhanh học kỳ"
                    >
                      <Settings size={16} />
                    </button>
                  )}
                </motion.div>
              ))}

            {/* ================= STUDENT HERO SLIDER ================= */}
            {shouldShowStudentSlider && (
              <div className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl p-5 shadow-sm shadow-slate-300/40 shrink-0 flex flex-col gap-4 relative overflow-hidden">
                <div className="flex items-center justify-between w-full">
                  <h3 className="font-sans font-bold text-[#64748B] text-[11px] tracking-[1px] uppercase">
                    Sinh viên đang chấm điểm
                  </h3>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => scrollSlider("left")}
                      className="w-8 h-8 rounded-xl bg-white/50 backdrop-blur-sm border border-white/80 flex items-center justify-center text-[#64748B] hover:bg-white/90 active:scale-95 transition-all cursor-pointer shadow-sm hover:scale-[1.05]"
                      title="Trượt sang trái"
                    >
                      <ChevronLeft size={16} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => scrollSlider("right")}
                      className="w-8 h-8 rounded-xl bg-white/50 backdrop-blur-sm border border-white/80 flex items-center justify-center text-[#64748B] hover:bg-white/90 active:scale-95 transition-all cursor-pointer shadow-sm hover:scale-[1.05]"
                      title="Trượt sang phải"
                    >
                      <ChevronRight size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                <div
                  ref={sliderRef}
                  onMouseDown={handleSliderMouseDown}
                  onMouseUp={handleSliderMouseUpOrLeave}
                  onMouseLeave={handleSliderMouseUpOrLeave}
                  onMouseMove={handleSliderMouseMove}
                  className="flex gap-4 overflow-x-auto pl-1 pr-10 py-2.5 custom-scrollbar scroll-smooth cursor-grab select-none"
                >
                  {isInitialLoading
                    ? Array.from({ length: 4 }).map((_, idx) => (
                        <div
                          key={`skel-hero-${idx}`}
                          className="w-[256px] h-[83px] bg-white/50 backdrop-blur-sm rounded-2xl border border-white/60 p-3.5 flex items-center gap-3 animate-pulse shrink-0"
                        >
                          <Skeleton className="w-12 h-12 rounded-full bg-slate-100 shrink-0 animate-pulse" />
                          <div className="flex-1 flex flex-col gap-1.5">
                            <Skeleton className="h-4 w-3/4 bg-slate-100 rounded" />
                            <Skeleton className="h-3.5 w-1/2 bg-slate-100 rounded" />
                          </div>
                        </div>
                      ))
                    : students.map((student, idx) => {
                        const isActive = student.id === activeStudentId;
                        const initials = getInitials(student.name);

                        return (
                          <motion.div
                            key={student.id || `student-card-${idx}`}
                            id={`student-card-${student.id}`}
                            layout="position"
                            onClick={() => setActiveStudentId(student.id)}
                            className={`relative bg-white/55 backdrop-blur-sm border-2 rounded-2xl p-[13px] w-[256px] flex gap-[12px] items-center shrink-0 cursor-pointer transition-all duration-200 select-none shadow-sm ${
                              isActive
                                ? "border-[#1A73E8] bg-white/80 shadow-[0px_4px_16px_rgba(26,115,232,0.08)] scale-[1.015]"
                                : "border-white hover:border-slate-300/40 hover:scale-[1.01]"
                            }`}
                          >
                            {/* Avatar container */}
                            <div className="relative shrink-0 w-12 h-12 rounded-full">
                              {student.avatarUrl ? (
                                <div className="absolute inset-0 rounded-full overflow-hidden border border-white/80 ring-2 ring-white">
                                  <img
                                    alt={student.name}
                                    className="object-cover w-full h-full"
                                    src={student.avatarUrl}
                                  />
                                </div>
                              ) : (
                                <div
                                  className={`absolute inset-0 rounded-full flex items-center justify-center font-bold text-[15px] border border-white/80 ring-2 ring-white ${student.colorTheme?.bg} ${student.colorTheme?.text}`}
                                >
                                  {initials}
                                </div>
                              )}

                              {/* Active Badge Checkmark */}
                              {isActive && (
                                <div className="absolute -bottom-1 -right-1 bg-[#1A73E8] text-white border-2 border-white rounded-lg w-5 h-5 flex items-center justify-center shadow-md">
                                  <Check size={11} strokeWidth={3} />
                                </div>
                              )}
                            </div>

                            {/* Student Info & Realtime Progress */}
                            <div className="flex-1 min-w-0 flex flex-col">
                              <h4
                                className="font-bold text-[#1E293B] text-[14.5px] truncate"
                                title={student.name}
                              >
                                {student.name}
                              </h4>
                              <span className="text-[#64748B] text-[11px] font-medium mt-0.5">
                                MSSV: {student.id}
                              </span>

                              {/* Realtime progress bar */}
                              <div className="flex gap-2.5 items-center mt-1.5">
                                <div className="bg-[#EBF2FA] flex-1 h-[5px] rounded-lg overflow-hidden border border-white/20">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${student.score}%` }}
                                    transition={{
                                      type: "spring",
                                      stiffness: 80,
                                      damping: 15,
                                    }}
                                    className="bg-[#1A73E8] h-full rounded-lg"
                                  />
                                </div>
                                <span className="font-bold text-[#1A73E8] text-[9.5px] tracking-wide shrink-0">
                                  {student.score}/100
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                </div>
              </div>
            )}

            {/* ================= ACTIVE STUDENT RANK CARD ================= */}
            {shouldShowActiveStudentRankCard && activeStudent && (
              <ActiveStudentRankCard activeStudent={activeStudent} />
            )}

            {/* ================= NAVIGATION TABS (Danh mục / Lịch sử) ================= */}
            <div className="flex w-full sm:w-auto bg-white/40 backdrop-blur-md border border-white/70 rounded-xl p-1.5 gap-2 self-stretch sm:self-start shrink-0 shadow-sm">
              <button
                onClick={() => setSubTab("category")}
                className={`flex-1 sm:flex-none text-center px-6 py-2.5 font-bold text-[13.5px] transition-all rounded-lg cursor-pointer relative whitespace-nowrap ${
                  subTab === "category"
                    ? "bg-white text-[#1A73E8] shadow-sm shadow-blue-900/5"
                    : "text-[#64748B] hover:text-[#1E293B]"
                }`}
              >
                <span className="hidden sm:inline">Danh mục tiêu chí</span>
                <span className="inline sm:hidden">Danh mục</span>
              </button>
              <button
                onClick={() => setSubTab("history")}
                className={`flex-1 sm:flex-none text-center px-6 py-2.5 font-bold text-[13.5px] transition-all rounded-lg cursor-pointer relative whitespace-nowrap ${
                  subTab === "history"
                    ? "bg-white text-[#1A73E8] shadow-sm shadow-blue-900/5"
                    : "text-[#64748B] hover:text-[#1E293B]"
                }`}
              >
                <span className="hidden sm:inline">Lịch sử ghi nhận</span>
                <span className="inline sm:hidden">Lịch sử</span>
              </button>
            </div>

            {/* ================= TAB CONTENTS ================= */}
            <div className="flex-1 flex flex-col gap-5 min-h-0 shrink-0">
              {/* ───── TAB 1: DANH MỤC (Criteria Evaluation) ───── */}
              {subTab === "category" && activeStudent && (
                <div className="flex flex-col gap-5">
                  {categories.map((category) => {
                    const studentCounts =
                      evaluationCounts[activeStudentId] || {};

                    // Tính toán tổng điểm danh mục rèn luyện realtime
                    let catScore = 0;
                    category.items.forEach((cri) => {
                      const count = studentCounts[cri.id] || 0;
                      const maxScore = (cri as any).maxScore || 10;
                      const minScore = (cri as any).minScore || 0;
                      const criterionScore =
                        cri.pointsPerUnit >= 0
                          ? Math.max(
                              minScore,
                              Math.min(maxScore, count * cri.pointsPerUnit),
                            )
                          : Math.max(
                              -maxScore,
                              Math.min(0, count * cri.pointsPerUnit),
                            );
                      catScore += criterionScore;
                    });
                    const clampedCatScore = Math.max(
                      0,
                      Math.min(category.maxPoints, catScore),
                    );

                    // Xác định màu sắc badge dựa trên tỷ lệ điểm
                    const ratio = clampedCatScore / category.maxPoints;
                    let badgeStyle =
                      "bg-slate-500/10 text-[#64748B] border-slate-500/10"; // mặc định xám
                    if (ratio >= 0.8) {
                      badgeStyle =
                        "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"; // xanh lá
                    } else if (ratio >= 0.5) {
                      badgeStyle =
                        "bg-blue-500/10 text-[#1A73E8] border-blue-500/20"; // xanh dương
                    }

                    return (
                      <motion.div
                        key={category.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl overflow-hidden shadow-sm shadow-slate-300/40 flex flex-col w-full hover:scale-[1.002] transition-all duration-300"
                      >
                        {/* Category Header */}
                        <div className="bg-white/40 flex items-center justify-between p-5 w-full select-none border-b border-white/40 gap-3">
                          <h4 className="font-bold text-[#1E293B] text-[15px] tracking-wide flex items-center gap-2 min-w-0 flex-1">
                            {category.code && (
                              <span className="text-[#1A73E8] font-mono text-[12px] bg-[#1A73E8]/10 border border-[#1A73E8]/15 px-2.5 py-1 rounded-xl font-bold shrink-0">
                                {category.code}
                              </span>
                            )}
                            <span className="truncate" title={category.title}>{category.title}</span>
                            {category.title.length > 35 && <CriteriaTooltip content={category.title} />}
                          </h4>
                          <div
                            className={`px-4.5 py-1.5 border rounded-xl font-bold text-[12.5px] tracking-wide shrink-0 transition-colors duration-300 ${badgeStyle}`}
                          >
                            {clampedCatScore} / {category.maxPoints}đ
                          </div>
                        </div>

                        {/* Criteria List Rows */}
                <div className="flex flex-col w-full gap-3 p-4 bg-white/10">
                          {category.items.map((item) => {
                            const count = studentCounts[item.id] || 0;
                            const hasViolation = item.type === "violation";
                            const detail = evaluationDetailsMap[item.id];
                            const isApproved = detail?.status === "locked";
                            const hasTeacherReviewed = Boolean(
                              detail?.gv_reviewed_at ||
                                detail?.gv_reviewed_by ||
                                detail?.status === "gv_reviewed" ||
                                detail?.status === "locked",
                            );
                            const criterionScore = calculateCriterionScore(
                              item,
                              count,
                            );
                            const achievedPoints = criterionScore;

                            const studentPreCounts =
                              preExistingCountsState[activeStudentId] || {};
                            const minCount =
                              studentPreCounts[item.id]?.original_count || 0;
                            const maxScore = item.maxScore ?? 10;
                            const pointsPerUnit = Math.abs(item.pointsPerUnit || 1);
                            const maxCount = Math.max(minCount, Math.ceil(maxScore / pointsPerUnit));
                            const sliderMax = Math.max(maxCount, count);
                            const numbers = [];
                            for (let i = minCount; i <= sliderMax; i++) {
                              numbers.push(i);
                            }

                            return (
                              <div
                                key={item.id}
                                className={`flex flex-col md:flex-row md:items-center justify-between gap-3.5 md:gap-4 p-4.5 md:p-5 w-full rounded-2xl border transition-all duration-200 ${
                                  hasViolation
                                    ? "bg-rose-500/5 hover:bg-rose-500/10 border-rose-200/45 shadow-none hover:shadow-[0_4px_12px_rgba(244,63,94,0.03)]"
                                    : "bg-[#1A73E8]/5 hover:bg-[#1A73E8]/10 border-blue-200/45 shadow-none hover:shadow-[0_4px_12px_rgba(26,115,232,0.03)]"
                                }`}
                              >
                                {/* Left Column: Title, Badges (Desktop & Mobile) */}
                                <div className="flex-1 min-w-0 flex flex-col gap-2">
                                  <div className="flex items-start justify-between gap-3 md:block">
                                    <h5 className="font-bold text-[#1E293B] text-[14px] leading-relaxed break-words flex items-center flex-wrap gap-1 flex-1">
                                      <span className={item.name.length > 35 ? "line-clamp-2 overflow-hidden text-ellipsis" : ""}>{item.name}</span>
                                      {item.name.length > 35 && <CriteriaTooltip content={item.name} />}
                                    </h5>
                                    
                                    {/* Mobile-only Realtime Points Display on the right of title */}
                                    <div className="flex flex-col items-end shrink-0 md:hidden">
                                      <span className={`font-bold text-[16px] ${hasViolation ? "text-rose-600" : "text-emerald-600"}`}>
                                        {formatScoreLabel(achievedPoints)}
                                      </span>
                                      {item.maxScore !== undefined && (
                                        <span className="text-[8.5px] text-[#64748B] font-bold">
                                          Tối đa {item.maxScore}đ
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Scores Badges + Đơn giá */}
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    {/* Sinh viên */}
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-[#1A73E8] text-[10px] font-bold border border-blue-100/40">
                                      <span className="opacity-70">SV:</span>
                                      <span>
                                        {formatScoreLabel(detail?.sv_score)}
                                      </span>
                                    </div>

                                    {/* Giảng viên / Cố vấn */}
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100/40">
                                      <span className="opacity-70">GV:</span>
                                      <span>
                                        {formatScoreLabel(
                                          hasTeacherReviewed
                                            ? detail?.gv_score
                                            : null,
                                        )}
                                      </span>
                                    </div>

                                    {isApproved && (
                                      <div
                                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200/70 shadow-sm"
                                        title="Điểm đạt được sau khi supervisor/admin duyệt và chốt"
                                      >
                                        <span className="opacity-70">Đạt:</span>
                                        <span>
                                          {formatScoreLabel(criterionScore)}
                                        </span>
                                      </div>
                                    )}

                                  </div>
                                </div>

                                {/* Right Column: Counter Control & Desktop Realtime Points */}
                                <div className="flex flex-col md:flex-row md:items-center justify-end gap-3 md:gap-6 shrink-0 pt-2 md:pt-0 border-t border-slate-100/80 md:border-t-0 mt-1 md:mt-0 w-full md:w-auto">
                                  {/* Cupertino Horizontal Wheel Picker & Points Per Unit underneath */}
                                  <div className="flex flex-col items-end w-full md:w-auto mt-1 md:mt-0 gap-1 shrink-0">
                                    <div
                                      className={`bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-xl py-1 px-2 flex gap-2 items-center shadow-sm ${item.is_locked || !canModifyScore ? "opacity-60 bg-slate-100/50" : ""}`}
                                    >
                                      {/* Nút giảm */}
                                      <button
                                        onClick={() =>
                                          !item.is_locked &&
                                          canModifyScore &&
                                          handleCountChange(item.id, -1)
                                        }
                                        disabled={
                                          count <= minCount ||
                                          item.is_locked ||
                                          !canModifyScore
                                        }
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                          count <= minCount ||
                                          item.is_locked ||
                                          !canModifyScore
                                            ? "opacity-30 cursor-not-allowed text-slate-400"
                                            : "cursor-pointer " +
                                              (hasViolation
                                                ? "text-rose-600 hover:bg-rose-50"
                                                : "text-[#1A73E8] hover:bg-blue-50")
                                        }`}
                                        title={
                                          !canModifyScore
                                            ? "Không có quyền sửa đổi trong giai đoạn này"
                                            : item.is_locked
                                              ? "Tiêu chí đã bị khóa"
                                              : "Giảm số lần"
                                        }
                                      >
                                        <Minus size={11} strokeWidth={3} />
                                      </button>

                                      <CupertinoHorizontalPicker
                                        count={count}
                                        minCount={minCount}
                                        maxCount={sliderMax}
                                        onChange={(val) => handleCountSet(item.id, val)}
                                        isLocked={item.is_locked || false}
                                        canModifyScore={canModifyScore}
                                        hasViolation={hasViolation}
                                      />

                                      {/* Nút tăng */}
                                      <button
                                        onClick={() =>
                                          !item.is_locked &&
                                          canModifyScore &&
                                          handleCountChange(item.id, 1)
                                        }
                                        disabled={
                                          count >= sliderMax ||
                                          item.is_locked ||
                                          !canModifyScore
                                        }
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                          count >= sliderMax ||
                                          item.is_locked ||
                                          !canModifyScore
                                            ? "opacity-30 cursor-not-allowed text-slate-400"
                                            : "cursor-pointer " +
                                              (hasViolation
                                                ? "text-rose-600 hover:bg-rose-50"
                                                : "text-[#1A73E8] hover:bg-blue-50")
                                        }`}
                                        title={
                                          !canModifyScore
                                            ? "Không có quyền sửa đổi trong giai đoạn này"
                                            : item.is_locked
                                              ? "Tiêu chí đã bị khóa"
                                              : "Tăng số lần"
                                        }
                                      >
                                        <Plus size={11} strokeWidth={3} />
                                      </button>
                                    </div>

                                    {/* Đơn giá nằm dưới Picker */}
                                    <span className="text-[#64748B] text-[10px] font-bold tracking-wide pr-3 select-none">
                                      {item.pointsPerUnit > 0 ? "+" : ""}{item.pointsPerUnit}đ/lần
                                    </span>
                                  </div>

                                  {/* Desktop-only Realtime Points Display */}
                                  <div className="hidden md:flex flex-col items-end min-w-[75px] shrink-0 justify-center">
                                    <span
                                      className={`font-bold text-[16px] ${
                                        hasViolation
                                          ? "text-rose-600"
                                          : "text-emerald-600"
                                      }`}
                                    >
                                      {formatScoreLabel(achievedPoints)}
                                    </span>
                                    <span className="text-[9.5px] text-[#64748B] font-bold mt-0.5">
                                      {isApproved
                                        ? "Điểm đã chốt"
                                        : "Điểm mục này"}
                                    </span>
                                    {item.maxScore !== undefined && (
                                      <span className="text-[9.5px] text-[#64748B] bg-white/70 border border-white/80 px-2 py-0.5 rounded-xl font-bold mt-1 text-right shrink-0">
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

                  {/* Nút lưu & đặt lại ở dưới cùng - Pill Shaped */}
                  {canModifyScore && (
                    <div className="flex items-center justify-end gap-3.5 pt-4 pb-12 w-full">
                      <Button
                        onClick={handleReset}
                        variant="outline"
                        className="bg-white/60 backdrop-blur-sm border border-white/80 hover:bg-white/90 text-[#1E293B] font-bold text-[14px] px-7 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer h-[42px] hover:scale-[1.02] shadow-sm"
                        title="Đặt lại các tiêu chí"
                      >
                        <RotateCcw size={15} strokeWidth={2.5} />
                        <span>Đặt lại</span>
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={isFetching}
                        className="bg-[#1A73E8] hover:bg-[#155cc4] text-white font-bold text-[14px] px-8 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-[0_4px_12px_rgba(26,115,232,0.15)] active:scale-95 cursor-pointer h-[42px] disabled:opacity-80 disabled:cursor-not-allowed hover:scale-[1.02]"
                        title="Lưu điểm rèn luyện"
                      >
                        {isFetching ? (
                          <svg
                            className="animate-spin h-4 w-4 text-white shrink-0"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                        ) : (
                          <Save size={15} strokeWidth={2.5} />
                        )}
                        <span>
                          {isFetching ? "Đang lưu..." : "Lưu thay đổi"}
                        </span>
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* ───── TAB 2: LỊCH SỬ GHI NHẬN (History Log) ───── */}
              {subTab === "history" &&
                activeStudent &&
                (() => {
                  const records = historyRecords.filter(
                    (r) => r.studentId === activeStudentId,
                  );
                  const historyPageSize = 15;
                  const paginatedRecords = records.slice(
                    (historyPage - 1) * historyPageSize,
                    historyPage * historyPageSize,
                  );
                  const totalPages = Math.ceil(
                    records.length / historyPageSize,
                  );

                  return (
                    <div className="flex flex-col gap-4">
                      {records.length === 0 ? (
                        <div className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl py-20 flex flex-col items-center justify-center text-center p-8 gap-3 shadow-sm shadow-slate-300/40">
                          <div className="p-4 bg-white/70 border border-white/80 rounded-2xl text-slate-300 shadow-sm">
                            <History size={36} strokeWidth={1.5} />
                          </div>
                          <h4 className="font-bold text-[#1E293B] text-[15px]">
                            Chưa có lịch sử chấm điểm
                          </h4>
                          <p className="text-[#64748B] text-[12.5px] max-w-[260px] font-medium leading-relaxed">
                            Thực hiện tăng giảm điểm rèn luyện ở tab Danh mục và
                            bấm Lưu để ghi nhận lịch sử.
                          </p>
                        </div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col min-h-0 w-full gap-5"
                        >
                          <div
                            className={`flex flex-col gap-4 px-1 pt-4 pb-8 w-full ${
                              records.length > 6
                                ? "max-h-[640px] overflow-y-auto custom-scrollbar"
                                : ""
                            }`}
                          >
                            {paginatedRecords.map((rec, index) => (
                              <HistoryCard
                                key={rec.id}
                                rec={rec}
                                index={index}
                                total={paginatedRecords.length}
                                onDelete={() => {
                                  setRecordToDelete(rec);
                                  setIsConfirmDeleteOpen(true);
                                }}
                              />
                            ))}
                          </div>

                          {/* Render Pagination ở dưới cùng danh sách lịch sử */}
                          {records.length > 0 && (
                            <div className="bg-white/45 backdrop-blur-sm border border-white/70 rounded-2xl p-3 shadow-sm shadow-slate-300/10">
                              <CustomPagination
                                currentPage={historyPage}
                                totalItems={records.length}
                                pageSize={historyPageSize}
                                onPageChange={(page) => {
                                  setIsHistoryFetching(true);
                                  setTimeout(() => {
                                    setHistoryPage(page);
                                    setIsHistoryFetching(false);
                                  }, 400);
                                }}
                                label="lịch sử"
                                isLoading={isHistoryFetching}
                              />
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  );
                })()}
            </div>
          </main>

          {/* Modal xác nhận xóa lịch sử */}
          <AnimatePresence>
            {isConfirmDeleteOpen && recordToDelete && (
              <div className="fixed inset-0 bg-[#1E293B]/40 backdrop-blur-[4px] z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white/90 backdrop-blur-md rounded-2xl border border-white/70 shadow-2xl p-6 max-w-md w-full flex flex-col gap-4 font-sans"
                >
                  <div className="flex gap-4 items-start">
                    <div className="p-3 bg-rose-500/10 text-rose-600 rounded-xl shrink-0">
                      <AlertTriangle size={24} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-bold text-[#1E293B] text-[17px]">
                        Xác nhận xóa lịch sử?
                      </h3>
                      <p className="text-[#64748B] text-[13.5px] leading-relaxed">
                        Bạn có chắc chắn muốn xóa lịch sử ghi nhận tiêu chí{" "}
                        <span className="font-semibold text-[#1E293B]">
                          "{recordToDelete.title}"
                        </span>
                        ? Điểm số thời gian thực và tổng điểm rèn luyện của sinh
                        viên sẽ tự động được cập nhật lại tương ứng.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/60">
                    <button
                      onClick={() => {
                        setIsConfirmDeleteOpen(false);
                        setRecordToDelete(null);
                      }}
                      className="px-5 py-2 border border-slate-200 text-[#64748B] hover:bg-slate-50 rounded-xl font-bold text-[13px] transition-colors cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      onClick={handleDeleteHistoryRecord}
                      className="px-6 py-2 bg-rose-600 text-white rounded-xl font-bold text-[13px] hover:bg-rose-700 transition-colors shadow-sm cursor-pointer flex items-center gap-1.5 hover:scale-[1.02]"
                    >
                      <Trash2 size={13} />
                      <span>Xác nhận xóa</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <SemesterModal
        isOpen={isSemesterModalOpen}
        onClose={handleCloseSemesterModal}
        apiSemesters={apiSemesters}
        onRefreshSemesters={(updatedSemesters) =>
          setApiSemesters(updatedSemesters || [])
        }
        selectedSemester={selectedSemesterId}
        setSelectedSemester={setSelectedSemesterId}
      />

      {/* Button Cuộn lên đầu trang (Scroll to Top) - Pill Styled */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.1, translateY: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToTop}
            className="fixed bottom-20 md:bottom-8 right-8 z-50 bg-[#1A73E8] text-white p-3.5 rounded-xl shadow-[0px_4px_20px_rgba(26,115,232,0.35)] hover:bg-[#155cc4] transition-all cursor-pointer border border-white/20 flex items-center justify-center"
            title="Cuộn lên đầu trang"
          >
            <ArrowUp size={22} strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

// Component wrapper để kiểm tra quyền truy cập hoặc bypass khi có taskId hợp lệ.
function GradingScoreWithGuard() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("taskId");

  const [isValidating, setIsValidating] = useState(!!taskId);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setValidationError(null);
      setIsValidating(false);
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    let isMounted = true;
    const validateTaskAccess = async () => {
      try {
        const result = await studentTaskApi.checkTaskAccess(taskId);
        
        if (!result || !result.allowed) {
          throw new Error("Nhiệm vụ không thuộc quyền quản lý của bạn hoặc tiến độ đã bị hủy áp dụng");
        }

        if (result.mode !== "auto" || normalizeLinkedPath(result.linkedPage) !== "/grading/score") {
          throw new Error("Nhiệm vụ này không liên kết với trang chấm điểm tự động");
        }

        if (isMounted) {
          setIsValidating(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setValidationError(err.message || "Bạn không có quyền truy cập nhiệm vụ này");
          setIsValidating(false);
        }
      }
    };

    validateTaskAccess();
    return () => {
      isMounted = false;
    };
  }, [taskId]);

  if (taskId) {
    if (isValidating) {
      return (
        <div className="flex h-screen bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] font-sans items-center justify-center">
          <div className="text-center flex flex-col items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-xl animate-bounce bg-slate-100/50" />
            <div className="font-bold text-slate-500 text-[14px]">
              Đang xác thực thông tin nhiệm vụ...
            </div>
          </div>
        </div>
      );
    }

    if (validationError) {
      return (
        <div className="flex h-screen bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] font-sans items-center justify-center p-4">
          <div className="bg-white/90 backdrop-blur-md p-8 rounded-2xl border border-white/70 max-w-md w-full text-center shadow-lg flex flex-col items-center gap-4">
            <div className="p-4 bg-rose-500/10 text-rose-600 rounded-xl">
              <AlertTriangle size={32} />
            </div>
            <h3 className="font-bold text-slate-800 text-[17px]">
              Truy cập bị từ chối
            </h3>
            <p className="text-slate-500 text-[13.5px] leading-relaxed">
              {validationError}
            </p>
            <Button
              onClick={() => window.location.href = "/students/tasks"}
              className="mt-2 w-full rounded-xl bg-[#1A73E8] hover:bg-[#155cc4] text-white font-bold"
            >
              Quay lại danh sách nhiệm vụ
            </Button>
          </div>
        </div>
      );
    }

    return <GradingScoreContent />;
  }

  return (
    <RouteGuard requiredPermission="GRADING_PAGE">
      <GradingScoreContent />
    </RouteGuard>
  );
}

// Bọc component trong Suspense và RouteGuard để bảo vệ quyền truy cập và tránh lỗi static generation.
export default function ProtectedGradingScorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] font-sans items-center justify-center">
          <div className="text-center flex flex-col items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-xl animate-bounce bg-slate-100/50" />
            <div className="font-bold text-slate-500 text-[14px]">
              Đang tải giao diện chấm điểm...
            </div>
          </div>
        </div>
      }
    >
      <GradingScoreWithGuard />
    </Suspense>
  );
}
