'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  SquarePen,
  Plus,
  Check,
  FileDown,
  CheckCircle,
  XCircle,
  Eye,
  Settings,
  SlidersHorizontal,
  Trash2,
  FileSpreadsheet,
  X
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import dynamic from 'next/dynamic';
const SemesterModal = dynamic(() => import('@/components/grading/SemesterModal'), { ssr: false });
const GradingPdfTemplate = dynamic(() => import('@/components/grading/GradingPdfTemplate'), { ssr: false });
const ConfirmModal = dynamic(() => import('@/components/modals/ConfirmModal'), { ssr: false });
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import FloatingActionBar from '@/components/ui/FloatingActionBar';
import TabNavigation from '@/components/ui/TabNavigation';
import { CustomPagination } from '@/components/ui/pagination';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { StudentAvatar } from '@/components/ui/StudentAvatar';
import ResponsiveDataView, { ResponsiveColumn } from '@/components/ui/ResponsiveDataView';
import { departmentApi } from '@/api/department-api';
import { classApi } from '@/api/class-api';
import { semesterApi } from '@/api/semester-api';
import { summariesPointApi } from '@/api/summaries-point-api';
import { tokenStorage } from '@/api/auth-api';
import { evaluationDetailApi } from '@/api/evaluation-detail-api';
import { categoryApi } from '@/api/category-api';
import { criteriaApi } from '@/api/criteria-api';
import { studentApi } from '@/api/student-api';
import { academicRecordApi } from '@/api/academic-record-api';
import { RouteGuard, usePermission } from '@/components/guards/RouteGuard';
import { useAuth } from '@/providers/auth-provider';
import { useGradingRealtime } from '@/hooks/useGradingRealtime';

const calculateCriterionScore = (criterion: any, count: number) => {
  const maxScore = criterion?.maxScore ?? criterion?.max_score ?? 10;
  const minScore = criterion?.minScore ?? criterion?.min_score ?? 0;
  const pointsPerUnit = criterion?.pointsPerUnit ?? criterion?.score_per_unit ?? 1;
  const rawScore = count * pointsPerUnit;

  return pointsPerUnit >= 0
    ? Math.max(minScore, Math.min(maxScore, rawScore))
    : Math.max(-maxScore, Math.min(0, rawScore));
};

const getEntityId = (value: any) => {
  if (!value) return '';
  if (typeof value === 'object') return value._id || value.id || '';
  return value;
};

const getDefaultSemesterId = (semesters: any[]) => {
  const activeSemester = semesters.find((sem) => sem.status === 'active');
  if (activeSemester?._id) return activeSemester._id;

  const sortedSemesters = [...semesters].sort((a, b) => {
    const aDate = new Date(a.start_date || a.end_date || 0).getTime();
    const bDate = new Date(b.start_date || b.end_date || 0).getTime();
    return bDate - aDate;
  });

  return sortedSemesters[0]?._id || '';
};

const getClassDepartmentId = (cls: any) => {
  return getEntityId(cls?.dept_id);
};

const getClassAdvisorId = (cls: any) => {
  return getEntityId(cls?.advisor_id || cls?.user_id);
};

const getSummaryStudentCode = (summary: any) => {
  const studentObj = typeof summary?.student_id === 'object' ? summary.student_id : null;
  return (
    studentObj?.student_code ||
    studentObj?.id ||
    studentObj?._id ||
    (typeof summary?.student_id === 'string' ? summary.student_id : '') ||
    ''
  );
};

const getSummaryStudentKey = (summary: any, index?: number) => {
  return (
    getSummaryStudentCode(summary) ||
    getEntityId(summary?.student_id) ||
    getEntityId(summary?._id) ||
    `student-${index ?? 'unknown'}`
  );
};

function GradingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { canManageSemester } = usePermission({
    canManageSemester: 'GRADING_SEMESTER_MANAGE',
  });
  const userRole = (user?.role || '').toLowerCase();
  const canSelectSemester =
    canManageSemester || userRole === 'admin' || userRole === 'supervisor';
  const isAdminOrSupervisor = userRole === 'admin' || userRole === 'supervisor';
  const isAdmin = userRole === 'admin';
  const isStudent = userRole === 'student';
  const gradingTabs = [
    ...(isStudent ? [] : [{ id: 'list', label: 'Danh sách' }]),
    { id: 'score', label: 'Chấm điểm' },
    ...(isAdminOrSupervisor ? [{ id: 'reports', label: 'Danh mục' }] : []),
  ];
  const currentUserId = user?.id || (user as any)?._id || '';
  const isTeacher = userRole.includes('teacher') || userRole.includes('advisor');

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(40);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [isTableLoading, setIsTableLoading] = useState<boolean>(false);

  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = React.useRef<HTMLDivElement>(null);
  const mobileScrollRootRef = React.useRef<HTMLDivElement>(null);
  // States cho Khoa, Lớp và Học kì tải từ API
  const [apiDepartments, setApiDepartments] = useState<any[]>([]);
  const [apiClasses, setApiClasses] = useState<any[]>([]);
  const [apiSemesters, setApiSemesters] = useState<any[]>([]);
  const [apiSummariesPoints, setApiSummariesPoints] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [classApprovalMap, setClassApprovalMap] = useState<Record<string, { total: number; locked: number; allApproved: boolean }>>({}); 
  const [apiEvaluationDetails, setApiEvaluationDetails] = useState<any[]>([]);

  const [categories, setCategories] = useState<any[]>([]);

  // States lưu các bộ lọc đã xác nhận (applied)
  const [appliedSemester, setAppliedSemester] = useState<string>('');
  const [appliedDepartment, setAppliedDepartment] = useState<string>('');
  const [appliedClass, setAppliedClass] = useState<string>('');

  // State lưu trữ danh sách MSSV đang chọn
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Đánh dấu đã khôi phục xong filter state từ sessionStorage
  const [isStateRestored, setIsStateRestored] = useState(false);

  // Modal học kì
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportScope, setExportScope] = useState<'class' | 'faculty' | 'all'>('class');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const [deleteBulkConfirm, setDeleteBulkConfirm] = useState<{
    isOpen: boolean;
    message: string;
    summaryIds: string[];
    skippedStudents: string[];
  }>({
    isOpen: false,
    message: '',
    summaryIds: [],
    skippedStudents: []
  });

  const [deleteProgress, setDeleteProgress] = useState<{
    isOpen: boolean;
    total: number;
    completed: number;
  }>({
    isOpen: false,
    total: 0,
    completed: 0,
  });

  const [approveBulkConfirm, setApproveBulkConfirm] = useState<{
    isOpen: boolean;
    message: string;
    summaryIds: string[];
    skippedStudents: string[];
  }>({
    isOpen: false,
    message: '',
    summaryIds: [],
    skippedStudents: []
  });

  const [approveProgress, setApproveProgress] = useState<{
    isOpen: boolean;
    total: number;
    completed: number;
  }>({
    isOpen: false,
    total: 0,
    completed: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsMobileOrTablet(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleRealtimeEvent = (event: any) => {
    const { type, summaryId, data } = event;
    if (
      type === 'summary_updated' ||
      type === 'summary_approved' ||
      type === 'summary_cancelled' ||
      type === 'summary_recomputed'
    ) {
      if (data) {
        setApiSummariesPoints((prev) =>
          prev.map((item) => (item._id === summaryId ? { ...item, ...data } : item))
        );
      }
    } else if (
      type === 'summary_created' || 
      type === 'summary_deleted' || 
      type === 'academic_record_changed'
    ) {
      fetchSummaries(currentPage);
    }
  };

  useGradingRealtime({
    classId: appliedClass,
    semesterId: appliedSemester,
    enabled: !!appliedClass && !!appliedSemester,
    onEvent: handleRealtimeEvent,
  });

  // State confirm hủy duyệt hàng loạt
  const [cancelBulkConfirm, setCancelBulkConfirm] = useState<{
    isOpen: boolean;
    message: string;
    summaryIds: string[];
  }>({
    isOpen: false,
    message: '',
    summaryIds: [],
  });

  const [cancelProgress, setCancelProgress] = useState<{
    isOpen: boolean;
    total: number;
    completed: number;
  }>({
    isOpen: false,
    total: 0,
    completed: 0,
  });

  const visibleClasses = isTeacher
    ? apiClasses.filter((cls) => getClassAdvisorId(cls) === currentUserId)
    : apiClasses;
  const visibleDepartmentIds = new Set(
    visibleClasses.map(getClassDepartmentId).filter(Boolean)
  );
  const visibleDepartments = isTeacher
    ? apiDepartments.filter((dept) => visibleDepartmentIds.has(dept._id))
    : apiDepartments;
  const classesForSelectedDepartment = selectedDepartment
    ? visibleClasses.filter((cls) => getClassDepartmentId(cls) === selectedDepartment)
    : visibleClasses;

  const classMap = React.useMemo(() => {
    const map = new Map<string, any>();
    (apiClasses || []).forEach(c => {
      if (c && c._id) map.set(c._id, c);
    });
    return map;
  }, [apiClasses]);

  const semesterMap = React.useMemo(() => {
    const map = new Map<string, any>();
    (apiSemesters || []).forEach(s => {
      if (s && s._id) map.set(s._id, s);
    });
    return map;
  }, [apiSemesters]);

  const handleDeleteBulkClick = () => {
    if (selectedStudentIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một sinh viên để xóa!');
      return;
    }

    const summaryIdsToDelete: string[] = [];
    const skippedStudents: string[] = [];

    selectedStudentIds.forEach((studentId) => {
      const summary = (apiSummariesPoints || []).find(s => {
        const sId = getEntityId(s.student_id) || getEntityId(s._id);
        return sId === studentId;
      });

      if (summary) {
        summaryIdsToDelete.push(summary._id);
      } else {
        const studentObj = filteredStudents.find(s => s.id === studentId);
        skippedStudents.push(studentObj?.name || studentId);
      }
    });

    if (summaryIdsToDelete.length === 0) {
      toast.error('Không có sinh viên nào có bảng điểm để xóa!');
      return;
    }

    let messageText = '';
    if (skippedStudents.length > 0) {
      messageText = `Có ${skippedStudents.length} sinh viên chưa có bảng điểm (sẽ bị bỏ qua): ${skippedStudents.join(', ')}. Bạn có chắc chắn muốn xóa ${summaryIdsToDelete.length} bảng điểm còn lại không?`;
    } else {
      messageText = `Bạn có chắc chắn muốn xóa ${summaryIdsToDelete.length} bảng điểm đã chọn không?`;
    }

    setDeleteBulkConfirm({
      isOpen: true,
      message: messageText,
      summaryIds: summaryIdsToDelete,
      skippedStudents: skippedStudents
    });
  };

  const executeDeleteBulk = async (summaryIds: string[]) => {
    setDeleteBulkConfirm(prev => ({ ...prev, isOpen: false }));
    const periodIds = Array.from(new Set(summaryIds.map(id => (apiSummariesPoints || []).find(s => s._id === id)?.period_id).filter(Boolean).map(String)));
    if (periodIds.length === 1) {
      try {
        const result = await summariesPointApi.deleteSummariesPointsByPeriod(periodIds[0]);
        toast.success(`Đã xóa ${result.deleted} bảng điểm sau khi kiểm tra snapshot.`);
        await fetchSummaries(1, false, appliedClass, selectedSemester);
      } catch (error: any) {
        toast.error(error?.message || 'Không thể xóa bảng điểm của kỳ này');
      }
      return;
    }
    setDeleteProgress({ isOpen: true, total: summaryIds.length, completed: 0 });

    let successCount = 0;
    let failureCount = 0;
    const failedSummaryIds: string[] = [];

    const promises = summaryIds.map(async (id) => {
      try {
        await summariesPointApi.deleteSummariesPoint(id);
        successCount++;
      } catch (error) {
        failureCount++;
        failedSummaryIds.push(id);
      } finally {
        setDeleteProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
      }
    });

    await Promise.allSettled(promises);

    setDeleteProgress(prev => ({ ...prev, isOpen: false }));

    if (failureCount > 0) {
      toast.warning(`Đã xóa thành công ${successCount} bảng điểm, thất bại ${failureCount} bảng điểm.`);
      
      const failedStudentIds = failedSummaryIds.map(fid => {
        const summary = (apiSummariesPoints || []).find(s => s._id === fid);
        return summary ? getSummaryStudentKey(summary) : null;
      }).filter(Boolean) as string[];
      
      setSelectedStudentIds(failedStudentIds);
    } else {
      toast.success(`Đã xóa thành công ${successCount} bảng điểm!`);
      setSelectedStudentIds([]);
    }

    // Refresh state
    await fetchData();
    if (appliedClass && appliedSemester) {
      fetchSummaries(currentPage);
    }
  };

  const handleExportSummaryExcel = async () => {
    if (!appliedSemester) {
      toast.error('Vui lòng chọn Học kỳ trước khi xuất Excel');
      return;
    }
    if (exportScope === 'class' && !appliedClass) {
      toast.error('Vui lòng chọn Lớp học trước khi xuất Excel');
      return;
    }
    if (exportScope === 'faculty' && !appliedDepartment) {
      toast.error('Vui lòng chọn Khoa trước khi xuất Excel');
      return;
    }

    try {
      setIsExportingExcel(true);
      toast.loading('Đang tạo file Excel...', { id: 'export-excel' });
      
      const blob = await summariesPointApi.exportSummaryExcel({
        semesterId: appliedSemester,
        scope: exportScope,
        ...(exportScope === 'class' ? { classId: appliedClass } : {}),
        ...(exportScope === 'faculty' ? { departmentId: appliedDepartment } : {}),
        mode: 'all_filtered'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const normalizeFilenamePart = (value: string, fallback: string) => {
        const normalized = (value || fallback)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D')
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        return normalized || fallback;
      };
      const scopeName = exportScope === 'class'
        ? currentClassName
        : exportScope === 'faculty'
          ? (apiDepartments.find((department) => department._id === appliedDepartment)?.name || 'KHOA')
          : 'TAT-CA';
      const safeScopeName = normalizeFilenamePart(scopeName, 'TAT-CA');
      a.download = `PL03-TONGHOPRL-${safeScopeName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Xuất file Excel thành công', { id: 'export-excel' });
    } catch (error: any) {
      toast.error(error.message || 'Lỗi kết xuất file Excel', { id: 'export-excel' });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleApproveBulkClick = () => {
    if (selectedStudentIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một sinh viên để duyệt!');
      return;
    }

    const currentUser = tokenStorage.getUser();
    const roleLower = (currentUser?.role || '').toLowerCase();
    const canApprove = roleLower.includes('admin') || roleLower.includes('supervisor') || roleLower.includes('quản sinh');

    if (!canApprove) {
      toast.error('Bạn không có quyền duyệt điểm rèn luyện!');
      return;
    }

    const summaryIdsToApprove: string[] = [];

    selectedStudentIds.forEach((studentId) => {
      const summary = (apiSummariesPoints || []).find(s => {
        const sId = getEntityId(s.student_id) || getEntityId(s._id);
        return sId === studentId;
      });

      if (summary) {
        summaryIdsToApprove.push(summary._id);
      }
    });

    if (summaryIdsToApprove.length === 0) {
      toast.error('Không có sinh viên nào hợp lệ để duyệt!');
      return;
    }

    const messageText = `Bạn có chắc chắn muốn duyệt ${summaryIdsToApprove.length} bảng điểm đã chọn không?`;

    setApproveBulkConfirm({
      isOpen: true,
      message: messageText,
      summaryIds: summaryIdsToApprove,
      skippedStudents: []
    });
  };

  const executeApproveBulk = async (summaryIds: string[]) => {
    setApproveBulkConfirm(prev => ({ ...prev, isOpen: false }));
    setApproveProgress({ isOpen: true, total: summaryIds.length, completed: 0 });

    let successCount = 0;
    let failureCount = 0;
    const successes: any[] = [];

    const promises = summaryIds.map(async (id) => {
      try {
        const updatedSummary = await summariesPointApi.approveGrading(id);
        successes.push({ summaryId: id, data: updatedSummary });
        successCount++;
      } catch (error) {
        failureCount++;
      } finally {
        setApproveProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
      }
    });

    await Promise.allSettled(promises);

    setApproveProgress(prev => ({ ...prev, isOpen: false }));

    if (successes.length > 0) {
      setApiSummariesPoints((prevSummaries) => {
        return prevSummaries.map((summary) => {
          const match = successes.find((s: any) => s.summaryId === summary._id);
          if (match && match.data) {
            return match.data;
          }
          return summary;
        });
      });
    }

    if (failureCount > 0) {
      toast.warning(`Đã duyệt thành công ${successCount} sinh viên, thất bại ${failureCount} sinh viên.`);
    } else {
      toast.success(`Đã duyệt điểm rèn luyện thành công cho ${successCount} sinh viên!`);
      setSelectedStudentIds([]);
    }

    // Refresh approval status after bulk approve
    if (selectedSemester) fetchClassApprovalStatus(selectedSemester);
  };

  // Hàm duyệt điểm rèn luyện cho tài khoản Quản sinh (Supervisor) và Admin
  const handleApproveEvaluation = async (summaryId: string, studentName: string) => {
    const currentUser = tokenStorage.getUser();
    const roleLower = (currentUser?.role || '').toLowerCase();
    const canApprove = roleLower.includes('admin') || roleLower.includes('supervisor') || roleLower.includes('quản sinh');

    if (!canApprove) {
      toast.error('Bạn không có quyền duyệt điểm rèn luyện!');
      return;
    }

    setIsTableLoading(true);
    toast.loading(`Đang duyệt điểm rèn luyện cho sinh viên ${studentName}...`, { id: 'approve-loading' });

    try {
      // Gọi duy nhất API approve trên backend
      const updatedSummary = await summariesPointApi.approveGrading(summaryId);

      // Cập nhật local state: thay thế bảng điểm cũ bằng bảng điểm mới từ backend
      setApiSummariesPoints((prevSummaries) =>
        prevSummaries.map((summary) =>
          summary._id === summaryId ? updatedSummary : summary
        )
      );

      toast.dismiss('approve-loading');
      toast.success(`Đã duyệt rèn luyện thành công cho sinh viên ${studentName}!`);

      // Refresh approval status after single approve
      if (selectedSemester) fetchClassApprovalStatus(selectedSemester);
    } catch (error: any) {
      toast.dismiss('approve-loading');
      toast.error('Lỗi khi duyệt rèn luyện: ' + error.message);
    } finally {
      setIsTableLoading(false);
    }
  };

  // Hàm hủy duyệt điểm rèn luyện hàng loạt (chuyển về inactive và Chưa xếp loại)
  const handleCancelApproveBulk = async () => {
    if (selectedStudentIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một sinh viên để hủy duyệt!');
      return;
    }

    const currentUser = tokenStorage.getUser();
    const userRoleLower = currentUser?.role?.toLowerCase() || '';
    const canApprove = userRoleLower.includes('admin') || userRoleLower.includes('supervisor') || userRoleLower.includes('quản sinh');

    if (!canApprove) {
      toast.error('Bạn không có quyền hủy duyệt điểm rèn luyện!');
      return;
    }

    // Lọc ra các summaryId của các học sinh được chọn
    const summaryIdsToCancel: string[] = [];
    const nonLockedStudents: string[] = [];

    selectedStudentIds.forEach((studentId) => {
      const summary = (apiSummariesPoints || []).find(s => {
        const sId = getEntityId(s.student_id) || getEntityId(s._id);
        return sId === studentId;
      });

      if (summary) {
        if (summary.status === 'locked') {
          summaryIdsToCancel.push(summary._id);
        } else {
          const studentObj = typeof summary.student_id === 'object' ? summary.student_id : null;
          nonLockedStudents.push(studentObj?.full_name || studentObj?.name || studentId);
        }
      }
    });

    if (summaryIdsToCancel.length === 0) {
      toast.error('Không có sinh viên nào đang ở trạng thái đã phê duyệt (Locked) để hủy duyệt!');
      return;
    }

    let messageText = '';
    if (nonLockedStudents.length > 0) {
      messageText = `Có ${nonLockedStudents.length} sinh viên chưa được phê duyệt điểm (sẽ bị bỏ qua): ${nonLockedStudents.join(', ')}. Bạn có muốn tiếp tục hủy duyệt cho ${summaryIdsToCancel.length} sinh viên còn lại không?`;
    } else {
      messageText = `Bạn có chắc chắn muốn hủy duyệt điểm rèn luyện cho ${summaryIdsToCancel.length} sinh viên đã chọn không?`;
    }

    setCancelBulkConfirm({
      isOpen: true,
      message: messageText,
      summaryIds: summaryIdsToCancel
    });
  };

  const executeCancelApproveBulk = async (summaryIds: string[]) => {
    setCancelBulkConfirm(prev => ({ ...prev, isOpen: false }));
    setCancelProgress({ isOpen: true, total: summaryIds.length, completed: 0 });

    let successCount = 0;
    let failureCount = 0;
    const successes: any[] = [];

    const promises = summaryIds.map(async (id) => {
      try {
        const results = await summariesPointApi.cancelApprovalBulk([id]);
        const result = results[0];
        if (result && result.success) {
          successes.push(result);
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        failureCount++;
      } finally {
        setCancelProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
      }
    });

    await Promise.allSettled(promises);

    setCancelProgress(prev => ({ ...prev, isOpen: false }));

    if (successes.length > 0) {
      // Cập nhật local state: thay thế các summary được cập nhật thành công trong apiSummariesPoints
      setApiSummariesPoints((prevSummaries) => {
        return prevSummaries.map((summary) => {
          const match = successes.find((s: any) => s.summaryId === summary._id);
          if (match && match.data) {
            return match.data;
          }
          return summary;
        });
      });
    }

    if (failureCount > 0) {
      toast.warning(`Đã hủy duyệt thành công ${successCount} sinh viên, thất bại ${failureCount} sinh viên.`);
      console.error(`Có ${failureCount} bản ghi lỗi khi hủy duyệt hàng loạt.`);
    } else {
      toast.success(`Đã hủy duyệt điểm rèn luyện thành công cho ${successCount} sinh viên!`);
      setSelectedStudentIds([]); // Xóa danh sách đã chọn
    }

    // Refresh approval status after cancel approve
    if (selectedSemester) fetchClassApprovalStatus(selectedSemester);
  };

  // Fetch approval status for all classes in a semester
  const fetchClassApprovalStatus = async (semesterId: string) => {
    if (!semesterId) return;
    try {
      const map = await summariesPointApi.getClassApprovalStatus(semesterId);
      setClassApprovalMap(map || {});
    } catch (error) {
      console.error('Error fetching class approval status:', error);
    }
  };

  // Hàm tải dữ liệu từ database thông qua API
  const fetchData = async () => {
    try {
      setIsFetching(true);
      const [backendDepts, backendClasses, backendSemesters] = await Promise.all([
        departmentApi.getDepartments(),
        classApi.getClasses(),
        semesterApi.getSemesters()
      ]);

      setApiDepartments(backendDepts || []);
      setApiClasses(backendClasses || []);
      setApiSemesters(backendSemesters || []);
    } catch (error: any) {
      toast.error('Lỗi khi tải dữ liệu từ database: ' + error.message);
    } finally {
      setIsInitialLoading(false);
      setIsFetching(false);
    }
  };

  const fetchCategoriesAndCriteria = async () => {
    if (categories.length > 0) return;
    try {
      const [backendCats, backendCriteria] = await Promise.all([
        categoryApi.getCategories(),
        criteriaApi.getCriteria()
      ]);

      // Map categories và criteria sang cấu trúc chuẩn
      const categoriesMapped = (backendCats || []).map((cat: any) => {
        const catCriteria = (backendCriteria || []).filter((cri: any) => {
          const catId = typeof cri.category_id === 'object' ? cri.category_id?._id : cri.category_id;
          return catId === cat._id;
        });

        return {
          id: cat._id,
          code: cat.category_code,
          title: cat.category_name,
          maxPoints: cat.max_score,
          items: catCriteria.map((cri: any) => ({
            id: cri._id,
            name: cri.criterion_name,
            pointsPerUnit: cri.score_per_unit,
            type: cri.criterion_type === 'ky_luat' ? 'violation' : 'reward',
            maxScore: cri.max_score,
            minScore: cri.min_score
          }))
        };
      });

      setCategories(categoriesMapped);
    } catch (error: any) {
      console.error('Lỗi khi tải cấu hình tiêu chí chấm điểm: ', error);
    }
  };

  useEffect(() => {
    if (isPrintModalOpen) {
      fetchCategoriesAndCriteria();
    }
  }, [isPrintModalOpen]);

  const fetchSummaries = async (pageToFetch: number = currentPage, isLoadMore: boolean = false, overrideClassId?: string, overrideSemesterId?: string) => {
    const classToFetch = overrideClassId || appliedClass;
    const semToFetch = overrideSemesterId || appliedSemester;
    if (!classToFetch || !semToFetch) return;
    try {
      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        setIsFetching(true);
      }
      const res = await summariesPointApi.getSummariesPoints({
        page: pageToFetch,
        limit: pageSize,
        semesterId: semToFetch,
        classId: classToFetch,
        fields: 'details',
      });
      const data = res.data || [];
      
      if (isLoadMore && isMobileOrTablet) {
        setApiSummariesPoints(prev => {
          const newItems = data.filter((item: any) => !prev.some(p => p._id === item._id));
          return [...prev, ...newItems];
        });
      } else {
        setApiSummariesPoints(data);
      }
      
      setTotalItems(res.meta?.total || 0);
      setHasMore(res.meta?.totalPages ? pageToFetch < res.meta.totalPages : data.length > 0);


    } catch (e) {
      console.error('Error fetching summaries:', e);
    } finally {
      setIsFetching(false);
      if (isLoadMore) {
        setIsLoadingMore(false);
      }
    }
  };

  const { isLoading: authLoading } = useAuth();

  // Fetch class approval status when selectedSemester changes
  useEffect(() => {
    if (selectedSemester) {
      fetchClassApprovalStatus(selectedSemester);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSemester]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (isStateRestored && appliedClass && appliedSemester) {
      const isLoadMore = isMobileOrTablet && currentPage > 1;
      fetchSummaries(currentPage, isLoadMore);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, appliedClass, appliedSemester, isStateRestored]);

  useEffect(() => {
    if (!isMobileOrTablet || !appliedClass || !appliedSemester) return;

    const target = observerTarget.current;
    const root = mobileScrollRootRef.current;
    if (!target || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetching && !isLoadingMore) {
          setCurrentPage(prev => prev + 1);
        }
      },
      { root: root, rootMargin: '400px 0px', threshold: 0 }
    );

    observer.observe(target);

    return () => {
      observer.unobserve(target);
      observer.disconnect();
    };
  }, [isMobileOrTablet, appliedClass, appliedSemester, hasMore, isFetching, isLoadingMore]);


  // Effect 1: Khôi phục trạng thái từ sessionStorage khi mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDept = sessionStorage.getItem('grading_selectedDept') || '';
      const savedClass = sessionStorage.getItem('grading_selectedClass') || '';
      const savedSem = sessionStorage.getItem('grading_selectedSem') || '';
      const savedAppliedDept = sessionStorage.getItem('grading_appliedDept') || '';
      const savedAppliedClass = sessionStorage.getItem('grading_appliedClass') || '';
      const savedAppliedSem = sessionStorage.getItem('grading_appliedSem') || '';
      const savedSearch = sessionStorage.getItem('grading_search') || '';
      const savedPage = sessionStorage.getItem('grading_page') || '1';
      const isMobile = window.innerWidth < 1024;

      setSelectedDepartment(savedDept);
      setSelectedClass(savedClass);
      setSelectedSemester(savedSem);
      setAppliedDepartment(savedAppliedDept);
      setAppliedClass(savedAppliedClass);
      setAppliedSemester(savedAppliedSem);
      setSearchTerm(savedSearch);
      setCurrentPage(isMobile ? 1 : Number(savedPage));
    }
    setIsStateRestored(true);
  }, []);

  // Effect 2: Đồng bộ hóa state sang sessionStorage bất cứ khi nào có thay đổi
  useEffect(() => {
    if (isStateRestored && typeof window !== 'undefined') {
      sessionStorage.setItem('grading_selectedDept', selectedDepartment);
      sessionStorage.setItem('grading_selectedClass', selectedClass);
      sessionStorage.setItem('grading_selectedSem', selectedSemester);
      sessionStorage.setItem('grading_appliedDept', appliedDepartment);
      sessionStorage.setItem('grading_appliedClass', appliedClass);
      sessionStorage.setItem('grading_appliedSem', appliedSemester);
      sessionStorage.setItem('grading_search', searchTerm);
      sessionStorage.setItem('grading_page', String(currentPage));
    }
  }, [
    selectedDepartment,
    selectedClass,
    selectedSemester,
    appliedDepartment,
    appliedClass,
    appliedSemester,
    searchTerm,
    currentPage,
    isStateRestored
  ]);

  useEffect(() => {
    if (isStudent) {
      router.replace('/grading/score');
    }
  }, [isStudent, router]);

  useEffect(() => {
    if (!isStateRestored || apiSemesters.length === 0) return;

    const defaultSemesterId = getDefaultSemesterId(apiSemesters);
    if (!defaultSemesterId) return;

    if (!canSelectSemester) {
      if (selectedSemester !== defaultSemesterId) {
        setSelectedSemester(defaultSemesterId);
      }
      if (appliedSemester !== defaultSemesterId) {
        setAppliedSemester(defaultSemesterId);
      }
      return;
    }

    if (!selectedSemester) {
      setSelectedSemester(defaultSemesterId);
    }
    if (!appliedSemester) {
      setAppliedSemester(defaultSemesterId);
    }
  }, [
    apiSemesters,
    appliedSemester,
    canSelectSemester,
    isStateRestored,
    selectedSemester,
  ]);

  useEffect(() => {
    if (!isStateRestored || !isTeacher) return;

    const teacherClasses = apiClasses.filter(
      (cls) => getClassAdvisorId(cls) === currentUserId
    );

    if (teacherClasses.length === 0) {
      if (selectedDepartment) setSelectedDepartment('');
      if (selectedClass) setSelectedClass('');
      if (appliedDepartment) setAppliedDepartment('');
      if (appliedClass) setAppliedClass('');
      return;
    }

    const selectedClassObj = teacherClasses.find((cls) => cls._id === selectedClass);
    const appliedClassObj = teacherClasses.find((cls) => cls._id === appliedClass);
    const selectedDepartmentClasses = selectedDepartment
      ? teacherClasses.filter((cls) => getClassDepartmentId(cls) === selectedDepartment)
      : teacherClasses;
    const appliedDepartmentClasses = appliedDepartment
      ? teacherClasses.filter((cls) => getClassDepartmentId(cls) === appliedDepartment)
      : teacherClasses;
    const nextSelectedClass =
      selectedClassObj || selectedDepartmentClasses[0] || teacherClasses[0];
    const nextAppliedClass =
      appliedClassObj || appliedDepartmentClasses[0] || nextSelectedClass;
    const nextSelectedDeptId = getClassDepartmentId(nextSelectedClass);
    const nextAppliedDeptId = getClassDepartmentId(nextAppliedClass);

    if (selectedClass !== nextSelectedClass._id) {
      setSelectedClass(nextSelectedClass._id);
    }
    if (selectedDepartment !== nextSelectedDeptId) {
      setSelectedDepartment(nextSelectedDeptId);
    }
    if (appliedClass !== nextAppliedClass._id) {
      setAppliedClass(nextAppliedClass._id);
    }
    if (appliedDepartment !== nextAppliedDeptId) {
      setAppliedDepartment(nextAppliedDeptId);
    }
  }, [
    apiClasses,
    appliedClass,
    appliedDepartment,
    currentUserId,
    isStateRestored,
    isTeacher,
    selectedClass,
    selectedDepartment,
  ]);

  const handleConfirmFilter = async () => {
    if (!selectedClass) {
      toast.warning('Vui lòng chọn lớp học trước khi xác nhận!');
      return;
    }
    if (!selectedSemester) {
      toast.warning('Vui lòng chọn học kỳ trước khi xác nhận!');
      return;
    }

    try {
      setIsTableLoading(true);

      // Gọi API khởi tạo bảng điểm hàng loạt ở Backend
      const initRes = await summariesPointApi.initializeClass(selectedClass, selectedSemester);
      if (initRes.success) {
        if (initRes.createdCount > 0) {
          toast.success(`Đã tự động khởi tạo bảng điểm cho ${initRes.createdCount} sinh viên mới!`);
        }
      }

      // Load lại dữ liệu và áp dụng bộ lọc
      await fetchData();

      setCurrentPage(1);
      setHasMore(true);
      setIsLoadingMore(false);
      setApiSummariesPoints([]);

      setAppliedSemester(selectedSemester);
      setAppliedDepartment(selectedDepartment);
      setAppliedClass(selectedClass);

      await fetchSummaries(1, false, selectedClass, selectedSemester);

      toast.success('Đã cập nhật danh sách sinh viên theo bộ lọc!');
    } catch (error: any) {
      toast.error('Lỗi khi cập nhật danh sách rèn luyện: ' + error.message);
    } finally {
      setIsTableLoading(false);
    }
  };

  // Lọc và map dữ liệu từ summaries-point-api sang dạng tương thích với bảng hiển thị
  const filteredStudents = !appliedClass
    ? []
    : (apiSummariesPoints || [])
      .map((summary, idx) => {
        const studentObj = typeof summary.student_id === 'object' ? summary.student_id : null;
        const studentObjectId = getEntityId(summary.student_id) || getEntityId(summary._id);
        const studentCode = studentObj?.student_code || '';
        const studentName = studentObj?.full_name || studentObj?.name || 'Chưa rõ';
        const studentClassId = studentObj?.class_id?._id || studentObj?.class_id || studentObj?.classId || '';

        const semId = typeof summary.semester_id === 'object' ? summary.semester_id?._id : summary.semester_id;

        const classObj = classMap.get(studentClassId);
        const deptId = classObj ? (typeof classObj.dept_id === 'object' ? classObj.dept_id?._id : classObj.dept_id) : '';

        const studentDob = studentObj?.date_bir || '';

        return {
          id: studentObjectId,
          studentCode,
          name: studentName,
          score: summary.total_score || 0,
          grading: summary.grading || 'Chưa xếp loại',
          status: summary.status || 'draft',
          classId: studentClassId,
          semesterId: semId,
          departmentId: deptId,
          summaryId: summary._id,
          dob: studentDob,
          details: summary.details || []
        };
      })
      .filter(student => {
        const matchesSearch =
          student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.studentCode.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesSearch;
      });

  const currentSemesterObj = semesterMap.get(appliedSemester);
  const isSemesterActive = currentSemesterObj ? currentSemesterObj.status === 'active' : false;

  const getRank = (score: number) => {
    if (score === 0) return { label: 'Chưa xếp loại', color: 'bg-slate-500/10 text-[#64748B] border-slate-500/20' };
    if (score >= 90) return { label: 'Xuất sắc', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20' };
    if (score >= 80) return { label: 'Tốt', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' };
    if (score >= 70) return { label: 'Khá', color: 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20' };
    if (score >= 50) return { label: 'Trung bình', color: 'bg-purple-500/10 text-purple-700 border-purple-500/20' };
    return { label: 'Yếu', color: 'bg-rose-500/10 text-rose-700 border-rose-500/20' };
  };

  const getRankColor = (label: string) => {
    if (label === 'Xuất sắc') return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    if (label === 'Tốt') return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
    if (label === 'Khá') return 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20';
    if (label === 'Trung bình') return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
    if (label === 'Yếu') return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
    return 'bg-slate-500/10 text-[#64748B] border-slate-500/20';
  };

  // Chuẩn bị dữ liệu cho PDF template in ấn
  const selectedStudentsData = filteredStudents.filter(std => selectedStudentIds.includes(std.id));
  const currentClassObj = classMap.get(appliedClass);
  const currentClassName = currentClassObj ? currentClassObj.class_name : '';
  const currentSemesterName = currentSemesterObj ? currentSemesterObj.semester_name : '';

  // Build normalized evaluation scores map with full detail data for PDF
  // Uses NormalizedEvalDetail to carry all score fields (not just count)
  // so the PDF template can apply the correct score priority chain.
  const evaluationScoresMap: Record<string, Record<string, {
    count: number;
    finalScore: number | null;
    teacherScore: number | null;
    studentScore: number | null;
    systemScore: number | null;
    selectedOptionScore: number | null;
  }>> = {};
  selectedStudentsData.forEach(student => {
    evaluationScoresMap[student.id] = {};

    const studentDetails = student.details || [];

    studentDetails.forEach(detail => {
      const criterionId = typeof detail.criterion_id === 'object' ? detail.criterion_id?._id : detail.criterion_id;
      if (criterionId) {
        evaluationScoresMap[student.id][criterionId] = {
          count: detail.current_count ?? 0,
          finalScore: detail.final_score ?? null,
          teacherScore: detail.gv_score ?? null,
          studentScore: detail.sv_score ?? null,
          systemScore: detail.system_score ?? null,
          selectedOptionScore: detail.selected_option_score ?? null,
        };
      }
    });
  });

  const columns: ResponsiveColumn<any>[] = [
    {
      key: 'studentCode',
      header: 'Mã sinh viên',
      priority: 'secondary',
      className: 'text-sm font-medium text-[#475569]',
    },
    {
      key: 'name',
      header: 'Tên',
      priority: 'primary',
      render: (_, student) => (
        <div className="flex items-center gap-[12px]">
          <StudentAvatar fullName={student.name} sizeClass="w-[36px] h-[36px]" />
          <div>
            <div className="font-semibold text-[14px] text-[#0f172a]">{student.name}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'classId',
      header: 'Lớp',
      priority: 'metadata',
      render: (_, student) => {
        return classMap.get(student.classId)?.class_name || student.classId;
      },
    },
    {
      key: 'score',
      header: 'Tổng điểm',
      priority: 'metadata',
      className: 'text-center',
      render: (_, student) => {
        const rank = getRank(student.score);
        return (
          <span className={`inline-flex items-center justify-center px-3 py-1 border rounded-xl text-[13px] font-semibold backdrop-blur-sm shadow-sm ${rank.color}`}>
            {student.score}/100
          </span>
        );
      },
    },
    {
      key: 'grading',
      header: 'Xếp loại',
      priority: 'metadata',
      className: 'text-center',
      render: (_, student) => (
        <span className={`px-3 py-1 border rounded-xl text-[11px] font-bold uppercase tracking-tight backdrop-blur-sm shadow-sm ${getRankColor(student.grading)}`}>
          {student.grading}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Hành động',
      priority: 'action',
      className: 'text-right',
      render: (_, student) => {
        const currentUser = tokenStorage.getUser();
        const userRoleLower = currentUser?.role?.toLowerCase() || '';
        const canApprove = userRoleLower.includes('admin') || userRoleLower.includes('supervisor') || userRoleLower.includes('quản sinh');
        const isApproved = student.status === 'locked';
        const hasDetails = (student.details || []).some((detail: any) => (detail.current_count || 0) > 0);
        const hasEvaluations = hasDetails;

        return (
          <div className="flex gap-2 justify-end items-center" onClick={(e) => e.stopPropagation()}>
            {isSemesterActive && student.status !== 'locked' ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const query = new URLSearchParams();
                  query.set('studentId', student.id);
                  if (appliedClass) query.set('classId', appliedClass);
                  if (appliedSemester) query.set('semesterId', appliedSemester);
                  router.push(`/grading/score?${query.toString()}`);
                }}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 hover:scale-[1.05] transition-all duration-150 ease-out active:scale-95 cursor-pointer shadow-sm"
                title="Chấm điểm sinh viên"
              >
                <SquarePen size={15} />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const query = new URLSearchParams();
                  query.set('studentId', student.id);
                  if (appliedClass) query.set('classId', appliedClass);
                  if (appliedSemester) query.set('semesterId', appliedSemester);
                  query.set('view', 'true');
                  router.push(`/grading/score?${query.toString()}`);
                }}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/60 border border-white/80 text-slate-600 hover:bg-white/90 hover:scale-[1.05] transition-all duration-150 ease-out active:scale-95 cursor-pointer shadow-sm"
                title="Xem chi tiết điểm"
              >
                <Eye size={15} />
              </button>
            )}
            {canApprove && (isApproved || isSemesterActive) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleApproveEvaluation(student.summaryId, student.name);
                }}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 ease-out active:scale-95 shadow-sm ${isApproved
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 cursor-pointer hover:scale-[1.05]'
                  : 'bg-white/60 border border-white/80 text-slate-400 hover:bg-white/90 hover:scale-[1.05] cursor-pointer'
                  }`}
                title={
                  isApproved
                    ? "Phê duyệt lại điểm rèn luyện (Đã duyệt)"
                    : "Phê duyệt điểm rèn luyện"
                }
              >
                <CheckCircle size={15} />
              </button>
            )}
          </div>
        );
      }
    }
  ];

  const renderMobileCard = (student: any, index: number) => {
    const isChecked = selectedStudentIds.includes(student.id);
    
    return (
      <div 
        key={student.id}
        className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl p-4 shadow-sm flex flex-col gap-3 transition-all duration-150 ease-out hover:scale-[1.01] hover:bg-white/60"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => {
                setSelectedStudentIds(prev => 
                  e.target.checked ? [...prev, student.id] : prev.filter(id => id !== student.id)
                );
              }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer shrink-0"
            />
            <div className="min-w-0">
              <div className="font-bold text-sm text-[#1E293B] truncate">
                {columns.find(c => c.key === 'name')?.render?.(student.name, student)}
              </div>
              <div className="text-xs text-[#64748B] mt-0.5 truncate">
                {student.studentCode}
              </div>
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center gap-1.5 justify-end">
             {columns.find(c => c.key === 'actions')?.render?.(null, student)}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 pt-3 border-t border-white/40 text-xs">
          <div className="flex justify-between items-center gap-2">
            <span className="text-[#64748B] font-semibold shrink-0">Tổng điểm:</span>
            <span className="text-slate-800 font-bold text-right truncate max-w-[200px]">
              {columns.find(c => c.key === 'score')?.render?.(student.score, student)}
            </span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-[#64748B] font-semibold shrink-0">Xếp loại:</span>
            <span className="text-slate-800 font-bold text-right truncate max-w-[200px]">
              {columns.find(c => c.key === 'grading')?.render?.(student.grading, student)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
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

          <TabNavigation
            tabs={gradingTabs}
            activeTab={isStudent ? 'score' : 'list'}
            onTabChange={(id) => {
              if (id === 'score') {
                router.push('/grading/score');
              } else if (id === 'reports') {
                router.push('/grading/categories');
              }
            }}
          />

          <main className="flex-1 p-4 md:px-8 flex flex-col gap-3 w-full overflow-hidden">
            {/* Desktop Filters (Visible only on lg and above) */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="hidden lg:flex relative z-20 w-full max-w-full min-w-0 flex-nowrap items-center gap-3 shrink-0 min-h-[48px] overflow-x-hidden"
            >
              <div className={`${isSearchExpanded ? 'min-w-0 flex-1 basis-[240px]' : 'w-9 h-9 shrink-0'} relative transition-all duration-300 ease-in-out`}>
                {!isSearchExpanded ? (
                  <button
                    type="button"
                    onClick={() => setIsSearchExpanded(true)}
                    className="w-full h-full rounded-xl bg-white/50 border border-white/80 hover:bg-white/70 flex items-center justify-center text-gray-500 transition-all duration-150 ease-out shadow-sm group"
                    title="Mở tìm kiếm"
                  >
                    <Search size={18} className="group-hover:scale-110 transition-transform" />
                  </button>
                ) : (
                  <>
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                      <Search size={18} />
                    </div>
                    <input
                      type="text"
                      placeholder="Tìm kiếm tên sinh viên hoặc MSSV..."
                      className="w-full bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl pl-10 pr-10 py-2 text-[13px] font-medium placeholder:text-slate-400 focus:bg-white/70 focus:ring-0 focus:ring-transparent focus:border-white/80 transition-all duration-150 ease-out outline-none"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setIsSearchExpanded(false)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-black/5 transition-colors"
                      title="Đóng tìm kiếm"
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>

              {/* Select Học kì */}
              <div className={`shrink-0 items-center gap-2 ${isSearchExpanded ? 'hidden' : 'flex'}`}>
                <div className="min-w-[160px] flex-1 md:flex-initial">
                  <Select
                    value={selectedSemester}
                    onValueChange={(val: string) => {
                      if (canSelectSemester) {
                        setSelectedSemester(val);
                      }
                    }}
                    disabled={!canSelectSemester}
                  >
                    <SelectTrigger
                      className="h-9 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-[13px] font-medium text-[#1E293B] focus-within:bg-white/70 focus-within:ring-0 focus-within:ring-transparent focus-within:border-white/80 transition-all duration-150 ease-out shadow-none disabled:cursor-not-allowed disabled:opacity-75"
                      title={canSelectSemester ? 'Chọn học kỳ' : 'Chỉ Admin/Supervisor được chọn học kỳ'}
                    >
                      <SelectValue placeholder="-- Chọn học kỳ --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Chọn học kỳ --</SelectItem>
                      {apiSemesters.map(sem => (
                        <SelectItem key={sem._id} value={sem._id}>{sem.semester_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {canSelectSemester && (
                  <button
                    type="button"
                    onClick={() => setIsSemesterModalOpen(true)}
                    className="w-9 h-9 shrink-0 rounded-xl bg-white/50 border border-white/80 hover:bg-white/70 hover:scale-[1.01] text-slate-600 flex items-center justify-center transition-all duration-150 ease-out cursor-pointer shadow-sm active:scale-95 group"
                    title="Cấu hình Học kì"
                  >
                    <Settings size={16} className="group-hover:rotate-45 transition-transform duration-200" />
                  </button>
                )}
              </div>

              {/* Select Khoa */}
              <div className="ml-auto min-w-[150px] max-w-full flex-1 lg:flex-none">
                <Select
                  value={selectedDepartment}
                  onValueChange={(val: string) => { setSelectedDepartment(val); setSelectedClass(''); }}
                >
                  <SelectTrigger className="h-9 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-[13px] font-medium text-[#1E293B] focus-within:bg-white/70 focus-within:ring-0 focus-within:ring-transparent focus-within:border-white/80 transition-all duration-150 ease-out shadow-none">
                    <SelectValue placeholder="-- Chọn khoa --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-- Chọn khoa --</SelectItem>
                    {visibleDepartments.map(dept => (
                      <SelectItem key={dept._id} value={dept._id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Select Lớp */}
              <div className="min-w-[150px] max-w-full flex-1 lg:flex-none">
                <Select
                  value={selectedClass}
                  onValueChange={(val: string) => setSelectedClass(val)}
                >
                  <SelectTrigger
                    className={`h-9 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-[13px] font-medium text-[#1E293B] focus-within:bg-white/70 focus-within:ring-0 focus-within:ring-transparent focus-within:border-white/80 transition-all duration-150 ease-out shadow-none ${!selectedDepartment ? "pointer-events-none opacity-50 bg-slate-100/80 text-slate-400" : ""
                      }`}
                  >
                    <SelectValue placeholder={selectedDepartment ? "Chọn lớp" : "Chọn khoa trước"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-- Không chọn --</SelectItem>
                    {classesForSelectedDepartment.map(cls => (
                      <SelectItem key={cls._id} value={cls._id} label={cls.class_name}>
                        <span className="flex items-center justify-between w-full gap-2">
                          <span>{cls.class_name}</span>
                          {classApprovalMap[cls._id]?.allApproved && (
                            <span className="text-emerald-600 text-[11px] font-bold shrink-0">Đã duyệt</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
                <Button
                  onClick={handleConfirmFilter}
                  disabled={!selectedClass || isTableLoading}
                  className="relative h-9 min-w-0 whitespace-nowrap inline-flex items-center justify-center rounded-xl border border-white/80 bg-white/50 backdrop-blur-sm text-[#1E293B] font-medium shadow-sm transition-all duration-150 ease-out hover:bg-white/70 hover:border-white hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 px-3 sm:px-4"
                >
                  {isTableLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="animate-spin h-4 w-4 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                  <span className={isTableLoading ? "invisible" : ""}>Xác nhận</span>
                </Button>
                {isAdmin ? (
                  <Popover open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        disabled={!appliedSemester || isExportingExcel || isTableLoading}
                        className="relative h-9 min-w-0 whitespace-nowrap inline-flex items-center justify-center gap-2 rounded-xl border border-white/80 bg-white/50 backdrop-blur-sm text-[#1E293B] font-medium shadow-sm transition-all duration-150 ease-out hover:bg-white/70 hover:border-white hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 px-3 sm:px-4"
                        title="Xuất Excel theo phạm vi và học kỳ đã xác nhận"
                        aria-label={isExportingExcel ? "Đang xuất Excel" : "Xuất Excel"}
                      >
                        {isExportingExcel ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <svg className="animate-spin h-4 w-4 text-emerald-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </div>
                        ) : (
                          <FileDown size={16} className="shrink-0" aria-hidden="true" />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      sideOffset={8}
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      className="w-[320px] sm:w-[340px] rounded-2xl bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] border border-white/80 shadow-2xl p-4 font-sans z-[100] outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none"
                    >
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/60">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-sm font-bold text-[#1E293B]">Phạm vi xuất file Excel</span>
                      </div>

                      <div className="space-y-3 my-1">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Phạm vi</label>
                          <Select value={exportScope} onValueChange={(val: string) => setExportScope(val as 'class' | 'faculty' | 'all')}>
                            <SelectTrigger className="h-9 bg-white/70 border border-white/90 rounded-xl text-[12.5px] font-semibold text-[#1E293B] focus-within:ring-2 focus-within:ring-emerald-500/30 transition-all shadow-none w-full outline-none focus:outline-none focus-visible:ring-0 focus-visible:outline-none">
                              <SelectValue placeholder="Chọn phạm vi" />
                            </SelectTrigger>
                            <SelectContent disablePortal>
                              <SelectItem value="class">Theo Lớp học đã chọn</SelectItem>
                              <SelectItem value="faculty">Theo Khoa đã chọn</SelectItem>
                              <SelectItem value="all">Tất cả (Toàn hệ thống)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="rounded-xl bg-white/60 border border-white/80 p-2.5 space-y-1.5 text-[11.5px] text-slate-600">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-500">Học kỳ:</span>
                            <span className="font-bold text-slate-800 truncate max-w-[170px]">{currentSemesterName || 'Chưa chọn'}</span>
                          </div>
                          {exportScope === 'class' && (
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-500">Lớp học:</span>
                              <span className="font-bold text-slate-800 truncate max-w-[170px]">{currentClassName || 'Chưa chọn'}</span>
                            </div>
                          )}
                          {exportScope === 'faculty' && (
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-500">Khoa:</span>
                              <span className="font-bold text-slate-800 truncate max-w-[170px]">
                                {apiDepartments.find(d => d._id === appliedDepartment)?.name || 'Chưa chọn'}
                              </span>
                            </div>
                          )}
                          {exportScope === 'all' && (
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-500">Phạm vi:</span>
                              <span className="font-bold text-emerald-700">Toàn bộ sinh viên</span>
                            </div>
                          )}
                        </div>

                        {exportScope === 'class' && !appliedClass && (
                          <p className="text-[10.5px] text-amber-600 font-medium">
                            ⚠️ Cần chọn Lớp học ở bộ lọc chính trước.
                          </p>
                        )}
                        {exportScope === 'faculty' && !appliedDepartment && (
                          <p className="text-[10.5px] text-amber-600 font-medium">
                            ⚠️ Cần chọn Khoa ở bộ lọc chính trước.
                          </p>
                        )}
                      </div>

                      <div className="mt-2.5 flex justify-end gap-1.5 pt-2 border-t border-white/60">
                        <button
                          type="button"
                          onClick={() => setIsExportModalOpen(false)}
                          className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-[#64748B] hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer border border-slate-200 bg-white"
                        >
                          Hủy
                        </button>
                        <Button
                          onClick={async () => {
                            setIsExportModalOpen(false);
                            await handleExportSummaryExcel();
                          }}
                          disabled={!appliedSemester || (exportScope === 'class' && !appliedClass) || (exportScope === 'faculty' && !appliedDepartment) || isExportingExcel}
                          className="h-8 px-3 rounded-xl text-[11px] font-bold transition-all duration-150 ease-out hover:bg-white/70 hover:shadow-md flex items-center justify-center bg-white/50 border border-white/80 backdrop-blur-sm text-[#1E293B] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Xác nhận xuất
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Button
                    onClick={handleExportSummaryExcel}
                    disabled={!appliedSemester || !appliedClass || isExportingExcel || isTableLoading}
                    className="relative h-9 min-w-0 whitespace-nowrap inline-flex items-center justify-center gap-2 rounded-xl border border-white/80 bg-white/50 backdrop-blur-sm text-[#1E293B] font-medium shadow-sm transition-all duration-150 ease-out hover:bg-white/70 hover:border-white hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 px-3 sm:px-4"
                    title="Xuất Excel theo phạm vi và học kỳ đã xác nhận"
                    aria-label={isExportingExcel ? "Đang xuất Excel" : "Xuất Excel"}
                  >
                    {isExportingExcel ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="animate-spin h-4 w-4 text-emerald-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : (
                      <FileDown size={16} className="shrink-0" aria-hidden="true" />
                    )}
                  </Button>
                )}
              </div>
            </motion.div>

            {/* Mobile/Tablet Filters Row (Visible only on < lg screens) */}
            <div className="flex lg:hidden items-center gap-2 shrink-0 w-full">
              {/* Search Bar (Real-time client-side search) */}
              <div className="flex-1 relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  placeholder="Tìm kiếm tên hoặc MSSV..."
                  className="w-full bg-white/50 border border-white/80 rounded-xl pl-9 pr-4 py-2 text-[13px] font-medium placeholder:text-slate-400 focus:bg-white/70 focus:ring-0 focus:ring-transparent focus:border-white/80 transition-all duration-150 ease-out outline-none h-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Advance Filter Button (Icon only) */}
              <button
                type="button"
                onClick={() => setIsFilterDialogOpen(true)}
                className="w-10 h-10 shrink-0 rounded-xl bg-white border border-[#D0D5DD] hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-all duration-150 ease-out cursor-pointer shadow-sm active:scale-95"
                title="Bộ lọc nâng cao"
              >
                <SlidersHorizontal size={18} />
              </button>
            </div>

            {/* Tab Danh sách */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-slate-300/40 overflow-hidden flex-1 flex flex-col min-h-0"
            >
              {!appliedClass ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[350px]">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 shadow-sm">
                    <Search size={26} />
                  </div>
                  <h3 className="text-[15px] font-bold text-slate-800 mb-1.5">Chưa hiển thị danh sách sinh viên</h3>
                  <p className="text-[12.5px] text-slate-500 max-w-[340px] leading-relaxed">
                    Vui lòng chọn <strong>Khoa</strong>, <strong>Lớp học</strong> và <strong>Học kỳ</strong> phù hợp ở bộ lọc phía trên, sau đó nhấn <strong>Xác nhận</strong> để tải danh sách.
                  </p>
                </div>
              ) : (
                <ResponsiveDataView
                  data={filteredStudents}
                  columns={columns}
                  isLoading={isInitialLoading}
                  keyExtractor={(std) => std.id}
                  breakpoint="lg"
                  renderCard={renderMobileCard}
                  selection={{
                    selectedKeys: selectedStudentIds,
                    onSelectRow: (id, checked) => {
                      setSelectedStudentIds(prev =>
                        checked ? [...prev, id] : prev.filter(item => item !== id)
                      );
                    },
                    onSelectAll: (checked) => {
                      if (checked) {
                        setSelectedStudentIds(prev => {
                          const newSelection = [...prev];
                          filteredStudents.forEach(std => {
                            if (!newSelection.includes(std.id)) {
                              newSelection.push(std.id);
                            }
                          });
                          return newSelection;
                        });
                      } else {
                        setSelectedStudentIds(prev =>
                          prev.filter(id => !filteredStudents.some(std => std.id === id))
                        );
                      }
                    },
                    allSelected: filteredStudents.length > 0 && filteredStudents.every(std => selectedStudentIds.includes(std.id))
                  }}
                  mobileScrollRef={mobileScrollRootRef}
                  mobileFooter={
                    isMobileOrTablet && appliedClass && appliedSemester && filteredStudents.length > 0 && !isInitialLoading && !isFetching ? (
                      hasMore ? (
                        <div ref={observerTarget} className="w-full py-4 flex justify-center min-h-[40px]">
                          {isLoadingMore && (
                            <div className="flex items-center gap-2 text-slate-500">
                              <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span className="text-sm font-medium">Đang tải thêm...</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className="w-full py-4 flex justify-center min-h-[40px] text-xs font-semibold text-slate-400"
                          role="status"
                          aria-live="polite"
                        >
                          Đã tải hết
                        </div>
                      )
                    ) : null
                  }
                  pagination={
                    !isMobileOrTablet ? (
                      <CustomPagination
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalItems={totalItems}
                        onPageChange={(page) => {
                          setIsFetching(true);
                          setTimeout(() => {
                            setCurrentPage(page);
                            setIsFetching(false);
                          }, 400);
                        }}
                        label="sinh viên"
                        isLoading={isFetching}
                        pageSizeOptions={[5, 10, 20, 40, 50, 100]}
                        onPageSizeChange={(size) => {
                          setPageSize(size);
                          setCurrentPage(1);
                        }}
                        extraInfo={
                          currentClassObj?.advisor_id?.user_name ? (
                            <span className="text-emerald-600 text-[13px] font-semibold whitespace-nowrap">
                              GVCN: {currentClassObj.advisor_id.user_name}
                            </span>
                          ) : undefined
                        }
                      />
                    ) : undefined
                  }
                />
              )}
            </motion.div>
          </main>

          {/* Thanh tác vụ chọn sinh viên hàng loạt */}
          <FloatingActionBar
            selectedCount={selectedStudentIds.length}
            onClear={() => setSelectedStudentIds([])}
            variant="dark"
            actions={
              <>
                {isAdminOrSupervisor && (
                  <>
                    <button
                      onClick={handleDeleteBulkClick}
                      className="bg-[#e11d48] hover:bg-rose-600 text-white font-bold text-[12px] px-3 sm:px-5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-[0_2px_8px_rgba(225,29,72,0.25)] active:scale-95 cursor-pointer h-9 shrink-0"
                      title="Xóa bảng điểm"
                    >
                      <Trash2 size={13} strokeWidth={2.5} />
                      <span className="hidden sm:inline">Xóa</span>
                    </button>

                    <button
                      onClick={handleApproveBulkClick}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[12px] px-3 sm:px-5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-[0_2px_8px_rgba(16,185,129,0.25)] active:scale-95 cursor-pointer h-9 shrink-0"
                      title="Duyệt hàng loạt"
                    >
                      <CheckCircle size={13} strokeWidth={2.5} />
                      <span className="hidden sm:inline">Duyệt</span>
                    </button>

                    <button
                      onClick={handleCancelApproveBulk}
                      className="bg-[#e11d48] hover:bg-rose-600 text-white font-bold text-[12px] px-3 sm:px-5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-[0_2px_8px_rgba(225,29,72,0.25)] active:scale-95 cursor-pointer h-9 shrink-0"
                      title="Hủy duyệt hàng loạt"
                    >
                      <XCircle size={13} strokeWidth={2.5} />
                      <span className="hidden sm:inline">Hủy duyệt</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => setIsPrintModalOpen(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-[12px] px-3 sm:px-5 py-2 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer h-9 shrink-0 border border-slate-700/60"
                >
                  <FileDown size={13} strokeWidth={2.5} />
                  <span className="hidden sm:inline">Xuất PDF</span>
                </button>
              </>
            }
          />

      <GradingPdfTemplate
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        selectedStudents={selectedStudentsData}
        categories={categories}
        evaluationCounts={evaluationScoresMap}
        semesterName={currentSemesterName}
        className={currentClassName}
      />

      <ConfirmModal
        isOpen={cancelBulkConfirm.isOpen}
        onClose={() => setCancelBulkConfirm(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => executeCancelApproveBulk(cancelBulkConfirm.summaryIds)}
        title="Xác nhận hủy duyệt hàng loạt"
        message={cancelBulkConfirm.message}
        confirmLabel="Tiếp tục"
        cancelLabel="Hủy"
        variant="warning"
      />

      <ConfirmModal
        isOpen={deleteBulkConfirm.isOpen}
        onClose={() => setDeleteBulkConfirm(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => executeDeleteBulk(deleteBulkConfirm.summaryIds)}
        title="Xác nhận xóa bảng điểm"
        message={deleteBulkConfirm.message}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
      />

      <ConfirmModal
        isOpen={approveBulkConfirm.isOpen}
        onClose={() => setApproveBulkConfirm(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => executeApproveBulk(approveBulkConfirm.summaryIds)}
        title="Xác nhận duyệt hàng loạt"
        message={approveBulkConfirm.message}
        confirmLabel="Duyệt"
        cancelLabel="Hủy"
      />

      <Dialog open={approveProgress.isOpen} onOpenChange={() => {}}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md rounded-2xl p-6" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className="mb-2">
            <DialogTitle className="text-lg font-bold text-[#1E293B] text-center">
              Đang thực hiện duyệt điểm...
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-6 my-4">
            <div className="w-16 h-16 relative">
              <svg className="animate-spin w-full h-full text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${Math.round((approveProgress.completed / Math.max(1, approveProgress.total)) * 100)}%` }}
              ></div>
            </div>
            <p className="text-sm font-semibold text-slate-600">
              Đã duyệt: {approveProgress.completed} / {approveProgress.total} ({Math.round((approveProgress.completed / Math.max(1, approveProgress.total)) * 100)}%)
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteProgress.isOpen} onOpenChange={() => {}}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md rounded-2xl p-6" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className="mb-2">
            <DialogTitle className="text-lg font-bold text-[#1E293B] text-center">
              Đang thực hiện xóa bảng điểm...
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-6 my-4">
            <div className="w-16 h-16 relative">
              <svg className="animate-spin w-full h-full text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${Math.round((deleteProgress.completed / Math.max(1, deleteProgress.total)) * 100)}%` }}
              ></div>
            </div>
            <p className="text-sm font-semibold text-slate-600">
              Đã xóa: {deleteProgress.completed} / {deleteProgress.total} ({Math.round((deleteProgress.completed / Math.max(1, deleteProgress.total)) * 100)}%)
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelProgress.isOpen} onOpenChange={() => {}}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md rounded-2xl p-6" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className="mb-2">
            <DialogTitle className="text-lg font-bold text-[#1E293B] text-center">
              Đang thực hiện hủy duyệt điểm...
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-6 my-4">
            <div className="w-16 h-16 relative">
              <svg className="animate-spin w-full h-full text-rose-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-rose-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${Math.round((cancelProgress.completed / Math.max(1, cancelProgress.total)) * 100)}%` }}
              ></div>
            </div>
            <p className="text-sm font-semibold text-slate-600">
              Đã hủy duyệt: {cancelProgress.completed} / {cancelProgress.total} ({Math.round((cancelProgress.completed / Math.max(1, cancelProgress.total)) * 100)}%)
            </p>
          </div>
        </DialogContent>
      </Dialog>


      {/* Dialog for Advanced Filters (Mobile/Tablet Only) */}
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent 
          className="w-[calc(100%-2rem)] sm:w-full max-w-[400px] rounded-2xl bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] border border-white/80 shadow-2xl p-5 z-[100] font-sans"
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('.z-\\[9999\\]') || target.closest('[role="listbox"]')) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader className="mb-4 text-left">
            <DialogTitle className="text-base font-bold text-[#1E293B]">Bộ lọc nâng cao</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 my-2">
            {/* Select Học kì */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Học kỳ</label>
                {canSelectSemester && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSemesterModalOpen(true);
                      setIsFilterDialogOpen(false);
                    }}
                    className="text-[11px] font-bold text-[#1A73E8] hover:underline"
                  >
                    Cấu hình học kỳ
                  </button>
                )}
              </div>
              <Select
                value={selectedSemester}
                onValueChange={(val: string) => {
                  if (canSelectSemester) {
                    setSelectedSemester(val);
                  }
                }}
                disabled={!canSelectSemester}
              >
                <SelectTrigger
                  className="h-9 bg-white/60 border border-white/80 rounded-xl text-[13px] font-medium text-[#1E293B] focus-within:bg-white/70 focus-within:ring-0 focus-within:ring-transparent focus-within:border-white/80 transition-all duration-150 ease-out shadow-none disabled:cursor-not-allowed disabled:opacity-75 w-full"
                >
                  <SelectValue placeholder="-- Chọn học kỳ --" />
                </SelectTrigger>
                <SelectContent disablePortal>
                  <SelectItem value="">-- Chọn học kỳ --</SelectItem>
                  {apiSemesters.map(sem => (
                    <SelectItem key={sem._id} value={sem._id}>{sem.semester_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Select Khoa */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Khoa</label>
              <Select
                value={selectedDepartment}
                onValueChange={(val: string) => { 
                  setSelectedDepartment(val); 
                  setSelectedClass(''); 
                }}
              >
                <SelectTrigger className="h-9 bg-white/60 border border-white/80 rounded-xl text-[13px] font-medium text-[#1E293B] focus-within:bg-white/70 focus-within:ring-0 focus-within:ring-transparent focus-within:border-white/80 transition-all duration-150 ease-out shadow-none w-full">
                  <SelectValue placeholder="-- Chọn khoa --" />
                </SelectTrigger>
                <SelectContent disablePortal>
                  <SelectItem value="">-- Chọn khoa --</SelectItem>
                  {visibleDepartments.map(dept => (
                    <SelectItem key={dept._id} value={dept._id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Select Lớp */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Lớp học</label>
              <Select
                value={selectedClass}
                onValueChange={(val: string) => setSelectedClass(val)}
              >
                <SelectTrigger
                  className={`h-9 bg-white/60 border border-white/80 rounded-xl text-[13px] font-medium text-[#1E293B] focus-within:bg-white/70 focus-within:ring-0 focus-within:ring-transparent focus-within:border-white/80 transition-all duration-150 ease-out shadow-none w-full ${
                    !selectedDepartment ? "pointer-events-none opacity-50 bg-slate-100/80 text-slate-400" : ""
                  }`}
                >
                  <SelectValue placeholder={selectedDepartment ? "Chọn lớp" : "Chọn khoa trước"} />
                </SelectTrigger>
                <SelectContent disablePortal>
                  <SelectItem value="">-- Không chọn --</SelectItem>
                  {classesForSelectedDepartment.map(cls => (
                    <SelectItem key={cls._id} value={cls._id} label={cls.class_name}>
                      <span className="flex items-center justify-between w-full gap-2">
                        <span>{cls.class_name}</span>
                        {classApprovalMap[cls._id]?.allApproved && (
                          <span className="text-emerald-600 text-[11px] font-bold shrink-0">Đã duyệt</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2.5">
            <button
              onClick={() => {
                setSelectedDepartment('');
                setSelectedClass('');
                setIsFilterDialogOpen(false);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer border border-slate-200 bg-white"
            >
              Đặt lại
            </button>
            <Button
              onClick={async () => {
                await handleConfirmFilter();
                setIsFilterDialogOpen(false);
              }}
              disabled={!selectedClass || isTableLoading}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-150 ease-out hover:bg-white/70 hover:shadow-md flex items-center justify-center relative bg-white/50 border border-white/80 backdrop-blur-sm text-[#1E293B] shadow-sm ${
                !selectedClass
                  ? "opacity-50 cursor-not-allowed"
                  : isTableLoading
                  ? "opacity-80 cursor-not-allowed text-transparent"
                  : ""
              }`}
            >
              {isTableLoading && (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
              <span>Xác nhận</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>


    </>
  );
}

export default function ProtectedGradingPage() {
  return (
    <RouteGuard requiredPermission="GRADING_PAGE">
      <GradingPage />
    </RouteGuard>
  );
}

