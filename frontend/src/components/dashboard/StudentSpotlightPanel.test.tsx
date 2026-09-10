import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentSpotlightPanel from './StudentSpotlightPanel';
import { systemApi } from '@/api/system-api';
import type { DashboardMetrics, StudentHighlightItem } from './dashboard-helpers';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (() => {
    const rowsByCount = new Map<number, Array<{ index: number; start: number }>>();
    return ({ count }: { count: number }) => {
      if (!rowsByCount.has(count)) rowsByCount.set(count, Array.from({ length: count }, (_, index) => ({ index, start: index * 78 })));
      return { getVirtualItems: () => rowsByCount.get(count)!, getTotalSize: () => count * 78, measureElement: () => undefined };
    };
  })(),
}));
vi.mock('lucide-react', () => {
  const Icon = () => null;
  return { Award: Icon, PlusCircle: Icon, AlertTriangle: Icon, GraduationCap: Icon, ArrowUpRight: Icon, Sparkles: Icon, ArrowRight: Icon, TrendingUp: Icon, Activity: Icon, CheckCircle2: Icon, AlertCircle: Icon };
});
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <>{children}</>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/api/system-api', () => ({ systemApi: { getStudentHighlights: vi.fn() } }));

const highlight = (followUpStatus: StudentHighlightItem['followUpStatus']): StudentHighlightItem => ({
  studentId: 'student-1', studentName: 'Nguyễn Văn A', studentCode: 'SV001', className: 'Lớp A',
  recordCount: 3, impactScore: -3, followUpStatus, type: 'ky_luat',
});

const metrics = (): DashboardMetrics => ({
  roleScope: 'admin', highlightMode: 'staff', canReadStudentHighlights: true,
  activeSemester: { _id: 'semester-1' } as DashboardMetrics['activeSemester'], activePeriod: null,
  kpis: {} as DashboardMetrics['kpis'], studentHighlights: {} as DashboardMetrics['studentHighlights'],
});

describe('Student spotlight discipline status', () => {
  beforeEach(() => {
    vi.mocked(systemApi.getStudentHighlights).mockImplementation(async ({ category }) => ({
      items: category === 'discipline' ? [highlight(category === 'discipline' ? currentStatus : undefined)] : [],
      total: category === 'discipline' ? 1 : 0, page: 1, limit: 20, hasMore: false, semesterId: 'semester-1',
    }));
  });

  let currentStatus: StudentHighlightItem['followUpStatus'] = 'unhandled';

  it('omits Ghi nhận mới for an unhandled student', async () => {
    currentStatus = 'unhandled';
    render(<StudentSpotlightPanel metrics={metrics()} />);
    await waitFor(() => expect(screen.getAllByText('Nguyễn Văn A').length).toBeGreaterThan(0));
    expect(screen.queryByText('Ghi nhận mới')).not.toBeInTheDocument();
  });

  it('displays Ghi nhận mới for a handled student with a positive delta', async () => {
    currentStatus = 'new';
    render(<StudentSpotlightPanel metrics={metrics()} />);
    expect((await screen.findAllByText('Ghi nhận mới')).length).toBeGreaterThan(0);
  });
});
