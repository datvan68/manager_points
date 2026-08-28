'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
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
import StudentSpotlightPanel from '@/components/dashboard/StudentSpotlightPanel';

const DeferredPanelsPlaceholder = () => (
  <div
    aria-label="Đang tải các bảng điều khiển bổ sung"
    className="space-y-4 sm:space-y-6"
  >
    <div className="h-24 rounded-2xl bg-white/45 border border-white/75 animate-pulse" />
    <div className="h-[420px] rounded-2xl bg-white/45 border border-white/75 animate-pulse" />
  </div>
);

const DashboardDeferredPanels = dynamic(
  () => import('@/components/dashboard/DashboardDeferredPanels'),
  { loading: () => <DeferredPanelsPlaceholder />, ssr: false },
);



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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Extra system state
  const [systemRequests, setSystemRequests] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const loadsInFlightRef = useRef(new Map<string, Promise<void>>());
  const deferredPanelsSentinelRef = useRef<HTMLDivElement>(null);
  const [shouldLoadDeferredPanels, setShouldLoadDeferredPanels] = useState(false);

  useEffect(() => {
    if (shouldLoadDeferredPanels) return;

    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoadDeferredPanels(true);
      return;
    }

    const sentinel = deferredPanelsSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoadDeferredPanels(true);
          observer.disconnect();
        }
      },
      { rootMargin: '640px 0px' },
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [metrics, shouldLoadDeferredPanels]);

  const loadData = useCallback(async (showIndicator = true, targetSemId?: string | null) => {
    if (!user) return;
    const semIdToLoad = targetSemId !== undefined ? targetSemId : selectedSemesterRef.current;
    const loadKey = semIdToLoad || '__active__';
    const existingLoad = loadsInFlightRef.current.get(loadKey);
    if (existingLoad) return existingLoad;

    const load = (async () => {
    if (showIndicator) {
      setIsRefreshing(true);
    }
    setLoadError(null);

    try {
      // 1. Determine the semester ID to load (use refs for stable references)
      // 2. Fetch metrics from backend (single API call)
      const dashboardMetrics = await Promise.race([
        systemApi.getDashboardMetrics(semIdToLoad || undefined),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DASHBOARD_TIMEOUT')), 12000)),
      ]);
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
      setLoadError('Không thể tải dữ liệu vận hành. Vui lòng kiểm tra kết nối và thử lại.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
    })();
    loadsInFlightRef.current.set(loadKey, load);
    try {
      await load;
    } finally {
      loadsInFlightRef.current.delete(loadKey);
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
          {loadError ? <p className="text-xs font-semibold text-rose-600 text-center max-w-xs">{loadError}</p> : <>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1A73E8] border-t-transparent shadow-md"></div>
            <p className="text-xs font-semibold text-[#64748B] animate-pulse">Đang tải dữ liệu vận hành...</p>
          </>}
          {loadError && <button type="button" onClick={() => loadData(true)} className="rounded-xl bg-[#1A73E8] px-4 py-2 text-xs font-bold text-white">Thử lại</button>}
        </div>
      </div>
    );
  }

  const role = (user?.roleCode || user?.roleName || user?.role || '').toUpperCase();
  const isSysAdmin = role === 'ADMIN' || (user?.permissions || []).includes('ADMIN_FULL');
  const isSystemOp = (user?.permissions || []).some(p => ['LOGIN_LOG_READ', 'SYSTEM_REQUEST_READ', 'DATABASE_BACKUP_READ'].includes(p));
  const showSystemPanel = isSysAdmin || isSystemOp;

  return (
    <div className="flex-1 overflow-auto p-2 sm:p-6 md:p-6 scrollbar-hover">
      <div className="max-w-screen-2xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Header section with Semester Selector */}
        <DashboardHeader 
          userName={user?.user_name || user?.username || 'Người dùng'}
          roleName={user?.roleName || user?.role || 'Khách'}
          roleScope={metrics.roleScope}
          activeSemester={metrics.activeSemester}
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

        <div ref={deferredPanelsSentinelRef} aria-hidden="true" className="h-1" />
        {shouldLoadDeferredPanels ? (
          <DashboardDeferredPanels
            metrics={metrics}
            showSystemPanel={showSystemPanel}
            systemRequests={systemRequests}
            backups={backups}
          />
        ) : (
          <DeferredPanelsPlaceholder />
        )}

      </div>
    </div>
  );
}
