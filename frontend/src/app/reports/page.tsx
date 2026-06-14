'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';
import { RouteGuard } from '@/components/guards/RouteGuard';
import { useAuth, isAdminUser } from '@/providers/auth-provider';
import { toast } from 'sonner';
import { format } from 'date-fns';

// APIs
import { studentApi } from '@/api/student-api';
import { classApi } from '@/api/class-api';
import { departmentApi } from '@/api/department-api';
import { semesterApi } from '@/api/semester-api';
import { summariesPointApi } from '@/api/summaries-point-api';
import { academicRecordApi } from '@/api/academic-record-api';
import { dailyClassReportApi } from '@/api/daily-class-report-api';
import { studentTaskApi } from '@/api/task-api';
import { notificationApi } from '@/api/notification-api';
import { systemApi } from '@/api/system-api';
import { evaluationPeriodApi } from '@/api/evaluation-period-api';
import { evaluationDetailApi } from '@/api/evaluation-detail-api';
import { categoryApi } from '@/api/category-api';
import { criteriaApi } from '@/api/criteria-api';

// Types & Helpers
import { ReportFilterState, ReportsDataset } from '@/components/reports/report-types';
import { processReportsData, getEntityId, translateStatus } from '@/components/reports/report-helpers';
import { reportExportHelper, ColumnConfig } from '@/components/reports/report-export';

// Components
import ReportPageHeader from '@/components/reports/ReportPageHeader';
import ReportFilters from '@/components/reports/ReportFilters';
import ReportKpiGrid from '@/components/reports/ReportKpiGrid';
import ReportTabs, { ReportTabType } from '@/components/reports/ReportTabs';

// Tabs
import OverviewReportTab from '@/components/reports/tabs/OverviewReportTab';
import StudentReportTab from '@/components/reports/tabs/StudentReportTab';
import ScoreReportTab from '@/components/reports/tabs/ScoreReportTab';
import AcademicRecordReportTab from '@/components/reports/tabs/AcademicRecordReportTab';
import AttendanceReportTab from '@/components/reports/tabs/AttendanceReportTab';
import TaskReportTab from '@/components/reports/tabs/TaskReportTab';
import SystemReportTab from '@/components/reports/tabs/SystemReportTab';

const MAX_EXPORT_ROWS_PER_SHEET = 5000;
const MAX_EXPORT_WORKBOOK_ROWS = 10000;
const EXPORT_PAGE_SIZE = 100;

export default function ReportsPage() {
  const { user, hasPermission } = useAuth();
  
  // States for selectors
  const [semesters, setSemesters] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  
  // Main dataset & loading
  const [dataset, setDataset] = useState<ReportsDataset>({
    students: [],
    classes: [],
    departments: [],
    semesters: [],
    evaluationPeriods: [],
    summaries: [],
    evaluationDetails: [],
    categories: [],
    criteria: [],
    academicRecords: [],
    dailyReports: [],
    tasks: [],
    taskProgress: [],
    notifications: [],
    loginLogs: []
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTabType>('overview');
  const [hasLimitWarning, setHasLimitWarning] = useState(false);

  // Filter State
  const [filters, setFilters] = useState<ReportFilterState>({
    semesterId: '',
    evaluationPeriodId: '',
    departmentId: '',
    classId: '',
    startDate: '',
    endDate: '',
    searchQuery: '',
    status: ''
  });

  // Load configuration items (semesters, departments, classes)
  const loadConfigData = async () => {
    try {
      const [sems, depts, clses] = await Promise.all([
        semesterApi.getSemesters().catch(() => []),
        departmentApi.getDepartments().catch(() => []),
        classApi.getClasses().catch(() => [])
      ]);

      setSemesters(sems);
      setDepartments(depts);
      setClasses(clses);

      // Set active semester as default
      const activeSem = sems.find((s: any) => s.status === 'active');
      if (activeSem) {
        setFilters(prev => ({ ...prev, semesterId: activeSem._id }));
      }
    } catch (error) {
      console.error('Failed to load filter configurations:', error);
      toast.error('Lỗi khi tải cấu hình bộ lọc');
    }
  };

  // Load actual reports data
  const loadReportsData = async (showToast = false) => {
    setIsRefreshing(true);
    try {
      const [
        studentsRes,
        classesRes,
        deptsRes,
        semestersRes,
        summariesRes,
        recordsRes,
        dailyReportsRes,
        tasksRes,
        progressRes,
        notificationsRes,
        logsRes,
        periodsRes,
        detailsRes,
        categoriesRes,
        criteriaRes
      ] = await Promise.all([
        studentApi.getStudents().then(res => Array.isArray(res) ? res : (res?.data || [])).catch(() => []),
        classApi.getClasses().catch(() => []),
        departmentApi.getDepartments().catch(() => []),
        semesterApi.getSemesters().catch(() => []),
        summariesPointApi.getSummariesPoints().then(res => res?.data || []).catch(() => []),
        academicRecordApi.getAcademicRecords().catch(() => []),
        dailyClassReportApi.getDailyClassReports().catch(() => []),
        studentTaskApi.getTasks({ limit: 100 }).catch(() => ({ items: [], total: 0 })),
        studentTaskApi.getTaskProgressOverview({ limit: 100 }).catch(() => ({ items: [], total: 0 })),
        notificationApi.getNotifications({ limit: 100 }).catch(() => ({ items: [], total: 0 })),
        // Only fetch system logs if user is admin, otherwise skip
        (isAdminUser(user) || hasPermission('SYSTEM_ADMIN') || hasPermission('LOGIN_LOG_READ'))
          ? systemApi.getLoginLogs({ limit: 100 }).catch(() => ({ items: [], total: 0 }))
          : Promise.resolve({ items: [], total: 0 }),
        evaluationPeriodApi.getEvaluationPeriods().catch(() => []),
        evaluationDetailApi.getEvaluationDetails().catch(() => []),
        categoryApi.getCategories().catch(() => []),
        criteriaApi.getCriteria().catch(() => [])
      ]);

      setDataset({
        students: studentsRes,
        classes: classesRes,
        departments: deptsRes,
        semesters: semestersRes,
        evaluationPeriods: periodsRes,
        summaries: summariesRes,
        evaluationDetails: detailsRes,
        categories: categoriesRes,
        criteria: criteriaRes,
        academicRecords: recordsRes,
        dailyReports: dailyReportsRes,
        tasks: tasksRes.items || [],
        taskProgress: progressRes.items || [],
        notifications: notificationsRes.items || [],
        loginLogs: logsRes.items || []
      });

      // Check limit warnings
      const isTasksLimited = (tasksRes.total || 0) > (tasksRes.items?.length || 0);
      const isProgressLimited = (progressRes.total || 0) > (progressRes.items?.length || 0);
      const isNotificationsLimited = (notificationsRes.total || 0) > (notificationsRes.items?.length || 0);
      const isLogsLimited = (logsRes.total || 0) > (logsRes.items?.length || 0);
      setHasLimitWarning(isTasksLimited || isProgressLimited || isNotificationsLimited || isLogsLimited);

      if (showToast) {
        toast.success('Làm mới dữ liệu thành công!');
      }
    } catch (error) {
      console.error('Failed to load reports dataset:', error);
      toast.error('Không thể làm mới toàn bộ dữ liệu báo cáo');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadConfigData();
    loadReportsData();
  }, [user]);

  const handleRefresh = () => {
    loadReportsData(true);
  };

  // Helper function to sequentially fetch all pages of a paginated API endpoint
  async function fetchAllPagesForExport<T>(
    endpointFetcher: (query: any) => Promise<{ items: T[]; total: number }>,
    baseQuery: any,
    pageSize: number = 500,
    maxRows: number = 5000,
    tableName: string = 'Dữ liệu'
  ): Promise<T[]> {
    let allItems: T[] = [];
    let currentPage = 1;
    let hasMore = true;

    // Fetch the first page to determine items and total count
    const firstRes = await endpointFetcher({ ...baseQuery, page: currentPage, limit: pageSize });
    allItems = [...(firstRes.items || [])];
    const total = firstRes.total || 0;

    if (total > maxRows) {
      throw new Error(`Dữ liệu bảng "${tableName}" quá lớn (${total.toLocaleString()} dòng, vượt giới hạn ${maxRows.toLocaleString()} dòng). Vui lòng áp dụng bộ lọc chi tiết hơn.`);
    }

    if (allItems.length >= total) {
      hasMore = false;
    }

    while (hasMore && allItems.length < total) {
      currentPage++;
      const res = await endpointFetcher({ ...baseQuery, page: currentPage, limit: pageSize });
      const items = res.items || [];
      if (items.length === 0) {
        break; // Guard against infinite loop
      }
      allItems = [...allItems, ...items];
      if (allItems.length >= total) {
        hasMore = false;
      }
    }

    return allItems.slice(0, total);
  }

  // Fetch full datasets for export to bypass interactive 1000 limits
  const fetchFullDatasetForExport = async (target: 'task' | 'system' | 'all') => {
    let fullTasks = dataset.tasks;
    let fullProgress = dataset.taskProgress;
    let fullNotifications = dataset.notifications;
    let fullLogs = dataset.loginLogs;

    try {
      if (target === 'task' || target === 'all') {
        toast.info('Đang tải đầy đủ dữ liệu nhiệm vụ...');
        const [tasksRes, progressRes] = await Promise.all([
          fetchAllPagesForExport(
            studentTaskApi.getTasks,
            { search: filters.searchQuery },
            EXPORT_PAGE_SIZE,
            MAX_EXPORT_ROWS_PER_SHEET,
            'Nhiệm vụ'
          ),
          fetchAllPagesForExport(
            studentTaskApi.getTaskProgressOverview,
            { search: filters.searchQuery },
            EXPORT_PAGE_SIZE,
            MAX_EXPORT_ROWS_PER_SHEET,
            'Tiến độ nhiệm vụ'
          )
        ]);
        fullTasks = tasksRes;
        fullProgress = progressRes;
      }

      if (target === 'system' || target === 'all') {
        toast.info('Đang tải đầy đủ dữ liệu hệ thống...');
        const fetchSystem = isAdminUser(user) || hasPermission('SYSTEM_ADMIN') || hasPermission('LOGIN_LOG_READ');
        const [notificationsRes, logsRes] = await Promise.all([
          fetchAllPagesForExport(
            notificationApi.getNotifications,
            { search: filters.searchQuery },
            EXPORT_PAGE_SIZE,
            MAX_EXPORT_ROWS_PER_SHEET,
            'Thông báo'
          ),
          fetchSystem
            ? fetchAllPagesForExport(
                systemApi.getLoginLogs,
                { search: filters.searchQuery },
                EXPORT_PAGE_SIZE,
                MAX_EXPORT_ROWS_PER_SHEET,
                'Logs hệ thống'
              )
            : Promise.resolve([])
        ]);
        fullNotifications = notificationsRes;
        fullLogs = logsRes;
      }

      // Check cumulative limit threshold for full workbook
      if (target === 'all') {
        const totalRows = 
          dataset.students.length +
          dataset.summaries.length + 
          dataset.evaluationDetails.length + 
          dataset.academicRecords.length + 
          dataset.dailyReports.length + 
          fullTasks.length +
          fullProgress.length +
          fullNotifications.length +
          fullLogs.length;

        if (totalRows > MAX_EXPORT_WORKBOOK_ROWS) {
          throw new Error(`Tổng dữ liệu xuất workbook quá lớn (${totalRows.toLocaleString()} dòng, vượt giới hạn ${MAX_EXPORT_WORKBOOK_ROWS.toLocaleString()} dòng). Vui lòng áp dụng bộ lọc chi tiết hơn.`);
        }
      }

      return {
        ...dataset,
        tasks: fullTasks,
        taskProgress: fullProgress,
        notifications: fullNotifications,
        loginLogs: fullLogs
      };
    } catch (error: any) {
      console.error('Failed to fetch full data for export:', error);
      toast.error(error.message || 'Lỗi khi tải dữ liệu đầy đủ để xuất Excel');
      return null;
    }
  };

  // Process data based on active filters
  const processed = processReportsData(dataset, filters);

  // Filter out attention students (Rèn luyện yếu, vắng nhiều hoặc có kỷ luật)
  const getAttentionStudents = () => {
    const attentionList: any[] = [];
    
    // 1. Weak training points (score < 50)
    processed.tables.scores.forEach(score => {
      if (score.total_score < 50) {
        attentionList.push({
          _id: `score-${score._id}`,
          student_code: score.student_code,
          full_name: score.full_name,
          class_name: score.class_name,
          reason: `Điểm rèn luyện yếu: ${score.total_score}đ (${score.grading})`,
          severity: 'high'
        });
      }
    });

    // 2. High absence rate (attendance_rate < 80% / absent > 3 times)
    processed.tables.attendance.forEach(att => {
      if (att.attendance_rate < 0.8 && att.total_absent > 0) {
        // Find students in this class that have high absent records (approximate warning or detail warning)
        // For client side simplicity, we warn on the class or query students with high absent
      }
    });

    // 3. Disciplined students
    processed.tables.records.forEach(rec => {
      if (rec.type === 'ky_luat') {
        attentionList.push({
          _id: `rec-${rec._id}`,
          student_code: rec.student_code,
          full_name: rec.full_name,
          class_name: rec.class_name,
          reason: `Có ghi nhận kỷ luật: ${rec.record_title}`,
          severity: rec.points_effect <= -10 ? 'high' : 'medium'
        });
      }
    });

    return attentionList.slice(0, 10); // Limit to top 10 items for dashboard overview
  };

  const attentionStudents = getAttentionStudents();

  // Excel column configurations
  const studentCols: ColumnConfig[] = [
    { key: 'student_code', header: 'Mã SV', width: 15 },
    { key: 'full_name', header: 'Họ tên', width: 25 },
    { key: 'email', header: 'Email', width: 25 },
    { key: 'class_name', header: 'Lớp', width: 15 },
    { key: 'department_name', header: 'Khoa', width: 20 },
    { key: 'class_year', header: 'Khóa/Năm', width: 12 },
    { key: 'class_type', header: 'Hệ đào tạo', width: 15 },
    { key: 'headquarters', header: 'Cơ sở', width: 20 },
    { key: 'status', header: 'Trạng thái học tập', width: 20 },
    { key: 'account_status', header: 'Trạng thái tài khoản', width: 20 },
    { key: 'createdAt', header: 'Ngày tạo', width: 15 }
  ];

  const scoreCols: ColumnConfig[] = [
    { key: 'student_code', header: 'Mã SV', width: 15 },
    { key: 'full_name', header: 'Họ tên', width: 25 },
    { key: 'class_name', header: 'Lớp', width: 15 },
    { key: 'department_name', header: 'Khoa', width: 20 },
    { key: 'semester_name', header: 'Học kỳ', width: 20 },
    { key: 'total_score', header: 'Tổng điểm', type: 'number', width: 12 },
    { key: 'grading', header: 'Xếp loại', width: 15 },
    { key: 'status', header: 'Trạng thái hồ sơ', width: 15 },
    { key: 'updatedAt', header: 'Cập nhật gần nhất', width: 20 }
  ];

  const scoreDetailCols: ColumnConfig[] = [
    { key: 'student_code', header: 'Mã SV', width: 15 },
    { key: 'full_name', header: 'Họ tên', width: 25 },
    { key: 'class_name', header: 'Lớp', width: 15 },
    { key: 'category_name', header: 'Nhóm tiêu chí', width: 20 },
    { key: 'criterion_name', header: 'Tiêu chí', width: 35 },
    { key: 'current_count', header: 'Số lần', type: 'number', width: 12 },
    { key: 'system_score', header: 'Điểm HT', type: 'number', width: 12 },
    { key: 'sv_score', header: 'Điểm SV', type: 'number', width: 12 },
    { key: 'gv_score', header: 'Điểm GV', type: 'number', width: 12 },
    { key: 'final_score', header: 'Điểm cuối', type: 'number', width: 12 },
    { key: 'status', header: 'Trạng thái', width: 15 }
  ];

  const recordCols: ColumnConfig[] = [
    { key: 'recorded_at', header: 'Ngày ghi nhận', width: 15 },
    { key: 'student_code', header: 'Mã SV', width: 15 },
    { key: 'full_name', header: 'Họ tên', width: 25 },
    { key: 'class_name', header: 'Lớp', width: 15 },
    { key: 'department_name', header: 'Khoa', width: 20 },
    { key: 'type', header: 'Loại ghi nhận', width: 15 },
    { key: 'record_title', header: 'Tiêu đề', width: 30 },
    { key: 'description', header: 'Chi tiết', width: 40 },
    { key: 'points_effect', header: 'Điểm tác động', type: 'number', width: 15 },
    { key: 'recorded_by', header: 'Người ghi nhận', width: 20 },
    { key: 'status', header: 'Trạng thái', width: 15 }
  ];

  const attendanceCols: ColumnConfig[] = [
    { key: 'report_date', header: 'Ngày báo cáo', width: 15 },
    { key: 'class_name', header: 'Lớp học', width: 15 },
    { key: 'department_name', header: 'Khoa', width: 20 },
    { key: 'teacher_name', header: 'Giảng viên', width: 25 },
    { key: 'total_present', header: 'Có mặt', type: 'number', width: 12 },
    { key: 'total_absent', header: 'Vắng mặt', type: 'number', width: 12 },
    { key: 'total', header: 'Tổng số', type: 'number', width: 12 },
    { key: 'attendance_rate', header: 'Tỉ lệ hiện diện', type: 'percent', width: 15 },
    { key: 'class_note', header: 'Ghi chú lớp', width: 30 }
  ];

  const taskCols: ColumnConfig[] = [
    { key: 'title', header: 'Tên nhiệm vụ', width: 30 },
    { key: 'type', header: 'Loại', width: 15 },
    { key: 'subject', header: 'Chủ đề/Môn học', width: 20 },
    { key: 'deadline', header: 'Hạn hoàn thành', width: 15 },
    { key: 'priority', header: 'Mức độ ưu tiên', width: 15 },
    { key: 'status', header: 'Trạng thái', width: 15 },
    { key: 'targetType', header: 'Đối tượng', width: 15 },
    { key: 'targetScope', header: 'Phạm vi giao', width: 15 },
    { key: 'completion_rate', header: 'Tỉ lệ hoàn thành', type: 'percent', width: 18 }
  ];

  const taskProgressCols: ColumnConfig[] = [
    { key: 'taskTitle', header: 'Nhiệm vụ', width: 30 },
    { key: 'assigneeName', header: 'Người nhận', width: 25 },
    { key: 'assigneeType', header: 'Vai trò', width: 15 },
    { key: 'className', header: 'Lớp học', width: 15 },
    { key: 'status', header: 'Trạng thái tiến độ', width: 18 },
    { key: 'startedAt', header: 'Bắt đầu', width: 15 },
    { key: 'completedAt', header: 'Hoàn thành', width: 15 },
    { key: 'deadline', header: 'Hạn chót', width: 15 }
  ];

  const notificationCols: ColumnConfig[] = [
    { key: 'createdAt', header: 'Thời điểm', width: 20 },
    { key: 'title', header: 'Tiêu đề', width: 30 },
    { key: 'type', header: 'Loại', width: 15 },
    { key: 'description', header: 'Nội dung', width: 40 },
    { key: 'isRead', header: 'Trạng thái', width: 15 },
    { key: 'source', header: 'Nguồn', width: 15 }
  ];

  const systemCols: ColumnConfig[] = [
    { key: 'login_time', header: 'Thời điểm', width: 20 },
    { key: 'user_name', header: 'Tài khoản', width: 20 },
    { key: 'email', header: 'Email', width: 25 },
    { key: 'role_name', header: 'Vai trò', width: 15 },
    { key: 'ip_address', header: 'Địa chỉ IP', width: 18 },
    { key: 'action', header: 'Hành động', width: 20 },
    { key: 'details', header: 'Chi tiết logs', width: 40 }
  ];

  const maskEmail = (emailStr: string): string => {
    if (!emailStr || !emailStr.includes('@')) return emailStr;
    const [name, domain] = emailStr.split('@');
    if (name.length <= 2) return `${name[0]}***@${domain}`;
    return `${name.substring(0, 2)}***@${domain}`;
  };

  const maskIp = (ipStr: string): string => {
    if (!ipStr) return ipStr;
    const parts = ipStr.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`;
    }
    return ipStr.replace(/:/g, ':*');
  };

  // Individual Tab Excel Exports
  const handleExportSingleTab = async (tab: string) => {
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const workbook = reportExportHelper.createWorkbook();
    
    // Determine target based on tab to avoid fetching unnecessary tables
    let target: 'task' | 'system' | 'all' = 'task';
    if (tab === 'notifications' || tab === 'system') {
      target = 'system';
    }

    let exportDataset = dataset;
    // Check if we need to fetch full dataset for paginated tabs
    if (['task', 'taskProgress', 'notifications', 'system'].includes(tab)) {
      const fullDataset = await fetchFullDatasetForExport(target);
      if (!fullDataset) return; // Error toast already shown
      exportDataset = fullDataset;
    }

    const exportProcessed = processReportsData(exportDataset, filters);
    
    if (tab === 'student') {
      if (exportProcessed.tables.students.length === 0) return toast.warning('Không có dữ liệu để xuất Excel');
      reportExportHelper.appendJsonSheet(workbook, 'Sinh viên', exportProcessed.tables.students, studentCols);
      reportExportHelper.writeWorkbook(workbook, `Bao_cao_Sinh_vien_${timestamp}.xlsx`);
    } else if (tab === 'score') {
      if (exportProcessed.tables.scores.length === 0) return toast.warning('Không có dữ liệu để xuất Excel');
      reportExportHelper.appendJsonSheet(workbook, 'Điểm rèn luyện', exportProcessed.tables.scores, scoreCols);
      reportExportHelper.writeWorkbook(workbook, `Bao_cao_Diem_ren_luyen_${timestamp}.xlsx`);
    } else if (tab === 'scoreDetails') {
      if (exportProcessed.tables.scoreDetails.length === 0) return toast.warning('Không có dữ liệu để xuất Excel');
      reportExportHelper.appendJsonSheet(workbook, 'Chi tiết tiêu chí', exportProcessed.tables.scoreDetails, scoreDetailCols);
      reportExportHelper.writeWorkbook(workbook, `Bao_cao_Chi_tiet_tieu_chi_${timestamp}.xlsx`);
    } else if (tab === 'record') {
      if (exportProcessed.tables.records.length === 0) return toast.warning('Không có dữ liệu để xuất Excel');
      reportExportHelper.appendJsonSheet(workbook, 'Ghi nhận rèn luyện', exportProcessed.tables.records, recordCols);
      reportExportHelper.writeWorkbook(workbook, `Bao_cao_Ghi_nhan_${timestamp}.xlsx`);
    } else if (tab === 'attendance') {
      if (exportProcessed.tables.attendance.length === 0) return toast.warning('Không có dữ liệu để xuất Excel');
      reportExportHelper.appendJsonSheet(workbook, 'Chuyên cần', exportProcessed.tables.attendance, attendanceCols);
      reportExportHelper.writeWorkbook(workbook, `Bao_cao_Chuyen_can_${timestamp}.xlsx`);
    } else if (tab === 'task') {
      if (exportProcessed.tables.tasks.length === 0) return toast.warning('Không có dữ liệu để xuất Excel');
      reportExportHelper.appendJsonSheet(workbook, 'Nhiệm vụ', exportProcessed.tables.tasks, taskCols);
      reportExportHelper.writeWorkbook(workbook, `Bao_cao_Nhiem_vu_${timestamp}.xlsx`);
    } else if (tab === 'taskProgress') {
      if (exportProcessed.tables.taskProgress.length === 0) return toast.warning('Không có dữ liệu để xuất Excel');
      reportExportHelper.appendJsonSheet(workbook, 'Tiến độ người nhận', exportProcessed.tables.taskProgress, taskProgressCols);
      reportExportHelper.writeWorkbook(workbook, `Bao_cao_Tien_do_nhiem_vu_${timestamp}.xlsx`);
    } else if (tab === 'notifications') {
      if (exportProcessed.tables.notifications.length === 0) return toast.warning('Không có dữ liệu để xuất Excel');
      reportExportHelper.appendJsonSheet(workbook, 'Thông báo hệ thống', exportProcessed.tables.notifications, notificationCols);
      reportExportHelper.writeWorkbook(workbook, `Bao_cao_Thong_bao_${timestamp}.xlsx`);
    } else if (tab === 'system') {
      if (exportProcessed.tables.system.length === 0) return toast.warning('Không có dữ liệu để xuất Excel');
      const maskedLogs = exportProcessed.tables.system.map(log => ({
        ...log,
        email: maskEmail(log.email),
        ip_address: maskIp(log.ip_address)
      }));
      reportExportHelper.appendJsonSheet(workbook, 'Logs hệ thống', maskedLogs, systemCols);
      reportExportHelper.writeWorkbook(workbook, `Bao_cao_Thong_bao_He_thong_${timestamp}.xlsx`);
    }
    
    toast.success('Xuất dữ liệu Excel thành công!');
  };

  // Export Cumulative Workbook (All tabs combined)
  const handleExportWorkbookAll = async () => {
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const workbook = reportExportHelper.createWorkbook();

    // Fetch full datasets for all tabs before export
    const exportDataset = await fetchFullDatasetForExport('all');
    if (!exportDataset) return; // Error toast shown

    const exportProcessed = processReportsData(exportDataset, filters);

    // 0. Filter Sheet
    const getFilterLabel = (id: string, list: any[], keyName = 'semester_name') => {
      const item = list.find(x => x._id === id);
      return item ? (item[keyName] || item.name || item.class_name) : 'Tất cả';
    };

    const showLogs = isAdminUser(user) || hasPermission('SYSTEM_ADMIN') || hasPermission('LOGIN_LOG_READ');

    const filterMetadata = [
      { 'Trường thông tin': 'Học kỳ', 'Giá trị áp dụng': getFilterLabel(filters.semesterId, semesters, 'semester_name') },
      { 'Trường thông tin': 'Đợt đánh giá', 'Giá trị áp dụng': filters.evaluationPeriodId || 'Tất cả' },
      { 'Trường thông tin': 'Khoa', 'Giá trị áp dụng': getFilterLabel(filters.departmentId, departments, 'name') },
      { 'Trường thông tin': 'Lớp học', 'Giá trị áp dụng': getFilterLabel(filters.classId, classes, 'class_name') },
      { 'Trường thông tin': 'Từ ngày', 'Giá trị áp dụng': filters.startDate || 'Không giới hạn' },
      { 'Trường thông tin': 'Đến ngày', 'Giá trị áp dụng': filters.endDate || 'Không giới hạn' },
      { 'Trường thông tin': 'Tìm kiếm', 'Giá trị áp dụng': filters.searchQuery || 'Trống' },
      { 'Trường thông tin': 'Trạng thái học tập', 'Giá trị áp dụng': filters.status ? translateStatus(filters.status) : 'Tất cả' },
      { 'Trường thông tin': 'Thời điểm xuất', 'Giá trị áp dụng': format(new Date(), 'dd/MM/yyyy HH:mm:ss') },
      { 'Trường thông tin': 'Người thực hiện', 'Giá trị áp dụng': user?.user_name || user?.username || 'Hệ thống' },
      { 'Trường thông tin': 'Nguồn kết xuất', 'Giá trị áp dụng': 'Client-side Full Fetch' },
      { 'Trường thông tin': 'Số dòng [Sinh viên]', 'Giá trị áp dụng': exportProcessed.tables.students.length.toString() },
      { 'Trường thông tin': 'Số dòng [Điểm rèn luyện]', 'Giá trị áp dụng': exportProcessed.tables.scores.length.toString() },
      { 'Trường thông tin': 'Số dòng [Chi tiết tiêu chí]', 'Giá trị áp dụng': exportProcessed.tables.scoreDetails.length.toString() },
      { 'Trường thông tin': 'Số dòng [Ghi nhận]', 'Giá trị áp dụng': exportProcessed.tables.records.length.toString() },
      { 'Trường thông tin': 'Số dòng [Chuyên cần]', 'Giá trị áp dụng': exportProcessed.tables.attendance.length.toString() },
      { 'Trường thông tin': 'Số dòng [Nhiệm vụ]', 'Giá trị áp dụng': exportProcessed.tables.tasks.length.toString() },
      { 'Trường thông tin': 'Số dòng [Tiến độ nhiệm vụ]', 'Giá trị áp dụng': exportProcessed.tables.taskProgress.length.toString() }
    ];

    if (exportProcessed.tables.notifications.length > 0) {
      filterMetadata.push({ 'Trường thông tin': 'Số dòng [Thông báo]', 'Giá trị áp dụng': exportProcessed.tables.notifications.length.toString() });
    }
    if (showLogs && exportProcessed.tables.system.length > 0) {
      filterMetadata.push({ 'Trường thông tin': 'Số dòng [Logs hệ thống]', 'Giá trị áp dụng': exportProcessed.tables.system.length.toString() });
    }

    reportExportHelper.appendJsonSheet(workbook, 'Bo loc', filterMetadata, [
      { key: 'Trường thông tin', header: 'Trường thông tin bộ lọc', width: 25 },
      { key: 'Giá trị áp dụng', header: 'Giá trị cấu hình', width: 35 }
    ]);

    // 1. Overview sheet
    const overviewData = exportProcessed.kpis.map(k => ({
      'Chỉ số': k.title,
      'Giá trị': String(k.value),
      'Mô tả': k.description
    }));
    reportExportHelper.appendJsonSheet(workbook, 'Tong quan', overviewData, [
      { key: 'Chỉ số', header: 'Chỉ số KPI', width: 25 },
      { key: 'Giá trị', header: 'Giá trị thống kê', width: 20 },
      { key: 'Mô tả', header: 'Mô tả chi tiết', width: 35 }
    ]);

    // 2. Student sheet
    if (exportProcessed.tables.students.length > 0) {
      reportExportHelper.appendJsonSheet(workbook, 'Sinh vien', exportProcessed.tables.students, studentCols);
    }
    // 3. Score sheet & Score Details sheet
    if (exportProcessed.tables.scores.length > 0) {
      reportExportHelper.appendJsonSheet(workbook, 'Diem ren luyen', exportProcessed.tables.scores, scoreCols);
    }
    if (exportProcessed.tables.scoreDetails.length > 0) {
      reportExportHelper.appendJsonSheet(workbook, 'Chi tiet tieu chi', exportProcessed.tables.scoreDetails, scoreDetailCols);
    }
    // 4. Record sheet
    if (exportProcessed.tables.records.length > 0) {
      reportExportHelper.appendJsonSheet(workbook, 'Ghi nhan', exportProcessed.tables.records, recordCols);
    }
    // 5. Attendance sheet
    if (exportProcessed.tables.attendance.length > 0) {
      reportExportHelper.appendJsonSheet(workbook, 'Chuyen can', exportProcessed.tables.attendance, attendanceCols);
    }
    // 6. Task sheet & Task Progress sheet
    if (exportProcessed.tables.tasks.length > 0) {
      reportExportHelper.appendJsonSheet(workbook, 'Nhiem vu', exportProcessed.tables.tasks, taskCols);
    }
    if (exportProcessed.tables.taskProgress.length > 0) {
      reportExportHelper.appendJsonSheet(workbook, 'Tien do nhiem vu', exportProcessed.tables.taskProgress, taskProgressCols);
    }
    // 6b. Notifications sheet (Admin/Supervisor only or all report users)
    if (exportProcessed.tables.notifications.length > 0) {
      reportExportHelper.appendJsonSheet(workbook, 'Thong bao', exportProcessed.tables.notifications, notificationCols);
    }
    // 7. System logs (Admin / LOGIN_LOG_READ only, with Email/IP masking)
    if (exportProcessed.tables.system.length > 0 && showLogs) {
      const maskedLogs = exportProcessed.tables.system.map(log => ({
        ...log,
        email: maskEmail(log.email),
        ip_address: maskIp(log.ip_address)
      }));
      reportExportHelper.appendJsonSheet(workbook, 'Logs he thong', maskedLogs, systemCols);
    }

    reportExportHelper.writeWorkbook(workbook, `Bao_cao_Tong_hop_Manager_Point_${timestamp}.xlsx`);
    toast.success('Xuất Workbook tổng hợp Excel thành công!');
  };

  const showSystem = isAdminUser(user) || hasPermission('SYSTEM_ADMIN') || hasPermission('LOGIN_LOG_READ');

  // Badge count mappings
  const tabCounts = {
    student: processed.tables.students.length,
    score: processed.tables.scores.length,
    record: processed.tables.records.length,
    attendance: processed.tables.attendance.length,
    task: processed.tables.tasks.length,
    system: showSystem ? (processed.tables.notifications.length + processed.tables.system.length) : 0
  };

  return (
    <RouteGuard useDynamicMapping>
      <div className="flex h-screen bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] font-sans text-[#1E293B] overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header />
          <main className="flex-1 flex flex-col overflow-y-auto custom-scrollbar pb-10">
          
          {/* Header section */}
          <ReportPageHeader
            onExportAll={handleExportWorkbookAll}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            canExport={!isLoading && processed.tables.students.length > 0}
          />

          {/* Filters Area */}
          <ReportFilters
            semesters={semesters}
            departments={departments}
            classes={classes}
            filters={filters}
            onChange={setFilters}
          />

          {/* Limit warning banner */}
          {hasLimitWarning && (
            <div className="mx-6 mt-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 backdrop-blur-md flex items-start gap-3 text-amber-700 animate-fade-in">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h4 className="font-bold text-[14px]">Dữ liệu hiển thị bị giới hạn</h4>
                <p className="text-[12.5px] mt-0.5 text-amber-700 font-medium">
                  Một số nguồn dữ liệu (Nhiệm vụ, Tiến độ, Thông báo, Logs hệ thống) đang vượt quá giới hạn 1,000 bản ghi. 
                  Số liệu hiển thị và file Excel xuất ra có thể chưa đầy đủ. Hãy chọn bộ lọc chi tiết hơn (Khoa, Lớp, Học kỳ, Khoảng ngày) hoặc liên hệ Quản trị viên để lấy báo cáo hoàn chỉnh từ máy chủ.
                </p>
              </div>
            </div>
          )}

          {/* KPIs Area */}
          <ReportKpiGrid
            kpis={processed.kpis}
            isLoading={isLoading}
          />

          {/* Tabs Area */}
          <ReportTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            counts={tabCounts}
            showSystemTab={showSystem}
          />

          {/* Dynamic Tab Content rendering */}
          <div className="flex-1 min-h-[400px]">
            {activeTab === 'overview' && (
              <OverviewReportTab
                charts={processed.charts}
                attentionStudents={attentionStudents}
              />
            )}

            {activeTab === 'student' && (
              <StudentReportTab
                data={processed.tables.students}
                isLoading={isLoading}
                onExport={() => handleExportSingleTab('student')}
              />
            )}

            {activeTab === 'score' && (
              <ScoreReportTab
                data={processed.tables.scores}
                scoreDetailsData={processed.tables.scoreDetails}
                isLoading={isLoading}
                onExport={() => handleExportSingleTab('score')}
                onExportDetails={() => handleExportSingleTab('scoreDetails')}
              />
            )}

            {activeTab === 'record' && (
              <AcademicRecordReportTab
                data={processed.tables.records}
                isLoading={isLoading}
                onExport={() => handleExportSingleTab('record')}
              />
            )}

            {activeTab === 'attendance' && (
              <AttendanceReportTab
                data={processed.tables.attendance}
                isLoading={isLoading}
                onExport={() => handleExportSingleTab('attendance')}
              />
            )}

            {activeTab === 'task' && (
              <TaskReportTab
                data={processed.tables.tasks}
                taskProgressData={processed.tables.taskProgress}
                isLoading={isLoading}
                onExport={() => handleExportSingleTab('task')}
                onExportProgress={() => handleExportSingleTab('taskProgress')}
              />
            )}

            {activeTab === 'system' && showSystem && (
              <SystemReportTab
                notificationsData={processed.tables.notifications}
                onExportNotifications={() => handleExportSingleTab('notifications')}
                logsData={processed.tables.system}
                onExportLogs={() => handleExportSingleTab('system')}
                isLoading={isLoading}
                showLogs={isAdminUser(user) || hasPermission('SYSTEM_ADMIN') || hasPermission('LOGIN_LOG_READ')}
              />
            )}
          </div>
        </main>
        </div>
      </div>
    </RouteGuard>
  );
}
