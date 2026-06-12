'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import { useAuth } from '@/providers/auth-provider';
import { studentApi } from '@/api/student-api';
import { classApi } from '@/api/class-api';
import { departmentApi } from '@/api/department-api';
import { semesterApi, Semester } from '@/api/semester-api';
import { evaluationPeriodApi } from '@/api/evaluation-period-api';
import { summariesPointApi } from '@/api/summaries-point-api';
import { academicRecordApi } from '@/api/academic-record-api';
import { studentTaskApi } from '@/api/task-api';
import { notificationApi } from '@/api/notification-api';
import { systemApi } from '@/api/system-api';
import { criteriaApi } from '@/api/criteria-api';
import { categoryApi } from '@/api/category-api';
import { buildDashboardOverview, DashboardMetrics } from '../components/dashboard/dashboard-helpers';
import { AlertTriangle, Info, ShieldAlert, CheckCircle2 } from 'lucide-react';

// Dashboard sub-components
import DashboardHeader from '../components/dashboard/DashboardHeader';
import KpiGrid from '../components/dashboard/KpiGrid';
import EvaluationProgressPanel from '../components/dashboard/EvaluationProgressPanel';
import AcademicOverviewPanel from '../components/dashboard/AcademicOverviewPanel';
import AttendanceRecordPanel from '../components/dashboard/AttendanceRecordPanel';
import TaskPanel from '../components/dashboard/TaskPanel';
import SystemOperationsPanel from '../components/dashboard/SystemOperationsPanel';
import QuickActionsPanel from '../components/dashboard/QuickActionsPanel';
import ScoreDistributionChart from '../components/dashboard/ScoreDistributionChart';
import StudentSpotlightPanel from '../components/dashboard/StudentSpotlightPanel';

export default function DashboardPage() {
  const { user } = useAuth();
  
  // Filtering & State
  const [semestersList, setSemestersList] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Extra system state
  const [systemRequests, setSystemRequests] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);

  // Raw fetched arrays to re-aggregate when filter changes without re-fetching
  const [rawState, setRawState] = useState<{
    students: any[];
    classes: any[];
    departments: any[];
    semesters: any[];
    periods: any[];
    summaries: any[];
    academicRecords: any[];
    criteria: any[];
    categories: any[];
    tasks: any[];
    notifications: any[];
    unreadCount: number;
    systemData: any;
  } | null>(null);

  const loadData = useCallback(async (showIndicator = true) => {
    if (!user) return;
    if (showIndicator) {
      setIsRefreshing(true);
    }

    try {
      const role = (user?.roleCode || user?.roleName || user?.role || '').toUpperCase();
      const isSysAdmin = role === 'ADMIN' || (user?.permissions || []).includes('ADMIN_FULL');
      const isTeacher = role.includes('TEACHER') || role.includes('ADVISOR') || role.includes('GIANG VIEN') || role.includes('CO VAN');
      const isStudent = role.includes('STUDENT') || role.includes('SINH VIEN') || role.includes('HOC SINH');
      const isSystemOp = (user?.permissions || []).some(p => ['LOGIN_LOG_READ', 'SYSTEM_REQUEST_READ', 'DATABASE_BACKUP_READ'].includes(p));

      // Construct promises arrays to call concurrent APIs safely using .catch() wrappers
      const pStudents = (isSysAdmin || isTeacher) 
        ? studentApi.getStudents().catch(() => []) 
        : isStudent 
          ? studentApi.getMyStudent().then(s => s ? [s] : []).catch(() => [])
          : Promise.resolve([]);

      const pClasses = (isSysAdmin || isTeacher)
        ? classApi.getClasses().catch(() => [])
        : Promise.resolve([]);

      const pDepts = (isSysAdmin || isTeacher)
        ? departmentApi.getDepartments().catch(() => [])
        : Promise.resolve([]);

      const pSemesters = semesterApi.getSemesters().catch(() => []);
      const pPeriods = evaluationPeriodApi.getEvaluationPeriods().catch(() => []);
      const pSummaries = summariesPointApi.getSummariesPoints().catch(() => []);

      const pAcademicRecords = (isSysAdmin || isTeacher)
        ? academicRecordApi.getAcademicRecords().catch(() => [])
        : (isStudent && user.studentId)
          ? academicRecordApi.getAcademicRecordsByStudent(user.studentId).catch(() => [])
          : Promise.resolve([]);

      const pCriteria = criteriaApi.getCriteria().catch(() => []);
      const pCategories = categoryApi.getCategories().catch(() => []);

      const pTasks = studentTaskApi.getTasks({ page: 1, limit: 10, sort: 'deadline_asc' })
        .then(res => res.items || [])
        .catch(() => []);

      const pUnreadCount = notificationApi.getUnreadCount()
        .then(res => res.count || 0)
        .catch(() => 0);

      const pNotifications = notificationApi.getNotifications({ page: 1, limit: 10 })
        .then(res => res.items || [])
        .catch(() => []);

      // System Operator exclusive promises
      const pLoginSummary = (isSysAdmin || isSystemOp)
        ? systemApi.getLoginLogsSummary().catch(() => null)
        : Promise.resolve(null);

      const pRequests = (isSysAdmin || isSystemOp)
        ? systemApi.getRequests({ page: 1, limit: 5 }).then(res => res.items || []).catch(() => [])
        : Promise.resolve([]);

      const pBackupsList = (isSysAdmin || isSystemOp)
        ? systemApi.getBackups({ page: 1, limit: 5 }).then(res => res.items || []).catch(() => [])
        : Promise.resolve([]);

      // Resolve all promises concurrently
      const [
        students,
        classes,
        departments,
        semesters,
        periods,
        summaries,
        academicRecords,
        criteria,
        categories,
        tasks,
        unreadCount,
        notifications,
        loginSummary,
        requests,
        backupsList
      ] = await Promise.all([
        pStudents,
        pClasses,
        pDepts,
        pSemesters,
        pPeriods,
        pSummaries,
        pAcademicRecords,
        pCriteria,
        pCategories,
        pTasks,
        pUnreadCount,
        pNotifications,
        pLoginSummary,
        pRequests,
        pBackupsList
      ]);

      setSemestersList(semesters);

      // Default selectedSemesterId to active semester if not already set
      if (!selectedSemesterId && semesters.length > 0) {
        const activeSem = semesters.find(s => s.status === 'active') || semesters[0];
        if (activeSem) {
          setSelectedSemesterId(activeSem._id);
        }
      }

      const systemData = {
        loginSummary,
        systemRequests: requests,
        backups: backupsList
      };

      // Store raw state for filtering
      setRawState({
        students,
        classes,
        departments,
        semesters,
        periods,
        summaries,
        academicRecords,
        criteria,
        categories,
        tasks,
        notifications,
        unreadCount,
        systemData
      });

      setSystemRequests(requests);
      setBackups(backupsList);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user, selectedSemesterId]);

  // Run initial load
  useEffect(() => {
    if (user) {
      loadData(false);
    }
  }, [user, loadData]);

  // Re-aggregate when selected semester filters change or raw state loads
  useEffect(() => {
    if (user && rawState) {
      const computedMetrics = buildDashboardOverview({
        user,
        students: rawState.students,
        classes: rawState.classes,
        departments: rawState.departments,
        semesters: rawState.semesters,
        periods: rawState.periods,
        summaries: rawState.summaries,
        academicRecords: rawState.academicRecords,
        criteria: rawState.criteria,
        categories: rawState.categories,
        tasks: rawState.tasks,
        notifications: rawState.notifications,
        unreadCount: rawState.unreadCount,
        systemData: rawState.systemData,
        selectedSemesterId
      });
      setMetrics(computedMetrics);
    }
  }, [selectedSemesterId, rawState, user]);

  const handleRefresh = () => {
    loadData(true);
  };

  const handleSemesterChange = (semesterId: string) => {
    setSelectedSemesterId(semesterId);
  };

  // Compute Attention Warnings
  const getAttentionItems = () => {
    if (!metrics) return [];
    const items: Array<{ text: string; type: 'warning' | 'danger' | 'info' | 'success' }> = [];

    // 1. Evaluation period ending soon
    if (metrics.activePeriod) {
      let deadlineStr = '';
      let phaseName = '';
      switch (metrics.activePeriod.status) {
        case 'sv_phase':
          deadlineStr = metrics.activePeriod.sv_deadline;
          phaseName = 'SV tự đánh giá';
          break;
        case 'gv_phase':
          deadlineStr = metrics.activePeriod.gv_deadline;
          phaseName = 'GV duyệt điểm';
          break;
        case 'admin_phase':
          deadlineStr = metrics.activePeriod.admin_deadline;
          phaseName = 'Admin chốt điểm';
          break;
      }
      if (deadlineStr) {
        const diffDays = Math.ceil((new Date(deadlineStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 3 && diffDays >= 0) {
          items.push({
            text: `Đợt đánh giá rèn luyện (Giai đoạn: ${phaseName}) sẽ kết thúc sau ${diffDays} ngày nữa! Hãy hoàn thành tiến trình kịp thời.`,
            type: 'warning'
          });
        } else if (diffDays < 0) {
          items.push({
            text: `Đợt đánh giá rèn luyện (Giai đoạn: ${phaseName}) đã quá hạn chót ${Math.abs(diffDays)} ngày!`,
            type: 'danger'
          });
        }
      }
    }

    // 2. High login failures
    if (metrics.kpis.todayLoginFailure > 5) {
      items.push({
        text: `Số lượt đăng nhập thất bại tăng đột biến hôm nay (${metrics.kpis.todayLoginFailure} lượt). Hãy kiểm tra hệ thống bảo mật!`,
        type: 'danger'
      });
    }

    // 3. Last backup failed
    if (metrics.kpis.lastBackupStatus === 'failed') {
      items.push({
        text: 'Bản sao lưu dữ liệu gần nhất đã thất bại! Hãy thực hiện lại hoặc kiểm tra log hệ thống.',
        type: 'danger'
      });
    }

    return items;
  };

  if (isLoading || !metrics) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] font-sans text-[#1E293B]">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1A73E8] border-t-transparent shadow-md"></div>
              <p className="text-xs font-semibold text-[#64748B] animate-pulse">
                Đang tải dữ liệu vận hành...
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const role = (user?.roleCode || user?.roleName || user?.role || '').toUpperCase();
  const isSysAdmin = role === 'ADMIN' || (user?.permissions || []).includes('ADMIN_FULL');
  const isSystemOp = (user?.permissions || []).some(p => ['LOGIN_LOG_READ', 'SYSTEM_REQUEST_READ', 'DATABASE_BACKUP_READ'].includes(p));
  const showSystemPanel = isSysAdmin || isSystemOp;
  const attentionItems = getAttentionItems();

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] font-sans text-[#1E293B]">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-6 scrollbar-hover">
          <div className="max-w-screen-2xl mx-auto space-y-6">
            
            {/* Header section with Semester Selector */}
            <DashboardHeader 
              userName={user?.user_name || user?.username || 'Người dùng'}
              roleName={user?.roleName || user?.role || 'Khách'}
              roleScope={metrics.roleScope}
              activeSemester={metrics.activeSemester}
              activePeriod={metrics.activePeriod}
              lastUpdated={lastUpdated}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              semesters={semestersList}
              selectedSemesterId={selectedSemesterId}
              onSemesterChange={handleSemesterChange}
            />

            {/* Student Spotlight & Leaderboards */}
            <StudentSpotlightPanel metrics={metrics} />

            {/* Attention Alerts / Warnings */}
            {attentionItems.length > 0 && (
              <div className="space-y-2">
                {attentionItems.map((item, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center gap-2.5 p-3.5 border rounded-2xl text-xs font-bold shadow-sm transition-all duration-150 ${
                      item.type === 'danger' 
                        ? 'bg-rose-500/10 text-rose-700 border-rose-500/20' 
                        : 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                    }`}
                  >
                    {item.type === 'danger' ? <ShieldAlert size={16} className="shrink-0 text-rose-600" /> : <AlertTriangle size={16} className="shrink-0 text-amber-600" />}
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* KPI Cards Grid */}
            <KpiGrid metrics={metrics} />

            {/* Quick Actions Panel */}
            <QuickActionsPanel roleScope={metrics.roleScope} />

            {/* Main dashboard columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column (2 spans wide on lg) */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Attendance & Evaluation Progress Panels */}
                {metrics.roleScope !== 'system' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <AttendanceRecordPanel metrics={metrics} />
                    <EvaluationProgressPanel metrics={metrics} />
                  </div>
                )}

                {/* Score Distribution Chart & Student Roster Statuses */}
                {metrics.roleScope !== 'system' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ScoreDistributionChart distribution={metrics.distributions.scoreDistribution} />
                    <AcademicOverviewPanel metrics={metrics} />
                  </div>
                )}
                
                {/* For system operator role only */}
                {metrics.roleScope === 'system' && (
                  <TaskPanel metrics={metrics} />
                )}

              </div>

              {/* Right Column (1 span wide on lg) */}
              <div className="space-y-6">
                
                {/* Task Panel (For student, teacher, admin) */}
                {metrics.roleScope !== 'system' && (
                  <TaskPanel metrics={metrics} />
                )}


              </div>

            </div>

            {/* System operations dashboard card for admins & operators */}
            {showSystemPanel && (
              <SystemOperationsPanel 
                metrics={metrics} 
                systemRequests={systemRequests}
                backups={backups}
              />
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
