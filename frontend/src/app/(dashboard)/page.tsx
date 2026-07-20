'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { isStudentRole } from '@/utils/role.util';
import { Semester } from '@/api/semester-api';
import { systemApi } from '@/api/system-api';
import type { DashboardMetrics } from '@/components/dashboard/dashboard-helpers';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

// Dashboard sub-components
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import KpiGrid from '@/components/dashboard/KpiGrid';
import EvaluationProgressPanel from '@/components/dashboard/EvaluationProgressPanel';
import AcademicOverviewPanel from '@/components/dashboard/AcademicOverviewPanel';
import AttendanceRecordPanel from '@/components/dashboard/AttendanceRecordPanel';
import TaskPanel from '@/components/dashboard/TaskPanel';
import QuickActionsPanel from '@/components/dashboard/QuickActionsPanel';
import ScoreDistributionChart from '@/components/dashboard/ScoreDistributionChart';

// Lazy-loaded panels (conditional rendering)
const SystemOperationsPanel = lazy(() => import('@/components/dashboard/SystemOperationsPanel'));
const StudentSpotlightPanel = lazy(() => import('@/components/dashboard/StudentSpotlightPanel'));



export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && isStudentRole(user)) {
      router.push('/students/tasks');
    }
  }, [user, router]);
  


  // Filtering & State
  const [semestersList, setSemestersList] = useState<Semester[]>([]);
  const semestersRef = useRef<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string | null>(null);
  const selectedSemesterRef = useRef<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Extra system state
  const [systemRequests, setSystemRequests] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);

  const loadData = useCallback(async (showIndicator = true, targetSemId?: string | null) => {
    if (!user) return;
    if (showIndicator) {
      setIsRefreshing(true);
    }

    try {
      // 1. Determine the semester ID to load (use refs for stable references)
      const semIdToLoad = targetSemId !== undefined ? targetSemId : selectedSemesterRef.current;

      // 2. Fetch metrics from backend (single API call)
      const dashboardMetrics = await systemApi.getDashboardMetrics(semIdToLoad || undefined);
      setMetrics(dashboardMetrics);

      // 3. Update semesters list from metrics if available and not yet loaded
      if (semestersRef.current.length === 0 && dashboardMetrics.semesters) {
        semestersRef.current = dashboardMetrics.semesters;
        setSemestersList(dashboardMetrics.semesters);
        // Auto-select active semester if none selected
        if (!selectedSemesterRef.current && dashboardMetrics.semesters.length > 0) {
          const activeSem = dashboardMetrics.semesters.find((s: Semester) => s.status === 'active') || dashboardMetrics.semesters[0];
          if (activeSem) {
            selectedSemesterRef.current = activeSem._id;
            setSelectedSemesterId(activeSem._id);
          }
        }
      }

      // 4. Set system operator data
      if (dashboardMetrics.systemData) {
        setSystemRequests(dashboardMetrics.systemData.systemRequests || []);
        setBackups(dashboardMetrics.systemData.backups || []);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  // Run initial load
  useEffect(() => {
    if (user) {
      loadData(false);
    }
  }, [user]);

  useEffect(() => {
    const handleNotificationsUpdate = () => loadData(false);
    window.addEventListener('notifications-updated', handleNotificationsUpdate);
    return () => window.removeEventListener('notifications-updated', handleNotificationsUpdate);
  }, [loadData]);

  const handleRefresh = () => {
    loadData(true);
  };

  const handleSemesterChange = (semesterId: string) => {
    selectedSemesterRef.current = semesterId;
    setSelectedSemesterId(semesterId);
    loadData(true, semesterId);
  };

  // Compute Attention Warnings (memoized to avoid recalculation on every render)
  const attentionItems = useMemo(() => {
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
          phaseName = 'Admin phê duyệt';
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
  }, [metrics]);

  if (isLoading || !metrics) {
    return (
      <div className="flex-1 flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1A73E8] border-t-transparent shadow-md"></div>
          <p className="text-xs font-semibold text-[#64748B] animate-pulse">
            Đang tải dữ liệu vận hành...
          </p>
        </div>
      </div>
    );
  }

  const role = (user?.roleCode || user?.roleName || user?.role || '').toUpperCase();
  const isSysAdmin = role === 'ADMIN' || (user?.permissions || []).includes('ADMIN_FULL');
  const isSystemOp = (user?.permissions || []).some(p => ['LOGIN_LOG_READ', 'SYSTEM_REQUEST_READ', 'DATABASE_BACKUP_READ'].includes(p));
  const showSystemPanel = isSysAdmin || isSystemOp;

  return (
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
        <Suspense fallback={<div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40 h-32 animate-pulse" />}>
          <StudentSpotlightPanel metrics={metrics} />
        </Suspense>

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
          <Suspense fallback={<div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40 h-32 animate-pulse" />}>
            <SystemOperationsPanel 
              metrics={metrics} 
              systemRequests={systemRequests}
              backups={backups}
            />
          </Suspense>
        )}

      </div>
    </div>
  );
}
