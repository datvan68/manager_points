'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';
import {
  Search,
  SquarePen,
  Plus,
  Check,
  FileDown,
  CheckCircle,
  XCircle,
  Eye,
  Settings
} from 'lucide-react';
import dynamic from 'next/dynamic';
const SemesterModal = dynamic(() => import('../../components/grading/SemesterModal'), { ssr: false });
const BulkGradingModal = dynamic(() => import('../../components/grading/BulkGradingModal'), { ssr: false });
const GradingPdfTemplate = dynamic(() => import('../../components/grading/GradingPdfTemplate'), { ssr: false });
const ConfirmModal = dynamic(() => import('../../components/modals/ConfirmModal'), { ssr: false });
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import FloatingActionBar from '@/components/ui/FloatingActionBar';
import TabNavigation from '@/components/ui/TabNavigation';
import { CustomPagination } from '@/components/ui/pagination';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { StudentAvatar } from '@/components/ui/StudentAvatar';
import { departmentApi } from '../../api/department-api';
import { classApi } from '../../api/class-api';
import { semesterApi } from '../../api/semester-api';
import { summariesPointApi } from '../../api/summaries-point-api';
import { tokenStorage } from '@/api/auth-api';
import { evaluationDetailApi } from '@/api/evaluation-detail-api';
import { categoryApi } from '../../api/category-api';
import { criteriaApi } from '../../api/criteria-api';
import { studentApi } from '../../api/student-api';
import { academicRecordApi } from '../../api/academic-record-api';
import { RouteGuard, usePermission } from '@/components/guards/RouteGuard';
import { useAuth } from '@/providers/auth-provider';

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
  const [pageSize, setPageSize] = useState(10);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [isTableLoading, setIsTableLoading] = useState<boolean>(false);

  const [selectedSemester, setSelectedSemester] = useState<string>('');
  // States cho Khoa, Lớp và Học kì tải từ API
  const [apiDepartments, setApiDepartments] = useState<any[]>([]);
  const [apiClasses, setApiClasses] = useState<any[]>([]);
  const [apiSemesters, setApiSemesters] = useState<any[]>([]);
  const [apiSummariesPoints, setApiSummariesPoints] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [apiEvaluationDetails, setApiEvaluationDetails] = useState<any[]>([]);
  const [preExistingCountsCache, setPreExistingCountsCache] = useState<Record<string, Record<string, { original_count: number; current_count: number }>>>({});
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
  const [isBulkGradingOpen, setIsBulkGradingOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

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

  const handleConfirmBulkGrading = async (criteriaId: string, count: number) => {
    if (selectedStudentIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một sinh viên để chấm điểm!');
      return;
    }
    if (count <= 0) {
      toast.error('Số lượng chấm điểm phải lớn hơn 0!');
      return;
    }

    setIsTableLoading(true);
    toast.loading(`Đang chấm điểm rèn luyện hàng loạt cho ${selectedStudentIds.length} sinh viên...`, { id: 'bulk-loading' });

    try {
      const currentUser = tokenStorage.getUser();

      // Tra cứu tiêu chí từ state categories
      let targetCriterion: any = null;
      categories.forEach(cat => {
        const found = cat.items.find((cri: any) => cri.id === criteriaId);
        if (found) targetCriterion = found;
      });

      if (!targetCriterion) {
        throw new Error('Không tìm thấy thông tin tiêu chí chấm điểm!');
      }

      // Tạo payload cho batch endpoint
      const actionBatchId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
      
      const recordsToCreate: any[] = [];
      selectedStudentIds.forEach((studentId) => {
        for (let i = 0; i < count; i++) {
          recordsToCreate.push({
            student_id: studentId,
            criterion_id: criteriaId,
            semester_id: appliedSemester,
            record_title: targetCriterion.name,
            description: 'Chấm điểm hàng loạt',
            status: 'active' as const,
            recorded_at: new Date().toISOString(),
            recorded_by: currentUser?.id,
            idempotency_key: `bulk_grading:${appliedSemester}:${criteriaId}:${studentId}:${actionBatchId}:${i}`,
            source: 'bulk_grading'
          });
        }
      });

      await academicRecordApi.bulkCreateAcademicRecords(recordsToCreate);

      toast.dismiss('bulk-loading');
      toast.success(`Đã áp dụng chấm điểm hàng loạt thành công cho ${selectedStudentIds.length} sinh viên!`);
      setSelectedStudentIds([]);
      setIsBulkGradingOpen(false);

      // Tải lại dữ liệu toàn bảng
      await fetchData();

    } catch (error: any) {
      toast.dismiss('bulk-loading');
      toast.error('Lỗi khi chấm điểm hàng loạt: ' + error.message);
    } finally {
      setIsTableLoading(false);
    }
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
        const sId = getSummaryStudentKey(s);
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
    setIsTableLoading(true);
    toast.loading(`Đang hủy duyệt điểm rèn luyện cho ${summaryIds.length} sinh viên...`, { id: 'cancel-bulk-loading' });

    try {
      // Gọi API bulk cancel approval ở Backend
      const results = await summariesPointApi.cancelApprovalBulk(summaryIds);

      // Đếm số thành công và lỗi
      const successes = results.filter((r: any) => r.success);
      const failures = results.filter((r: any) => !r.success);

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

      toast.dismiss('cancel-bulk-loading');
      
      if (failures.length > 0) {
        toast.warning(`Đã hủy duyệt thành công ${successes.length} sinh viên, thất bại ${failures.length} sinh viên.`);
        console.error('Chi tiết lỗi hủy duyệt hàng loạt:', failures);
      } else {
        toast.success(`Đã hủy duyệt điểm rèn luyện thành công cho ${successes.length} sinh viên!`);
      }

      setSelectedStudentIds([]); // Xóa danh sách đã chọn
    } catch (error: any) {
      toast.dismiss('cancel-bulk-loading');
      toast.error('Lỗi khi hủy duyệt rèn luyện hàng loạt: ' + error.message);
    } finally {
      setIsTableLoading(false);
    }
  };

  // Hàm tải dữ liệu từ database thông qua API
  const fetchData = async () => {
    try {
      setIsFetching(true);
      const [backendDepts, backendClasses, backendSemesters, backendCats, backendCriteria] = await Promise.all([
        departmentApi.getDepartments(),
        classApi.getClasses(),
        semesterApi.getSemesters(),
        categoryApi.getCategories(),
        criteriaApi.getCriteria()
      ]);

      setApiDepartments(backendDepts || []);
      setApiClasses(backendClasses || []);
      setApiSemesters(backendSemesters || []);

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
      toast.error('Lỗi khi tải dữ liệu từ database: ' + error.message);
    } finally {
      setIsInitialLoading(false);
      setIsFetching(false);
    }
  };

  const fetchSummaries = async (pageToFetch: number = currentPage) => {
    if (!appliedClass || !appliedSemester) return;
    try {
      setIsFetching(true);
      const res = await summariesPointApi.getSummariesPoints({
        page: pageToFetch,
        limit: pageSize,
        semesterId: appliedSemester,
        classId: appliedClass,
      });
      const data = res.data || [];
      setApiSummariesPoints(data);
      setTotalItems(res.meta?.total || 0);

      const summaryIds = data.map((s: any) => s._id);
      if (summaryIds.length > 0) {
        const bulkCounts = await evaluationDetailApi.getPreExistingCountsBulk(summaryIds);
        if (bulkCounts) {
          setPreExistingCountsCache(prev => ({ ...prev, ...bulkCounts }));
        }
      }
    } catch (e) {
      console.error('Error fetching summaries:', e);
    } finally {
      setIsFetching(false);
    }
  };

  const { isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (isStateRestored && appliedClass && appliedSemester) {
      fetchSummaries(currentPage);
    }
  }, [currentPage, pageSize, appliedClass, appliedSemester, isStateRestored]);


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

      setSelectedDepartment(savedDept);
      setSelectedClass(savedClass);
      setSelectedSemester(savedSem);
      setAppliedDepartment(savedAppliedDept);
      setAppliedClass(savedAppliedClass);
      setAppliedSemester(savedAppliedSem);
      setSearchTerm(savedSearch);
      setCurrentPage(Number(savedPage));
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

      // 1. Tải tất cả sinh viên và tất cả summaries
      const [backendStudents, backendSummaries] = await Promise.all([
        studentApi.getStudents({ limit: 1000, classId: selectedClass }),
        summariesPointApi.getSummariesPoints({ limit: 1000, classId: selectedClass, semesterId: selectedSemester })
      ]);
        
      const studentsData = (backendStudents as any)?.data || backendStudents || [];
      const summariesData = (backendSummaries as any)?.data || backendSummaries || [];

      // 2. Lọc các sinh viên thuộc lớp đang chọn (đã lọc qua tham số backend)
      const classStudents = studentsData;

      // 3. Kiểm tra xem sinh viên nào chưa có trong bảng summaries cho học kỳ đang chọn
      const createPromises: Promise<any>[] = [];
      classStudents.forEach((student: any) => {
        const hasSummary = summariesData.some((summary: any) => {
          const semId = typeof summary.semester_id === 'object' ? summary.semester_id?._id : summary.semester_id;
          const studId = typeof summary.student_id === 'object' ? summary.student_id?._id : summary.student_id;
          return semId === selectedSemester && studId === student._id;
        });

        if (!hasSummary) {
          createPromises.push(
            summariesPointApi.createSummariesPoint({
              student_id: student._id,
              semester_id: selectedSemester,
              total_score: 0,
              grading: 'Chưa xếp loại',
              status: 'draft'
            })
          );
        }
      });

      if (createPromises.length > 0) {
        toast.info(`Phát hiện ${createPromises.length} sinh viên chưa có bảng điểm rèn luyện. Đang tự động khởi tạo...`);
        await Promise.all(createPromises);
        toast.success(`Đã tự động khởi tạo bảng điểm cho ${createPromises.length} sinh viên mới!`);
      }

      // 4. Load lại dữ liệu và áp dụng bộ lọc
      await fetchData();

      setAppliedSemester(selectedSemester);
      setAppliedDepartment(selectedDepartment);
      setAppliedClass(selectedClass);

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
        const studentId = getSummaryStudentKey(summary, idx);
        const studentName = studentObj?.full_name || studentObj?.name || 'Chưa rõ';
        const studentClassId = studentObj?.class_id?._id || studentObj?.class_id || studentObj?.classId || '';

        const semId = typeof summary.semester_id === 'object' ? summary.semester_id?._id : summary.semester_id;

        const classObj = classMap.get(studentClassId);
        const deptId = classObj ? (typeof classObj.dept_id === 'object' ? classObj.dept_id?._id : classObj.dept_id) : '';

        const studentDob = studentObj?.date_bir || '';

        return {
          id: studentId,
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
          student.id.toLowerCase().includes(searchTerm.toLowerCase());
        
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

  const evaluationCountsMap: Record<string, Record<string, number>> = {};
  selectedStudentsData.forEach(student => {
    evaluationCountsMap[student.id] = {};

    const studentDetails = student.details || [];

    const evaluatedCriteriaIds = new Set<string>();

    studentDetails.forEach(detail => {
      const criterionId = typeof detail.criterion_id === 'object' ? detail.criterion_id?._id : detail.criterion_id;
      if (criterionId) {
        evaluationCountsMap[student.id][criterionId] = detail.current_count || 0;
        evaluatedCriteriaIds.add(criterionId);
      }
    });

    // Merge pre-existing counts cho tiêu chí chưa có evaluation_detail
    const preCounts = preExistingCountsCache[student.summaryId];
    if (preCounts) {
      Object.entries(preCounts).forEach(([criId, preCount]) => {
        if (!evaluatedCriteriaIds.has(criId) && preCount.current_count > 0) {
          evaluationCountsMap[student.id][criId] = preCount.current_count;
        }
      });
    }
  });

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
      <div className="flex h-screen bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header />

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
            {/* Filters Section Container */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl px-4 flex gap-3 items-center shrink-0 h-[68px] shadow-sm shadow-slate-300/40"
            >
              <div className="flex-1 relative">

                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Tìm kiếm tên sinh viên hoặc MSSV..."
                  className="w-full bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl pl-10 pr-4 py-2 text-[13px] font-medium placeholder:text-slate-400 focus:bg-white/70 focus:ring-2 focus:ring-[#1A73E8]/30 transition-all duration-150 ease-out outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Select Học kì */}
              <div className="shrink-0 flex items-center gap-2">
                <div className="min-w-[160px]">
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
                      className="h-9 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-[13px] font-medium text-[#1E293B] focus-within:bg-white/70 focus-within:ring-2 focus-within:ring-[#1A73E8]/30 transition-all duration-150 ease-out shadow-none disabled:cursor-not-allowed disabled:opacity-75"
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
              <div className="shrink-0 min-w-[180px]">
                <Select
                  value={selectedDepartment}
                  onValueChange={(val: string) => { setSelectedDepartment(val); setSelectedClass(''); }}
                >
                  <SelectTrigger className="h-9 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-[13px] font-medium text-[#1E293B] focus-within:bg-white/70 focus-within:ring-2 focus-within:ring-[#1A73E8]/30 transition-all duration-150 ease-out shadow-none">
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
              <div className="shrink-0 min-w-[160px]">
                <Select
                  value={selectedClass}
                  onValueChange={(val: string) => setSelectedClass(val)}
                >
                  <SelectTrigger
                    className={`h-9 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-[13px] font-medium text-[#1E293B] focus-within:bg-white/70 focus-within:ring-2 focus-within:ring-[#1A73E8]/30 transition-all duration-150 ease-out shadow-none ${!selectedDepartment ? "pointer-events-none opacity-50 bg-slate-100/80 text-slate-400" : ""
                      }`}
                  >
                    <SelectValue placeholder={selectedDepartment ? "Chọn lớp" : "Chọn khoa trước"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-- Không chọn --</SelectItem>
                    {classesForSelectedDepartment.map(cls => (
                      <SelectItem key={cls._id} value={cls._id}>{cls.class_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleConfirmFilter}
                disabled={!selectedClass || isTableLoading}
                className={`rounded-xl h-9 transition-all duration-150 ease-out hover:scale-[1.01] ${!selectedClass ? "opacity-50 cursor-not-allowed bg-slate-300 hover:bg-slate-300 text-slate-500 relative" : isTableLoading ? "opacity-80 cursor-not-allowed relative" : "relative bg-[#1A73E8] hover:bg-[#155dfc] text-white"}`}
              >
                {isTableLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
                <span className={isTableLoading ? "invisible" : ""}>Xác nhận</span>
              </Button>
            </motion.div>

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
                <>
                  <div className="flex-1 overflow-auto">
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-white/80 shadow-[0_1px_0_0_rgba(255,255,255,0.8)]">
                        <tr>
                          <th className="px-6 py-4 text-left w-16">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                className="rounded border-[#cbd5e1] text-[#137fec] focus:ring-[#137fec] cursor-pointer"
                                checked={
                                  filteredStudents.length > 0 &&
                                  filteredStudents.every(std => selectedStudentIds.includes(std.id))
                                }
                                onChange={(e) => {
                                  if (e.target.checked) {
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
                                }}
                              />
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-[12px] font-bold text-[#334155] uppercase tracking-wider">Mã sinh viên</th>
                          <th className="px-6 py-4 text-left text-[12px] font-bold text-[#334155] uppercase tracking-wider">Tên</th>
                          <th className="px-6 py-4 text-left text-[12px] font-bold text-[#334155] uppercase tracking-wider">Lớp</th>
                          <th className="px-6 py-4 text-center text-[12px] font-bold text-[#334155] uppercase tracking-wider">Tổng điểm</th>
                          <th className="px-6 py-4 text-center text-[12px] font-bold text-[#334155] uppercase tracking-wider">Xếp loại</th>
                          <th className="px-6 py-4 text-right text-[12px] font-bold text-[#334155] uppercase tracking-wider">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f5f9] relative">
                        {isInitialLoading ? (
                          Array.from({ length: 8 }).map((_, idx) => (
                            <tr key={`skeleton-${idx}`}>
                              <td className="px-6 py-4"><Skeleton className="h-4 w-4 rounded" /></td>
                              <td className="px-6 py-4"><Skeleton className="h-4 w-24 rounded" /></td>
                              <td className="px-6 py-4"><Skeleton className="h-4 w-32 rounded" /></td>
                              <td className="px-6 py-4"><Skeleton className="h-4 w-20 rounded" /></td>
                              <td className="px-6 py-4 text-center"><Skeleton className="h-6 w-16 rounded-full mx-auto" /></td>
                              <td className="px-6 py-4 text-center"><Skeleton className="h-6 w-16 rounded-full mx-auto" /></td>
                              <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-8 rounded-full ml-auto" /></td>
                            </tr>
                          ))
                        ) : (
                          <>
                            {filteredStudents.map((student, idx) => {
                                const rank = getRank(student.score);
                                const className = classMap.get(student.classId)?.class_name || student.classId;

                                return (
                                  <motion.tr
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    key={student.id || `student-row-${idx}`}
                                    className="hover:bg-white/60 transition-all duration-150 ease-out group cursor-pointer"
                                  >
                                    <td className="px-6 py-4">
                                      <input
                                        type="checkbox"
                                        className="rounded border-[#cbd5e1] text-[#137fec] focus:ring-[#137fec] cursor-pointer"
                                        checked={selectedStudentIds.includes(student.id)}
                                        onChange={() => {
                                          setSelectedStudentIds(prev =>
                                            prev.includes(student.id)
                                              ? prev.filter(id => id !== student.id)
                                              : [...prev, student.id]
                                          );
                                        }}
                                      />
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-[#475569]">{student.id}</td>
                                    <td className="px-6 py-2">
                                      <div className="flex items-center gap-[12px]">
                                        <StudentAvatar fullName={student.name} sizeClass="w-[36px] h-[36px]" />
                                        <div>
                                          <div className="font-semibold text-[14px] text-[#0f172a]">{student.name}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-[#475569]">{className}</td>
                                    <td className="px-6 py-4 text-center">
                                      <span className={`inline-flex items-center justify-center px-3 py-1 border rounded-xl text-[13px] font-semibold backdrop-blur-sm shadow-sm ${rank.color}`}>
                                        {student.score}/100
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span className={`px-3 py-1 border rounded-xl text-[11px] font-bold uppercase tracking-tight backdrop-blur-sm shadow-sm ${getRankColor(student.grading)}`}>
                                        {student.grading}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex gap-2 justify-end items-center">
                                        {isSemesterActive && student.status !== 'locked' ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              router.push(`/grading/score?studentId=${student.id}`);
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
                                              router.push(`/grading/score?studentId=${student.id}&view=true`);
                                            }}
                                            className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/60 border border-white/80 text-slate-600 hover:bg-white/90 hover:scale-[1.05] transition-all duration-150 ease-out active:scale-95 cursor-pointer shadow-sm"
                                            title="Xem chi tiết điểm"
                                          >
                                            <Eye size={15} />
                                          </button>
                                        )}
                                        {(() => {
                                          const currentUser = tokenStorage.getUser();
                                          const userRoleLower = currentUser?.role?.toLowerCase() || '';
                                          const canApprove = userRoleLower.includes('admin') || userRoleLower.includes('supervisor') || userRoleLower.includes('quản sinh');

                                          if (canApprove) {
                                            const isApproved = student.status === 'locked';
                                            if (isApproved || isSemesterActive) {
                                              const studentPreCounts = preExistingCountsCache[student.summaryId];
                                              const hasPreCounts = studentPreCounts ? Object.values(studentPreCounts).some((pc: any) => (pc.current_count || 0) > 0) : false;
                                              const hasDetails = (student.details || []).some((detail: any) => (detail.current_count || 0) > 0);
                                              const hasEvaluations = hasDetails || hasPreCounts;

                                              return (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isApproved) return;
                                                    if (!hasEvaluations) {
                                                      toast.warning(`Sinh viên ${student.name} chưa được chấm tiêu chí nào để duyệt!`);
                                                      return;
                                                    }
                                                    handleApproveEvaluation(student.summaryId, student.name);
                                                  }}
                                                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 ease-out active:scale-95 shadow-sm ${isApproved
                                                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 cursor-default'
                                                    : !hasEvaluations
                                                      ? 'bg-slate-50 border border-slate-100 text-slate-300 opacity-60 cursor-not-allowed'
                                                      : 'bg-white/60 border border-white/80 text-slate-400 hover:bg-white/90 hover:scale-[1.05] cursor-pointer'
                                                    }`}
                                                  title={
                                                    isApproved
                                                      ? "Đã phê duyệt điểm rèn luyện"
                                                      : !hasEvaluations
                                                        ? "Chưa có tiêu chí nào được chấm để duyệt"
                                                        : "Phê duyệt điểm rèn luyện"
                                                  }
                                                >
                                                  <CheckCircle size={15} />
                                                </button>
                                              );
                                            }
                                          }
                                          return null;
                                        })()}
                                      </div>
                                    </td>
                                  </motion.tr>
                                );
                              })
                            }
                            {(isFetching || isTableLoading) && (
                              <tr className="absolute inset-0 bg-white/40 backdrop-blur-[0.5px] z-20 pointer-events-none">
                                <td colSpan={7} className="h-full w-full p-0">
                                  <div className="w-full h-full animate-pulse bg-gradient-to-r from-transparent via-slate-100/50 to-transparent" />
                                </td>
                              </tr>
                            )}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>

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
                    pageSizeOptions={[5, 10, 20, 50, 100]}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                  />
                </>
              )}
            </motion.div>
          </main>
        </div>
      </div>

      {/* Modal Quản lý Học kỳ */}
      <SemesterModal
        isOpen={isSemesterModalOpen}
        onClose={() => setIsSemesterModalOpen(false)}
        apiSemesters={apiSemesters}
        onRefreshSemesters={(updated) => setApiSemesters(updated)}
        selectedSemester={selectedSemester}
        setSelectedSemester={setSelectedSemester}
      />

      {/* Modal Chấm điểm hàng loạt */}
      <BulkGradingModal
        isOpen={isBulkGradingOpen}
        onClose={() => setIsBulkGradingOpen(false)}
        selectedCount={selectedStudentIds.length}
        onConfirm={handleConfirmBulkGrading}
        categories={categories}
      />

      {/* Thanh tác vụ chọn sinh viên hàng loạt */}
      <FloatingActionBar
        selectedCount={selectedStudentIds.length}
        onClear={() => setSelectedStudentIds([])}
        variant="dark"
        actions={
          <>
            <button
              onClick={() => setIsBulkGradingOpen(true)}
              className="bg-[#137fec] hover:bg-blue-600 text-white font-bold text-[12px] px-5 py-2 rounded-full flex items-center gap-1.5 transition-all shadow-[0_2px_8px_rgba(19,127,236,0.25)] active:scale-95 cursor-pointer h-9 shrink-0"
            >
              <SquarePen size={13} strokeWidth={2.5} />
              <span>Chấm điểm </span>
            </button>

            {(() => {
              const currentUser = tokenStorage.getUser();
              const userRoleLower = currentUser?.role?.toLowerCase() || '';
              const canApprove = userRoleLower.includes('admin') || userRoleLower.includes('supervisor') || userRoleLower.includes('quản sinh');

              if (canApprove) {
                return (
                  <button
                    onClick={handleCancelApproveBulk}
                    className="bg-[#e11d48] hover:bg-rose-600 text-white font-bold text-[12px] px-5 py-2 rounded-full flex items-center gap-1.5 transition-all shadow-[0_2px_8px_rgba(225,29,72,0.25)] active:scale-95 cursor-pointer h-9 shrink-0"
                  >
                    <XCircle size={13} strokeWidth={2.5} />
                    <span>Hủy duyệt</span>
                  </button>
                );
              }
              return null;
            })()}

            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-[12px] px-5 py-2 rounded-full flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer h-9 shrink-0 border border-slate-700/60"
            >
              <FileDown size={13} strokeWidth={2.5} />
              <span>Xuất PDF</span>
            </button>
          </>
        }
      />

      <GradingPdfTemplate
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        selectedStudents={selectedStudentsData}
        categories={categories}
        evaluationCounts={evaluationCountsMap}
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

