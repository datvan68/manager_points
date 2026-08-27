'use client';

import AcademicOverviewPanel from '@/components/dashboard/AcademicOverviewPanel';
import AttendanceRecordPanel from '@/components/dashboard/AttendanceRecordPanel';
import EvaluationProgressPanel from '@/components/dashboard/EvaluationProgressPanel';
import QuickActionsPanel from '@/components/dashboard/QuickActionsPanel';
import ScoreDistributionChart from '@/components/dashboard/ScoreDistributionChart';
import SystemOperationsPanel from '@/components/dashboard/SystemOperationsPanel';
import TaskPanel from '@/components/dashboard/TaskPanel';
import type { DashboardMetrics } from '@/components/dashboard/dashboard-helpers';

interface DashboardDeferredPanelsProps {
  metrics: DashboardMetrics;
  showSystemPanel: boolean;
  systemRequests: any[];
  backups: any[];
}

export default function DashboardDeferredPanels({
  metrics,
  showSystemPanel,
  systemRequests,
  backups,
}: DashboardDeferredPanelsProps) {
  return (
    <>
      <QuickActionsPanel roleScope={metrics.roleScope} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {metrics.roleScope !== 'system' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AttendanceRecordPanel metrics={metrics} />
              <EvaluationProgressPanel metrics={metrics} />
            </div>
          )}

          {metrics.roleScope !== 'system' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ScoreDistributionChart distribution={metrics.distributions.scoreDistribution} />
              <AcademicOverviewPanel metrics={metrics} />
            </div>
          )}

          {metrics.roleScope === 'system' && <TaskPanel metrics={metrics} />}
        </div>

        <div className="space-y-6">
          {metrics.roleScope !== 'system' && <TaskPanel metrics={metrics} />}
        </div>
      </div>

      {showSystemPanel && (
        <SystemOperationsPanel
          metrics={metrics}
          systemRequests={systemRequests}
          backups={backups}
        />
      )}
    </>
  );
}
