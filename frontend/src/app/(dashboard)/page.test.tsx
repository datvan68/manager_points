import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');

describe('Dashboard loading contract', () => {
  it('coalesces concurrent requests for the same semester', () => {
    expect(source).toContain('loadsInFlightRef');
    expect(source).toContain('loadsInFlightRef.current.get(loadKey)');
    expect(source).toContain('loadsInFlightRef.current.set(loadKey, load)');
  });

  it('retains the requested semester in the dashboard API call', () => {
    expect(source).toContain('systemApi.getDashboardMetrics(semIdToLoad || undefined)');
  });

  it('keeps the initial dashboard content and defers lower panels', () => {
    expect(source).toContain("import StudentSpotlightPanel from '@/components/dashboard/StudentSpotlightPanel'");
    expect(source).toContain("import('@/components/dashboard/DashboardDeferredPanels')");
    expect(source).toContain('rootMargin: \'640px 0px\'');
    expect(source).toContain('typeof IntersectionObserver === \'undefined\'');
    expect(source).toContain('shouldLoadDeferredPanels');
    expect(source).not.toContain("import QuickActionsPanel from '@/components/dashboard/QuickActionsPanel'");
    expect(source).not.toContain("import EvaluationProgressPanel from '@/components/dashboard/EvaluationProgressPanel'");
  });

  it('preserves the deferred role predicates and panel order', () => {
    const deferredSource = readFileSync(resolve(__dirname, '../../components/dashboard/DashboardDeferredPanels.tsx'), 'utf8');
    expect(deferredSource).toContain('<QuickActionsPanel');
    expect(deferredSource).toContain('<AttendanceRecordPanel');
    expect(deferredSource).toContain('<EvaluationProgressPanel');
    expect(deferredSource).toContain('<ScoreDistributionChart');
    expect(deferredSource).toContain('<AcademicOverviewPanel');
    expect(deferredSource).toContain('<TaskPanel');
    expect(deferredSource).toContain('<SystemOperationsPanel');
    expect(deferredSource).toContain("metrics.roleScope !== 'system'");
    expect(deferredSource).toContain("metrics.roleScope === 'system'");
  });

  it('limits every leaderboard tab to ten rows and supports the larger viewport', () => {
    const spotlightSource = readFileSync(resolve(__dirname, '../../components/dashboard/StudentSpotlightPanel.tsx'), 'utf8');
    expect(spotlightSource).toContain('list.slice(0, 10)');
    expect(spotlightSource).toContain('max-h-[620px] sm:max-h-[760px]');
    expect(spotlightSource).toContain("contentVisibility: 'auto'");
    expect(spotlightSource).not.toContain('list.slice(0, 5)');
    expect(spotlightSource).not.toContain('max-h-[360px]');
  });
});
