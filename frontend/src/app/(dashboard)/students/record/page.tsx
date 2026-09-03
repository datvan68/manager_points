"use client";
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  Suspense,
} from "react";
import {
  Search,
  Plus,
  Calendar as CalendarIcon,
  Settings,
  MoreHorizontal,
  X,
  Edit,
  Trash2,
  ChevronUp,
  ChevronDown,
  CheckSquare,
  Check,
  Eye,
  Users,
  AlertCircle,
  Loader2,
  Copy,
  FileSpreadsheet,
  RotateCcw,
  ArrowLeft,
  Award,
  PlusCircle,
  ShieldAlert,
} from "lucide-react";

import { CustomPagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Research } from "@/components/ui/Research";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CustomCalendar } from "@/components/calendar/CustomCalendar";
import { format } from "date-fns";
import AddRecordView from "@/components/grading/AddRecordView";
import ImportStudentRecordPopup from '@/components/popups/ImportStudentRecordPopup';
import ImportClassRecordPopup from '@/components/popups/ImportClassRecordPopup';
import AddClassReportView from "@/components/grading/AddClassReportView";
import {
  dailyClassReportApi,
  DailyClassReport,
} from "@/api/daily-class-report-api";
import { classApi, Class } from "@/api/class-api";
import {
  academicRecordApi,
  AcademicRecord,
  BulkDeleteAcademicRecordsResult,
  AcademicRecordDeletePreviewResult,
} from "@/api/academic-record-api";
import { criteriaApi, Criterion } from "@/api/criteria-api";
import { semesterApi } from "@/api/semester-api";
import { RouteGuard, usePermission } from "@/components/guards/RouteGuard";
import { useRouter, useSearchParams } from "next/navigation";
import TabNavigation from "@/components/ui/TabNavigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FloatingActionBar from "@/components/ui/FloatingActionBar";
import ConfirmModal from "@/components/modals/ConfirmModal";
import { useAuth } from "@/providers/auth-provider";
import { HeaderCustomMappings } from "@/providers/header-provider";
import { useGradingRealtime } from "@/hooks/useGradingRealtime";

interface GhiNhanTabProps {
  activeSubTab: "class" | "student";
  setActiveSubTab: (tab: "class" | "student") => void;
}

const NEW_BADGE_WINDOW_MS = 6 * 60 * 60 * 1000;

interface MappedAcademicRecord {
  id: string;
  selectionId: string;
  isGrouped: boolean;
  studentId: string;
  fullName: string;
  className: string;
  recordType: "Khen thưởng" | "Kỷ luật" | "Cộng điểm";
  recordTypes: AcademicRecordType[];
  criteria: string;
  date: string;
  points: string;
  totalPoints: number;
  recordTypeCounts: Record<AcademicRecordType, number>;
  original: AcademicRecord;
  recordCount: number;
  studentObjectId: string;
}

type AcademicRecordType = "khen_thuong" | "cong_diem" | "ky_luat";

const academicRecordTypeLabels: Record<AcademicRecordType, string> = {
  khen_thuong: "Khen thưởng",
  cong_diem: "Cộng điểm",
  ky_luat: "Kỷ luật",
};

const getAcademicRecordTypeLabel = (type: AcademicRecordType) =>
  academicRecordTypeLabels[type];

/** Display class codes without the academic-year suffix. */
const getDisplayClassName = (className?: string) =>
  String(className || "N/A").replace(/\s*\(\d{4}\s*-\s*\d{4}\)\s*$/, "").trim();

const formatSignedPoints = (points: number) =>
  `${points > 0 ? "+" : ""}${points}`;

const RecordTypeIcons = ({ types }: { types: AcademicRecordType[] }) => (
  <span className="inline-flex items-center gap-1" aria-label="Loại ghi nhận">
    {types.map((type) => {
      const Icon =
          type === "khen_thuong"
            ? Award
            : type === "ky_luat"
              ? ShieldAlert
              : PlusCircle;
      const colorClass =
        type === "khen_thuong"
          ? "text-emerald-600"
          : type === "ky_luat"
            ? "text-rose-600"
            : "text-blue-600";
      const label = getAcademicRecordTypeLabel(type);

      return (
        <span key={type} title={label}>
          <Icon
            className={`h-4 w-4 ${colorClass}`}
            aria-label={label}
            role="img"
          />
        </span>
      );
    })}
  </span>
);

const recordTypeOrder: AcademicRecordType[] = [
  "khen_thuong",
  "cong_diem",
  "ky_luat",
];

const RecordTypeCounts = ({
  counts,
  total,
  className = "",
}: {
  counts: Record<AcademicRecordType, number>;
  total: number;
  className?: string;
}) => (
  <div
    aria-label="Số lượng ghi nhận theo loại"
    className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-slate-500 ${className}`}
  >
    <span className="font-bold text-slate-700">Tổng: {total}</span>
    {recordTypeOrder.map((type) => (
      <span key={type}>
        {getAcademicRecordTypeLabel(type)}: {counts[type]}
      </span>
    ))}
  </div>
);

const DrawerTypeFilterButton = ({
  type,
  count,
  active,
  loading,
  onClick,
}: {
  type: "Khen thưởng" | "Cộng điểm" | "Kỷ luật";
  count: number;
  active: boolean;
  loading: boolean;
  onClick: () => void;
}) => {
  const styles = type === "Khen thưởng"
    ? { text: "text-emerald-600", light: "bg-emerald-50/50", active: "bg-emerald-100", border: "border-emerald-100", activeBorder: "border-emerald-300", ring: "focus-visible:ring-emerald-500", hover: "hover:bg-emerald-100/70", skeleton: "bg-emerald-200/60", number: "text-emerald-600", suffix: "text-emerald-500" }
    : type === "Kỷ luật"
      ? { text: "text-rose-600", light: "bg-rose-50/50", active: "bg-rose-100", border: "border-rose-100", activeBorder: "border-rose-300", ring: "focus-visible:ring-rose-500", hover: "hover:bg-rose-100/70", skeleton: "bg-rose-200/60", number: "text-rose-600", suffix: "text-rose-500" }
      : { text: "text-blue-600", light: "bg-blue-50/50", active: "bg-blue-100", border: "border-blue-100", activeBorder: "border-blue-300", ring: "focus-visible:ring-blue-500", hover: "hover:bg-blue-100/70", skeleton: "bg-blue-200/60", number: "text-blue-600", suffix: "text-blue-500" };
  return (
    <button
      type="button"
      aria-label={`Lọc ${type}`}
      aria-pressed={active}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`rounded-xl border p-3 flex flex-col items-center justify-center text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 ${styles.ring} ${active ? `${styles.active} ${styles.activeBorder} shadow-sm` : `${styles.light} ${styles.border} ${styles.hover}`}`}
    >
      <span className={`text-[9px] font-bold ${styles.text} uppercase tracking-wider mb-1`}>{type}</span>
      <div className="flex items-baseline gap-0.5 min-h-[24px] justify-center items-center">
        {loading ? <Skeleton className={`w-10 h-5 rounded ${styles.skeleton} animate-pulse`} /> : <><span className={`text-xl font-black ${styles.number} leading-none`}>{count}</span><span className={`text-[10px] font-semibold ${styles.suffix} ml-0.5`}>lần</span></>}
      </div>
    </button>
  );
};

type AcademicRecordListItem = AcademicRecord & {
  latestRecord?: AcademicRecord;
  recordCount?: number;
  studentId?: string;
  recordTypeCounts?: Partial<Record<AcademicRecordType, number>>;
  recordTypes?: AcademicRecordType[];
  totalPoints?: number;
};

const MemoizedAcademicRecordTableCells = React.memo(function AcademicRecordTableCells({
  record,
  selected,
  isStudent,
  canDelete,
  onToggle,
}: {
  record: MappedAcademicRecord;
  selected: boolean;
  isStudent: boolean;
  canDelete: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <>
      {!isStudent && (
        <td className="px-5 py-4 w-12 text-center">
          {canDelete && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(record.selectionId)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          )}
        </td>
      )}
      <td className="px-5 py-4 text-sm font-medium text-[#64748B]">
        {record.studentId}
      </td>
      <td className="px-5 py-4 text-sm font-bold text-[#1E293B]">
        <div className="flex items-center gap-2">
          <span>{record.fullName}</span>
          {isNewWithinWindow(record.original?.createdAt) && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-xl text-[9px] font-bold bg-blue-50 text-[#1A73E8] border border-blue-100 uppercase tracking-wider animate-pulse">
              New
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-4 text-sm font-semibold text-[#64748B]">
        {record.className}
      </td>
      <td className="px-5 py-4">
        <RecordTypeIcons types={record.recordTypes} />
      </td>
      <td className="px-5 py-4 text-sm text-slate-700 max-w-[260px]">
        <div className="font-bold truncate" title={record.criteria || "Chưa có"}>
          {record.criteria || "Chưa có"}
        </div>
        <div className="text-xs font-medium text-[#64748B] mt-1">
          Ngày: {record.date}
        </div>
      </td>
      <td className="px-5 py-4 text-sm font-semibold text-[#64748B]">
        {record.recordCount} lần
      </td>
      <td className="px-5 py-4">
        <span
          className={`text-sm font-bold ${record.totalPoints < 0 ? "text-rose-500" : "text-emerald-500"}`}
        >
          {record.points}
        </span>
      </td>
    </>
  );
}, (previous, next) =>
  previous.record === next.record &&
  previous.selected === next.selected &&
  previous.isStudent === next.isStudent &&
  previous.canDelete === next.canDelete &&
  previous.onToggle === next.onToggle
);

const MemoizedDeletedAcademicRecordRow = React.memo(function DeletedAcademicRecordRow({
  record,
  onRestore,
  onForceDelete,
}: {
  record: AcademicRecord;
  onRestore: (id: string) => void;
  onForceDelete: (id: string) => void;
}) {
  const stdName =
    typeof record.student_id === "object" ? record.student_id?.full_name : "N/A";
  const stdCode =
    typeof record.student_id === "object" ? record.student_id?.student_code : "";

  return (
    <tr className="hover:bg-white/60 transition-colors">
      <td className="p-3">
        <div className="font-bold text-[#1E293B]">{stdName}</div>
        <div className="text-[10px] text-[#64748B] font-medium mt-0.5">{stdCode}</div>
      </td>
      <td
        className="p-3 text-[#1E293B] max-w-[240px] truncate"
        title={record.record_title}
      >
        {record.record_title}
      </td>
      <td
        className={`p-3 text-center font-bold ${record.points_effect < 0 ? "text-rose-500" : "text-emerald-500"}`}
      >
        {record.points_effect > 0 ? `+${record.points_effect}` : record.points_effect}
      </td>
      <td className="p-3">
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onRestore(record._id)}
            aria-label={`Khôi phục ${stdName}`}
            className="p-1.5 bg-blue-50/50 text-[#1A73E8] border border-blue-500/10 hover:bg-blue-100/50 rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer"
            title="Khôi phục"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onForceDelete(record._id)}
            aria-label={`Xóa vĩnh viễn ${stdName}`}
            className="p-1.5 bg-rose-50/50 text-rose-600 border border-rose-500/10 hover:bg-rose-100/50 rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer"
            title="Xóa vĩnh viễn"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
});

const getCreatedTime = (value?: string) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getRecordSortTime = (record: any) => {
  return getCreatedTime(record?.createdAt) || getCreatedTime(record?.updatedAt) || getCreatedTime(record?.recorded_at) || 0;
};

const getClassReportSortTime = (report: any) => {
  return getCreatedTime(report?.createdAt) || getCreatedTime(report?.updatedAt) || getCreatedTime(report?.report_date) || 0;
};

const isNewWithinWindow = (createdAt?: string) =>
  getCreatedTime(createdAt) > 0 &&
  Date.now() - getCreatedTime(createdAt) <= NEW_BADGE_WINDOW_MS;

const getClassReportCreatorName = (report: DailyClassReport) => {
  const creator = report.reported_by;
  const userName =
    typeof creator === "object" && typeof creator.user_name === "string"
      ? creator.user_name.trim()
      : "";
  return userName || "Không xác định";
};

function GhiNhanTab({ activeSubTab, setActiveSubTab }: GhiNhanTabProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const taskId = searchParams.get("taskId");
  const userRole = String(user?.role || '').toLowerCase();
  const isStudent = userRole.includes('student') || userRole.includes('học sinh') || userRole.includes('sinh viên');

  const ghiNhanAccess = usePermission({
    viewStudentRecord: "READ_STUDENT_RECORD",
    createStudentRecord: "CREATE_STUDENT_RECORD",
    editStudentRecord: "UPDATE_STUDENT_RECORD",
    deleteStudentRecord: "DELETE_STUDENT_RECORD",

    viewClassRecord: "READ_CLASS_RECORD",
    createClassRecord: "CREATE_CLASS_RECORD",
    editClassRecord: "UPDATE_CLASS_RECORD",
    deleteClassRecord: "DELETE_CLASS_RECORD",

    configRecord: "CONFIG_RECORD"
  });

  const currentUserId = String(user?.id || "");

  const getCreatorRoleKey = (record: AcademicRecord) => {
    const recordedBy =
      record.recorded_by && typeof record.recorded_by === "object"
        ? (record.recorded_by as any)
        : null;
    const rawRole =
      recordedBy?.role && typeof recordedBy.role === "object"
        ? recordedBy.role.name
        : recordedBy?.role;
    const normalizedRole = String(rawRole || "").toLowerCase();

    if (normalizedRole.includes("admin")) return "admin";
    if (
      normalizedRole.includes("supervisor") ||
      normalizedRole.includes("quản sinh") ||
      normalizedRole.includes("quan sinh")
    ) {
      return "supervisor";
    }
    if (
      normalizedRole.includes("teacher") ||
      normalizedRole.includes("advisor") ||
      normalizedRole.includes("giảng viên") ||
      normalizedRole.includes("giang vien")
    ) {
      return "teacher";
    }

    return "student";
  };

  const getEntityId = (value: any) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    return String(value._id || value.id || "");
  };

  const getClassReportCreatorId = (report: DailyClassReport) =>
    getEntityId((report as any).reported_by || report.user_id);

  const canDeleteClassReport = (report: DailyClassReport) => {
    if (!ghiNhanAccess.deleteClassRecord) return false;
    const isAdmin = String(user?.role || "").toLowerCase().includes("admin");
    if (isAdmin || ghiNhanAccess.configRecord) return true;
    if (!currentUserId) return false;
    return getClassReportCreatorId(report) === currentUserId;
  };

  const [currentView, setCurrentView] = useState<"list" | "add" | "edit" | "detail">(
    "list",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>(
    {},
  );
  const [filterDateRange, setFilterDateRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const [isCalendarDesktopOpen, setIsCalendarDesktopOpen] = useState(false);
  const [isSelectingHistory, setIsSelectingHistory] = useState(false);
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<string[]>(
    [],
  );
  const [drawerHistoryFilter, setDrawerHistoryFilter] = useState<
    "Khen thưởng" | "Cộng điểm" | "Kỷ luật" | null
  >(null);
  const [historyDeleteIds, setHistoryDeleteIds] = useState<string[]>([]);
  const [isHistoryDeleteConfirmOpen, setIsHistoryDeleteConfirmOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerHistory, setDrawerHistory] = useState<any[]>([]);
  const visibleDrawerHistory = useMemo(
    () => drawerHistoryFilter
      ? drawerHistory.filter((item) => item.recordType === drawerHistoryFilter)
      : drawerHistory,
    [drawerHistory, drawerHistoryFilter],
  );
  const toggleDrawerHistoryFilter = useCallback((type: "Khen thưởng" | "Cộng điểm" | "Kỷ luật") => {
    setDrawerHistoryFilter((current) => current === type ? null : type);
  }, []);
  const canCreateRecords =
    activeSubTab === "class"
      ? ghiNhanAccess.createClassRecord
      : ghiNhanAccess.createStudentRecord;
  const canAccessClassTab = ghiNhanAccess.viewClassRecord;
  const [selectedClassIdForStudent, setSelectedClassIdForStudent] =
    useState("all");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleteClassConfirmOpen, setIsDeleteClassConfirmOpen] =
    useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState(
    "Không thể thực hiện hành động",
  );
  const [errorModalMessage, setErrorModalMessage] = useState("");
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [deletedRecords, setDeletedRecords] = useState<AcademicRecord[]>([]);
  const [deletedReports, setDeletedReports] = useState<DailyClassReport[]>([]);
  const [isTrashLoading, setIsTrashLoading] = useState(false);
  const [isDeleteAllRecordsConfirmOpen, setIsDeleteAllRecordsConfirmOpen] = useState(false);
  const [isDeleteAllReportsConfirmOpen, setIsDeleteAllReportsConfirmOpen] = useState(false);
  const [isDeletingRecords, setIsDeletingRecords] = useState(false);
  const isDeletingRecordsRef = useRef(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ processed: 0, total: 0, failed: [] as Array<{ id: string; message: string }> });
  const [bulkDeleteResult, setBulkDeleteResult] = useState<{ failed: Array<{ id: string; message: string }> } | null>(null);
  const [isImportRecordPopupOpen, setIsImportRecordPopupOpen] = useState(false);
  const [isImportClassRecordPopupOpen, setIsImportClassRecordPopupOpen] = useState(false);
  const [trashTab, setTrashTab] = useState<"student" | "class">("student");
  const [recordToForceDelete, setRecordToForceDelete] = useState<string | null>(
    null,
  );
  const [reportToForceDelete, setReportToForceDelete] = useState<string | null>(
    null,
  );
  const [itemsPerPage, setItemsPerPage] = useState(40);
  const [classItemsPerPage, setClassItemsPerPage] = useState(40);

  // Academic record states
  const [academicRecords, setAcademicRecords] = useState<AcademicRecordListItem[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [allCriteria, setAllCriteria] = useState<Criterion[]>([]);
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null);
  const [hasResolvedActiveSemester, setHasResolvedActiveSemester] = useState(false);

  // Infinite scroll states
  const [hasMoreRecords, setHasMoreRecords] = useState(true);
  const [isLoadingMoreRecords, setIsLoadingMoreRecords] = useState(false);
  const [loadMoreRecordsError, setLoadMoreRecordsError] = useState(false);
  const recordsObserverTargetRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const pendingRecordsRefreshRef = useRef(false);
  const loadMoreInitiatedRef = useRef<number>(1);

  // Class tab states
  const [classReports, setClassReports] = useState<DailyClassReport[]>([]);
  const [totalClassReports, setTotalClassReports] = useState(0);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isClassLoading, setIsClassLoading] = useState(false);
  const [classSearchTerm, setClassSearchTerm] = useState("");
  const [debouncedClassSearchTerm, setDebouncedClassSearchTerm] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [selectedReportDateRange, setSelectedReportDateRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const [isClassDateCalendarDesktopOpen, setIsClassDateCalendarDesktopOpen] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [editingReport, setEditingReport] = useState<DailyClassReport | null>(
    null,
  );
  const [editingAcademicRecord, setEditingAcademicRecord] =
    useState<AcademicRecord | null>(null);
  const [classCurrentPage, setClassCurrentPage] = useState(1);
  const [isDeletingClassReports, setIsDeletingClassReports] = useState(false);
  const [detailRecord, setDetailRecord] = useState<any>(null);
  const [detailRecordHistory, setDetailRecordHistory] = useState<any[]>([]);
  const [detailHistoryFilter, setDetailHistoryFilter] = useState<
    "Khen thưởng" | "Cộng điểm" | "Kỷ luật" | null
  >(null);
  const visibleDetailRecordHistory = useMemo(
    () =>
      detailHistoryFilter
        ? detailRecordHistory.filter(
            (item) => item.recordType === detailHistoryFilter,
          )
        : detailRecordHistory,
    [detailRecordHistory, detailHistoryFilter],
  );
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Global configurations for absent criteria
  const [globalCriteria, setGlobalCriteria] = useState<Criterion[]>([]);
  const [globalAbsentCriteriaIds, setGlobalAbsentCriteriaIds] = useState<
    string[]
  >([]);
  const [isGlobalConfigModalOpen, setIsGlobalConfigModalOpen] = useState(false);
  const [viewLayout, setViewLayout] = useState<"table" | "card">("table");
  const [creatorFilter, setCreatorFilter] = useState<
    "all" | "student" | "teacher" | "admin" | "supervisor"
  >("all");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedClassSearchTerm(classSearchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [classSearchTerm]);

  // Filter reset effect moved to after fetchAcademicRecords definition

  useEffect(() => {
    setClassCurrentPage(1);
  }, [debouncedClassSearchTerm, selectedClassId, classItemsPerPage, selectedReportDateRange]);

  const toggleExpandCard = (index: number) => {
    setExpandedCards((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  useEffect(() => {
    let cancelled = false;

    const fetchActiveSemester = async () => {
      try {
        const semesterList = await semesterApi.getSemesters();
        if (!cancelled) {
          setActiveSemesterId(
            semesterList.find((semester) => semester.status === "active")?._id || null,
          );
        }
      } catch (err) {
        console.error("Lỗi khi nạp học kỳ đang hoạt động:", err);
        if (!cancelled) {
          setActiveSemesterId(null);
          toast.error("Không thể xác định học kỳ đang hoạt động.");
        }
      } finally {
        if (!cancelled) setHasResolvedActiveSemester(true);
      }
    };

    void fetchActiveSemester();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cachedLayout = localStorage.getItem("ghinhan_view_layout");
    if (cachedLayout === "table" || cachedLayout === "card") {
      setViewLayout(cachedLayout);
    }

    const fetchClasses = async () => {
      if (!canAccessClassTab) return;
      try {
        let classList = [];
        try {
          classList = await classApi.getClasses();
        } catch (classApiErr) {
          console.warn("API getClasses lỗi:", classApiErr);
        }
        setClasses(classList);
      } catch (err) {
        console.error("Lỗi khi nạp danh sách lớp:", err);
      }
    };
    fetchClasses();

    setIsLoading(false);
  }, [canAccessClassTab]);

  // Fetch student academic records
  const fetchAcademicRecords = async (pageToFetch = 1, isAppend = false) => {
    if (!hasResolvedActiveSemester || !activeSemesterId) {
      if (!isAppend) {
        setAcademicRecords([]);
        setTotalRecords(0);
        setHasMoreRecords(false);
        setIsLoading(false);
      }
      return;
    }

    if (isFetchingRef.current) {
      if (!isAppend && pageToFetch === 1) {
        pendingRecordsRefreshRef.current = true;
      }
      return;
    }
    isFetchingRef.current = true;

    if (pageToFetch === 1) {
      setCurrentPage(1);
      loadMoreInitiatedRef.current = 1;
    }

    if (isAppend) {
      setIsLoadingMoreRecords(true);
    } else {
      // Only show full loading skeleton when there's no existing data (first load)
      // Keep old records visible during SSE-triggered refreshes to prevent UI flash
      if (academicRecords.length === 0) {
        setIsLoading(true);
      }
    }
    setLoadMoreRecordsError(false);

    try {
      // Load all criteria first if empty
      let criteriaList = allCriteria;
      if (criteriaList.length === 0) {
        try {
          criteriaList = await criteriaApi.getCriteria();
          setAllCriteria(criteriaList);
        } catch (critErr) {
          console.warn("Lỗi khi tải danh sách tiêu chí:", critErr);
        }
      }

      let records: any[] = [];
      let total = 0;
      try {
        const res = await academicRecordApi.getAcademicRecords({
          page: pageToFetch,
          limit: itemsPerPage,
          groupBy: "student",
          semesterId: activeSemesterId,
          search: debouncedSearchTerm || undefined,
          classId: selectedClassIdForStudent === "all" ? undefined : selectedClassIdForStudent,
          startDate: filterDateRange?.start ? format(filterDateRange.start, "yyyy-MM-dd") : undefined,
          endDate: filterDateRange?.end ? format(filterDateRange.end, "yyyy-MM-dd") : undefined,
          creator: creatorFilter !== "all" ? creatorFilter : undefined,
        });
        if (res && 'data' in res) {
          records = res.data;
          total = res.meta.total;
        } else {
          records = Array.isArray(res) ? res : [];
          total = records.length;
        }
      } catch (apiErr) {
        console.warn("API getAcademicRecords lỗi:", apiErr);
        setLoadMoreRecordsError(true);
        if (!isAppend) toast.error("Không thể tải dữ liệu ghi nhận HSSV.");
        return;
      }

      setAcademicRecords(prev => {
        if (!isAppend) return records;
        const existingIds = new Set(prev.map(r => r.latestRecord?._id || r._id));
        const newRecords = records.filter(r => !existingIds.has(r.latestRecord?._id || r._id));
        return [...prev, ...newRecords];
      });
      setTotalRecords(total);
      
      setHasMoreRecords((pageToFetch - 1) * itemsPerPage + records.length < total);
    } catch (err) {
      console.error("Lỗi khi nạp dữ liệu ghi nhận HSSV:", err);
      if (!isAppend) toast.error("Không thể tải dữ liệu ghi nhận HSSV.");
      setLoadMoreRecordsError(true);
    } finally {
      if (isAppend) {
        setIsLoadingMoreRecords(false);
      } else {
        setIsLoading(false);
      }
      isFetchingRef.current = false;
      if (pendingRecordsRefreshRef.current) {
        pendingRecordsRefreshRef.current = false;
        fetchAcademicRecordsRef.current?.(1, false);
      }
    }
  };

  const refreshAcademicRecords = () => {
    if (isFetchingRef.current) {
      pendingRecordsRefreshRef.current = true;
      return;
    }
    void fetchAcademicRecords(1, false);
  };

  const getStudentHistoryParams = (record: any) => {
    return {
      studentId: record.studentObjectId,
      semesterId: activeSemesterId || undefined,
    };
  };

  const getFilteredStudentHistoryParams = (record: any) => {
    return {
      ...getStudentHistoryParams(record),
      classId: selectedClassIdForStudent === "all" ? undefined : selectedClassIdForStudent,
      startDate: filterDateRange?.start ? format(filterDateRange.start, "yyyy-MM-dd") : undefined,
      endDate: filterDateRange?.end ? format(filterDateRange.end, "yyyy-MM-dd") : undefined,
      creator: creatorFilter !== "all" ? creatorFilter : undefined,
    };
  };

  const handleOpenDrawerChange = async (isOpen: boolean, record: any) => {
    setOpenDrawerId(isOpen ? record.id : null);
    if (isOpen) setDrawerHistoryFilter(null);
    if (isOpen) {
      setDrawerLoading(true);
      try {
        const studentObj =
          typeof record.original?.student_id === "object"
            ? record.original.student_id
            : null;
        const studentId = record.studentObjectId || studentObj?._id || record.original?.student_id;

        if (studentId) {
          const studentRecordsResponse = await academicRecordApi.getAcademicRecords(
            getFilteredStudentHistoryParams({ ...record, studentObjectId: studentId }),
          );
          const studentRecords = Array.isArray(studentRecordsResponse)
            ? studentRecordsResponse
            : studentRecordsResponse.data;

          const mappedStudentRecords = studentRecords.map((r) => {
            const student =
              typeof r.student_id === "object" ? r.student_id : null;
            const evalDetail =
              typeof r.evaluation_detail_id === "object"
                ? r.evaluation_detail_id
                : null;
            const criterionId = r.criterion_id
              ? typeof r.criterion_id === "object"
                ? r.criterion_id?._id
                : r.criterion_id
              : r.criteria_id
                ? typeof r.criteria_id === "object"
                  ? r.criteria_id?._id
                  : r.criteria_id
                : evalDetail
                  ? typeof evalDetail.criterion_id === "object"
                    ? evalDetail.criterion_id?._id
                    : evalDetail.criterion_id
                  : r.evaluation_detail_id;

            const foundCriterion = allCriteria.find(
              (c) => c._id === criterionId,
            );

            let className = "N/A";
            if (student) {
              const classId =
                typeof student.class_id === "object"
                  ? student.class_id?._id
                  : student.class_id;
              const foundClass = classes.find((c) => c._id === classId);
              className = getDisplayClassName(foundClass?.class_name);
            }

            const pts = Number.isFinite(r.effectivePoints) ? r.effectivePoints : 0;

            const recordType = foundCriterion
              ? foundCriterion.criterion_type === "khen_thuong"
                ? "Khen thưởng"
                : foundCriterion.criterion_type === "ky_luat"
                  ? "Kỷ luật"
                  : "Cộng điểm"
              : pts > 0
                ? "Cộng điểm"
                : pts < 0
                  ? "Kỷ luật"
                  : "Cộng điểm";

            return {
              id: r._id,
              studentId: student ? student.student_code : "",
              fullName: student ? student.full_name : "",
              className: className,
              recordType: recordType,
              criteria: (() => {
                const raw = foundCriterion
                  ? foundCriterion.criterion_name
                  : r.record_title;
                return raw ? raw.replace(/\s*\(.*?\)\s*$/, "") : "N/A";
              })(),
              date: r.recorded_at
                ? format(new Date(r.recorded_at), "dd/MM/yyyy")
                : r.date_record
                  ? format(new Date(r.date_record), "dd/MM/yyyy")
                  : r.createdAt
                    ? format(new Date(r.createdAt), "dd/MM/yyyy")
                    : format(new Date(), "dd/MM/yyyy"),
              points: (pts >= 0 ? "+" : "") + pts,
              original: r,
            };
          });

          mappedStudentRecords.sort(
            (a: any, b: any) =>
              new Date(b.original.createdAt || 0).getTime() -
              new Date(a.original.createdAt || 0).getTime(),
          );
          setDrawerHistory(mappedStudentRecords);
        }
      } catch (err) {
        console.error("Lỗi khi tải lịch sử sinh viên:", err);
        toast.error("Không thể tải lịch sử rèn luyện.");
      } finally {
        setDrawerLoading(false);
      }
    } else {
      setIsSelectingHistory(false);
      setSelectedHistoryItems([]);
      setDrawerHistoryFilter(null);
      setDrawerHistory([]);
    }
  };

  // Fetch class data
  const fetchClassReports = async () => {
    if (!canAccessClassTab) return;
    setIsClassLoading(true);
    try {
      // Load criteria list to setup configuration
      try {
        const criteriaList = await criteriaApi.getCriteria();
        setAllCriteria(criteriaList);
        const disciplineCriteria = criteriaList.filter(
          (c) => c.criterion_type === "ky_luat",
        );
        setGlobalCriteria(disciplineCriteria);

        // Load from localStorage or set defaults
        const cached = localStorage.getItem("absentCriteriaIds");
        if (cached) {
          setGlobalAbsentCriteriaIds(JSON.parse(cached));
        } else {
          const defaultAbsents = disciplineCriteria
            .filter((c) => {
              const nameLower = c.criterion_name.toLowerCase();
              return (
                nameLower.includes("vắng") &&
                (nameLower.includes("không phép") ||
                  nameLower.includes("có phép"))
              );
            })
            .map((c) => c._id);
          setGlobalAbsentCriteriaIds(defaultAbsents);
          localStorage.setItem(
            "absentCriteriaIds",
            JSON.stringify(defaultAbsents),
          );
        }
      } catch (critErr) {
        console.warn("Không thể load tiêu chí:", critErr);
      }

      let reports: any[] = [];
      let total = 0;
      try {
        const res = await dailyClassReportApi.getDailyClassReports({
          page: classCurrentPage,
          limit: classItemsPerPage,
          classId: selectedClassId === "all" ? undefined : selectedClassId,
          search: debouncedClassSearchTerm || undefined,
          startDate: selectedReportDateRange?.start ? format(selectedReportDateRange.start, "yyyy-MM-dd") : undefined,
          endDate: selectedReportDateRange?.end ? format(selectedReportDateRange.end, "yyyy-MM-dd") : undefined,
        });
        if (res && 'data' in res) {
          reports = res.data;
          total = res.meta.total;
        } else {
          reports = Array.isArray(res) ? res : [];
          total = reports.length;
        }
      } catch (apiErr) {
        console.warn("API dailyClassReports lỗi:", apiErr);
      }

      setClassReports(reports);
      setTotalClassReports(total);

      let classList = [];
      try {
        classList = await classApi.getClasses();
      } catch (classApiErr) {
        console.warn("API getClasses lỗi:", classApiErr);
      }
      setClasses(classList);
    } catch (err) {
      console.error("Lỗi khi nạp dữ liệu lớp học:", err);
      toast.error("Không thể tải dữ liệu tình hình lớp học.");
    } finally {
      setIsClassLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccessClassTab && activeSubTab !== "student") {
      setActiveSubTab("student");
    }
  }, [activeSubTab, canAccessClassTab]);

  useEffect(() => {
    if (activeSubTab === "student") {
      setCurrentPage(1);
      setHasMoreRecords(true);
      setLoadMoreRecordsError(false);
      loadMoreInitiatedRef.current = 1;
      fetchAcademicRecords(1, false);
    }
  }, [activeSubTab, itemsPerPage, debouncedSearchTerm, selectedClassIdForStudent, filterDateRange, creatorFilter, activeSemesterId, hasResolvedActiveSemester]);

  useEffect(() => {
    if (activeSubTab === "class" && canAccessClassTab) {
      fetchClassReports();
    }
  }, [activeSubTab, canAccessClassTab, classCurrentPage, classItemsPerPage, debouncedClassSearchTerm, selectedClassId, selectedReportDateRange]);

  const fetchAcademicRecordsRef = useRef<any>(null);
  useEffect(() => {
    fetchAcademicRecordsRef.current = fetchAcademicRecords;
  });

  useGradingRealtime({
    classId: selectedClassIdForStudent !== 'all' ? selectedClassIdForStudent : undefined,
    // Disable SSE auto-reload when user is actively searching to prevent flickering
    enabled: activeSubTab === 'student' && !debouncedSearchTerm,
    onEvent: (event) => {
      if (event.type === 'academic_record_changed') {
        refreshAcademicRecords();
      }
    }
  });

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    if (activeSubTab !== "student") return;
    if (!hasMoreRecords || loadMoreRecordsError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (isFetchingRef.current) return;
          const currentRefPage = loadMoreInitiatedRef.current;
          const nextPage = currentRefPage + 1;
          loadMoreInitiatedRef.current = nextPage;
          setCurrentPage(nextPage);
          if (fetchAcademicRecordsRef.current) {
            fetchAcademicRecordsRef.current(nextPage, true);
          }
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "100px",
        threshold: 0.1,
      }
    );

    const currentTarget = recordsObserverTargetRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [activeSubTab, hasMoreRecords, loadMoreRecordsError]);

  // Map academicRecords to dummy format for UI compatibility
  const mappedRecords = useMemo(() => academicRecords.map((item) => {
    const r = item.latestRecord || item;
    const student = typeof r.student_id === "object" ? r.student_id : null;
    const studentObjectId = item.studentId || student?._id || String(r.student_id || "");
    const evalDetail =
      typeof r.evaluation_detail_id === "object"
        ? r.evaluation_detail_id
        : null;
    const criterionId = r.criterion_id
      ? typeof r.criterion_id === "object"
        ? r.criterion_id?._id
        : r.criterion_id
      : r.criteria_id
        ? typeof r.criteria_id === "object"
          ? r.criteria_id?._id
          : r.criteria_id
        : evalDetail
          ? typeof evalDetail.criterion_id === "object"
            ? evalDetail.criterion_id?._id
            : evalDetail.criterion_id
          : r.evaluation_detail_id;

    const foundCriterion = allCriteria.find((c) => c._id === criterionId);
    const foundStudent = student;

    let className = "N/A";
    if (foundStudent) {
      const classId =
        typeof foundStudent.class_id === "object"
          ? foundStudent.class_id?._id
          : foundStudent.class_id;
      const foundClass = classes.find((c) => c._id === classId);
      className = getDisplayClassName(foundClass?.class_name);
    }

    const pts = Number.isFinite(r.effectivePoints) ? r.effectivePoints : 0;

    const recordType = foundCriterion
      ? foundCriterion.criterion_type === "khen_thuong"
        ? "Khen thưởng"
        : foundCriterion.criterion_type === "ky_luat"
          ? "Kỷ luật"
          : "Cộng điểm"
      : pts > 0
        ? "Cộng điểm"
        : pts < 0
          ? "Kỷ luật"
          : "Cộng điểm";
    const latestRecordType: AcademicRecordType = foundCriterion
      ? foundCriterion.criterion_type === "khen_thuong"
        ? "khen_thuong"
        : foundCriterion.criterion_type === "ky_luat"
          ? "ky_luat"
          : "cong_diem"
      : pts < 0
        ? "ky_luat"
        : "cong_diem";
    const recordTypes = Array.isArray(item.recordTypes) && item.recordTypes.length > 0
      ? item.recordTypes
      : [latestRecordType];
    const recordCount = item.recordCount ?? 1;
    const suppliedRecordTypeCounts = item.recordTypeCounts;
    const recordTypeCounts: Record<AcademicRecordType, number> = {
      khen_thuong: Number(suppliedRecordTypeCounts?.khen_thuong ?? 0),
      cong_diem: Number(suppliedRecordTypeCounts?.cong_diem ?? 0),
      ky_luat: Number(suppliedRecordTypeCounts?.ky_luat ?? 0),
    };
    if (!suppliedRecordTypeCounts) {
      recordTypeCounts[latestRecordType] = recordCount;
    }
    const totalPoints =
      typeof item.totalPoints === "number" ? item.totalPoints : pts;
    const isGrouped = Boolean(item.latestRecord || item.studentId);

    return {
      id: r._id,
      selectionId: isGrouped ? studentObjectId : r._id,
      isGrouped,
      studentId: foundStudent ? foundStudent.student_code : "",
      fullName: foundStudent ? foundStudent.full_name : "",
      className: className,
      recordType: recordType as "Khen thưởng" | "Kỷ luật" | "Cộng điểm",
      recordTypes,
      criteria: (() => {
        const raw = foundCriterion
          ? foundCriterion.criterion_name
          : r.record_title;
        return raw ? raw.replace(/\s*\(.*?\)\s*$/, "") : "N/A";
      })(),
      criterionCode: foundCriterion ? foundCriterion.criterion_code || '' : '',
      date: r.recorded_at
        ? format(new Date(r.recorded_at), "dd/MM/yyyy")
        : r.date_record
          ? format(new Date(r.date_record), "dd/MM/yyyy")
          : r.createdAt
            ? format(new Date(r.createdAt), "dd/MM/yyyy")
            : format(new Date(), "dd/MM/yyyy"),
      points: formatSignedPoints(totalPoints),
      totalPoints,
      original: r,
      recordCount,
      recordTypeCounts,
      studentObjectId,
    };
  }), [academicRecords, allCriteria, classes]);

  // Student filtering
  const filteredRecords = useMemo(() => mappedRecords.filter((record) => {
    const matchesCreator =
      creatorFilter === "all" ||
      getCreatorRoleKey(record.original) === creatorFilter;

    return matchesCreator;
  }), [mappedRecords, creatorFilter]);

  const sortedRecords = useMemo(
    () => [...filteredRecords].sort(
      (a, b) => getRecordSortTime(b.original) - getRecordSortTime(a.original),
    ),
    [filteredRecords],
  );

  const totalPages = Math.ceil(totalRecords / itemsPerPage);
  const paginatedRecords = sortedRecords;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Class filtering (handled entirely by backend)
  const filteredClassReports = classReports;

  const sortedClassReports = [...filteredClassReports].sort(
    (a, b) => getClassReportSortTime(b) - getClassReportSortTime(a),
  );

  const totalClassPages = Math.ceil(totalClassReports / classItemsPerPage);
  const paginatedClassReports = sortedClassReports;

  // Student list toggle selects
  const toggleSelectAll = useCallback(() => {
    if (!ghiNhanAccess.deleteStudentRecord) return;

    const deletableIds = paginatedRecords.map((record) => record.selectionId);

    if (deletableIds.length === 0) return;

    if (deletableIds.every((id) => selectedIdSet.has(id))) {
      setSelectedIds([]);
    } else {
      setSelectedIds(deletableIds);
    }
  }, [ghiNhanAccess.deleteStudentRecord, paginatedRecords, selectedIdSet]);

  type StudentGroupDeletePlan = {
    selectionId: string;
    recordIds: string[];
    preservedDailyReportCount: number;
    error?: string;
  };

  const [deletePreview, setDeletePreview] = useState<{
    groups: StudentGroupDeletePlan[];
    recordIds: string[];
    preservedDailyReportCount: number;
  } | null>(null);
  const [isPreparingDeletePreview, setIsPreparingDeletePreview] = useState(false);
  const isPreparingDeletePreviewRef = useRef(false);

  const prepareDeletePreview = async () => {
    if (
      !ghiNhanAccess.deleteStudentRecord ||
      selectedIds.length === 0 ||
      isDeletingRecordsRef.current ||
      isPreparingDeletePreviewRef.current
    ) {
      return;
    }

    const selectedGroups = mappedRecords.filter((record) =>
      selectedIdSet.has(record.selectionId),
    );
    if (selectedGroups.length === 0) {
      toast.warning("Không còn nhóm sinh viên nào phù hợp với bộ lọc hiện tại.");
      return;
    }

    isPreparingDeletePreviewRef.current = true;
    setIsPreparingDeletePreview(true);
    try {
      const response: AcademicRecordDeletePreviewResult =
        await academicRecordApi.previewBulkDeleteAcademicRecords({
          studentIds: selectedGroups.map((record) => record.studentObjectId),
          classId:
            selectedClassIdForStudent === "all" ? undefined : selectedClassIdForStudent,
          startDate: filterDateRange?.start
            ? format(filterDateRange.start, "yyyy-MM-dd")
            : undefined,
          endDate: filterDateRange?.end
            ? format(filterDateRange.end, "yyyy-MM-dd")
            : undefined,
          creator: creatorFilter !== "all" ? creatorFilter : undefined,
        });
      const groups: StudentGroupDeletePlan[] = response.groups.map((group) => ({
        selectionId:
          selectedGroups.find((selectedGroup) => selectedGroup.studentObjectId === group.studentId)
            ?.selectionId || group.studentId,
        recordIds: Array.from(new Set(group.recordIds)),
        preservedDailyReportCount: group.preservedDailyReportCount,
        error: group.failures.length > 0
          ? `${group.failures.length} ghi nhận không đủ quyền xoá.`
          : undefined,
      }));
      setDeletePreview({
        groups,
        recordIds: Array.from(new Set(response.recordIds)),
        preservedDailyReportCount: response.preservedDailyReportCount,
      });
      setIsDeleteConfirmOpen(true);
    } catch (error: any) {
      toast.error(error?.message || "Không thể tạo bản xem trước xoá.");
    } finally {
      isPreparingDeletePreviewRef.current = false;
      setIsPreparingDeletePreview(false);
    }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }, []);

  const runBulkRecordDelete = async (
    ids: string[],
    permanent = false,
    groupPlan?: StudentGroupDeletePlan[],
  ) => {
    const uniqueIds = Array.from(new Set(ids));
    if (isDeletingRecordsRef.current || isDeletingRecords || uniqueIds.length === 0) return;
    isDeletingRecordsRef.current = true;
    setIsDeletingRecords(true);
    setBulkDeleteResult(null);
    setBulkDeleteProgress({ processed: 0, total: uniqueIds.length, failed: [] });
    const failed: Array<{ id: string; message: string }> = [];
    const succeededIds = new Set<string>();
    let processed = 0;
    try {
      for (let offset = 0; offset < uniqueIds.length; offset += 25) {
        const batch = uniqueIds.slice(offset, offset + 25);
        let result: BulkDeleteAcademicRecordsResult;
        try {
          result = permanent
            ? await academicRecordApi.bulkForceDeleteAcademicRecords(batch)
            : await academicRecordApi.bulkDeleteAcademicRecords(batch);
          failed.push(...result.failed);
          result.succeeded.forEach((id) => succeededIds.add(id));
        } catch (error: any) {
          failed.push(...batch.map(id => ({ id, message: error?.message || 'Không thể xoá ghi nhận' })));
        }
        processed += batch.length;
        setBulkDeleteProgress({ processed, total: uniqueIds.length, failed: [...failed] });
      }

      const failedIds = new Set(failed.map(item => item.id));
      if (permanent) {
        setDeletedRecords(prev => prev.filter(record => !succeededIds.has(record._id)));
        await fetchDeletedItems();
      } else {
        if (groupPlan) {
          setSelectedIds((prev) =>
            prev.filter((selectionId) => {
              const group = groupPlan.find((item) => item.selectionId === selectionId);
              return !group ||
                (group.recordIds.length > 0 && group.recordIds.some((id) => failedIds.has(id))) ||
                !!group.error;
            }),
          );
        } else {
          setSelectedIds(prev => prev.filter(id => failedIds.has(id)));
        }
        setAcademicRecords(prev => prev.filter(record => !succeededIds.has(record.latestRecord?._id || record._id)));
        await refreshAcademicRecords();
      }
      if (failed.length > 0) {
        toast.warning(`Đã xử lý ${uniqueIds.length - failed.length}/${uniqueIds.length} ghi nhận; còn ${failed.length} ghi nhận thất bại.`);
      } else {
        toast.success(`Đã ${permanent ? 'xóa vĩnh viễn' : 'xóa'} thành công ${uniqueIds.length} ghi nhận.`);
      }
      setBulkDeleteResult({ failed: [...failed] });
    } finally {
      isDeletingRecordsRef.current = false;
      setIsDeletingRecords(false);
    }
  };

  const requestHistoryDelete = () => {
    const ids = selectedHistoryItems
      .filter((id) => drawerHistory.some((item) => item.id === id))
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;
    setHistoryDeleteIds(ids);
    setIsHistoryDeleteConfirmOpen(true);
  };

  const confirmHistoryDelete = async () => {
    if (historyDeleteIds.length === 0) return;
    await runBulkRecordDelete(historyDeleteIds);
    const current = paginatedRecords.find((record) => record.id === openDrawerId);
    if (current) await handleOpenDrawerChange(true, current);
    setSelectedHistoryItems([]);
    setIsSelectingHistory(false);
    setHistoryDeleteIds([]);
  };

  const handleDelete = async () => {
    setIsDeleteConfirmOpen(false);
    const preview = deletePreview;
    setDeletePreview(null);
    if (!ghiNhanAccess.deleteStudentRecord || !preview) {
      toast.error("Bạn không có quyền xóa các ghi nhận đã chọn.");
      return;
    }
    if (preview.recordIds.length === 0) {
      toast.warning(
        preview.groups.some((group) => group.error)
          ? "Không thể xoá vì một số nhóm không tải được dữ liệu lọc."
          : "Không có ghi nhận phù hợp để xoá; các nhóm vẫn được giữ lại.",
      );
      return;
    }
    await runBulkRecordDelete(preview.recordIds, false, preview.groups);
  };

  // Class list toggle selects
  const toggleSelectAllClass = () => {
    const deletableIds = paginatedClassReports
      .filter((report) => canDeleteClassReport(report))
      .map((report) => report._id);

    if (deletableIds.length === 0) return;

    setSelectedReportIds((prev) => {
      const selectedSet = new Set(prev);
      const allSelected = deletableIds.every((id) => selectedSet.has(id));

      if (allSelected) {
        return prev.filter((id) => !deletableIds.includes(id));
      }

      return Array.from(new Set([...prev, ...deletableIds]));
    });
  };

  const toggleSelectClass = (id: string) => {
    const target = classReports.find((report) => report._id === id);
    if (!target || !canDeleteClassReport(target)) return;

    setSelectedReportIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleDeleteClassReportsBulk = async () => {
    const deletableIds = Array.from(new Set(
      selectedReportIds.filter((id) => {
        const target = classReports.find((report) => report._id === id);
        return target ? canDeleteClassReport(target) : false;
      })
    ));

    if (deletableIds.length === 0) {
      toast.error("Bạn không có quyền xóa các báo cáo đã chọn.");
      return;
    }

    if (deletableIds.length !== selectedReportIds.length) {
      toast.warning("Một số báo cáo đã chọn không đủ quyền xóa và đã được bỏ qua.");
    }

    setIsDeletingClassReports(true);
    const toastId = toast.loading("Đang xóa các báo cáo lớp học...");
    try {
      const result = await dailyClassReportApi.deleteDailyClassReportsBulk(deletableIds);
      toast.dismiss(toastId);

      if (result.failed && result.failed.length > 0) {
        if (result.deletedCount > 0) {
          toast.success(`Đã xóa thành công ${result.deletedCount} báo cáo lớp học. Tuy nhiên có ${result.failed.length} báo cáo gặp lỗi.`);
        } else {
          toast.error(`Xóa hàng loạt thất bại. Chi tiết: ${result.failed[0].message}`);
        }
      } else {
        toast.success(`Đã xóa thành công ${result.deletedCount} báo cáo lớp học.`);
      }

      setSelectedReportIds([]);
      fetchClassReports();
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error(err);
      toast.error(err.message || "Có lỗi xảy ra khi xóa hàng loạt.");
    } finally {
      setIsDeletingClassReports(false);
    }
  };

  const handleDeleteClassReportSingle = async (id: string) => {
    try {
      const target = classReports.find((report) => report._id === id);
      if (!target || !canDeleteClassReport(target)) {
        toast.error("Bạn chỉ được xóa báo cáo lớp do chính mình tạo.");
        return;
      }
      await dailyClassReportApi.deleteDailyClassReport(id);
      toast.success("Đã xóa báo cáo lớp học thành công.");
      fetchClassReports();
    } catch (err) {
      console.error(err);
      toast.error("Không thể xóa báo cáo lớp học.");
    }
  };

  const fetchDeletedItems = async () => {
    setIsTrashLoading(true);
    try {
      const [recs, reps] = await Promise.all([
        academicRecordApi.getDeletedAcademicRecords(),
        dailyClassReportApi.getDeletedDailyClassReports(),
      ]);
      setDeletedRecords(recs);
      setDeletedReports(reps);
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu thùng rác:", err);
      toast.error("Không thể tải danh sách thùng rác.");
    } finally {
      setIsTrashLoading(false);
    }
  };

  const handleRestoreRecord = async (id: string) => {
    try {
      await academicRecordApi.restoreAcademicRecord(id);
      toast.success("Khôi phục ghi nhận vi phạm thành công!");
      fetchDeletedItems();
      refreshAcademicRecords();
    } catch (err: any) {
      console.error("Lỗi khi khôi phục ghi nhận:", err);
      toast.error(err.message || "Khôi phục ghi nhận vi phạm thất bại.");
    }
  };

  const handleRestoreReport = async (id: string) => {
    try {
      await dailyClassReportApi.restoreDailyClassReport(id);
      toast.success("Khôi phục báo cáo ngày thành công!");
      fetchDeletedItems();
      fetchClassReports();
      refreshAcademicRecords();
    } catch (err: any) {
      console.error("Lỗi khi khôi phục báo cáo:", err);
      toast.error(err.message || "Khôi phục báo cáo ngày thất bại.");
    }
  };

  const handleForceDeleteRecord = async (id: string) => {
    try {
      await academicRecordApi.forceDeleteAcademicRecord(id, true);
      toast.success("Đã xóa vĩnh viễn ghi nhận vi phạm.");
      setRecordToForceDelete(null);
      fetchDeletedItems();
    } catch (err: any) {
      console.error("Lỗi khi xóa vĩnh viễn ghi nhận:", err);
      toast.error(err.message || "Không thể xóa vĩnh viễn ghi nhận.");
    }
  };

  const handleRestoreRecordRef = useRef(handleRestoreRecord);
  handleRestoreRecordRef.current = handleRestoreRecord;
  const handleRestoreRecordStable = useCallback(
    (id: string) => handleRestoreRecordRef.current(id),
    [],
  );

  const handleForceDeleteReport = async (id: string) => {
    try {
      await dailyClassReportApi.forceDeleteDailyClassReport(id);
      toast.success("Đã xóa vĩnh viễn báo cáo lớp học.");
      setReportToForceDelete(null);
      fetchDeletedItems();
    } catch (err: any) {
      console.error("Lỗi khi xóa vĩnh viễn báo cáo:", err);
      toast.error(err.message || "Không thể xóa vĩnh viễn báo cáo.");
    }
  };

  const handleForceDeleteAllRecords = async () => {
    setIsDeleteAllRecordsConfirmOpen(false);
    if (deletedRecords.length === 0) return;
    await runBulkRecordDelete(deletedRecords.map(rec => rec._id), true);
  };

  const handleForceDeleteAllReports = async () => {
    setIsDeleteAllReportsConfirmOpen(false);
    if (deletedReports.length === 0) return;
    const toastId = toast.loading("Đang xóa vĩnh viễn tất cả báo cáo lớp học...");
    try {
      const results = await Promise.allSettled(
        deletedReports.map((rep) =>
          dailyClassReportApi.forceDeleteDailyClassReport(rep._id),
        ),
      );
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failCount = results.filter((r) => r.status === "rejected").length;

      if (failCount > 0) {
        toast.warning(`Đã xóa vĩnh viễn ${successCount} báo cáo. Thất bại ${failCount} báo cáo.`, { id: toastId });
      } else {
        toast.success("Đã xóa vĩnh viễn tất cả báo cáo lớp học thành công!", { id: toastId });
      }
      fetchDeletedItems();
    } catch (err: any) {
      console.error("Lỗi khi xóa vĩnh viễn tất cả báo cáo:", err);
      toast.error(err.message || "Xóa vĩnh viễn thất bại.", { id: toastId });
    }
  };

  const handleExportStudentExcel = async () => {
    if (filteredRecords.length === 0) {
      toast.error("Không có dữ liệu để xuất Excel");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const data = filteredRecords.map((r) => ({
        "Mã SV": r.studentId,
        "Họ và tên": r.fullName,
        Lớp: r.className,
        "Loại ghi nhận": r.recordTypes
          .map(getAcademicRecordTypeLabel)
          .join(", "),
        "Mã tiêu chí gần nhất": r.criterionCode,
        "Ghi nhận gần nhất - Tiêu chí": r.criteria || "Chưa có",
        "Ghi nhận gần nhất - Ngày": r.date,
        "Số lần ghi nhận": r.recordCount,
        "Tính điểm": r.points,
      }));
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Ghi nhận HSSV");
      XLSX.writeFile(
        workbook,
        `Ghi_nhan_HSSV_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`,
      );
      toast.success("Đã xuất file Excel ghi nhận HSSV thành công!");
    } catch (error) {
      console.error(error);
      toast.error("Có lỗi xảy ra khi xuất file Excel");
    }
  };

  const handleExportClassExcel = async () => {
    if (filteredClassReports.length === 0) {
      toast.error("Không có dữ liệu để xuất Excel");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const data = filteredClassReports.map((report) => {
        const classObj =
          typeof report.class_id === "object" ? report.class_id : null;
        const className = getDisplayClassName(classObj?.class_name || "CS-101-A");
        const totalPresent = report.total_present || 0;
        const totalAbsent = report.total_absent || 0;
        const totalStudents = totalPresent + totalAbsent;
        const percent =
          totalStudents === 0
            ? 0
            : Math.round((totalPresent / totalStudents) * 100);

        return {
          "Lớp học": className,
          "Ngày báo cáo": report.report_date,
          "Tổng số SV": totalStudents,
          "Sĩ số có mặt": totalPresent,
          "Sĩ số vắng": totalAbsent,
          "Tỉ lệ hiện diện": `${percent}%`,
          "Giảng viên ghi nhận": report.teacher_name,
          "Ghi chú lớp": report.class_note || "Ghi nhận đầy đủ...",
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tình hình lớp học");
      XLSX.writeFile(
        workbook,
        `Tinh_hinh_lop_hoc_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`,
      );
      toast.success("Đã xuất file Excel tình hình lớp học thành công!");
    } catch (error) {
      console.error(error);
      toast.error("Có lỗi xảy ra khi xuất file Excel");
    }
  };

  const handleExportSelectedStudentExcel = async () => {
    if (selectedIds.length === 0) {
      toast.error("Không có dữ liệu được chọn để xuất Excel");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const selectedRecords = mappedRecords.filter((r) =>
        selectedIdSet.has(r.selectionId),
      );
      const data = selectedRecords.map((r) => ({
        "Mã SV": r.studentId,
        "Họ và tên": r.fullName,
        Lớp: r.className,
        "Loại ghi nhận": r.recordTypes
          .map(getAcademicRecordTypeLabel)
          .join(", "),
        "Mã tiêu chí gần nhất": r.criterionCode,
        "Ghi nhận gần nhất - Tiêu chí": r.criteria || "Chưa có",
        "Ghi nhận gần nhất - Ngày": r.date,
        "Số lần ghi nhận": r.recordCount,
        "Tính điểm": r.points,
      }));
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Ghi nhận HSSV được chọn",
      );
      XLSX.writeFile(
        workbook,
        `Ghi_nhan_HSSV_Selected_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`,
      );
      toast.success(
        "Đã xuất file Excel các ghi nhận HSSV được chọn thành công!",
      );
    } catch (error) {
      console.error(error);
      toast.error("Có lỗi xảy ra khi xuất file Excel");
    }
  };

  const handleExportSelectedClassExcel = async () => {
    if (selectedReportIds.length === 0) {
      toast.error("Không có dữ liệu được chọn để xuất Excel");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const selectedReports = classReports.filter((report) =>
        selectedReportIds.includes(report._id),
      );
      const data = selectedReports.map((report) => {
        const classObj =
          typeof report.class_id === "object" ? report.class_id : null;
        const className = getDisplayClassName(classObj?.class_name || "CS-101-A");
        const totalPresent = report.total_present || 0;
        const totalAbsent = report.total_absent || 0;
        const totalStudents = totalPresent + totalAbsent;
        const percent =
          totalStudents === 0
            ? 0
            : Math.round((totalPresent / totalStudents) * 100);

        return {
          "Lớp học": className,
          "Ngày báo cáo": report.report_date,
          "Tổng số SV": totalStudents,
          "Sĩ số có mặt": totalPresent,
          "Sĩ số vắng": totalAbsent,
          "Tỉ lệ hiện diện": `${percent}%`,
          "Giảng viên ghi nhận": report.teacher_name,
          "Ghi chú lớp": report.class_note || "Ghi nhận đầy đủ...",
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Tình hình lớp học được chọn",
      );
      XLSX.writeFile(
        workbook,
        `Tinh_hinh_lop_hoc_Selected_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`,
      );
      toast.success(
        "Đã xuất file Excel các tình hình lớp học được chọn thành công!",
      );
    } catch (error) {
      console.error(error);
      toast.error("Có lỗi xảy ra khi xuất file Excel");
    }
  };

  const handleCreate = () => {
    if (!canCreateRecords) {
      toast.error("Bạn không có quyền thêm ghi nhận.");
      return;
    }
    setCurrentView("add");
  };

  const handleEditClassReport = (report: DailyClassReport) => {
    setEditingReport(report);
    setCurrentView("edit");
  };

  const handleOpenDetailView = async (record: any) => {
    setDetailRecord(record);
    setDetailHistoryFilter(null);
    setCurrentView("detail");
    setIsDetailLoading(true);
    try {
      const studentObj =
        typeof record.original?.student_id === "object"
          ? record.original.student_id
          : null;
      const studentId = record.studentObjectId || studentObj?._id || record.original?.student_id;

      if (studentId) {
        const studentRecordsResponse = await academicRecordApi.getAcademicRecords({
          ...getStudentHistoryParams(record),
          studentId,
        });
        const studentRecords = Array.isArray(studentRecordsResponse)
          ? studentRecordsResponse
          : studentRecordsResponse.data;

        const mappedStudentRecords = studentRecords.map((r) => {
          const student =
            typeof r.student_id === "object" ? r.student_id : null;
          const evalDetail =
            typeof r.evaluation_detail_id === "object"
              ? r.evaluation_detail_id
              : null;
          const criterionId = r.criterion_id
            ? typeof r.criterion_id === "object"
              ? r.criterion_id?._id
              : r.criterion_id
            : r.criteria_id
              ? typeof r.criteria_id === "object"
                ? r.criteria_id?._id
                : r.criteria_id
              : evalDetail
                ? typeof evalDetail.criterion_id === "object"
                  ? evalDetail.criterion_id?._id
                  : evalDetail.criterion_id
                : r.evaluation_detail_id;

          const foundCriterion = allCriteria.find(
            (c) => c._id === criterionId,
          );

          let className = "N/A";
          if (student) {
            const classId =
              typeof student.class_id === "object"
                ? student.class_id?._id
                : student.class_id;
            const foundClass = classes.find((c) => c._id === classId);
            className = getDisplayClassName(foundClass?.class_name);
          }

          const pts = Number.isFinite(r.effectivePoints) ? r.effectivePoints : 0;

          const recordType = foundCriterion
            ? foundCriterion.criterion_type === "khen_thuong"
              ? "Khen thưởng"
              : foundCriterion.criterion_type === "ky_luat"
                ? "Kỷ luật"
                : "Cộng điểm"
            : pts > 0
              ? "Cộng điểm"
              : pts < 0
                ? "Kỷ luật"
                : "Cộng điểm";

          return {
            id: r._id,
            studentId: student ? student.student_code : "",
            fullName: student ? student.full_name : "",
            className: className,
            recordType: recordType,
            criteria: (() => {
              const raw = foundCriterion
                ? foundCriterion.criterion_name
                : r.record_title;
              return raw ? raw.replace(/\s*\(.*?\)\s*$/, "") : "N/A";
            })(),
            date: r.recorded_at
              ? format(new Date(r.recorded_at), "dd/MM/yyyy")
              : r.date_record
                ? format(new Date(r.date_record), "dd/MM/yyyy")
                : r.createdAt
                  ? format(new Date(r.createdAt), "dd/MM/yyyy")
                  : format(new Date(), "dd/MM/yyyy"),
            points: (pts >= 0 ? "+" : "") + pts,
            original: r,
          };
        });

        mappedStudentRecords.sort(
          (a: any, b: any) =>
            new Date(b.original.createdAt || 0).getTime() -
            new Date(a.original.createdAt || 0).getTime(),
        );
        setDetailRecordHistory(mappedStudentRecords);
      }
    } catch (err) {
      console.error("Lỗi khi tải lịch sử sinh viên:", err);
      toast.error("Không thể tải lịch sử rèn luyện.");
    } finally {
      setIsDetailLoading(false);
    }
  };

  const bulkDeletePercent = bulkDeleteProgress.total
    ? Math.round((bulkDeleteProgress.processed / bulkDeleteProgress.total) * 100)
    : 0;
  const bulkDeleteStatus = isDeletingRecords
    ? "active"
    : bulkDeleteResult?.failed.length
      ? "partial"
      : "success";
  const bulkDeleteStatusLabel = isDeletingRecords
    ? "Đang xử lý"
    : bulkDeleteResult?.failed.length
      ? "Hoàn tất một phần"
      : "Hoàn tất";

  if (currentView === "add" && canCreateRecords) {
    return (
      <motion.div
        key="add-view"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="flex-1 w-full h-full relative"
      >
        {activeSubTab === "class" ? (
          <AddClassReportView
            onBack={() => setCurrentView("list")}
            onSuccess={() => {
              setCurrentView("list");
              fetchClassReports();
            }}
          />
        ) : (
          <AddRecordView
            onBack={() => setCurrentView("list")}
            onSuccess={() => {
              setCurrentView("list");
              refreshAcademicRecords();
            }}
            taskId={taskId}
          />
        )}
      </motion.div>
    );
  }

  if (currentView === "edit") {
    // Validate edit mode state - must have either editingReport or editingAcademicRecord
    if (!editingReport && !editingAcademicRecord) {
      return (
        <motion.div
          key="edit-error-view"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="flex-1 w-full h-full relative flex items-center justify-center"
        >
          <div className="flex flex-col items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-sm">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <div className="text-center">
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                Không tìm thấy bản ghi để chỉnh sửa
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Vui lòng chọn một bản ghi từ danh sách để chỉnh sửa.
              </p>
            </div>
            <button
              onClick={() => {
                setCurrentView("list");
                setEditingAcademicRecord(null);
                setEditingReport(null);
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Quay lại danh sách
            </button>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        key="edit-view"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="flex-1 w-full h-full relative"
      >
        {editingReport ? (
          <AddClassReportView
            onBack={() => {
              setCurrentView("list");
              setEditingReport(null);
            }}
            reportToEdit={editingReport}
            onSuccess={() => {
              setCurrentView("list");
              setEditingReport(null);
              fetchClassReports();
            }}
          />
        ) : (
          <AddRecordView
            onBack={() => {
              setCurrentView("list");
              setEditingAcademicRecord(null);
            }}
            recordToEdit={editingAcademicRecord}
            onSuccess={() => {
              setCurrentView("list");
              setEditingAcademicRecord(null);
              refreshAcademicRecords();
            }}
            taskId={taskId}
          />
        )}
      </motion.div>
    );
  }

  if (currentView === "detail" && detailRecord) {
    return (
      <motion.div
        key="detail-view"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="flex-1 w-full h-full bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-slate-300/40 p-6 flex flex-col gap-6 overflow-y-auto"
      >
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4 shrink-0">
          <button
            onClick={() => {
              setCurrentView("list");
              setDetailRecord(null);
              setDetailRecordHistory([]);
              setDetailHistoryFilter(null);
            }}
            className="p-1.5 hover:bg-white/60 active:bg-white/85 rounded-xl text-blue-650 border border-transparent hover:border-white/50 shadow-sm flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-slate-900">
            Chi tiết trạng thái HSSV
          </h2>
        </div>

        <div className="flex items-center gap-4 bg-white/30 border border-white/50 p-4 rounded-xl">
          <div className="w-[60px] h-[60px] rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-slate-200 bg-white">
            <img
              src={`https://api.dicebear.com/7.x/notionists/svg?seed=${detailRecord.studentId}&backgroundColor=b6e3f4`}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col items-start min-w-0">
            <h3 className="text-[18px] font-bold text-slate-900 leading-snug truncate w-full">
              {detailRecord.fullName}
            </h3>
            <p className="text-[12px] font-medium text-slate-500 truncate w-full mt-1">
              Mã SV: {detailRecord.studentId} • Lớp {detailRecord.className}
            </p>
          </div>
        </div>

        {(() => {
          const khenThuongCount = detailRecordHistory.filter(
            (mr) => mr.recordType === "Khen thưởng"
          ).length;
          const congDiemCount = detailRecordHistory.filter(
            (mr) => mr.recordType === "Cộng điểm"
          ).length;
          const kyLuatCount = detailRecordHistory.filter(
            (mr) => mr.recordType === "Kỷ luật"
          ).length;

          return (
            <div className="flex flex-col gap-2">
              <RecordTypeCounts
                counts={{
                  khen_thuong: khenThuongCount,
                  cong_diem: congDiemCount,
                  ky_luat: kyLuatCount,
                }}
                total={isDetailLoading ? (detailRecord.recordCount ?? 0) : detailRecordHistory.length}
                className="text-xs"
              />
              <div className="grid grid-cols-3 gap-2">
                {(["Khen thưởng", "Cộng điểm", "Kỷ luật"] as const).map(
                  (type) => (
                    <DrawerTypeFilterButton
                      key={type}
                      type={type}
                      count={
                        type === "Khen thưởng"
                          ? khenThuongCount
                          : type === "Cộng điểm"
                            ? congDiemCount
                            : kyLuatCount
                      }
                      active={detailHistoryFilter === type}
                      loading={isDetailLoading}
                      onClick={() =>
                        setDetailHistoryFilter((current) =>
                          current === type ? null : type,
                        )
                      }
                    />
                  ),
                )}
              </div>
            </div>
          );
        })()}

        <div className="flex flex-col gap-4">
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            Lịch sử ghi nhận
          </h4>

          {isDetailLoading ? (
            <div className="flex flex-col gap-4 mt-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="w-5 h-5 rounded-full shrink-0" />
                  <div className="flex-1 flex flex-col gap-2 pt-0.5">
                    <Skeleton className="w-24 h-3" />
                    <Skeleton className="w-48 h-4" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleDetailRecordHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-400 italic text-[12px] bg-white/30 border border-dashed border-white/60 rounded-xl">
              Chưa có ghi nhận nào cho học sinh này.
            </div>
          ) : (
            <div className="flex flex-col relative before:content-[''] before:absolute before:left-3 before:top-4 before:h-[calc(100%-1.5rem)] before:w-[1px] before:bg-slate-100 ml-1">
              {visibleDetailRecordHistory.map((mr, i) => {
                const isKyLuat = mr.recordType === "Kỷ luật";
                const isKhenThuong = mr.recordType === "Khen thưởng";

                let bulletBg = "bg-[#1A73E8]";
                let badgeClass = "bg-blue-500/10 text-[#1A73E8] border border-blue-500/20";
                if (isKhenThuong) {
                  bulletBg = "bg-emerald-500";
                  badgeClass = "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20";
                } else if (isKyLuat) {
                  bulletBg = "bg-rose-500";
                  badgeClass = "bg-rose-500/10 text-rose-700 border border-rose-500/20";
                }

                return (
                  <div key={mr.id} className="flex gap-4 relative mb-6 last:mb-0">
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 z-10">
                      <div className={`w-3 h-3 rounded-full ${bulletBg} shadow-sm border-2 border-white box-content`} />
                    </div>

                    <div className="flex-1 flex flex-col pt-0.5 bg-white/30 border border-white/50 p-3 rounded-xl">
                      <div className="flex justify-between items-start">
                        <span className="text-[11px] font-bold text-slate-500">
                          {mr.date}
                        </span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>
                          {mr.recordType} ({mr.points}đ)
                        </span>
                      </div>
                      <span className="text-[13px] font-bold text-slate-900 mt-1.5 leading-snug">
                        {mr.criteria}
                      </span>
                      {mr.original?.description && (
                        <p className="text-[11.5px] font-medium text-slate-600 mt-2 bg-slate-50/50 p-2 rounded-lg italic">
                          "{mr.original.description}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0 bg-transparent w-full">
      {/* Outer row: contains sub-tabs on the left, search/filters/buttons on the right */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 w-full">
        {/* Left Side: Sub-tabs (or title if student) */}
        {isStudent ? (
          <div className="text-sm font-bold text-[#1E293B] px-3 py-1.5 bg-white/40 backdrop-blur-md border border-white/70 rounded-xl shadow-sm w-full sm:w-auto text-center sm:text-left">
            Ghi nhận rèn luyện cá nhân
          </div>
        ) : (
          canAccessClassTab && (
            <div className="flex items-center gap-1 p-1 bg-white/40 backdrop-blur-md border border-white/70 rounded-xl shadow-xs shrink-0 h-9 w-full sm:w-auto justify-center">
              <button
                type="button"
                onClick={() => setActiveSubTab("student")}
                className={`flex-1 sm:flex-initial flex items-center justify-center text-center px-4 h-7 text-xs rounded-lg transition-all duration-150 ease-out outline-none focus:outline-none select-none cursor-pointer ${
                  activeSubTab === "student"
                    ? "bg-white text-slate-800 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium"
                }`}
              >
                <span>Tình hình HSSV</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab("class")}
                className={`flex-1 sm:flex-initial flex items-center justify-center text-center px-4 h-7 text-xs rounded-lg transition-all duration-150 ease-out outline-none focus:outline-none select-none cursor-pointer ${
                  activeSubTab === "class"
                    ? "bg-white text-slate-800 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium"
                }`}
              >
                <span>Tình hình lớp học</span>
              </button>
            </div>
          )
        )}

        {/* Right Side: Filters, Search, Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 lg:justify-end flex-1 w-full lg:w-auto">
          {activeSubTab === "student" ? (
            <>
              {/* Desktop View: Full search input and normal filters/buttons */}
              <div className="hidden lg:flex items-center gap-2.5 w-full lg:w-auto justify-end">
                <Research
                  placeholder="Tìm HSSV hoặc lớp..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  containerClassName="w-full sm:max-w-[220px]"
                />

                <div className="flex items-center gap-2">
                  <Popover open={isCalendarDesktopOpen} onOpenChange={setIsCalendarDesktopOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`flex items-center gap-1.5 px-3.5 h-9 border border-white/80 bg-white/50 backdrop-blur-sm hover:bg-white/70 hover:scale-[1.01] rounded-xl text-xs font-semibold shadow-xs shrink-0 transition-all duration-150 ease-out focus:outline-none cursor-pointer ${filterDateRange ? "border-[#1A73E8]/40 bg-[#1A73E8]/10 text-[#1A73E8]" : "text-slate-700"}`}
                      >
                        <CalendarIcon
                          className={`w-3.5 h-3.5 ${filterDateRange ? "text-[#1A73E8]" : "text-slate-500"}`}
                        />
                        <span>
                          {filterDateRange
                            ? `${format(filterDateRange.start, "dd/MM")} - ${format(filterDateRange.end, "dd/MM")}`
                            : "Chọn khoảng ngày"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 z-[100] bg-transparent border-none shadow-none overflow-hidden"
                      align="end"
                      side="bottom"
                      sideOffset={6}
                    >
                      <CustomCalendar
                        startDate={filterDateRange?.start || null}
                        endDate={filterDateRange?.end || null}
                        onRangeSelect={(start, end) =>
                          setFilterDateRange({ start, end })
                        }
                        onCancel={() => {
                          setFilterDateRange(null);
                          setIsCalendarDesktopOpen(false);
                        }}
                        onConfirm={() => setIsCalendarDesktopOpen(false)}
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Class Dropdown for Student */}
                  {!isStudent && (
                    <div className="w-[160px]">
                      <Select
                        value={selectedClassIdForStudent}
                        onValueChange={(val: string) => {
                          setSelectedClassIdForStudent(val);
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="h-9 bg-white/50 backdrop-blur-sm border border-white/80 text-slate-700 hover:bg-white/70 transition-all duration-150 ease-out hover:scale-[1.01] font-semibold text-xs rounded-xl shadow-xs">
                          <SelectValue placeholder="Tất cả các lớp" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tất cả các lớp</SelectItem>
                          {classes.map((c) => (
                            <SelectItem key={c._id} value={c._id}>
                              {getDisplayClassName(c.class_name)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {ghiNhanAccess.configRecord && (
                    <Button
                      variant="outline"
                      onClick={() => setIsGlobalConfigModalOpen(true)}
                      className="flex items-center justify-center h-9 w-9 border border-white/80 bg-white/50 backdrop-blur-sm hover:bg-white/70 hover:scale-[1.01] rounded-xl text-slate-700 hover:text-rose-600 shadow-xs shrink-0 transition-all duration-150 ease-out cursor-pointer focus:outline-none p-0"
                      title="Cấu hình tiêu chí vắng mặt"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  {ghiNhanAccess.createStudentRecord && (
                    <Button
                      variant="outline"
                      onClick={handleCreate}
                      className="flex items-center gap-1.5 px-4 h-9 border border-white/80 bg-white/50 backdrop-blur-sm hover:bg-white/70 hover:scale-[1.01] rounded-xl cursor-pointer text-xs font-semibold text-slate-700 shadow-xs shrink-0 transition-all duration-150 ease-out focus:outline-none"
                    >
                      <Plus size={13} />
                      <span>Thêm ghi nhận</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Mobile View: Search expands to full width beside the create action */}
              <div className="lg:hidden w-full">
                {isMobileSearchOpen ? (
                  <div className="flex items-center gap-2 h-10 px-3 bg-white/70 border border-[#1A73E8]/30 rounded-xl shadow-sm">
                    <Search className="w-4 h-4 shrink-0 text-slate-400" />
                    <input
                      autoFocus
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm HSSV hoặc lớp..."
                      className="min-w-0 flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400"
                    />
                    <button type="button" onClick={() => { setSearchTerm(""); setIsMobileSearchOpen(false); }} aria-label="Đóng tìm kiếm" className="p-1 text-slate-400 hover:text-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setIsMobileSearchOpen(true)} aria-label="Tìm kiếm" title="Tìm kiếm" className="flex items-center justify-center h-10 w-10 shrink-0 bg-white/70 border border-white/80 text-slate-600 rounded-xl shadow-sm">
                      <Search className="w-4 h-4" />
                    </button>
                    {ghiNhanAccess.createStudentRecord && (
                  <button
                    onClick={handleCreate}
                    className="flex-1 flex items-center justify-center gap-2 h-10 px-4 bg-[#1A73E8] text-white rounded-xl hover:bg-[#1557b0] transition-all duration-150 ease-out hover:scale-[1.01] active:scale-[0.99] font-semibold text-sm shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm ghi nhận</span>
                  </button>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Desktop View: Full search input and normal filters/buttons */}
              <div className="hidden lg:flex items-center gap-2.5 w-full lg:w-auto justify-end">
                <Research
                  placeholder="Nhập tên giảng viên hoặc ghi chú lớp..."
                  value={classSearchTerm}
                  onChange={(e) => setClassSearchTerm(e.target.value)}
                  containerClassName="w-full sm:max-w-[260px]"
                />

                <div className="flex items-center gap-2">
                  <Popover
                    open={isClassDateCalendarDesktopOpen}
                    onOpenChange={setIsClassDateCalendarDesktopOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`flex items-center gap-1.5 px-3.5 h-9 border border-white/80 bg-white/50 backdrop-blur-sm hover:bg-white/70 hover:scale-[1.01] rounded-xl text-xs font-semibold shadow-xs shrink-0 transition-all duration-150 ease-out focus:outline-none cursor-pointer ${selectedReportDateRange ? "border-[#1A73E8]/40 bg-[#1A73E8]/10 text-[#1A73E8]" : "text-slate-700"}`}
                      >
                        <CalendarIcon
                          className={`w-3.5 h-3.5 ${selectedReportDateRange ? "text-[#1A73E8]" : "text-slate-500"}`}
                        />
                        <span>
                          {selectedReportDateRange
                            ? `${format(selectedReportDateRange.start, "dd/MM")} - ${format(selectedReportDateRange.end, "dd/MM")}`
                            : "Chọn khoảng ngày"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 z-[100] bg-transparent border-none shadow-none overflow-hidden"
                      align="end"
                      side="bottom"
                      sideOffset={6}
                    >
                      <CustomCalendar
                        startDate={selectedReportDateRange?.start || null}
                        endDate={selectedReportDateRange?.end || null}
                        onRangeSelect={(start, end) =>
                          setSelectedReportDateRange({ start, end })
                        }
                        onCancel={() => {
                          setSelectedReportDateRange(null);
                          setIsClassDateCalendarDesktopOpen(false);
                        }}
                        onConfirm={() => setIsClassDateCalendarDesktopOpen(false)}
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Class Dropdown */}
                  <div className="w-[160px]">
                    <Select
                      value={selectedClassId}
                      onValueChange={(val: string) => {
                        setSelectedClassId(val);
                        setClassCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9 bg-white/50 backdrop-blur-sm border border-white/80 text-slate-700 hover:bg-white/70 transition-all duration-150 ease-out hover:scale-[1.01] font-semibold text-xs rounded-xl shadow-xs">
                        <SelectValue placeholder="Tất cả các lớp" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả các lớp</SelectItem>
                        {classes.map((c) => (
                          <SelectItem key={c._id} value={c._id}>
                            {getDisplayClassName(c.class_name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {ghiNhanAccess.configRecord && (
                    <Button
                      variant="outline"
                      onClick={() => setIsGlobalConfigModalOpen(true)}
                      className="flex items-center justify-center h-9 w-9 border border-white/80 bg-white/50 backdrop-blur-sm hover:bg-white/70 hover:scale-[1.01] rounded-xl text-slate-700 hover:text-rose-600 shadow-xs shrink-0 transition-all duration-150 ease-out cursor-pointer focus:outline-none p-0"
                      title="Cấu hình tiêu chí vắng mặt"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  {ghiNhanAccess.createClassRecord && (
                    <Button
                      variant="outline"
                      onClick={handleCreate}
                      className="flex items-center gap-1.5 px-4 h-9 border border-white/80 bg-white/50 backdrop-blur-sm hover:bg-white/70 hover:scale-[1.01] rounded-xl cursor-pointer text-xs font-semibold text-slate-700 shadow-xs shrink-0 transition-all duration-150 ease-out focus:outline-none"
                    >
                      <Plus size={13} />
                      <span>Thêm ghi nhận</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Mobile View: Search expands to full width beside the create action */}
              <div className="lg:hidden w-full">
                {isMobileSearchOpen ? (
                  <div className="flex items-center gap-2 h-10 px-3 bg-white/70 border border-[#1A73E8]/30 rounded-xl shadow-sm">
                    <Search className="w-4 h-4 shrink-0 text-slate-400" />
                    <input
                      autoFocus
                      value={classSearchTerm}
                      onChange={(e) => setClassSearchTerm(e.target.value)}
                      placeholder="Tìm kiếm..."
                      className="min-w-0 flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400"
                    />
                    <button type="button" onClick={() => { setClassSearchTerm(""); setIsMobileSearchOpen(false); }} aria-label="Đóng tìm kiếm" className="p-1 text-slate-400 hover:text-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setIsMobileSearchOpen(true)} aria-label="Tìm kiếm" title="Tìm kiếm" className="flex items-center justify-center h-10 w-10 shrink-0 bg-white/70 border border-white/80 text-slate-600 rounded-xl shadow-sm">
                      <Search className="w-4 h-4" />
                    </button>
                    {ghiNhanAccess.createClassRecord && (
                  <button
                    onClick={handleCreate}
                    className="flex-1 flex items-center justify-center gap-2 h-10 px-4 bg-[#1A73E8] text-white rounded-xl hover:bg-[#1557b0] transition-all duration-150 ease-out hover:scale-[1.01] active:scale-[0.99] font-semibold text-sm shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm ghi nhận</span>
                  </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main card containing only the table/content */}
      <div className="flex-1 lg:bg-white/45 lg:backdrop-blur-md lg:border lg:border-white/70 lg:rounded-2xl lg:shadow-sm lg:shadow-slate-300/40 overflow-hidden flex flex-col min-h-0 w-full">
        {activeSubTab === "student" ? (
          <>
            {/* Table Content student record */}
            <div className="flex-1 overflow-y-auto w-full max-w-full bg-transparent flex flex-col">
            {/* Mobile/Tablet View (Luôn hiển thị dạng thẻ tinh giản và ẩn trên desktop) */}
            <div ref={scrollContainerRef} className="p-4 bg-blue-50/30 backdrop-blur-md lg:hidden flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex flex-col gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-white/40 backdrop-blur-md p-4 rounded-xl border border-white/70 shadow-sm flex flex-col gap-3"
                    >
                      <Skeleton className="w-1/3 h-5" />
                      <Skeleton className="w-1/2 h-4" />
                      <Skeleton className="w-full h-8" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {paginatedRecords.map((record) => (
                    <div key={record.id} className="bg-white/50 backdrop-blur-md border border-white/70 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-[#1E293B]">
                              {record.fullName}
                            </h3>
                            {isNewWithinWindow(record.original?.createdAt) && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-xl text-[9px] font-bold bg-blue-50 text-[#1A73E8] border border-blue-100 uppercase tracking-wider animate-pulse">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-semibold text-[#64748B] mt-0.5">
                            Lớp: {record.className}
                          </p>
                          <p className="text-[11px] font-semibold text-[#64748B] mt-0.5">{record.recordCount} lần ghi nhận</p>
                          <p className="text-[11px] font-semibold text-[#64748B] mt-1">
                            Tổng điểm: <span className={record.totalPoints < 0 ? "text-rose-500" : "text-emerald-500"}>{record.points}</span>
                          </p>
                        </div>
                      </div>

                      <div className="bg-slate-50/50 border border-slate-100 rounded-lg p-2.5 text-[12px] text-[#334155] font-medium leading-relaxed">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Ghi nhận gần nhất
                        </span>
                        <span className="block">{record.criteria || "Không có tiêu chí"}</span>
                        <span className="block text-[11px] text-slate-500 mt-1">Ngày: {record.date}</span>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleOpenDetailView(record)}
                          className="px-3.5 py-1.5 bg-[#1A73E8]/10 hover:bg-[#1A73E8]/20 text-[#1A73E8] rounded-xl text-xs font-bold transition-all duration-150 active:scale-[0.97] cursor-pointer shadow-sm border border-[#1A73E8]/10"
                        >
                          Chi tiết
                        </button>
                      </div>
                    </div>
                  ))}
                  {paginatedRecords.length === 0 && (
                    <div className="text-center py-12 text-slate-400 italic text-[12.5px] bg-white/30 border border-dashed border-white/60 rounded-2xl">
                      Không tìm thấy ghi nhận nào.
                    </div>
                  )}
                </div>
              )}
              
              {/* Infinite Scroll Sentinel */}
              <div ref={recordsObserverTargetRef} className="py-4 w-full flex justify-center items-center shrink-0 min-h-[60px] pb-6">
                {isLoadingMoreRecords && (
                  <div className="flex items-center gap-2 text-sm text-[#1A73E8]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang tải thêm...</span>
                  </div>
                )}
                {loadMoreRecordsError && (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm text-rose-500 font-medium">Lỗi khi tải thêm dữ liệu</span>
                    <button
                      onClick={() => fetchAcademicRecords(currentPage, true)}
                      className="text-xs text-[#1A73E8] underline hover:text-[#1557b0]"
                    >
                      Thử lại
                    </button>
                  </div>
                )}
                {!hasMoreRecords && academicRecords.length > 0 && !isLoading && !isLoadingMoreRecords && (
                  <span className="text-sm text-slate-400 italic">Đã hiển thị tất cả ghi nhận.</span>
                )}
              </div>
            </div>

            {/* Desktop View (lg:block - chỉ hiển thị trên desktop) */}
            <div className="hidden lg:block h-full">
              {viewLayout === "card" ? (
                <div className="p-4 bg-blue-50/30 backdrop-blur-md">
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-white/40 backdrop-blur-md p-4 rounded-xl border border-white/70 shadow-sm flex flex-col gap-3"
                      >
                        <div className="flex justify-between items-start">
                          <Skeleton className="w-20 h-4" />
                          <Skeleton className="w-20 h-6 rounded-xl" />
                        </div>
                        <Skeleton className="w-40 h-5" />
                        <Skeleton className="w-32 h-4" />
                        <div className="border-t border-white/60 pt-3 flex justify-between items-center">
                          <Skeleton className="w-24 h-4" />
                          <Skeleton className="w-8 h-8 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedRecords.map((record) => {
                      return (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.15 }}
                          key={record.id}
                          className={`bg-white/45 backdrop-blur-md border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-150 ease-out hover:scale-[1.01] hover:border-[#1A73E8]/50 flex flex-col gap-3 relative group ${
                            selectedIdSet.has(record.selectionId)
                              ? "border-[#1A73E8] bg-blue-50/20 shadow-[0_2px_12px_rgba(26,115,232,0.15)]"
                              : "border-white/70"
                          }`}
                        >
                          {/* Checkbox & Badge */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {record.original && !isStudent && ghiNhanAccess.deleteStudentRecord && (
                                <input
                                  type="checkbox"
                                  aria-label={`Chọn sinh viên ${record.fullName}`}
                                  checked={selectedIdSet.has(record.selectionId)}
                                  onChange={() => toggleSelect(record.selectionId)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              )}
                              <span className="text-[11px] font-bold text-[#64748B]">
                                {record.studentId}
                              </span>
                            </div>
                            <RecordTypeIcons types={record.recordTypes} />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-[#1E293B] leading-snug">
                                {record.fullName}
                              </h3>
                              {isNewWithinWindow(record.original?.createdAt) && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-xl text-[9px] font-bold bg-blue-50 text-[#1A73E8] border border-blue-100 uppercase tracking-wider animate-pulse">
                                    New
                                  </span>
                                )}
                            </div>
                            <p className="text-[11.5px] font-semibold text-[#64748B] mt-0.5">
                              {record.className}
                            </p>
                            <RecordTypeCounts
                              counts={record.recordTypeCounts}
                              total={record.recordCount}
                              className="mt-1"
                            />
                          </div>

                          {/* Latest filtered record */}
                          <div className="bg-white/30 border border-white/50 rounded-xl p-2.5 text-[12px] text-[#1E293B] font-medium min-h-14">
                            <span className="block text-[9px] text-[#64748B] font-semibold uppercase tracking-wider mb-1">
                              Ghi nhận gần nhất
                            </span>
                            <span className="block line-clamp-2">{record.criteria || "Không có tiêu chí"}</span>
                            <span className="block text-[10px] font-semibold text-slate-500 mt-1">Ngày: {record.date}</span>
                          </div>

                          {/* Date, Point & Action */}
                          <div className="border-t border-white/40 pt-2.5 mt-1 flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-[#64748B] font-semibold uppercase tracking-wider">
                                Ngày ghi nhận
                              </span>
                              <span className="text-[11px] font-bold text-[#1E293B] mt-0.5">
                                {record.date}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-500 mt-0.5">
                                {record.recordCount} lần ghi nhận
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span
                                className={`text-sm font-bold ${record.totalPoints < 0 ? "text-rose-500" : "text-emerald-500"}`}
                              >
                                {record.points}
                              </span>
                              <Drawer
                                direction="right"
                                open={openDrawerId === record.id}
                                onOpenChange={(isOpen) =>
                                  handleOpenDrawerChange(isOpen, record)
                                }
                              >
                                <DrawerTrigger asChild>
                                  <button
                                    aria-label="Xem chi tiết"
                                    title="Xem chi tiết"
                                    className="w-8 h-8 rounded-xl border border-white/70 hover:border-[#1A73E8]/50 bg-white/50 hover:bg-white/80 text-[#64748B] hover:text-[#1E293B] flex items-center justify-center transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer shadow-sm"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </DrawerTrigger>

                                <DrawerContent className="w-[450px] sm:max-w-md h-full bg-white/95 backdrop-blur-xl border-l border-white/60 shadow-2xl flex flex-col items-stretch outline-none overflow-hidden">
                                  {/* Modal Header */}
                                  <div className="flex justify-between items-center py-[17px] px-6 border-b border-gray-100 bg-white shrink-0">
                                    <DrawerTitle className="text-base font-bold text-slate-900">
                                      Chi tiết trạng thái
                                    </DrawerTitle>
                                    <DrawerDescription className="sr-only">
                                      Lịch sử và trạng thái chi tiết của bản
                                      ghi.
                                    </DrawerDescription>
                                    <DrawerClose asChild>
                                      <button className="w-6 h-6 flex justify-center items-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-colors">
                                        <X className="w-4 h-4" />
                                      </button>
                                    </DrawerClose>
                                  </div>

                                  <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
                                    {/* Profile overview */}
                                    <div className="flex items-center gap-4">
                                      <div className="w-[60px] h-[60px] rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-slate-200">
                                        <img
                                          src={`https://api.dicebear.com/7.x/notionists/svg?seed=${record.studentId}&backgroundColor=b6e3f4`}
                                          alt="Avatar"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <div className="flex flex-col items-start min-w-0">
                                        <h2 className="text-[18px] font-bold text-slate-900 leading-snug truncate w-full">
                                          {record.fullName}
                                        </h2>
                                        <p className="text-[12px] font-medium text-slate-500 truncate w-full">
                                          Mã SV: {record.studentId} • Lớp{" "}
                                          {record.className}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Summary blocks */}
                                    {(() => {
                                      const khenThuongCount =
                                        drawerHistory.filter(
                                          (mr) =>
                                            mr.recordType === "Khen thưởng",
                                        ).length;
                                      const congDiemCount =
                                        drawerHistory.filter(
                                          (mr) => mr.recordType === "Cộng điểm",
                                        ).length;
                                      const kyLuatCount = drawerHistory.filter(
                                        (mr) => mr.recordType === "Kỷ luật",
                                      ).length;

                                      return (
                                        <>
                                          <div className="grid grid-cols-3 gap-2">
                                            <DrawerTypeFilterButton type="Khen thưởng" count={khenThuongCount} active={drawerHistoryFilter === "Khen thưởng"} loading={drawerLoading} onClick={() => toggleDrawerHistoryFilter("Khen thưởng")} />
                                            <DrawerTypeFilterButton type="Cộng điểm" count={congDiemCount} active={drawerHistoryFilter === "Cộng điểm"} loading={drawerLoading} onClick={() => toggleDrawerHistoryFilter("Cộng điểm")} />
                                            <DrawerTypeFilterButton type="Kỷ luật" count={kyLuatCount} active={drawerHistoryFilter === "Kỷ luật"} loading={drawerLoading} onClick={() => toggleDrawerHistoryFilter("Kỷ luật")} />
                                          <div className="hidden">
                                            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mb-1">
                                                Khen thưởng
                                              </span>
                                              <div className="flex items-baseline gap-0.5 min-h-[24px] justify-center items-center">
                                                {drawerLoading ? (
                                                  <Skeleton className="w-10 h-5 rounded bg-emerald-200/60 animate-pulse" />
                                                ) : (
                                                  <>
                                                    <span className="text-xl font-black text-emerald-600 leading-none">
                                                      {khenThuongCount}
                                                    </span>
                                                    <span className="text-[10px] font-semibold text-emerald-500 ml-0.5">
                                                      lần
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider mb-1">
                                                Cộng điểm
                                              </span>
                                              <div className="flex items-baseline gap-0.5 min-h-[24px] justify-center items-center">
                                                {drawerLoading ? (
                                                  <Skeleton className="w-10 h-5 rounded bg-blue-200/60 animate-pulse" />
                                                ) : (
                                                  <>
                                                    <span className="text-xl font-black text-blue-600 leading-none">
                                                      {congDiemCount}
                                                    </span>
                                                    <span className="text-[10px] font-semibold text-blue-500 ml-0.5">
                                                      lần
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                            <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                              <span className="text-[9px] font-bold text-rose-600 uppercase tracking-wider mb-1">
                                                Kỷ luật
                                              </span>
                                              <div className="flex items-baseline gap-0.5 min-h-[24px] justify-center items-center">
                                                {drawerLoading ? (
                                                  <Skeleton className="w-10 h-5 rounded bg-rose-200/60 animate-pulse" />
                                                ) : (
                                                  <>
                                                    <span className="text-xl font-black text-rose-600 leading-none">
                                                      {kyLuatCount}
                                                    </span>
                                                    <span className="text-[10px] font-semibold text-rose-500 ml-0.5">
                                                      lần
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          </div>

                                          <div className="flex flex-col pb-4">
                                            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                                              Ghi nhận gần đây
                                            </h4>

                                            {drawerLoading ? (
                                              <div className="flex flex-col gap-4 mt-2">
                                                {Array.from({ length: 3 }).map(
                                                  (_, i) => (
                                                    <div
                                                      key={i}
                                                      className="flex gap-4"
                                                    >
                                                      <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                                                      <div className="flex-1 flex flex-col gap-2 pt-0.5">
                                                        <Skeleton className="w-24 h-3" />
                                                        <Skeleton className="w-48 h-4" />
                                                        <Skeleton className="w-16 h-4 rounded" />
                                                      </div>
                                                    </div>
                                                  ),
                                                )}
                                              </div>
                                            ) : visibleDrawerHistory.length === 0 ? (
                                              <div className="text-center py-6 text-slate-400 italic text-[12px]">
                                                Chưa có ghi nhận nào cho học
                                                sinh này.
                                              </div>
                                            ) : (
                                              <div className="flex flex-col relative before:content-[''] before:absolute before:left-3 before:top-4 before:h-[calc(100%-1.5rem)] before:w-[1px] before:bg-slate-100 ml-1">
                                                {visibleDrawerHistory.map((mr, i) => {
                                                  const isKyLuat =
                                                    mr.recordType === "Kỷ luật";
                                                  const isKhenThuong =
                                                    mr.recordType ===
                                                    "Khen thưởng";
                                                  const isExpanded =
                                                    !!expandedCards[i];

                                                  let bulletBg =
                                                    "bg-[#1A73E8] shadow-blue-200/50";
                                                  let badgeClass =
                                                    "bg-blue-500/10 text-[#1A73E8] border border-blue-500/20";
                                                  if (isKhenThuong) {
                                                    bulletBg =
                                                      "bg-emerald-500 shadow-emerald-200/50";
                                                    badgeClass =
                                                      "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20";
                                                  } else if (isKyLuat) {
                                                    bulletBg =
                                                      "bg-rose-500 shadow-rose-200/50";
                                                    badgeClass =
                                                      "bg-rose-500/10 text-rose-700 border border-rose-500/20";
                                                  }

                                                  return (
                                                    <div
                                                      key={mr.id}
                                                      data-testid={`drawer-history-${mr.id}`}
                                                      className="flex gap-4 relative mb-6 last:mb-0"
                                                    >
                                                      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 z-10">
                                                        {isSelectingHistory ? (
                                                          <div
                                                            role="checkbox"
                                                            aria-checked={selectedHistoryItems.includes(mr.id)}
                                                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all duration-150 shadow-sm ring-1 ring-white ${selectedHistoryItems.includes(mr.id) ? "bg-blue-600 border-blue-600 shadow-blue-200/70" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/60"}`}
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setSelectedHistoryItems(
                                                                (prev) =>
                                                                  prev.includes(mr.id)
                                                                    ? prev.filter(
                                                                        (x) =>
                                                                          x !== mr.id,
                                                                      )
                                                                    : [
                                                                        ...prev,
                                                                        mr.id,
                                                                      ],
                                                              );
                                                            }}
                                                          >
                                                            {selectedHistoryItems.includes(mr.id) && (
                                                              <Check
                                                                className="w-3.5 h-3.5 text-white"
                                                                strokeWidth={3}
                                                              />
                                                            )}
                                                          </div>
                                                        ) : (
                                                          <div
                                                            className={`w-3.5 h-3.5 rounded-full ${bulletBg} shadow-sm border-2 border-white box-content`}
                                                          />
                                                        )}
                                                      </div>

                                                      <div className="flex-1 flex flex-col pt-0.5">
                                                        <div
                                                          className="flex justify-between items-start cursor-pointer group"
                                                          onClick={() =>
                                                            toggleExpandCard(i)
                                                          }
                                                        >
                                                          <div className="flex flex-col gap-1 pr-4">
                                                            <span className="text-[11px] font-bold text-slate-500">
                                                              {mr.date}
                                                            </span>
                                                            <span className="text-[13px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                                                              {mr.criteria}
                                                            </span>
                                                            <div className="mt-0.5">
                                                              <span
                                                                className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}
                                                              >
                                                                {mr.recordType}{" "}
                                                                ({mr.points}đ)
                                                              </span>
                                                              {mr.original?.daily_report_id && (
                                                                <span className="ml-1 inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-700 border border-violet-500/20">
                                                                  Ghi nhận lớp
                                                                </span>
                                                              )}
                                                            </div>
                                                          </div>
                                                          <button className="p-1 rounded text-slate-400 group-hover:text-blue-600 mt-1">
                                                            {isExpanded ? (
                                                              <ChevronUp className="w-4 h-4" />
                                                            ) : (
                                                              <ChevronDown className="w-4 h-4" />
                                                            )}
                                                          </button>
                                                        </div>

                                                        <AnimatePresence>
                                                          {isExpanded && (
                                                            <motion.div
                                                              initial={{
                                                                height: 0,
                                                                opacity: 0,
                                                                marginTop: 0,
                                                              }}
                                                              animate={{
                                                                height: "auto",
                                                                opacity: 1,
                                                                marginTop: 12,
                                                              }}
                                                              exit={{
                                                                height: 0,
                                                                opacity: 0,
                                                                marginTop: 0,
                                                              }}
                                                              className="overflow-hidden"
                                                            >
                                                              <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-3">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                  <div className="flex flex-col gap-1">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                                      Tiêu chí
                                                                    </span>
                                                                    <span className="text-[12px] font-semibold text-slate-900">
                                                                      {
                                                                        mr.criteria
                                                                      }
                                                                    </span>
                                                                  </div>
                                                                  <div className="flex flex-col gap-1">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                                      Danh mục
                                                                    </span>
                                                                    <span className="text-[12px] font-semibold text-slate-900">
                                                                      {
                                                                        mr.recordType
                                                                      }
                                                                    </span>
                                                                  </div>
                                                                  <div className="flex flex-col gap-1">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                                      Điểm số
                                                                    </span>
                                                                    <span className="text-[12px] font-semibold text-slate-900">
                                                                      {
                                                                        mr.points
                                                                      }
                                                                      đ
                                                                    </span>
                                                                  </div>
                                                                  <div className="flex flex-col gap-1">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                                      Ngày ghi
                                                                    </span>
                                                                    <span className="text-[12px] font-semibold text-slate-900">
                                                                      {mr.date}
                                                                    </span>
                                                                  </div>
                                                                </div>
                                                                {mr.original
                                                                  ?.description && (
                                                                  <div className="pt-2 border-t border-slate-200/60 flex flex-col gap-1 mt-1">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                                      Mô tả
                                                                    </span>
                                                                    <p className="text-[12px] font-medium text-slate-600 leading-relaxed font-sans">
                                                                      "
                                                                      {
                                                                        mr
                                                                          .original
                                                                          .description
                                                                      }
                                                                      "
                                                                    </p>
                                                                  </div>
                                                                )}
                                                              </div>
                                                            </motion.div>
                                                          )}
                                                        </AnimatePresence>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>

                                  {/* Modal Footer actions */}
                                  {!isStudent && <div className="p-4 border-t border-slate-100 bg-white shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.02)] shrink-0 flex items-center justify-between gap-3">
                                    {isSelectingHistory ? (
                                      <>
                                        <button
                                          onClick={() => {
                                            setIsSelectingHistory(false);
                                            setSelectedHistoryItems([]);
                                          }}
                                          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-slate-50 border border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-colors shadow-sm"
                                        >
                                          Hủy
                                        </button>
                                        <button
                                          onClick={requestHistoryDelete}
                                          disabled={
                                            selectedHistoryItems.length === 0
                                          }
                                          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-rose-50 border border-rose-100 text-[13px] font-bold text-rose-600 hover:bg-rose-100 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          <Trash2 className="w-4 h-4 text-rose-500" />
                                          Xóa ({selectedHistoryItems.length})
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => setIsSelectingHistory(true)}
                                        className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-white border border-slate-200 text-[13px] font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-sm"
                                      >
                                        <CheckSquare className="w-4 h-4 text-slate-600" />
                                        Chọn ghi nhận trong lịch sử
                                      </button>
                                    )}
                                  </div>}
                                </DrawerContent>
                              </Drawer>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
                {paginatedRecords.length === 0 && !isLoading && (
                  <div className="text-center py-12 text-slate-400 italic text-sm">
                    Không tìm thấy ghi nhận nào.
                  </div>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-max">
                <thead className="bg-white/90 backdrop-blur-md sticky top-0 z-10 shadow-sm shadow-slate-100/30 border-b border-white/80">
                  <tr>
                    {!isStudent && (
                      <th className="px-5 py-3 w-12 text-center border-b border-white/80">
                        {ghiNhanAccess.deleteStudentRecord &&
                          paginatedRecords.length > 0 && (
                          <input
                            type="checkbox"
                            aria-label="Chọn tất cả sinh viên"
                            checked={
                              paginatedRecords.every((record) =>
                              selectedIdSet.has(record.selectionId),
                              )
                            }
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        )}
                      </th>
                    )}
                    <th className="px-5 py-3 text-xs font-bold text-[#334155] uppercase tracking-wide border-b border-white/80">
                      Mã SV
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-[#334155] uppercase tracking-wide border-b border-white/80">
                      Họ và tên
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-[#334155] uppercase tracking-wide border-b border-white/80">
                      Lớp
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-[#334155] uppercase tracking-wide border-b border-white/80">
                      Loại ghi nhận
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-[#334155] uppercase tracking-wide border-b border-white/80">
                      Ghi nhận gần nhất
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-[#334155] uppercase tracking-wide border-b border-white/80">
                      Số lần
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-[#334155] uppercase tracking-wide border-b border-white/80">
                      Tính điểm
                    </th>
                    <th className="px-5 py-3 w-16 text-center text-xs font-bold text-[#334155] uppercase tracking-wide border-b border-white/80">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                  {isLoading
                    ? Array.from({ length: itemsPerPage }).map((_, i) => (
                        <tr key={i}>
                          {!isStudent && (
                            <td className="px-5 py-4 border-b border-white/40 text-center">
                              <Skeleton className="w-4 h-4 rounded-xl mx-auto" />
                            </td>
                          )}
                          <td className="px-5 py-4 border-b border-white/40">
                            <Skeleton className="w-20 h-4" />
                          </td>
                          <td className="px-5 py-4 border-b border-white/40">
                            <Skeleton className="w-32 h-4" />
                          </td>
                          <td className="px-5 py-4 border-b border-white/40">
                            <Skeleton className="w-24 h-4" />
                          </td>
                          <td className="px-5 py-4 border-b border-white/40">
                            <Skeleton className="w-24 h-6 rounded-xl" />
                          </td>
                          <td className="px-5 py-4 border-b border-white/40">
                            <Skeleton className="w-40 h-4" />
                            <Skeleton className="w-24 h-3 mt-2" />
                          </td>
                          <td className="px-5 py-4 border-b border-white/40">
                            <Skeleton className="w-10 h-4" />
                          </td>
                          <td className="px-5 py-4 border-b border-white/40">
                            <Skeleton className="w-10 h-4" />
                          </td>
                          <td className="px-5 py-4 border-b border-white/40 text-center">
                            <Skeleton className="w-6 h-6 rounded-xl mx-auto" />
                          </td>
                        </tr>
                      ))
                    : paginatedRecords.map((record) => {
                        return (
                          <motion.tr
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.1 }}
                            key={record.id}
                            className="hover:bg-white/65 transition-colors duration-150 ease-out group"
                          >
                            <MemoizedAcademicRecordTableCells
                              record={record}
                              selected={selectedIdSet.has(record.selectionId)}
                              isStudent={isStudent}
                              canDelete={ghiNhanAccess.deleteStudentRecord}
                              onToggle={toggleSelect}
                            />
                            <td className="px-5 py-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Drawer
                                  direction="right"
                                  open={openDrawerId === record.id}
                                  onOpenChange={(isOpen) =>
                                    handleOpenDrawerChange(isOpen, record)
                                  }
                                >
                                  <DrawerTrigger asChild>
                                    <button
                                      className="text-slate-500 hover:text-[#1A73E8] hover:bg-white/70 p-1.5 rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer"
                                      title="Xem chi tiết"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  </DrawerTrigger>

                                  <DrawerContent className="w-[450px] sm:max-w-md h-full bg-white/90 backdrop-blur-xl border-l border-white/60 flex flex-col items-stretch outline-none overflow-hidden">
                                    {/* Modal Header */}
                                    <div className="flex justify-between items-center py-[17px] px-6 border-b border-gray-100 bg-white shrink-0">
                                      <DrawerTitle className="text-base font-bold text-slate-900">
                                        Chi tiết trạng thái
                                      </DrawerTitle>
                                      <DrawerDescription className="sr-only">
                                        Lịch sử và trạng thái chi tiết của bản
                                        ghi.
                                      </DrawerDescription>
                                      <DrawerClose asChild>
                                        <button className="w-6 h-6 flex justify-center items-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-colors">
                                          <X className="w-4 h-4" />
                                        </button>
                                      </DrawerClose>
                                    </div>

                                    <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
                                      {/* Profile overview */}
                                      <div className="flex items-center gap-4">
                                        <div className="w-[60px] h-[60px] rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-slate-200">
                                          <img
                                            src={`https://api.dicebear.com/7.x/notionists/svg?seed=${record.studentId}&backgroundColor=b6e3f4`}
                                            alt="Avatar"
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                        <div className="flex flex-col items-start min-w-0">
                                          <h2 className="text-[18px] font-bold text-slate-900 leading-snug truncate w-full">
                                            {record.fullName}
                                          </h2>
                                          <p className="text-[12px] font-medium text-slate-500 truncate w-full">
                                            Mã SV: {record.studentId} • Lớp{" "}
                                            {record.className}
                                          </p>
                                        </div>
                                      </div>

                                      {/* Summary blocks */}
                                      {(() => {
                                        const khenThuongCount =
                                          drawerHistory.filter(
                                            (mr) =>
                                              mr.recordType === "Khen thưởng",
                                          ).length;
                                        const congDiemCount =
                                          drawerHistory.filter(
                                            (mr) =>
                                              mr.recordType === "Cộng điểm",
                                          ).length;
                                        const kyLuatCount =
                                          drawerHistory.filter(
                                            (mr) => mr.recordType === "Kỷ luật",
                                          ).length;

                                        return (
                                          <>
                                            <div className="grid grid-cols-3 gap-2">
                                              <DrawerTypeFilterButton type="Khen thưởng" count={khenThuongCount} active={drawerHistoryFilter === "Khen thưởng"} loading={drawerLoading} onClick={() => toggleDrawerHistoryFilter("Khen thưởng")} />
                                              <DrawerTypeFilterButton type="Cộng điểm" count={congDiemCount} active={drawerHistoryFilter === "Cộng điểm"} loading={drawerLoading} onClick={() => toggleDrawerHistoryFilter("Cộng điểm")} />
                                              <DrawerTypeFilterButton type="Kỷ luật" count={kyLuatCount} active={drawerHistoryFilter === "Kỷ luật"} loading={drawerLoading} onClick={() => toggleDrawerHistoryFilter("Kỷ luật")} />
                                            <div className="hidden">
                                              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mb-1">
                                                  Khen thưởng
                                                </span>
                                                <div className="flex items-baseline gap-0.5 min-h-[24px] justify-center items-center">
                                                  {drawerLoading ? (
                                                    <Skeleton className="w-10 h-5 rounded bg-emerald-200/60 animate-pulse" />
                                                  ) : (
                                                    <>
                                                      <span className="text-xl font-black text-emerald-600 leading-none">
                                                        {khenThuongCount}
                                                      </span>
                                                      <span className="text-[10px] font-semibold text-emerald-500 ml-0.5">
                                                        lần
                                                      </span>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider mb-1">
                                                  Cộng điểm
                                                </span>
                                                <div className="flex items-baseline gap-0.5 min-h-[24px] justify-center items-center">
                                                  {drawerLoading ? (
                                                    <Skeleton className="w-10 h-5 rounded bg-blue-200/60 animate-pulse" />
                                                  ) : (
                                                    <>
                                                      <span className="text-xl font-black text-blue-600 leading-none">
                                                        {congDiemCount}
                                                      </span>
                                                      <span className="text-[10px] font-semibold text-blue-500 ml-0.5">
                                                        lần
                                                      </span>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                                <span className="text-[9px] font-bold text-rose-600 uppercase tracking-wider mb-1">
                                                  Kỷ luật
                                                </span>
                                                <div className="flex items-baseline gap-0.5 min-h-[24px] justify-center items-center">
                                                  {drawerLoading ? (
                                                    <Skeleton className="w-10 h-5 rounded bg-rose-200/60 animate-pulse" />
                                                  ) : (
                                                    <>
                                                      <span className="text-xl font-black text-rose-600 leading-none">
                                                        {kyLuatCount}
                                                      </span>
                                                      <span className="text-[10px] font-semibold text-rose-500 ml-0.5">
                                                        lần
                                                      </span>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                            </div>

                                            </div>

                                            <div className="flex flex-col pb-4">
                                              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                                                Ghi nhận gần đây
                                              </h4>

                                              {drawerLoading ? (
                                                <div className="flex flex-col gap-4 mt-2">
                                                  {Array.from({
                                                    length: 3,
                                                  }).map((_, i) => (
                                                    <div
                                                      key={i}
                                                      className="flex gap-4"
                                                    >
                                                      <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                                                      <div className="flex-1 flex flex-col gap-2 pt-0.5">
                                                        <Skeleton className="w-24 h-3" />
                                                        <Skeleton className="w-48 h-4" />
                                                        <Skeleton className="w-16 h-4 rounded" />
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : visibleDrawerHistory.length === 0 ? (
                                                <div className="text-center py-6 text-slate-400 italic text-[12px]">
                                                  Chưa có ghi nhận nào cho học
                                                  sinh này.
                                                </div>
                                              ) : (
                                                <div className="flex flex-col relative before:content-[''] before:absolute before:left-3 before:top-4 before:h-[calc(100%-1.5rem)] before:w-[1px] before:bg-slate-100 ml-1">
                                                  {visibleDrawerHistory.map(
                                                    (mr, i) => {
                                                      const isKyLuat =
                                                        mr.recordType ===
                                                        "Kỷ luật";
                                                      const isKhenThuong =
                                                        mr.recordType ===
                                                        "Khen thưởng";
                                                      const isExpanded =
                                                        !!expandedCards[i];

                                                      let bulletBg =
                                                        "bg-[#1A73E8] shadow-blue-200/50";
                                                      let badgeClass =
                                                        "bg-blue-500/10 text-[#1A73E8] border border-blue-500/20";
                                                      if (isKhenThuong) {
                                                        bulletBg =
                                                          "bg-emerald-500 shadow-emerald-200/50";
                                                        badgeClass =
                                                          "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20";
                                                      } else if (isKyLuat) {
                                                        bulletBg =
                                                          "bg-rose-500 shadow-rose-200/50";
                                                        badgeClass =
                                                          "bg-rose-500/10 text-rose-700 border border-rose-500/20";
                                                      }

                                                      return (
                                                        <div
                                                          key={mr.id}
                                                          data-testid={`drawer-history-${mr.id}`}
                                                          className="flex gap-4 relative mb-6 last:mb-0"
                                                        >
                                                          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 z-10">
                                                            {isSelectingHistory ? (
                                                              <div
                                                                role="checkbox"
                                                                aria-checked={selectedHistoryItems.includes(mr.id)}
                                                                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all duration-150 shadow-sm ring-1 ring-white ${selectedHistoryItems.includes(mr.id) ? "bg-blue-600 border-blue-600 shadow-blue-200/70" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/60"}`}
                                                                onClick={(
                                                                  e,
                                                                ) => {
                                                                  e.stopPropagation();
                                                                  setSelectedHistoryItems(
                                                                    (prev) =>
                                                                      prev.includes(mr.id)
                                                                        ? prev.filter(
                                                                            (
                                                                              x,
                                                                            ) =>
                                                                              x !== mr.id,
                                                                          )
                                                                        : [
                                                                            ...prev,
                                                                            mr.id,
                                                                          ],
                                                                  );
                                                                }}
                                                              >
                                                                {selectedHistoryItems.includes(mr.id) && (
                                                                  <Check
                                                                    className="w-3.5 h-3.5 text-white"
                                                                    strokeWidth={
                                                                      3
                                                                    }
                                                                  />
                                                                )}
                                                              </div>
                                                            ) : (
                                                              <div
                                                                className={`w-3.5 h-3.5 rounded-full ${bulletBg} shadow-sm border-2 border-white box-content`}
                                                              />
                                                            )}
                                                          </div>

                                                          <div className="flex-1 flex flex-col pt-0.5">
                                                            <div
                                                              className="flex justify-between items-start cursor-pointer group"
                                                              onClick={() =>
                                                                toggleExpandCard(
                                                                  i,
                                                                )
                                                              }
                                                            >
                                                              <div className="flex flex-col gap-1 pr-4">
                                                                <span className="text-[11px] font-bold text-slate-500">
                                                                  {mr.date}
                                                                </span>
                                                                <span className="text-[13px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                                                                  {mr.criteria}
                                                                </span>
                                                                <div className="mt-0.5">
                                                                  <span
                                                                    className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}
                                                                  >
                                                                    {
                                                                      mr.recordType
                                                                    }{" "}
                                                                    ({mr.points}
                                                                    đ)
                                                                  </span>
                                                                  {mr.original?.daily_report_id && (
                                                                    <span className="ml-1 inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-700 border border-violet-500/20">
                                                                      Ghi nhận lớp
                                                                    </span>
                                                                  )}
                                                                </div>
                                                              </div>
                                                              <button className="p-1 rounded text-slate-400 group-hover:text-blue-600 mt-1">
                                                                {isExpanded ? (
                                                                  <ChevronUp className="w-4 h-4" />
                                                                ) : (
                                                                  <ChevronDown className="w-4 h-4" />
                                                                )}
                                                              </button>
                                                            </div>

                                                            <AnimatePresence>
                                                              {isExpanded && (
                                                                <motion.div
                                                                  initial={{
                                                                    height: 0,
                                                                    opacity: 0,
                                                                    marginTop: 0,
                                                                  }}
                                                                  animate={{
                                                                    height:
                                                                      "auto",
                                                                    opacity: 1,
                                                                    marginTop: 12,
                                                                  }}
                                                                  exit={{
                                                                    height: 0,
                                                                    opacity: 0,
                                                                    marginTop: 0,
                                                                  }}
                                                                  className="overflow-hidden"
                                                                >
                                                                  <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-3">
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                      <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                                          Tiêu
                                                                          chí
                                                                        </span>
                                                                        <span className="text-[12px] font-semibold text-slate-900">
                                                                          {
                                                                            mr.criteria
                                                                          }
                                                                        </span>
                                                                      </div>
                                                                      <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                                          Danh
                                                                          mục
                                                                        </span>
                                                                        <span className="text-[12px] font-semibold text-slate-900">
                                                                          {
                                                                            mr.recordType
                                                                          }
                                                                        </span>
                                                                      </div>
                                                                      <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                                          Điểm
                                                                          số
                                                                        </span>
                                                                        <span className="text-[12px] font-semibold text-slate-900">
                                                                          {
                                                                            mr.points
                                                                          }
                                                                          đ
                                                                        </span>
                                                                      </div>
                                                                      <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                                          Ngày
                                                                          ghi
                                                                        </span>
                                                                        <span className="text-[12px] font-semibold text-slate-900">
                                                                          {
                                                                            mr.date
                                                                          }
                                                                        </span>
                                                                      </div>
                                                                    </div>
                                                                    {mr.original
                                                                      ?.description && (
                                                                      <div className="pt-2 border-t border-slate-200/60 flex flex-col gap-1 mt-1">
                                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                                          Mô tả
                                                                        </span>
                                                                        <p className="text-[12px] font-medium text-slate-600 leading-relaxed font-sans">
                                                                          "
                                                                          {
                                                                            mr
                                                                              .original
                                                                              .description
                                                                          }
                                                                          "
                                                                        </p>
                                                                      </div>
                                                                    )}
                                                                  </div>
                                                                </motion.div>
                                                              )}
                                                            </AnimatePresence>
                                                          </div>
                                                        </div>
                                                      );
                                                    },
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>

                                    {/* Modal Footer actions */}
                                    {!isStudent && (
                                      <div className="p-4 border-t border-slate-100 bg-white shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.02)] shrink-0 flex items-center justify-between gap-3">
                                        {isSelectingHistory ? (
                                          <>
                                            <button
                                              onClick={() => {
                                                setIsSelectingHistory(false);
                                                setSelectedHistoryItems([]);
                                              }}
                                              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-slate-50 border border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-colors shadow-sm"
                                            >
                                              Hủy
                                            </button>
                                            <button
                                              onClick={requestHistoryDelete}
                                              disabled={
                                                selectedHistoryItems.length === 0
                                              }
                                              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-rose-50 border border-rose-100 text-[13px] font-bold text-rose-600 hover:bg-rose-100 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              <Trash2 className="w-4 h-4 text-rose-500" />
                                              Xóa ({selectedHistoryItems.length})
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            onClick={() => setIsSelectingHistory(true)}
                                            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-white border border-slate-200 text-[13px] font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-sm"
                                          >
                                            <CheckSquare className="w-4 h-4 text-slate-600" />
                                            Chọn ghi nhận trong lịch sử
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </DrawerContent>
                                </Drawer>

                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}

                  {paginatedRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={isStudent ? 9 : 10}
                        className="px-5 py-8 text-center text-sm text-gray-500 bg-gray-50/50"
                      >
                        Không tìm thấy ghi nhận nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            </div>
          </div>

          {/* Pagination Bar Student */}
          {totalRecords > 0 && (
            <div className="hidden lg:block shrink-0">
              <CustomPagination
                currentPage={currentPage}
                pageSize={itemsPerPage}
                totalItems={totalRecords}
                pageSizeOptions={[5, 10, 20, 40, 50, 100, 500]}
                onPageChange={(page) => {
                  setCurrentPage(page);
                  fetchAcademicRecords(page, false);
                }}
                onPageSizeChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                  // useEffect on itemsPerPage change will handle fetch
                }}
                label="bản ghi"
                isLoading={isLoading}
              />
            </div>
          )}
        </>
      ) : (
        // ==================== TAB 2: TÌNH HÌNH LỚP HỌC ====================
        <>
          {/* Table Content class record */}
          <div className="flex-1 overflow-y-auto w-full max-w-full bg-transparent flex flex-col">
            {/* Mobile/Tablet View (Luôn hiển thị dạng thẻ và ẩn trên desktop) */}
            <div className="p-4 bg-blue-50/30 backdrop-blur-md lg:hidden flex-1 overflow-y-auto">
              {isClassLoading ? (
                <div className="flex flex-col gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-white/40 backdrop-blur-md p-4 rounded-xl border border-white/70 shadow-sm flex flex-col gap-3"
                    >
                      <Skeleton className="w-1/3 h-5" />
                      <Skeleton className="w-1/2 h-4" />
                      <Skeleton className="w-full h-8" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {paginatedClassReports.map((report) => {
                    const classObj =
                      typeof report.class_id === "object"
                        ? report.class_id
                        : null;
                    const className = classObj
                      ? getDisplayClassName(classObj.class_name)
                      : "CS-101-A";

                    const totalPresent = report.total_present || 0;
                    const totalAbsent = report.total_absent || 0;
                    const totalStudents = totalPresent + totalAbsent;
                    const percent =
                      totalStudents === 0
                        ? 0
                        : Math.round((totalPresent / totalStudents) * 100);

                    return (
                      <div
                        key={report._id}
                        className="bg-white/50 backdrop-blur-md border border-white/70 rounded-xl p-4 shadow-sm flex flex-col gap-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-sm font-bold text-[#1E293B]">
                              {className}
                            </h3>
                            {classObj?.headquarters && (
                              <p className="text-[10.5px] font-semibold text-[#64748B] mt-0.5">
                                {classObj.headquarters}
                              </p>
                            )}
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[10px] font-bold uppercase border shrink-0 ${
                              percent >= 80
                                ? "bg-emerald-50 text-emerald-600 border-emerald-100/50"
                                : "bg-rose-50 text-rose-600 border-rose-100/50"
                            }`}
                          >
                            Sĩ số: {percent}%
                          </span>
                        </div>

                        <div className="bg-slate-50/50 border border-slate-100 rounded-lg p-2.5 flex items-center justify-between text-[11.5px] text-[#1E293B] font-semibold">
                          <span>
                            Hiện diện: {totalPresent}/{totalStudents}
                          </span>
                          <span>Vắng: {totalAbsent}</span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="text-[11.5px] font-bold text-[#1E293B]">
                            GV: {getClassReportCreatorName(report)}
                          </div>
                          {report.class_note && (
                            <p className="text-[11px] text-[#64748B] font-medium italic">
                              "{report.class_note}"
                            </p>
                          )}
                        </div>

                        <div className="flex justify-between items-center border-t border-white/40 pt-2.5 mt-1">
                          <span className="text-[11px] font-bold text-[#1E293B]">
                            {(() => {
                              const dStr = report.report_date;
                              if (!dStr) return "N/A";
                              if (dStr.includes("/")) return dStr;
                              try {
                                return format(new Date(dStr), "dd/MM/yyyy");
                              } catch {
                                return dStr;
                              }
                            })()}
                          </span>
                          <div className="flex items-center gap-2">
                            <ClassReportDetailDialog
                              report={report}
                              className={className}
                              totalPresent={totalPresent}
                              totalAbsent={totalAbsent}
                              allCriteria={allCriteria}
                            >
                              <button className="px-3.5 py-1.5 bg-[#1A73E8]/10 hover:bg-[#1A73E8]/20 text-[#1A73E8] rounded-xl text-xs font-bold transition-all duration-150 active:scale-[0.97] cursor-pointer shadow-sm border border-[#1A73E8]/10">
                                Chi tiết
                              </button>
                            </ClassReportDetailDialog>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {paginatedClassReports.length === 0 && (
                    <div className="text-center py-12 text-slate-400 italic text-[12.5px] bg-white/30 border border-dashed border-white/60 rounded-2xl">
                      Không tìm thấy báo cáo tình hình lớp học nào phù hợp.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Desktop View (lg:block - chỉ hiển thị trên desktop) */}
            <div className="hidden lg:block h-full">
              {viewLayout === "card" ? (
                <div className="p-4 bg-blue-50/30 backdrop-blur-md">
                {isClassLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-white/40 backdrop-blur-md p-4 rounded-xl border border-white/70 shadow-sm flex flex-col gap-3"
                      >
                        <Skeleton className="w-24 h-5" />
                        <Skeleton className="w-32 h-4" />
                        <Skeleton className="w-full h-8 rounded-xl" />
                        <Skeleton className="w-full h-10 rounded-xl" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedClassReports.map((report, idx) => {
                      const classObj =
                        typeof report.class_id === "object"
                          ? report.class_id
                          : null;
                      const className = classObj
                        ? getDisplayClassName(classObj.class_name)
                        : "CS-101-A";

                      const totalPresent = report.total_present || 0;
                      const totalAbsent = report.total_absent || 0;
                      const totalStudents = totalPresent + totalAbsent;
                      const percent =
                        totalStudents === 0
                          ? 0
                          : Math.round((totalPresent / totalStudents) * 100);

                      return (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.15, delay: idx * 0.03 }}
                          key={report._id}
                          className={`bg-white/45 backdrop-blur-md border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-150 ease-out hover:scale-[1.01] hover:border-[#1A73E8]/50 flex flex-col gap-3 relative group ${
                            selectedReportIds.includes(report._id)
                              ? "border-[#1A73E8] bg-blue-50/20 shadow-[0_2px_12px_rgba(26,115,232,0.15)]"
                              : "border-white/70"
                          }`}
                        >
                          {/* Checkbox & Class Name */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {canDeleteClassReport(report) && (
                                <input
                                  type="checkbox"
                                  checked={selectedReportIds.includes(
                                    report._id,
                                  )}
                                  onChange={() => toggleSelectClass(report._id)}
                                  className="w-4.5 h-4.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              )}
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-[#1E293B]">
                                    {className}
                                  </span>
                                  {isNewWithinWindow(report.createdAt) && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-xl text-[9px] font-bold bg-blue-50 text-[#1A73E8] border border-blue-100 uppercase tracking-wider animate-pulse">
                                        New
                                      </span>
                                    )}
                                </div>
                                {classObj?.headquarters && (
                                  <span className="text-[10.5px] font-semibold text-[#64748B]">
                                    {classObj.headquarters}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border ${
                                percent >= 80
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-100/50"
                                  : "bg-rose-50 text-rose-600 border-rose-100/50"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${percent >= 80 ? "bg-emerald-500" : "bg-rose-500"}`}
                              ></span>
                              Sĩ số: {percent}%
                            </span>
                          </div>

                          {/* Present stats */}
                          <div className="bg-white/30 border border-white/50 rounded-xl p-2.5 flex items-center justify-between text-[11.5px] text-[#1E293B] font-semibold">
                            <span>
                              Hiện diện: {totalPresent}/{totalStudents}
                            </span>
                            <span className="text-[#1A73E8] font-bold bg-blue-50 px-1.5 py-0.5 rounded-xl border border-blue-100/50">
                              {report.recordedStudentsCount || 0} ghi nhận
                            </span>
                            <span>Vắng: {totalAbsent}</span>
                          </div>

                          {/* Teacher name & note */}
                          <div className="flex flex-col gap-1">
                            <div className="text-[12px] font-bold text-[#1E293B]">
                              GV: {getClassReportCreatorName(report)}
                            </div>
                            <div
                              className="text-[11.5px] text-[#64748B] font-medium line-clamp-2 h-8"
                              title={report.class_note || "Ghi nhận đầy đủ..."}
                            >
                              {report.class_note || "Ghi nhận đầy đủ..."}
                            </div>
                          </div>

                          {/* Date & Actions */}
                          <div className="border-t border-white/40 pt-2.5 mt-1 flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-[#64748B] font-semibold uppercase tracking-wider">
                                Ngày báo cáo
                              </span>
                              <span className="text-[11px] font-bold text-[#1E293B] mt-0.5">
                                {(() => {
                                  const dStr = report.report_date;
                                  if (!dStr) return "N/A";
                                  if (dStr.includes("/")) return dStr;
                                  try {
                                    return format(new Date(dStr), "dd/MM/yyyy");
                                  } catch {
                                    return dStr;
                                  }
                                })()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <ClassReportDetailDialog
                                report={report}
                                className={className}
                                totalPresent={totalPresent}
                                totalAbsent={totalAbsent}
                                allCriteria={allCriteria}
                              >
                                <button className="w-8 h-8 rounded-xl border border-white/70 hover:border-[#1A73E8]/50 bg-white/50 hover:bg-white/80 text-[#64748B] hover:text-[#1A73E8] flex items-center justify-center transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer shadow-sm">
                                  <Eye className="w-4 h-4" />
                                </button>
                              </ClassReportDetailDialog>
                              {(ghiNhanAccess.editClassRecord ||
                                canDeleteClassReport(report)) && (
                                <>
                                  {ghiNhanAccess.editClassRecord && (
                                    <button
                                      onClick={() =>
                                        handleEditClassReport(report)
                                      }
                                      className="w-8 h-8 rounded-xl border border-white/70 hover:border-[#1A73E8]/50 bg-white/50 hover:bg-white/80 text-[#64748B] hover:text-[#1A73E8] flex items-center justify-center transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer shadow-sm"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canDeleteClassReport(report) && (
                                    <button
                                      onClick={() =>
                                        setReportToDelete(report._id)
                                      }
                                      className="w-8 h-8 rounded-xl border border-white/70 hover:border-rose-600/50 bg-white/50 hover:bg-white/80 text-[#64748B] hover:text-rose-600 flex items-center justify-center transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer shadow-sm"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
                {paginatedClassReports.length === 0 && !isClassLoading && (
                  <div className="text-center py-12 text-slate-400 italic text-sm bg-white rounded-2xl border border-slate-100">
                    Không tìm thấy báo cáo tình hình lớp học nào phù hợp.
                  </div>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-max">
                <thead className="bg-white/90 backdrop-blur-md sticky top-0 z-10 shadow-sm shadow-slate-100/30 border-b border-white/80">
                  <tr>
                    <th className="px-5 py-3 w-12 text-center border-b border-white/80">
                      {paginatedClassReports.some((report) =>
                        canDeleteClassReport(report),
                      ) && (
                        <input
                          type="checkbox"
                          checked={
                            (() => {
                              const deletableIdsOnPage = paginatedClassReports
                                .filter((report) => canDeleteClassReport(report))
                                .map((report) => report._id);
                              return deletableIdsOnPage.length > 0 &&
                                deletableIdsOnPage.every((id) => selectedReportIds.includes(id));
                            })()
                          }
                          onChange={toggleSelectAllClass}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      )}
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-[#334155] uppercase tracking-wide border-b border-white/80">
                      Lớp học
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-[#334155] uppercase tracking-wide border-b border-white/80">
                      Ngày báo cáo
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-[#334155] uppercase tracking-wide border-b border-white/80">
                      Sĩ số có mặt
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-[#334155] uppercase tracking-wide border-b border-white/80">
                      Ghi nhận sv
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-[#334155] uppercase tracking-wide border-b border-white/80">
                      Giảng viên ghi nhận
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-[#334155] uppercase tracking-wide border-b border-white/80">
                      Ghi chú lớp
                    </th>
                    <th className="px-5 py-3 w-16 text-center text-xs font-bold text-[#334155] uppercase tracking-wide border-b border-white/80">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                  {isClassLoading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-5 py-4 border-b border-white/40 text-center">
                            <Skeleton className="w-4 h-4 rounded-xl mx-auto" />
                          </td>
                          <td className="px-5 py-4 border-b border-white/40">
                            <Skeleton className="w-24 h-4" />
                          </td>
                          <td className="px-5 py-4 border-b border-white/40">
                            <Skeleton className="w-20 h-4" />
                          </td>
                          <td className="px-5 py-4 border-b border-white/40">
                            <Skeleton className="w-28 h-6 rounded-xl" />
                          </td>
                          <td className="px-5 py-4 border-b border-white/40">
                            <Skeleton className="w-24 h-4" />
                          </td>
                          <td className="px-5 py-4 border-b border-white/40">
                            <Skeleton className="w-28 h-4" />
                          </td>
                          <td className="px-5 py-4 border-b border-white/40">
                            <Skeleton className="w-44 h-4" />
                          </td>
                          <td className="px-5 py-4 border-b border-white/40 text-center">
                            <Skeleton className="w-12 h-6 rounded-xl mx-auto" />
                          </td>
                        </tr>
                      ))
                    : paginatedClassReports.map((report, idx) => {
                        const classObj =
                          typeof report.class_id === "object"
                            ? report.class_id
                            : null;
                        const className = classObj
                          ? getDisplayClassName(classObj.class_name)
                          : "CS-101-A";

                        const totalPresent = report.total_present || 0;
                        const totalAbsent = report.total_absent || 0;
                        const totalStudents = totalPresent + totalAbsent;
                        const percent =
                          totalStudents === 0
                            ? 0
                            : Math.round((totalPresent / totalStudents) * 100);

                        return (
                          <motion.tr
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.1, delay: idx * 0.04 }}
                            key={report._id}
                            className="hover:bg-white/65 transition-all duration-150 ease-out group"
                          >
                            <td className="px-5 py-4 w-12 text-center">
                              {canDeleteClassReport(report) && (
                                <input
                                  type="checkbox"
                                  checked={selectedReportIds.includes(
                                    report._id,
                                  )}
                                  onChange={() => toggleSelectClass(report._id)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              )}
                            </td>
                            <td className="px-5 py-4 text-sm font-bold text-[#1E293B]">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span>{className}</span>
                                  {isNewWithinWindow(report.createdAt) && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-xl text-[9px] font-bold bg-blue-50 text-[#1A73E8] border border-blue-100 uppercase tracking-wider animate-pulse">
                                        New
                                      </span>
                                    )}
                                </div>
                                {classObj?.headquarters && (
                                  <span className="text-[11px] font-medium text-[#64748B]">
                                    {classObj.headquarters}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm font-medium text-[#64748B]">
                              {(() => {
                                const dStr = report.report_date;
                                if (!dStr) return "N/A";
                                  if (dStr.includes("/")) return dStr;
                                  try {
                                    return format(new Date(dStr), "dd/MM/yyyy");
                                  } catch {
                                    return dStr;
                                  }
                              })()}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-[#64748B]">
                                  {totalPresent}/{totalStudents}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border ${
                                    percent >= 80
                                      ? "bg-emerald-50 text-emerald-600 border-emerald-100/50"
                                      : "bg-rose-50 text-rose-600 border-rose-100/50"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${percent >= 80 ? "bg-emerald-500" : "bg-rose-500"}`}
                                  ></span>
                                  {percent}%
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm font-semibold text-[#64748B]">
                              {report.recordedStudentsCount || 0} ghi nhận
                            </td>
                            <td className="px-5 py-4 text-sm font-bold text-[#1E293B]">
                              {getClassReportCreatorName(report)}
                            </td>
                            <td
                              className="px-5 py-4 text-sm font-medium text-[#64748B] max-w-[200px] truncate"
                              title={report.class_note || "Ghi nhận đầy đủ..."}
                            >
                              {report.class_note || "Ghi nhận đầy đủ..."}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {/* Chi tiết popover */}
                                <ClassReportDetailDialog
                                  report={report}
                                  className={className}
                                  totalPresent={totalPresent}
                                  totalAbsent={totalAbsent}
                                  allCriteria={allCriteria}
                                >
                                  <button
                                    className="text-slate-500 hover:text-[#1A73E8] hover:bg-white/70 p-1.5 rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer"
                                    title="Xem chi tiết"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </ClassReportDetailDialog>

                                {/* Sửa ghi nhận lớp */}
                                {ghiNhanAccess.editClassRecord && (
                                  <button
                                    onClick={() =>
                                      handleEditClassReport(report)
                                    }
                                    className="text-slate-500 hover:text-[#1A73E8] hover:bg-white/70 p-1.5 rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer"
                                    title="Chỉnh sửa"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                )}

                                {/* Xóa */}
                                {canDeleteClassReport(report) && (
                                  <button
                                    onClick={() =>
                                      setReportToDelete(report._id)
                                    }
                                    className="text-slate-500 hover:text-rose-600 hover:bg-rose-50/50 p-1.5 rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer"
                                    title="Xóa"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}

                  {!isClassLoading && paginatedClassReports.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-8 text-center text-sm text-gray-500 bg-gray-50/50"
                      >
                        Không tìm thấy báo cáo tình hình lớp học nào phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            </div>
          </div>

          {/* Pagination Bar Class */}
          {totalClassReports > 0 && (
            <div className="hidden lg:block shrink-0">
              <CustomPagination
                currentPage={classCurrentPage}
                pageSize={classItemsPerPage}
                totalItems={totalClassReports}
                pageSizeOptions={[5, 10, 20, 40, 50, 100]}
                onPageChange={(page) => {
                  setClassCurrentPage(page);
                }}
                onPageSizeChange={(size) => {
                  setClassItemsPerPage(size);
                  setClassCurrentPage(1);
                }}
                label="báo cáo lớp"
                isLoading={isClassLoading}
              />
            </div>
          )}
        </>
      )}
      </div>

      {activeSubTab === "student" ? (
        <FloatingActionBar
          selectedCount={selectedIds.length}
          onClear={() => setSelectedIds([])}
          variant="dark"
          actions={
            <div className="flex items-center gap-1.5 sm:gap-2">
              {selectedIds.length > 0 && ghiNhanAccess.deleteStudentRecord && (
                <button
                  onClick={prepareDeletePreview}
                  title="Xóa toàn bộ ghi nhận của sinh viên đã chọn"
                  disabled={isDeletingRecords || isPreparingDeletePreview}
                  className="bg-[#e11d48] hover:bg-rose-600 text-white font-bold text-[12px] px-3 sm:px-5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-[0_2px_8px_rgba(225,29,72,0.25)] active:scale-95 cursor-pointer h-9 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={13} strokeWidth={2.5} />
                  <span className="hidden sm:inline">{isPreparingDeletePreview ? "Đang chuẩn bị..." : `Xóa (${selectedIds.length})`}</span>
                  <span className="inline sm:hidden">({selectedIds.length})</span>
                </button>
              )}
            </div>
          }
        />
      ) : (
        <FloatingActionBar
          selectedCount={selectedReportIds.length}
          onClear={() => setSelectedReportIds([])}
          variant="dark"
          actions={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={handleExportSelectedClassExcel}
                className="bg-[#107c41] hover:bg-[#0e6c38] text-white font-bold text-[12px] px-3 sm:px-5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-[0_2px_8px_rgba(16,124,65,0.25)] active:scale-95 cursor-pointer h-9 shrink-0"
              >
                <FileSpreadsheet size={13} strokeWidth={2.5} />
                <span className="hidden sm:inline">Xuất Excel ({selectedReportIds.length})</span>
                <span className="inline sm:hidden">({selectedReportIds.length})</span>
              </button>
              {selectedReportIds.length > 0 &&
                ghiNhanAccess.deleteClassRecord && (
                  <button
                    onClick={() => setIsDeleteClassConfirmOpen(true)}
                    disabled={isDeletingClassReports}
                    className={`bg-[#e11d48] hover:bg-rose-600 text-white font-bold text-[12px] px-3 sm:px-5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-[0_2px_8px_rgba(225,29,72,0.25)] active:scale-95 cursor-pointer h-9 shrink-0 ${isDeletingClassReports ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {isDeletingClassReports ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 size={13} strokeWidth={2.5} />
                    )}
                    <span className="hidden sm:inline">Xóa ({selectedReportIds.length})</span>
                    <span className="inline sm:hidden">({selectedReportIds.length})</span>
                  </button>
                )}
            </div>
          }
        />
      )}

      {/* Confirm delete HSSV */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setDeletePreview(null);
        }}
        onConfirm={handleDelete}
        title="Xác nhận xóa ghi nhận"
        message={
          deletePreview ? (
            <div className="flex flex-col gap-2">
              <span>
                <strong>{deletePreview.groups.length} sinh viên</strong> · <strong>{deletePreview.recordIds.length} ghi nhận</strong> sẽ bị xóa.
              </span>
              {deletePreview.preservedDailyReportCount > 0 && (
                <span className="text-slate-600">
                  Giữ lại <strong>{deletePreview.preservedDailyReportCount} ghi nhận ngày</strong> vì các bản ghi này thuộc báo cáo điểm danh ngày.
                </span>
              )}
              {deletePreview.groups.some((group) => group.error) && (
                <span className="text-amber-700">
                  Không thể kiểm tra {deletePreview.groups.filter((group) => group.error).length} sinh viên.
                </span>
              )}
              {deletePreview.recordIds.length === 0 && !deletePreview.groups.some((group) => group.error) && (
                <span className="text-slate-600">
                  Không có ghi nhận phù hợp để xóa.
                </span>
              )}
            </div>
          ) : (
            "Đang tạo bản xem trước xoá..."
          )
        }
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        disabled={!deletePreview || deletePreview.recordIds.length === 0}
        variant="danger"
      />

      <ConfirmModal
        isOpen={isHistoryDeleteConfirmOpen}
        onClose={() => {
          setIsHistoryDeleteConfirmOpen(false);
          setHistoryDeleteIds([]);
        }}
        onConfirm={confirmHistoryDelete}
        title="Xác nhận xóa ghi nhận"
        message={`Bạn có chắc chắn muốn xóa ${historyDeleteIds.length} ghi nhận đã chọn trong lịch sử sinh viên?`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
      />

      {/* Confirm delete báo cáo lớp */}
      <ConfirmModal
        isOpen={isDeleteClassConfirmOpen}
        onClose={() => setIsDeleteClassConfirmOpen(false)}
        onConfirm={handleDeleteClassReportsBulk}
        title="Xác nhận xóa báo cáo lớp"
        message={`Bạn có chắc chắn muốn xóa ${selectedReportIds.length} báo cáo lớp học đã chọn? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
      />

      {/* Confirm delete 1 báo cáo lớp */}
      <ConfirmModal
        isOpen={reportToDelete !== null}
        onClose={() => setReportToDelete(null)}
        onConfirm={() =>
          reportToDelete && handleDeleteClassReportSingle(reportToDelete)
        }
        title="Xác nhận xóa báo cáo lớp"
        message="Bạn có chắc chắn muốn xóa báo cáo lớp học này? Hành động này không thể hoàn tác."
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
      />

      {/* Import Student Record Popup */}
      <ImportStudentRecordPopup
        isOpen={isImportRecordPopupOpen}
        onClose={() => setIsImportRecordPopupOpen(false)}
        onSuccess={() => {
          setCurrentPage(1);
          refreshAcademicRecords();
        }}
      />
      {/* Import Class Record Popup */}
      <ImportClassRecordPopup
        isOpen={isImportClassRecordPopupOpen}
        onClose={() => setIsImportClassRecordPopupOpen(false)}
        onSuccess={() => {
          setClassCurrentPage(1);
          fetchClassReports();
        }}
      />

      {/* Modal thông báo lỗi từ backend */}
      <Dialog
        open={isDeletingRecords || bulkDeleteResult !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingRecords) setBulkDeleteResult(null);
        }}
      >
        <DialogContent
          onPointerDownOutside={(event) => {
            if (isDeletingRecords) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (isDeletingRecords) event.preventDefault();
          }}
          data-status={bulkDeleteStatus}
          className="max-w-md rounded-2xl border border-white/70 bg-white/45 backdrop-blur-md shadow-sm shadow-slate-300/40"
        >
          <DialogTitle className="font-bold text-[#1E293B]">{isDeletingRecords ? 'Đang xoá ghi nhận' : 'Kết quả xoá ghi nhận'}</DialogTitle>
          <DialogDescription>
            {isDeletingRecords
              ? `Đã xử lý ${bulkDeleteProgress.processed}/${bulkDeleteProgress.total} (${bulkDeletePercent}%).`
              : bulkDeleteResult?.failed.length
                ? `Có ${bulkDeleteResult.failed.length} ghi nhận chưa xoá được và vẫn được giữ lại trong danh sách chọn.`
                : 'Đã xoá thành công toàn bộ ghi nhận đã chọn.'}
          </DialogDescription>
          <div
            aria-live="polite"
            className="flex items-center justify-between rounded-xl border border-white/70 bg-white/50 px-3 py-2 text-xs font-semibold text-[#64748B]"
          >
            <span data-testid="bulk-delete-status">{bulkDeleteStatusLabel}</span>
            <span>{bulkDeletePercent}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Tiến độ xoá ghi nhận"
            aria-valuemin={0}
            aria-valuemax={bulkDeleteProgress.total}
            aria-valuenow={bulkDeleteProgress.processed}
            aria-valuetext={`${bulkDeleteProgress.processed}/${bulkDeleteProgress.total} (${bulkDeletePercent}%)`}
            className="h-2 overflow-hidden rounded-xl bg-slate-100/80"
          >
            <div
              className="h-full rounded-xl bg-[#1A73E8] transition-all duration-150 ease-out"
              style={{ width: `${bulkDeletePercent}%` }}
            />
          </div>
          {!!(bulkDeleteResult?.failed.length || bulkDeleteProgress.failed.length) && (
            <div className="max-h-28 overflow-y-auto rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-700">
              {(bulkDeleteResult?.failed || bulkDeleteProgress.failed).map(item => (
                <div key={item.id}>{item.id}: {item.message}</div>
              ))}
            </div>
          )}
          {!isDeletingRecords && (
            <Button type="button" onClick={() => setBulkDeleteResult(null)} className="rounded-xl transition-all duration-150 ease-out">Đóng</Button>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={isErrorModalOpen}
        onClose={() => setIsErrorModalOpen(false)}
        onConfirm={() => setIsErrorModalOpen(false)}
        title={errorModalTitle}
        message={errorModalMessage}
        confirmLabel="Đã hiểu"
        showCancel={false}
        variant="warning"
      />

      {/* Dialog cấu hình tiêu chí vắng mặt toàn cục */}
      <Dialog
        open={isGlobalConfigModalOpen}
        onOpenChange={setIsGlobalConfigModalOpen}
      >
        <DialogContent className="max-w-[760px] w-[calc(100%-1rem)] sm:w-[95vw] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-white/70 bg-white/45 backdrop-blur-xl shadow-sm shadow-slate-300/40 p-4 sm:p-5 gap-4 text-[#1E293B]">
          <DialogTitle className="text-[17px] font-bold text-[#1E293B] flex items-center gap-2 border-b border-white/70 pb-3">
            <Settings className="w-4 h-4 text-[#1A73E8]" />
            Cấu hình & Tiện ích hệ thống
          </DialogTitle>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            {/* Cột trái: Tiện ích */}
            <div className="flex flex-col gap-3 rounded-2xl border border-white/70 bg-white/40 backdrop-blur-md p-4 shadow-sm shadow-slate-300/40">
              <h4 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                Tiện ích
              </h4>
              <button
                onClick={() => {
                  setIsGlobalConfigModalOpen(false);
                  setIsTrashOpen(true);
                  fetchDeletedItems();
                }}
                className="w-full flex items-center justify-between p-3.5 bg-white/40 border border-white/70 hover:bg-white/65 rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer shadow-sm text-left group"
              >
              
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Trash2 className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[#1E293B]">
                      Thùng rác
                    </div>
                    <div className="text-[11px] text-[#64748B] font-medium mt-0.5">
                      Xem các ghi nhận đã bị xóa gần đây
                    </div>
                  </div>
                </div>
                <ChevronDown
                  className="w-4 h-4 text-slate-400"
                  style={{ transform: "rotate(-90deg)" }}
                />
              </button>
              {activeSubTab === 'student' && ghiNhanAccess.createStudentRecord && (
                <button
                  onClick={() => {
                    setIsGlobalConfigModalOpen(false);
                    setIsImportRecordPopupOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3.5 bg-white/40 border border-white/70 hover:bg-white/65 rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer shadow-sm text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-650 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <FileSpreadsheet className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-[#1E293B]">Import Ghi nhận</div>
                      <div className="text-[11px] text-[#64748B] font-medium mt-0.5">Import ghi nhận HSSV từ file Excel</div>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" style={{ transform: "rotate(-90deg)" }} />
                </button>
              )}
              {activeSubTab === 'class' && ghiNhanAccess.createClassRecord && (
                <button
                  onClick={() => {
                    setIsGlobalConfigModalOpen(false);
                    setIsImportClassRecordPopupOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3.5 bg-white/40 border border-white/70 hover:bg-white/65 rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer shadow-sm text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <FileSpreadsheet className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-[#1E293B]">Import báo cáo lớp</div>
                      <div className="text-[11px] text-[#64748B] font-medium mt-0.5">Import tình hình lớp học và ghi nhận sinh viên từ file Excel</div>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" style={{ transform: "rotate(-90deg)" }} />
                </button>
              )}
            </div>

            {/* Cột phải: Cấu hình */}
            <div className="flex flex-col gap-3 rounded-2xl border border-white/70 bg-white/40 backdrop-blur-md p-4 shadow-sm shadow-slate-300/40">
              <div>
                <h4 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2.5">
                  Cấu hình hiển thị
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setViewLayout("table");
                      localStorage.setItem("ghinhan_view_layout", "table");
                    }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-[12px] font-bold transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer ${
                      viewLayout === "table"
                        ? "bg-blue-50 border-blue-200 text-[#1A73E8] shadow-sm"
                        : "bg-white border-slate-100 text-[#64748B] hover:text-[#1E293B]"
                    }`}
                  >
                    Dạng bảng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewLayout("card");
                      localStorage.setItem("ghinhan_view_layout", "card");
                    }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-[12px] font-bold transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer ${
                      viewLayout === "card"
                        ? "bg-blue-50 border-blue-200 text-[#1A73E8] shadow-sm"
                        : "bg-white border-slate-100 text-[#64748B] hover:text-[#1E293B]"
                    }`}
                  >
                    Dạng thẻ
                  </button>
                </div>
                <div className="mt-3">
                  <Select
                    value={creatorFilter}
                    onValueChange={(
                      value:
                        | "all"
                        | "student"
                        | "teacher"
                        | "admin"
                        | "supervisor",
                    ) => {
                      setCreatorFilter(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8.5 bg-white/50 border border-white/80 text-[#1E293B] hover:bg-white/70 transition-all duration-150 ease-out hover:scale-[1.01] font-semibold text-sm rounded-xl shadow-sm">
                      <SelectValue placeholder="Lọc theo đối tượng tạo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="student">HSSV</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

            </div>
          </div>

          <div className="flex justify-end border-t border-white/70 pt-3">
            <button
              type="button"
              onClick={() => setIsGlobalConfigModalOpen(false)}
              className="bg-[#1A73E8] text-white font-bold rounded-xl px-5 py-1.5 hover:bg-[#1A73E8]/90 transition-all duration-150 ease-out hover:scale-[1.01] text-[12.5px] cursor-pointer border-none shadow-sm outline-none"
            >
              Hoàn tất
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Thùng rác thực tế */}
      <Dialog open={isTrashOpen} onOpenChange={setIsTrashOpen}>
        <DialogContent className="max-w-[900px] w-[calc(100vw-1rem)] max-h-[calc(100vh-1rem)] overflow-hidden rounded-2xl border border-white/75 bg-[#edf2fa] backdrop-blur-xl shadow-sm shadow-slate-300/40 p-4 sm:p-5">
          <DialogTitle className="text-[17px] font-bold text-[#1E293B] flex items-center gap-2 border-b border-white/75 pb-3">
            <Trash2 className="w-4.5 h-4.5 text-rose-500" />
            Thùng rác hệ thống
          </DialogTitle>
          {/* Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/75 mt-4 mb-4 pb-2">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Nội dung thùng rác">
              <button
                type="button"
                onClick={() => setTrashTab("student")}
                role="tab"
                aria-selected={trashTab === "student"}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 ease-out hover:scale-[1.01] border cursor-pointer ${
                  trashTab === "student"
                    ? "border-rose-500/20 bg-rose-500/10 text-rose-600"
                    : "border-white/70 bg-white/40 text-[#64748B] hover:bg-white/70 hover:text-[#1E293B]"
                }`}
              >
                Vi phạm sinh viên ({deletedRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setTrashTab("class")}
                role="tab"
                aria-selected={trashTab === "class"}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 ease-out hover:scale-[1.01] border cursor-pointer ${
                  trashTab === "class"
                    ? "border-rose-500/20 bg-rose-500/10 text-rose-600"
                    : "border-white/70 bg-white/40 text-[#64748B] hover:bg-white/70 hover:text-[#1E293B]"
                }`}
              >
                Báo cáo của lớp ({deletedReports.length})
              </button>
            </div>

            {/* Nút Xóa tất cả */}
            {((trashTab === "student" && deletedRecords.length > 0) ||
              (trashTab === "class" && deletedReports.length > 0)) && (
              <button
                type="button"
                onClick={() => {
                  if (trashTab === "student") {
                    setIsDeleteAllRecordsConfirmOpen(true);
                  } else {
                    setIsDeleteAllReportsConfirmOpen(true);
                  }
                }}
                className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-500/20 flex items-center gap-1.5 transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Xóa tất cả</span>
              </button>
            )}
          </div>

          <div className="mt-2 min-h-0 max-h-[min(56vh,440px)] overflow-y-auto pr-1 custom-scrollbar">
            {isTrashLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                <span>Đang tải dữ liệu thùng rác...</span>
              </div>
            ) : trashTab === "student" ? (
              <>
                {deletedRecords.length > 0 ? (
                  <table className="hidden md:table w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/90 backdrop-blur-md text-[#334155] font-semibold border-b border-white/80">
                        <th className="p-3 border-b border-white/80">
                          Sinh viên
                        </th>
                        <th className="p-3 border-b border-white/80">
                          Nội dung ghi nhận
                        </th>
                        <th className="p-3 border-b border-white/80 text-center">
                          Điểm ảnh hưởng
                        </th>
                        <th className="p-3 border-b border-white/80 text-center">
                          Hành động
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/40">
                      {deletedRecords.map((rec) => (
                        <MemoizedDeletedAcademicRecordRow
                          key={rec._id}
                          record={rec}
                          onRestore={handleRestoreRecordStable}
                          onForceDelete={setRecordToForceDelete}
                        />
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-12 text-[#64748B] italic text-[12.5px]">
                    Thùng rác ghi nhận vi phạm trống.
                  </div>
                )}
                {deletedRecords.length > 0 && (
                  <div className="grid gap-3 md:hidden">
                    {deletedRecords.map((rec) => {
                      const student = typeof rec.student_id === "object" ? rec.student_id : null;
                      return (
                        <article key={rec._id} className="rounded-xl border border-white/75 bg-white/40 backdrop-blur-md p-4 shadow-sm shadow-slate-300/30">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words font-bold text-[#1E293B]">{student?.full_name || "N/A"}</p>
                              <p className="text-[10px] text-[#64748B]">{student?.student_code || ""}</p>
                            </div>
                            <span className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold ${rec.points_effect < 0 ? "border-rose-500/20 bg-rose-500/10 text-rose-600" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"}`}>
                              {rec.points_effect > 0 ? `+${rec.points_effect}` : rec.points_effect}
                            </span>
                          </div>
                          <p className="mt-3 break-words text-xs text-[#1E293B]">{rec.record_title}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => handleRestoreRecordStable(rec._id)} aria-label={`Khôi phục ${student?.full_name || "ghi nhận"}`} className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-[#1A73E8] transition-all duration-150 ease-out hover:bg-blue-500/20">Khôi phục</button>
                            <button type="button" onClick={() => setRecordToForceDelete(rec._id)} aria-label={`Xóa vĩnh viễn ${student?.full_name || "ghi nhận"}`} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-all duration-150 ease-out hover:bg-rose-500/20">Xóa vĩnh viễn</button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                {deletedReports.length > 0 ? (
                  <table className="hidden md:table w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/90 backdrop-blur-md text-[#334155] font-semibold border-b border-white/80">
                        <th className="p-3 border-b border-white/80">
                          Lớp học
                        </th>
                        <th className="p-3 border-b border-white/80">
                          Ngày báo cáo
                        </th>
                        <th className="p-3 border-b border-white/80">
                          Giảng viên ghi nhận
                        </th>
                        <th className="p-3 border-b border-white/80 text-center">
                          Hành động
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/40">
                      {deletedReports.map((rep) => {
                        const classObj =
                          typeof rep.class_id === "object"
                            ? rep.class_id
                            : null;
                        const className = classObj
                          ? getDisplayClassName(classObj.class_name)
                          : "N/A";
                        return (
                          <tr
                            key={rep._id}
                            className="hover:bg-white/60 transition-colors"
                          >
                            <td className="p-3 font-bold text-[#1E293B]">
                              {className}
                            </td>
                            <td className="p-3 text-[#1E293B] font-medium">
                              {rep.report_date
                                ? format(
                                    new Date(rep.report_date),
                                    "dd/MM/yyyy",
                                  )
                                : "N/A"}
                            </td>
                            <td className="p-3 text-[#1E293B] font-semibold">
                              {getClassReportCreatorName(rep)}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleRestoreReport(rep._id)}
                                  className="p-1.5 bg-blue-50/50 text-[#1A73E8] border border-blue-500/10 hover:bg-blue-100/50 rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer"
                                  title="Khôi phục"
                                  aria-label={`Khôi phục ${className}`}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReportToForceDelete(rep._id)
                                  }
                                  className="p-1.5 bg-rose-50/50 text-rose-600 border border-rose-500/10 hover:bg-rose-100/50 rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer"
                                  title="Xóa vĩnh viễn"
                                  aria-label={`Xóa vĩnh viễn ${className}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-12 text-[#64748B] italic text-[12.5px]">
                    Thùng rác báo cáo lớp trống.
                  </div>
                )}
                {deletedReports.length > 0 && (
                  <div className="grid gap-3 md:hidden">
                    {deletedReports.map((rep) => {
                      const classObj = typeof rep.class_id === "object" ? rep.class_id : null;
                      const className = getDisplayClassName(classObj?.class_name);
                      return (
                        <article key={rep._id} className="rounded-xl border border-white/75 bg-white/40 backdrop-blur-md p-4 shadow-sm shadow-slate-300/30">
                          <div className="grid gap-2 text-xs">
                            <div><span className="text-[#64748B]">Lớp học</span><p className="break-words font-bold text-[#1E293B]">{className}</p></div>
                            <div><span className="text-[#64748B]">Ngày báo cáo</span><p className="font-medium text-[#1E293B]">{rep.report_date ? format(new Date(rep.report_date), "dd/MM/yyyy") : "N/A"}</p></div>
                            <div><span className="text-[#64748B]">Giảng viên ghi nhận</span><p className="break-words font-semibold text-[#1E293B]">{getClassReportCreatorName(rep)}</p></div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => handleRestoreReport(rep._id)} aria-label={`Khôi phục ${className}`} className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-[#1A73E8] transition-all duration-150 ease-out hover:bg-blue-500/20">Khôi phục</button>
                            <button type="button" onClick={() => setReportToForceDelete(rep._id)} aria-label={`Xóa vĩnh viễn ${className}`} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-all duration-150 ease-out hover:bg-rose-500/20">Xóa vĩnh viễn</button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-white/75 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsTrashOpen(false);
                setIsGlobalConfigModalOpen(true);
              }}
              className="rounded-xl border border-white/80 bg-white/50 px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all duration-150 ease-out hover:scale-[1.01] hover:bg-white/85 cursor-pointer"
            >
              Quay lại cấu hình
            </button>
            <button
              type="button"
              onClick={() => setIsTrashOpen(false)}
              className="rounded-xl border border-white/70 bg-[#1E293B] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all duration-150 ease-out hover:scale-[1.01] hover:bg-slate-800 cursor-pointer"
            >
              Đóng thùng rác
            </button>
          </div>

          {/* Confirm force delete AcademicRecord */}
          <ConfirmModal
            isOpen={recordToForceDelete !== null}
            onClose={() => setRecordToForceDelete(null)}
            onConfirm={() =>
              recordToForceDelete &&
              handleForceDeleteRecord(recordToForceDelete)
            }
            title="Xác nhận xoá vĩnh viễn"
            message="Bạn có chắc chắn muốn xoá vĩnh viễn ghi nhận rèn luyện này? Hành động này sẽ xoá sạch dữ liệu và không thể hoàn tác."
            confirmLabel="Xoá vĩnh viễn"
            cancelLabel="Huỷ"
            variant="danger"
          />

          {/* Confirm force delete DailyClassReport */}
          <ConfirmModal
            isOpen={reportToForceDelete !== null}
            onClose={() => setReportToForceDelete(null)}
            onConfirm={() =>
              reportToForceDelete &&
              handleForceDeleteReport(reportToForceDelete)
            }
            title="Xác nhận xoá vĩnh viễn"
            message="Bạn có chắc chắn muốn xoá vĩnh viễn báo cáo lớp học này? Hành động này sẽ xoá sạch báo cáo và các ghi nhận vi phạm liên quan vĩnh viễn khỏi database."
            confirmLabel="Xoá vĩnh viễn"
            cancelLabel="Huỷ"
            variant="danger"
          />

          {/* Confirm force delete all AcademicRecords */}
          <ConfirmModal
            isOpen={isDeleteAllRecordsConfirmOpen}
            onClose={() => setIsDeleteAllRecordsConfirmOpen(false)}
            onConfirm={handleForceDeleteAllRecords}
            title="Xác nhận xoá vĩnh viễn tất cả"
            message="Bạn có chắc chắn muốn xoá vĩnh viễn TẤT CẢ ghi nhận vi phạm hiện có trong thùng rác? Hành động này sẽ xoá sạch dữ liệu và không thể hoàn tác."
            confirmLabel="Xoá tất cả"
            cancelLabel="Huỷ"
            variant="danger"
          />

          {/* Confirm force delete all DailyClassReports */}
          <ConfirmModal
            isOpen={isDeleteAllReportsConfirmOpen}
            onClose={() => setIsDeleteAllReportsConfirmOpen(false)}
            onConfirm={handleForceDeleteAllReports}
            title="Xác nhận xoá vĩnh viễn tất cả"
            message="Bạn có chắc chắn muốn xoá vĩnh viễn TẤT CẢ báo cáo lớp học trong thùng rác? Hành động này sẽ xoá sạch tất cả báo cáo và các ghi nhận liên quan vĩnh viễn khỏi database."
            confirmLabel="Xoá tất cả"
            cancelLabel="Huỷ"
            variant="danger"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ViolationItem {
  student_id: string;
  student_name: string;
  student_code: string;
  evaluation_detail_id: string;
  criterion_name: string;
  points_effect: number;
  class_note: string;
}

function ClassReportDetailDialog({
  report,
  className,
  totalPresent,
  totalAbsent,
  allCriteria = [],
  children,
}: {
  report: DailyClassReport;
  className: string;
  totalPresent: number;
  totalAbsent: number;
  allCriteria?: any[];
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [violations, setViolations] = useState<ViolationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const loadHtmlToImage = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).htmlToImage) {
        resolve((window as any).htmlToImage);
        return;
      }
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js";
      script.onload = () => {
        if ((window as any).htmlToImage) {
          resolve((window as any).htmlToImage);
        } else {
          reject(new Error("html-to-image load failed"));
        }
      };
      script.onerror = () => reject(new Error("html-to-image load failed"));
      document.head.appendChild(script);
    });
  };

  const handleCopyAsImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!shareCardRef.current) return;

    const loadingToast = toast.loading("Đang xử lý hình ảnh báo cáo...");
    try {
      const htmlToImageLib = await loadHtmlToImage();
      const blob = await htmlToImageLib.toBlob(shareCardRef.current, {
        pixelRatio: 2,
        backgroundColor: "#f8fafc",
        style: {
          opacity: "1",
          visibility: "visible",
          transform: "none",
        },
      });

      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ]);
        toast.success(
          "Đã sao chép hình ảnh báo cáo vào Clipboard! Bạn có thể gửi đi ngay.",
          { id: loadingToast },
        );
      } else {
        throw new Error("Không thể tạo blob ảnh");
      }
    } catch (err) {
      console.error("Lỗi khi sao chép hình ảnh:", err);
      toast.error("Không thể chụp hình ảnh. Vui lòng thử lại!", {
        id: loadingToast,
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    async function loadViolations() {
      setIsLoading(true);
      try {
        const records = await academicRecordApi.getAcademicRecordsByDailyReport(
          report._id,
        );
        if (records && records.length > 0) {
          const mapped: ViolationItem[] = records.map((rec) => {
            const stObj =
              typeof rec.student_id === "object" ? rec.student_id : null;
            const critObj =
              typeof rec.evaluation_detail_id === "object"
                ? rec.evaluation_detail_id
                : null;
            const criterionId = rec.criterion_id
              ? typeof rec.criterion_id === "object"
                ? rec.criterion_id?._id
                : rec.criterion_id
              : rec.criteria_id
                ? typeof rec.criteria_id === "object"
                  ? rec.criteria_id?._id
                  : rec.criteria_id
                : critObj
                  ? typeof critObj.criterion_id === "object"
                    ? critObj.criterion_id?._id
                    : critObj.criterion_id
                  : rec.evaluation_detail_id;

            const foundCri = allCriteria.find((c) => c._id === criterionId);
            const pts = foundCri
              ? foundCri.score_per_unit || foundCri.min_score || 0
              : rec.points_effect || -5;

            return {
              student_id: stObj ? stObj._id : rec.student_id,
              student_name: stObj ? stObj.full_name : "Sinh viên",
              student_code: stObj ? stObj.student_code : "",
              evaluation_detail_id: criterionId,
              criterion_name: rec.record_title || "Vi phạm",
              points_effect: pts,
              class_note: rec.description || "",
            };
          });
          setViolations(mapped);
        } else {
          setViolations([]);
        }
      } catch (err) {
        console.error("Lỗi khi tải danh sách vi phạm của báo cáo:", err);
        setViolations([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadViolations();
  }, [isOpen, report._id, totalAbsent]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-[440px] sm:max-w-[480px] w-[calc(100%-2rem)] sm:w-full bg-white/45 backdrop-blur-xl rounded-2xl p-6 border border-white/70 shadow-2xl z-50 overflow-hidden gap-0 text-[#1E293B]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-white/60 pb-3 pr-6">
            <div className="flex flex-col">
              <DialogTitle className="font-bold text-[#1E293B] text-[16px]">
                Chi tiết báo cáo buổi học
              </DialogTitle>
              <DialogDescription className="sr-only">
                Xem thông tin chi tiết về sĩ số chuyên cần và danh sách các sinh
                viên bị ghi nhận vi phạm trong buổi học của lớp {className}.
              </DialogDescription>
            </div>
            <span className="text-xs bg-blue-50/80 text-[#1A73E8] px-3 py-0.5 rounded-xl font-bold border border-blue-500/20">
              {className}
            </span>
          </div>

          <div className="flex flex-col gap-2.5 text-xs font-semibold text-[#64748B] bg-white/40 rounded-xl p-3.5 border border-white/60">
            <div className="flex justify-between items-center w-full">
              <span className="text-[#64748B] text-left">Ngày báo cáo:</span>
              <span className="font-bold text-[#1E293B] text-right">
                {(() => {
                  const dStr = report.report_date;
                  if (!dStr) return "N/A";
                  if (dStr.includes("/")) return dStr;
                  try {
                    return format(new Date(dStr), "dd/MM/yyyy");
                  } catch {
                    return dStr;
                  }
                })()}
              </span>
            </div>
            <div className="flex justify-between items-center w-full">
              <span className="text-[#64748B] text-left">Giảng viên:</span>
              <span className="font-bold text-[#1E293B] text-right">
                {getClassReportCreatorName(report)}
              </span>
            </div>
            <div className="flex justify-between items-center w-full">
              <span className="text-[#64748B] text-left">Có mặt:</span>
              <span className="font-bold text-emerald-600 text-right">
                {totalPresent} sinh viên
              </span>
            </div>
            <div className="flex justify-between items-center w-full">
              <span className="text-[#64748B] text-left">Vắng mặt:</span>
              <span className="font-bold text-rose-600 text-right">
                {totalAbsent} sinh viên
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
              Ghi chú lớp
            </span>
            <p className="text-xs text-[#1E293B] italic bg-white/40 rounded-xl p-3 border border-white/60 min-h-[45px] leading-relaxed">
              "{report.class_note || "Không có ghi chú thêm."}"
            </p>
          </div>

          <div className="border-t border-white/60 pt-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                Sinh viên bị ghi nhận vi phạm
              </span>
              <span className="text-[10px] bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded-xl font-bold whitespace-nowrap">
                {violations.length} mục
              </span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-xs text-[#64748B] font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-[#1A73E8]" />
                <span>Đang tải thông tin sinh viên...</span>
              </div>
            ) : violations.length > 0 ? (
              <div className="max-h-[180px] overflow-y-auto pr-1 flex flex-col gap-2 scrollbar-thin">
                {violations.map((violation, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between p-3 rounded-xl border border-white/60 bg-white/50 backdrop-blur-sm shadow-[0px_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    <div className="flex flex-col min-w-0 pr-2 items-start text-left">
                      <span className="text-xs font-bold text-[#1E293B] truncate">
                        {violation.student_name}
                      </span>
                      <span className="text-[10px] text-[#64748B] font-medium mt-0.5 text-left">
                        Tiêu chí: {violation.criterion_name}
                      </span>
                      {violation.class_note && (
                        <span className="text-[10px] text-slate-400 italic mt-0.5 truncate text-left">
                          Ghi chú: {violation.class_note}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-xl shrink-0 border uppercase tracking-wider ${
                        violation.points_effect < 0
                          ? "bg-rose-50 text-rose-600 border-rose-100/50"
                          : "bg-emerald-50 text-emerald-600 border-emerald-100/50"
                      }`}
                    >
                      {violation.points_effect > 0 ? "+" : ""}
                      {violation.points_effect}đ
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl gap-1 text-center backdrop-blur-sm">
                <Check className="w-5 h-5 text-emerald-500 animate-bounce" />
                <span className="text-[11px] text-emerald-700 font-semibold">
                  Lớp học đầy đủ chuyên cần!
                </span>
                <span className="text-[10px] text-[#64748B]">
                  Không ghi nhận trường hợp vi phạm kỷ luật.
                </span>
              </div>
            )}
          </div>

          {/* Footer Actions Panel */}
          <div className="border-t border-white/60 pt-4 flex items-center justify-end">
            <button
              type="button"
              onClick={handleCopyAsImage}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1A73E8] hover:bg-[#1A73E8]/90 text-white text-xs font-bold rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer shadow-sm border-none outline-none w-full"
              title="Sao chép ảnh báo cáo"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Sao chép hình ảnh báo cáo</span>
            </button>
          </div>
        </div>
      </DialogContent>

      {/* Container bọc ngoài ẩn w-0 h-0 để giấu khỏi giao diện, bên trong card render opacity: 1 bình thường để chụp ảnh */}
      <div className="w-0 h-0 overflow-hidden pointer-events-none fixed top-0 left-0 z-[-50]">
        <div
          ref={shareCardRef}
          className="bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] p-8 rounded-3xl border border-slate-200 shadow-2xl w-[480px] flex flex-col gap-5 text-slate-800 font-sans"
        >
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
            <div className="flex flex-col items-start">
              <h3 className="font-bold text-slate-900 text-[18px] text-left">
                Báo cáo tình hình lớp học
              </h3>
            </div>
            <span className="text-xs bg-blue-500 text-white px-3.5 py-1 rounded-full font-bold uppercase tracking-wider">
              {className}
            </span>
          </div>

          <div className="flex flex-col gap-3 text-xs font-semibold text-slate-500 bg-white rounded-2xl p-4.5 border border-slate-100 shadow-[0px_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-center w-full">
              <span className="text-slate-400 text-left">Ngày báo cáo:</span>
              <span className="font-bold text-slate-800 text-right">
                {(() => {
                  const dStr = report.report_date;
                  if (!dStr) return "N/A";
                  if (dStr.includes("/")) return dStr;
                  try {
                    return format(new Date(dStr), "dd/MM/yyyy");
                  } catch {
                    return dStr;
                  }
                })()}
              </span>
            </div>
            <div className="flex justify-between items-center w-full">
              <span className="text-slate-400 text-left">Giảng viên:</span>
              <span className="font-bold text-slate-800 text-right">
                {getClassReportCreatorName(report)}
              </span>
            </div>
            <div className="flex justify-between items-center w-full">
              <span className="text-slate-400 text-left">Có mặt:</span>
              <span className="font-bold text-emerald-600 text-right">
                {totalPresent} sinh viên
              </span>
            </div>
            <div className="flex justify-between items-center w-full">
              <span className="text-slate-400 text-left">Vắng mặt:</span>
              <span className="font-bold text-rose-600 text-right">
                {totalAbsent} sinh viên
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 items-start w-full">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">
              Ghi chú lớp
            </span>
            <p className="text-xs text-slate-650 italic bg-white rounded-xl p-3 border border-slate-100/50 leading-relaxed shadow-[0px_1px_2px_rgba(0,0,0,0.01)] text-left w-full">
              "{report.class_note || "Không có ghi chú thêm."}"
            </p>
          </div>

          <div className="flex flex-col gap-2.5 mt-1 border-t border-slate-200/60 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Sinh viên bị ghi nhận vi phạm
              </span>
              <span className="text-[10px] bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                {violations.length} mục
              </span>
            </div>

            {violations.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {violations.map((violation, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between p-3.5 rounded-xl border border-slate-100/80 bg-white shadow-sm"
                  >
                    <div className="flex flex-col min-w-0 pr-3 items-start text-left">
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {violation.student_name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium mt-0.5 text-left">
                        Tiêu chí: {violation.criterion_name}
                      </span>
                      {violation.class_note && (
                        <span className="text-[10px] text-slate-400 italic mt-0.5 leading-normal text-left">
                          Ghi chú: {violation.class_note}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full shrink-0 border uppercase tracking-wider ${
                        violation.points_effect < 0
                          ? "bg-rose-50 text-rose-600 border-rose-100/50"
                          : "bg-emerald-50 text-emerald-600 border-emerald-100/50"
                      }`}
                    >
                      {violation.points_effect > 0 ? "+" : ""}
                      {violation.points_effect}đ
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 bg-emerald-50/20 border border-emerald-100/40 rounded-2xl gap-1 text-center">
                <Check className="w-5 h-5 text-emerald-500" />
                <span className="text-[11.5px] text-emerald-700 font-bold">
                  Lớp học đầy đủ chuyên cần!
                </span>
                <span className="text-[10px] text-slate-400">
                  Không ghi nhận trường hợp vi phạm kỷ luật.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function StudentRecordPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<"class" | "student">("student");
  const userRole = String(user?.role || '').toLowerCase();
  const isStudent = userRole.includes('student') || userRole.includes('học sinh') || userRole.includes('sinh viên');

  const ghiNhanAccess = usePermission({
    viewClassRecord: "READ_CLASS_RECORD",
  });
  const canAccessClassTab = !isStudent && ghiNhanAccess.viewClassRecord;

  return (
    <>
      <HeaderCustomMappings mappings={{ record: "Ghi nhận" }} />
        <TabNavigation
          tabs={
            isStudent
              ? [
                  { id: "Ghi nhận", label: "Ghi nhận" },
                  { id: "Nhiệm vụ", label: "Nhiệm vụ" },
                ]
              : [
                  { id: "Ghi nhận", label: "Ghi nhận" },
                  { id: "Danh sách", label: "Danh sách" },
                  { id: "Nhiệm vụ", label: "Nhiệm vụ" },
                ]
          }
          activeTab="Ghi nhận"
          onTabChange={(id) => {
            if (id === "Danh sách") {
              router.push("/students");
            } else if (id === "Nhiệm vụ") {
              router.push("/students/tasks");
            }
          }}
        />
        <main className="flex-1 p-3 md:p-4 overflow-hidden flex flex-col bg-transparent relative">
          <GhiNhanTab activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />
        </main>
    </>
  );
}

export default function StudentRecordPage() {
  const { user } = useAuth();
  const userRole = String(user?.role || '').toLowerCase();
  const isStudent = userRole.includes('student') || userRole.includes('học sinh') || userRole.includes('sinh viên');
  const bypassGuard = isStudent;

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-400">
          Loading student record...
        </div>
      }
    >
      <RouteGuard requiredPermission={bypassGuard ? undefined : "READ_STUDENT_RECORD"}>
        <StudentRecordPageContent />
      </RouteGuard>
    </Suspense>
  );
}
