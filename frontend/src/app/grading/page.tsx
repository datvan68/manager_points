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
import SemesterModal from '../../components/grading/SemesterModal';
import BulkGradingModal from '../../components/grading/BulkGradingModal';
import GradingPdfTemplate from '../../components/grading/GradingPdfTemplate';
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


export default function GradingPage() {
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
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
  const [isBulkGradingOpen, setIsBulkGradingOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const handleConfirmBulkGrading = async (criteriaId: string, count: number) => {
    if (selectedStudentIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một sinh viên để chấm điểm!');
      return;
    }

    setIsTableLoading(true);
    toast.loading(`Đang chấm điểm rèn luyện hàng loạt cho ${selectedStudentIds.length} sinh viên...`, { id: 'bulk-loading' });

    try {
      // 1. Xác định thông tin vai trò người chấm đăng nhập
      const currentUser = tokenStorage.getUser();
      let userRole: 'student' | 'teacher' | 'supervisor' | 'admin' = 'student';
      if (currentUser?.role) {
        const r = currentUser.role.toLowerCase();
        if (r.includes('admin')) {
          userRole = 'admin';
        } else if (r.includes('teacher') || r.includes('advisor')) {
          userRole = 'teacher';
        } else if (r.includes('supervisor') || r.includes('quản sinh')) {
          userRole = 'supervisor';
        }
      }

      // Trạng thái mặc định là bản nháp
      const detailStatus = 'draft';

      // 2. Tra cứu tiêu chí từ state categories
      let targetCriterion: any = null;
      categories.forEach(cat => {
        const found = cat.items.find((cri: any) => cri.id === criteriaId);
        if (found) targetCriterion = found;
      });

      if (!targetCriterion) {
        throw new Error('Không tìm thấy thông tin tiêu chí chấm điểm!');
      }

      // 3. Tiến hành duyệt qua từng sinh viên được tick chọn
      const promises = selectedStudentIds.map(async (studentId) => {
        // Tìm summary tương ứng của sinh viên này trong class hiện tại
        const summary = (apiSummariesPoints || []).find(s => {
          const studentObj = typeof s.student_id === 'object' ? s.student_id : null;
          const sId = studentObj?.student_code || studentObj?.id || studentObj?._id || (typeof s.student_id === 'string' ? s.student_id : '');
          return sId === studentId;
        });

        if (!summary) {
          console.warn(`Không tìm thấy bảng điểm rèn luyện (SummaryPoint) của sinh viên: ${studentId}`);
          return;
        }

        const summaryId = summary._id;

        // Tải các chi tiết chấm điểm cũ
        const oldDetails = await evaluationDetailApi.getEvaluationDetailsBySummary(summaryId);
        const existingDetail = (oldDetails || []).find(d => {
          const dCriId = typeof d.criterion_id === 'object' ? d.criterion_id?._id : d.criterion_id;
          return dCriId === criteriaId;
        });

        if (existingDetail) {
          const newCount = (existingDetail.current_count || 0) + count;
          const updatedHistory = [...(existingDetail.history || [])];
          updatedHistory.push({
            role: userRole,
            updated_by: currentUser?.id,
            count: count,
            reason: 'Chấm điểm hàng loạt'
          });

          // Lọc sạch lịch sử
          const cleanHistory = updatedHistory.map((log: any) => ({
            role: log.role,
            updated_by: typeof log.updated_by === 'object' ? log.updated_by?._id : log.updated_by,
            count: log.count,
            reason: log.reason || 'Chấm điểm hàng loạt'
          }));

          await evaluationDetailApi.updateEvaluationDetail(existingDetail._id, {
            current_count: newCount,
            history: cleanHistory,
            status: detailStatus
          });
        } else {
          await evaluationDetailApi.createEvaluationDetail({
            summary_id: summaryId,
            criterion_id: criteriaId,
            current_count: count,
            history: [
              {
                role: userRole,
                updated_by: currentUser?.id,
                count: count,
                reason: 'Chấm điểm hàng loạt'
              }
            ],
            status: detailStatus
          });
        }

        // Tải toàn bộ details mới để tính tổng điểm realtime
        const latestDetails = await evaluationDetailApi.getEvaluationDetailsBySummary(summaryId);

        let finalScore = 0;
        categories.forEach(cat => {
          let catScore = 0;
          cat.items.forEach((cri: any) => {
            const detail = latestDetails.find(d => {
              const dCriId = typeof d.criterion_id === 'object' ? d.criterion_id?._id : d.criterion_id;
              return dCriId === cri.id;
            });
            const currentCount = detail ? detail.current_count : 0;
            const maxScore = cri.maxScore || 10;
            const minScore = cri.minScore || 0;
            const criterionScore = cri.pointsPerUnit >= 0
              ? Math.max(minScore, Math.min(maxScore, currentCount * cri.pointsPerUnit))
              : Math.max(-maxScore, Math.min(0, currentCount * cri.pointsPerUnit));
            catScore += criterionScore;
          });
          const clampedCatScore = Math.max(0, Math.min(cat.maxPoints, catScore));
          finalScore += clampedCatScore;
        });

        const clampedFinalScore = Math.max(0, Math.min(100, finalScore));

        // Cập nhật summariesPoint
        await summariesPointApi.updateSummariesPoint(summaryId, {
          total_score: clampedFinalScore
        });
      });

      await Promise.all(promises);

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
    let userRole: 'student' | 'teacher' | 'supervisor' | 'admin' = 'student';
    if (currentUser?.role) {
      const r = currentUser.role.toLowerCase();
      if (r.includes('admin')) {
        userRole = 'admin';
      } else if (r.includes('teacher') || r.includes('advisor')) {
        userRole = 'teacher';
      } else if (r.includes('supervisor') || r.includes('quản sinh')) {
        userRole = 'supervisor';
      }
    }

    if (userRole !== 'supervisor' && userRole !== 'admin') {
      toast.error('Bạn không có quyền duyệt điểm rèn luyện!');
      return;
    }

    let detailStatus = 'draft';
    if (userRole === 'supervisor') detailStatus = 'supervisor_evaluated';
    else if (userRole === 'admin') detailStatus = 'finalized';

    setIsTableLoading(true);
    toast.loading(`Đang duyệt điểm rèn luyện cho sinh viên ${studentName}...`, { id: 'approve-loading' });

    try {
      const details = await evaluationDetailApi.getEvaluationDetailsBySummary(summaryId);
      if (!details || details.length === 0) {
        toast.dismiss('approve-loading');
        toast.warning(`Sinh viên ${studentName} chưa được chấm tiêu chí nào để duyệt!`);
        setIsTableLoading(false);
        return;
      }

      const promises = details.map(detail => {
        const updatedHistory = [...(detail.history || [])];
        updatedHistory.push({
          role: userRole,
          updated_by: currentUser?.id,
          count: detail.current_count,
          reason: 'Duyệt rèn luyện bởi ' + (userRole === 'supervisor' ? 'Quản sinh' : 'Admin')
        });

        // Lọc sạch mảng lịch sử trước khi gửi lên API
        const cleanHistory = updatedHistory.map((log: any) => ({
          role: log.role,
          updated_by: typeof log.updated_by === 'object' ? log.updated_by?._id : log.updated_by,
          count: log.count,
          reason: log.reason || 'Duyệt rèn luyện'
        }));

        return evaluationDetailApi.updateEvaluationDetail(detail._id, {
          history: cleanHistory,
          status: detailStatus
        });
      });

      await Promise.all(promises);

      // Tính toán lại tổng điểm rèn luyện dựa trên các chi tiết chấm điểm thực tế
      let finalScore = 0;
      categories.forEach(cat => {
        let catScore = 0;
        cat.items.forEach((cri: any) => {
          const detail = details.find(d => {
            const dCriId = typeof d.criterion_id === 'object' ? d.criterion_id?._id : d.criterion_id;
            return dCriId === cri.id;
          });
          const currentCount = detail ? detail.current_count : 0;
          const maxScore = cri.maxScore || 10;
          const minScore = cri.minScore || 0;
          const criterionScore = cri.pointsPerUnit >= 0
            ? Math.max(minScore, Math.min(maxScore, currentCount * cri.pointsPerUnit))
            : Math.max(-maxScore, Math.min(0, currentCount * cri.pointsPerUnit));
          catScore += criterionScore;
        });
        const clampedCatScore = Math.max(0, Math.min(cat.maxPoints, catScore));
        finalScore += clampedCatScore;
      });

      const clampedFinalScore = Math.max(0, Math.min(100, finalScore));

      // Xác định xếp loại tương ứng dựa trên tổng điểm mới tính
      let newGrading = 'Chưa xếp loại';
      if (clampedFinalScore >= 90) newGrading = 'Xuất sắc';
      else if (clampedFinalScore >= 80) newGrading = 'Tốt';
      else if (clampedFinalScore >= 70) newGrading = 'Khá';
      else if (clampedFinalScore >= 50) newGrading = 'Trung bình';
      else if (clampedFinalScore > 0) newGrading = 'Yếu';

      // Cập nhật cả total_score, xếp loại mới và trạng thái active vào Database thông qua summariesPointApi
      await summariesPointApi.updateSummariesPoint(summaryId, {
        total_score: clampedFinalScore,
        grading: newGrading,
        status: 'active'
      });

      toast.dismiss('approve-loading');
      toast.success(`Đã duyệt rèn luyện và xếp loại "${newGrading}" thành công cho sinh viên ${studentName}!`);

      // Tải lại bảng
      await fetchData();
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

    setIsTableLoading(true);
    toast.loading(`Đang hủy duyệt điểm rèn luyện cho ${selectedStudentIds.length} sinh viên...`, { id: 'cancel-bulk-loading' });

    try {
      const promises = selectedStudentIds.map(async (studentId) => {
        // Tìm summary tương ứng của sinh viên này
        const summary = (apiSummariesPoints || []).find(s => {
          const studentObj = typeof s.student_id === 'object' ? s.student_id : null;
          const sId = studentObj?.student_code || studentObj?.id || studentObj?._id || (typeof s.student_id === 'string' ? s.student_id : '');
          return sId === studentId;
        });

        if (!summary) return;

        const summaryId = summary._id;

        // 1. Tải tất cả chi tiết chấm điểm (EvaluationDetails) thuộc summaryId này
        const details = await evaluationDetailApi.getEvaluationDetailsBySummary(summaryId);

        // 2. Cập nhật status của tất cả chi tiết chấm điểm về 'draft'
        const detailPromises = (details || []).map(detail => {
          const updatedHistory = [...(detail.history || [])];
          updatedHistory.push({
            role: userRoleLower.includes('admin') ? 'admin' : 'supervisor',
            updated_by: currentUser?.id,
            count: detail.current_count,
            reason: 'Hủy duyệt rèn luyện về Bản nháp'
          });

          const cleanHistory = updatedHistory.map((log: any) => ({
            role: log.role,
            updated_by: typeof log.updated_by === 'object' ? log.updated_by?._id : log.updated_by,
            count: log.count,
            reason: log.reason || 'Hủy duyệt rèn luyện'
          }));

          return evaluationDetailApi.updateEvaluationDetail(detail._id, {
            history: cleanHistory,
            status: 'draft'
          });
        });

        await Promise.all(detailPromises);

        // 3. Cập nhật status bảng điểm về 'inactive' và grading về 'Chưa xếp loại'
        await summariesPointApi.updateSummariesPoint(summaryId, {
          status: 'inactive',
          grading: 'Chưa xếp loại'
        });
      });

      await Promise.all(promises);

      toast.dismiss('cancel-bulk-loading');
      toast.success(`Đã hủy duyệt điểm rèn luyện thành công cho ${selectedStudentIds.length} sinh viên!`);
      setSelectedStudentIds([]); // Xóa danh sách đã chọn

      // Tải lại bảng
      await fetchData();
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
      const [backendDepts, backendClasses, backendSemesters, backendSummaries, backendDetails, backendCats, backendCriteria] = await Promise.all([
        departmentApi.getDepartments(),
        classApi.getClasses(),
        semesterApi.getSemesters(),
        summariesPointApi.getSummariesPoints(),
        evaluationDetailApi.getEvaluationDetails(),
        categoryApi.getCategories(),
        criteriaApi.getCriteria()
      ]);

      setApiDepartments(backendDepts || []);
      setApiClasses(backendClasses || []);
      setApiSemesters(backendSemesters || []);
      setApiSummariesPoints(backendSummaries || []);
      setApiEvaluationDetails(backendDetails || []);

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

  useEffect(() => {
    fetchData();
  }, []);

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
        studentApi.getStudents(),
        summariesPointApi.getSummariesPoints()
      ]);

      // 2. Lọc các sinh viên thuộc lớp đang chọn
      const classStudents = (backendStudents || []).filter(student => {
        const classId = typeof student.class_id === 'object' ? student.class_id?._id : student.class_id;
        return classId === selectedClass;
      });

      // 3. Kiểm tra xem sinh viên nào chưa có trong bảng summaries cho học kỳ đang chọn
      const createPromises: Promise<any>[] = [];
      classStudents.forEach(student => {
        const hasSummary = (backendSummaries || []).some(summary => {
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
              status: 'inactive'
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

  const pageSize = 10;

  // Lọc và map dữ liệu từ summaries-point-api sang dạng tương thích với bảng hiển thị
  const filteredStudents = !appliedClass
    ? []
    : (apiSummariesPoints || [])
      .map(summary => {
        const studentObj = typeof summary.student_id === 'object' ? summary.student_id : null;
        const studentId = studentObj?.student_code || studentObj?.id || studentObj?._id || (typeof summary.student_id === 'string' ? summary.student_id : '');
        const studentName = studentObj?.full_name || studentObj?.name || 'Chưa rõ';
        const studentClassId = studentObj?.class_id?._id || studentObj?.class_id || studentObj?.classId || '';

        const semId = typeof summary.semester_id === 'object' ? summary.semester_id?._id : summary.semester_id;

        const classObj = apiClasses.find(c => c._id === studentClassId);
        const deptId = classObj ? (typeof classObj.dept_id === 'object' ? classObj.dept_id?._id : classObj.dept_id) : '';

        const studentDob = studentObj?.date_bir || '';

        return {
          id: studentId,
          name: studentName,
          score: summary.total_score || 0,
          grading: summary.grading || 'Chưa xếp loại',
          status: summary.status || 'inactive',
          classId: studentClassId,
          semesterId: semId,
          departmentId: deptId,
          summaryId: summary._id,
          dob: studentDob
        };
      })
      .filter(student => {
        const matchesSearch =
          student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSemester = appliedSemester ? student.semesterId === appliedSemester : true;
        const matchesDept = appliedDepartment ? student.departmentId === appliedDepartment : true;
        const matchesClass = appliedClass ? student.classId === appliedClass : true;

        return matchesSearch && matchesSemester && matchesDept && matchesClass;
      });

  const currentSemesterObj = apiSemesters.find(sem => sem._id === appliedSemester);
  const isSemesterActive = currentSemesterObj ? currentSemesterObj.status === 'active' : false;

  const getRank = (score: number) => {
    if (score === 0) return { label: 'Chưa xếp loại', color: 'bg-slate-100 text-slate-500 border-slate-200/50' };
    if (score >= 90) return { label: 'Xuất sắc', color: 'bg-amber-50 text-amber-700 border-amber-200/60' };
    if (score >= 80) return { label: 'Tốt', color: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' };
    if (score >= 70) return { label: 'Khá', color: 'bg-blue-50 text-blue-700 border-blue-200/60' };
    if (score >= 50) return { label: 'Trung bình', color: 'bg-purple-50 text-purple-700 border-purple-200/60' };
    return { label: 'Yếu', color: 'bg-rose-50 text-rose-700 border-rose-200/60' };
  };

  const getRankColor = (label: string) => {
    if (label === 'Xuất sắc') return 'bg-amber-50 text-amber-700 border-amber-200/60';
    if (label === 'Tốt') return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
    if (label === 'Khá') return 'bg-blue-50 text-blue-700 border-blue-200/60';
    if (label === 'Trung bình') return 'bg-purple-50 text-purple-700 border-purple-200/60';
    if (label === 'Yếu') return 'bg-rose-50 text-rose-700 border-rose-200/60';
    return 'bg-slate-100 text-slate-500 border-slate-200/50';
  };

  // Chuẩn bị dữ liệu cho PDF template in ấn
  const selectedStudentsData = filteredStudents.filter(std => selectedStudentIds.includes(std.id));
  const currentClassObj = apiClasses.find(c => c._id === appliedClass);
  const currentClassName = currentClassObj ? currentClassObj.class_name : '';
  const currentSemesterName = currentSemesterObj ? currentSemesterObj.semester_name : '';

  const evaluationCountsMap: Record<string, Record<string, number>> = {};
  selectedStudentsData.forEach(student => {
    evaluationCountsMap[student.id] = {};

    // Tìm tất cả chi tiết chấm điểm thuộc summaryId của sinh viên này
    const studentDetails = (apiEvaluationDetails || []).filter(detail => {
      const detailSummaryId = typeof detail.summary_id === 'object' ? detail.summary_id?._id : detail.summary_id;
      return detailSummaryId === student.summaryId;
    });

    studentDetails.forEach(detail => {
      const criterionId = typeof detail.criterion_id === 'object' ? detail.criterion_id?._id : detail.criterion_id;
      if (criterionId) {
        evaluationCountsMap[student.id][criterionId] = detail.current_count || 0;
      }
    });
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
            activeTab={'list'}
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
              className="bg-white border border-[#E5E7EB] rounded-2xl px-4 flex gap-3 items-center shrink-0 h-[68px] shadow-sm"
            >
              <div className="flex-1 relative">

                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Tìm kiếm tên sinh viên hoặc MSSV..."
                  className="w-full bg-[#F3F4F6] border-none rounded-xl pl-10 pr-4 py-2.5 text-[14px] font-medium placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Select Học kì */}
              <div className="shrink-0 flex items-center gap-2">
                <div className="min-w-[160px]">
                  <Select
                    value={selectedSemester}
                    onValueChange={(val: string) => setSelectedSemester(val)}
                  >
                    <SelectTrigger className="h-[42px] bg-[#F3F4F6] border-none rounded-xl text-[13px] font-medium text-slate-700 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-none">
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
                <button
                  type="button"
                  onClick={() => setIsSemesterModalOpen(true)}
                  className="w-[42px] h-[42px] shrink-0 rounded-xl bg-[#F3F4F6] hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 group"
                  title="Cấu hình Học kì"
                >
                  <Settings size={16} className="group-hover:rotate-45 transition-transform duration-200" />
                </button>
              </div>

              {/* Select Khoa */}
              <div className="shrink-0 min-w-[180px]">
                <Select
                  value={selectedDepartment}
                  onValueChange={(val: string) => { setSelectedDepartment(val); setSelectedClass(''); }}
                >
                  <SelectTrigger className="h-[42px] bg-[#F3F4F6] border-none rounded-xl text-[13px] font-medium text-slate-700 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-none">
                    <SelectValue placeholder="-- Chọn khoa --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-- Chọn khoa --</SelectItem>
                    {apiDepartments.map(dept => (
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
                    className={`h-[42px] bg-[#F3F4F6] border-none rounded-xl text-[13px] font-medium text-slate-700 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-none ${!selectedDepartment ? "pointer-events-none opacity-50 bg-slate-100/80 text-slate-400" : ""
                      }`}
                  >
                    <SelectValue placeholder={selectedDepartment ? "Chọn lớp" : "Chọn khoa trước"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-- Không chọn --</SelectItem>
                    {(selectedDepartment
                      ? apiClasses.filter(cls => {
                        const deptId = typeof cls.dept_id === 'object' ? cls.dept_id?._id : cls.dept_id;
                        return deptId === selectedDepartment;
                      })
                      : apiClasses
                    ).map(cls => (
                      <SelectItem key={cls._id} value={cls._id}>{cls.class_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleConfirmFilter}
                disabled={!selectedClass || isTableLoading}
                className={!selectedClass ? "opacity-50 cursor-not-allowed bg-slate-300 hover:bg-slate-300 text-slate-500 relative" : isTableLoading ? "opacity-80 cursor-not-allowed relative" : "relative"}
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
              className="bg-white border border-[#f1f5f9] rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0"
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
                      <thead className="sticky top-0 z-10 bg-[#f8fafc] shadow-[0_1px_0_0_#f1f5f9]">
                        <tr>
                          <th className="px-6 py-4 text-left w-16">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                className="rounded border-[#cbd5e1] text-[#137fec] focus:ring-[#137fec] cursor-pointer"
                                checked={
                                  filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize).length > 0 &&
                                  filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize).every(std => selectedStudentIds.includes(std.id))
                                }
                                onChange={(e) => {
                                  const currentPagedStudents = filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                                  if (e.target.checked) {
                                    setSelectedStudentIds(prev => {
                                      const newSelection = [...prev];
                                      currentPagedStudents.forEach(std => {
                                        if (!newSelection.includes(std.id)) {
                                          newSelection.push(std.id);
                                        }
                                      });
                                      return newSelection;
                                    });
                                  } else {
                                    setSelectedStudentIds(prev =>
                                      prev.filter(id => !currentPagedStudents.some(std => std.id === id))
                                    );
                                  }
                                }}
                              />
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Mã sinh viên</th>
                          <th className="px-6 py-4 text-left text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Tên</th>
                          <th className="px-6 py-4 text-left text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Lớp</th>
                          <th className="px-6 py-4 text-center text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Tổng điểm</th>
                          <th className="px-6 py-4 text-center text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Xếp loại</th>
                          <th className="px-6 py-4 text-right text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Hành động</th>
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
                            {filteredStudents
                              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                              .map((student) => {
                                const rank = getRank(student.score);
                                const className = apiClasses.find(c => c._id === student.classId)?.class_name || student.classId;

                                return (
                                  <motion.tr
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    key={student.id}
                                    className="hover:bg-slate-50 transition-colors group cursor-pointer"
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
                                      <span className={`inline-flex items-center justify-center px-3 py-1 border rounded-full text-[13px] font-semibold ${rank.color}`}>
                                        {student.score}/100
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span className={`px-3 py-1 border rounded-full text-[11px] font-bold uppercase tracking-tight ${getRankColor(student.grading)}`}>
                                        {student.grading}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex gap-2 justify-end items-center">
                                        {isSemesterActive ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              router.push(`/grading/score?studentId=${student.id}`);
                                            }}
                                            className="w-8 h-8 rounded-full flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 transition-all active:scale-95 cursor-pointer shadow-sm"
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
                                            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-700 transition-all active:scale-95 cursor-pointer shadow-sm"
                                            title="Xem chi tiết điểm"
                                          >
                                            <Eye size={15} />
                                          </button>
                                        )}
                                        {(() => {
                                          const currentUser = tokenStorage.getUser();
                                          const userRoleLower = currentUser?.role?.toLowerCase() || '';
                                          const canApprove = userRoleLower.includes('admin') || userRoleLower.includes('supervisor') || userRoleLower.includes('quản sinh');

                                          if (canApprove && isSemesterActive) {
                                            const isApproved = student.status === 'active';
                                            const hasEvaluations = (apiEvaluationDetails || []).some(d => {
                                              const detailSummaryId = typeof d.summary_id === 'object' ? d.summary_id?._id : d.summary_id;
                                              return detailSummaryId === student.summaryId;
                                            });

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
                                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-sm ${isApproved
                                                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 cursor-default'
                                                  : !hasEvaluations
                                                    ? 'bg-slate-50 text-slate-300 opacity-60 cursor-not-allowed'
                                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-500 cursor-pointer'
                                                  }`}
                                                title={
                                                  isApproved
                                                    ? "Đã duyệt điểm rèn luyện"
                                                    : !hasEvaluations
                                                      ? "Chưa có tiêu chí nào được chấm để duyệt"
                                                      : "Duyệt điểm rèn luyện"
                                                }
                                              >
                                                <CheckCircle size={15} />
                                              </button>
                                            );
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
                    totalItems={filteredStudents.length}
                    onPageChange={(page) => {
                      setIsFetching(true);
                      setTimeout(() => {
                        setCurrentPage(page);
                        setIsFetching(false);
                      }, 400);
                    }}
                    label="sinh viên"
                    isLoading={isFetching}
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
    </>
  );
}
