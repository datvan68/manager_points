import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dashboardMocks = vi.hoisted(() => ({
  user: { id: 'dashboard-user', role: 'Teacher', roleName: 'Teacher', permissions: [] },
  identity: 'dashboard-identity-1',
  getMetrics: vi.fn(),
}));

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: dashboardMocks.user }) }));
vi.mock('@/api/auth-api', () => ({ tokenStorage: { getAuthIdentity: () => dashboardMocks.identity } }));
vi.mock('@/api/system-api', () => ({ systemApi: { getDashboardMetrics: dashboardMocks.getMetrics } }));
vi.mock('@/components/dashboard/DashboardHeader', () => ({ default: () => <div data-testid="dashboard-header" /> }));
vi.mock('@/components/dashboard/KpiGrid', () => ({ default: () => <div data-testid="dashboard-content">Dashboard content</div> }));
vi.mock('@/components/dashboard/StudentSpotlightPanel', () => ({ default: () => null }));

import DashboardPage from './page';

const source = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');

describe('Dashboard loading contract', () => {
  beforeEach(() => {
    dashboardMocks.user = { id: 'dashboard-user', role: 'Teacher', roleName: 'Teacher', permissions: [] };
    dashboardMocks.identity = `dashboard-identity-${Math.random()}`;
    dashboardMocks.getMetrics.mockReset();
  });

  it('keeps a stable loading layout and reuses the same identity snapshot on remount', async () => {
    let resolveFirst!: (value: any) => void;
    dashboardMocks.getMetrics.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
    const view = render(<DashboardPage />);

    expect(screen.getByLabelText('Đang tải dữ liệu vận hành')).toBeDefined();
    expect(screen.queryByText('Đang tải dữ liệu vận hành...')).toBeNull();

    await act(async () => resolveFirst({ semesters: [], kpis: {}, systemData: {} }));
    await waitFor(() => expect(screen.getByTestId('dashboard-content')).toBeDefined());
    view.unmount();

    let resolveRefresh!: (value: any) => void;
    dashboardMocks.getMetrics.mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = resolve; }));
    render(<DashboardPage />);
    expect(screen.getByTestId('dashboard-content')).toBeDefined();
    expect(screen.queryByLabelText('Đang tải dữ liệu vận hành')).toBeNull();
    await act(async () => resolveRefresh({ semesters: [], kpis: {}, systemData: {} }));
  });

  it('retains the prior snapshot when a background refresh fails', async () => {
    dashboardMocks.getMetrics.mockResolvedValueOnce({ semesters: [], kpis: {}, systemData: {} });
    const view = render(<DashboardPage />);
    await waitFor(() => expect(screen.getByTestId('dashboard-content')).toBeDefined());
    view.unmount();

    dashboardMocks.getMetrics.mockRejectedValueOnce(new Error('offline'));
    render(<DashboardPage />);
    expect(screen.getByTestId('dashboard-content')).toBeDefined();
    await waitFor(() => expect(dashboardMocks.getMetrics).toHaveBeenCalled());
    expect(screen.getByTestId('dashboard-content')).toBeDefined();
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải dữ liệu vận hành');
  });

  it('does not render the previous identity snapshot after an auth identity change', async () => {
    dashboardMocks.getMetrics.mockResolvedValueOnce({ semesters: [], kpis: {}, systemData: {} });
    const view = render(<DashboardPage />);
    await waitFor(() => expect(screen.getByTestId('dashboard-content')).toBeDefined());

    dashboardMocks.user = { id: 'other-user', role: 'Teacher', roleName: 'Teacher', permissions: [] };
    dashboardMocks.identity = `other-identity-${Math.random()}`;
    let resolveOther!: (value: any) => void;
    dashboardMocks.getMetrics.mockReturnValueOnce(new Promise((resolve) => { resolveOther = resolve; }));
    view.rerender(<DashboardPage />);

    expect(screen.getByLabelText('Đang tải dữ liệu vận hành')).toBeDefined();
    expect(screen.queryByTestId('dashboard-content')).toBeNull();
    await act(async () => resolveOther({ semesters: [], kpis: {}, systemData: {} }));
    await waitFor(() => expect(screen.getByTestId('dashboard-content')).toBeDefined());
  });

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
    expect(deferredSource).toContain('<ClassRecordPanel');
    expect(deferredSource).toContain('selectedSemesterId');
    expect(deferredSource).toContain('<ScoreDistributionChart');
    expect(deferredSource).toContain('<AcademicOverviewPanel');
    expect(deferredSource).toContain('<TaskPanel');
    expect(deferredSource).toContain('<SystemOperationsPanel');
    expect(deferredSource).toContain("metrics.roleScope !== 'system'");
    expect(deferredSource).toContain("metrics.roleScope === 'system'");
  });

  it('uses paged virtualized leaderboards with a bounded scroll viewport', () => {
    const spotlightSource = readFileSync(resolve(__dirname, '../../components/dashboard/StudentSpotlightPanel.tsx'), 'utf8');
    expect(spotlightSource).toContain('@tanstack/react-virtual');
    expect(spotlightSource).toContain('useVirtualizer');
    expect(spotlightSource).toContain('max-h-[360px]');
    expect(spotlightSource).toContain('hasMore');
    expect(spotlightSource).not.toContain('list.slice(0, 10)');
    expect(spotlightSource).not.toContain('max-h-[620px] sm:max-h-[760px]');
  });

  it('removes the evaluation-period badge and prefers option labels in recent records', () => {
    const headerSource = readFileSync(resolve(__dirname, '../../components/dashboard/DashboardHeader.tsx'), 'utf8');
    const recordsSource = readFileSync(resolve(__dirname, '../../components/dashboard/AttendanceRecordPanel.tsx'), 'utf8');
    expect(headerSource).not.toContain('Đợt:');
    expect(recordsSource).toContain('selected_option_label');
    expect(recordsSource).toContain('criterion_id?.criterion_name');
  });
});
