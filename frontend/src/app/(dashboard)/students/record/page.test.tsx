import { render, screen, waitFor, act, cleanup, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import StudentRecordPage from './page';
import { academicRecordApi } from '@/api/academic-record-api';
import { classApi } from '@/api/class-api';
import { criteriaApi } from '@/api/criteria-api';
import { dailyClassReportApi } from '@/api/daily-class-report-api';

let mockRecordPermissions: Record<string, boolean> = {};

// --- MOCKS ---



// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, prop) => (props: any) => {
      const Tag = typeof prop === 'string' ? prop : 'div';
      return <Tag {...props} />;
    }
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
  useSearchParams: vi.fn(() => ({
    get: vi.fn(),
  })),
}));

vi.mock('@/api/academic-record-api', () => ({
  academicRecordApi: {
    getAcademicRecords: vi.fn(),
    getAcademicRecordsByStudent: vi.fn().mockResolvedValue([]),
    deleteAcademicRecord: vi.fn(),
  }
}));

vi.mock('@/api/class-api', () => ({
  classApi: {
    getClasses: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('@/api/criteria-api', () => ({
  criteriaApi: {
    getCriteria: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('@/api/criteria-api', () => ({
  criteriaApi: {
    getCriteria: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('@/api/daily-class-report-api', () => ({
  dailyClassReportApi: {
    getDailyClassReports: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
  }
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user1', role: 'teacher', permissions: [] },
  })),
}));

vi.mock('@/hooks/useGradingRealtime', () => ({
  useGradingRealtime: vi.fn(() => ({ status: 'connected' }))
}));

vi.mock('@/components/guards/RouteGuard', () => ({
  RouteGuard: ({ children }: any) => <>{children}</>,
  usePermission: vi.fn(() => ({
    viewStudentRecord: true,
    createStudentRecord: true,
    editStudentRecord: true,
    deleteStudentRecord: true,
    viewClassRecord: true,
    createClassRecord: true,
    editClassRecord: true,
    deleteClassRecord: true,
    configRecord: true,
    ...mockRecordPermissions,
  })),
}));

vi.mock('@/components/layout/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }));
vi.mock('@/components/layout/Header', () => ({ default: () => <div data-testid="header" /> }));

let mockIntersectionObserverCallback: IntersectionObserverCallback;

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    mockIntersectionObserverCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.IntersectionObserver = MockIntersectionObserver as any;

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('StudentRecordPage Infinite Scroll', () => {
  let resolveFirstFetch: any;
  let resolveSecondFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    (classApi.getClasses as any).mockResolvedValue([]);
    (criteriaApi.getCriteria as any).mockResolvedValue([]);
    resolveFirstFetch = null;
    resolveSecondFetch = null;
    mockRecordPermissions = {};
  });
  
  afterEach(() => {
    if (resolveFirstFetch) resolveFirstFetch({ data: [], meta: { total: 0 } });
    if (resolveSecondFetch) resolveSecondFetch({ data: [], meta: { total: 0 } });
    cleanup();
    vi.clearAllMocks();
  });

  it('should handle pagination correctly and prevent duplicate fetches during scroll', async () => {
    const firstFetchPromise = new Promise(resolve => { resolveFirstFetch = resolve; });
    const secondFetchPromise = new Promise(resolve => { resolveSecondFetch = resolve; });

    (academicRecordApi.getAcademicRecords as any)
      .mockReturnValueOnce(firstFetchPromise)
      .mockReturnValueOnce(secondFetchPromise)
      .mockResolvedValue({ data: [], meta: { total: 40 } });

    render(<StudentRecordPage />);

    // Wait for the first fetch to be initiated
    await waitFor(() => {
      expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledTimes(1);
    });
    expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 40 }));

    // Resolve first fetch with 40 items
    await act(async () => {
      resolveFirstFetch({
        data: Array.from({ length: 40 }).map((_, i) => ({
          _id: `id-1-${i}`,
          points_effect: 10,
          record_title: `Record 1-${i}`,
        })),
        meta: { total: 40 } // total 40 means hasMoreRecords = true
      });
    });

    // Simulate scroll to trigger IntersectionObserver
    await act(async () => {
      mockIntersectionObserverCallback([{ isIntersecting: true }] as any, null as any);
    });

    // Verify second fetch is initiated
    expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledTimes(2);
    expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));

    // Trigger IntersectionObserver AGAIN before second fetch resolves
    await act(async () => {
      mockIntersectionObserverCallback([{ isIntersecting: true }] as any, null as any);
    });

    // Should NOT call the API again, because isFetchingRef is true
    expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledTimes(2);

    // Resolve second fetch
    await act(async () => {
      resolveSecondFetch({
        data: Array.from({ length: 40 }).map((_, i) => ({
          _id: `id-2-${i}`,
          points_effect: 10,
          record_title: `Record 2-${i}`,
        })),
        meta: { total: 40 }
      });
    });

    // After resolving, hasMoreRecords should be false (40 items total fetched)
    // Trigger IntersectionObserver one more time
    await act(async () => {
      mockIntersectionObserverCallback([{ isIntersecting: true }] as any, null as any);
    });

    expect(academicRecordApi.getAcademicRecords).toHaveBeenCalled();
  });

  it('uses 40 rows for the class situation tab and avoids row scaling', async () => {
    (dailyClassReportApi.getDailyClassReports as any).mockResolvedValue({
      data: [{
        _id: 'report-1',
        class_id: { class_name: 'CS-101-A' },
        report_date: '2026-08-24',
        total_present: 10,
        total_absent: 0,
        recordedStudentsCount: 0,
        teacher_name: 'Teacher',
      }],
      meta: { total: 1 },
    });

    render(<StudentRecordPage />);
    fireEvent.click(screen.getByText('Tình hình lớp học'));

    await waitFor(() => {
      expect(dailyClassReportApi.getDailyClassReports).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 40 }),
      );
    });

    const classRow = screen
      .getAllByText('CS-101-A')
      .map((element) => element.closest('tr'))
      .find((row) => row !== null);
    expect(classRow).not.toHaveClass('hover:scale-[1.002]');
  });

  it('renders a saved class note in the class report card', async () => {
    (dailyClassReportApi.getDailyClassReports as any).mockResolvedValue({
      data: [{
        _id: 'report-note', class_id: { class_name: 'CS-101-A' }, report_date: '2026-08-24',
        total_present: 10, total_absent: 0, recordedStudentsCount: 0,
        teacher_name: 'Teacher', class_note: 'Ghi chú đã lưu',
      }],
      meta: { total: 1 },
    });

    render(<StudentRecordPage />);
    fireEvent.click(screen.getByText('Tình hình lớp học'));

    expect(await screen.findAllByText('Ghi chú đã lưu')).not.toHaveLength(0);
  });

  it('does not request class resources when READ_CLASS_RECORD is absent', async () => {
    mockRecordPermissions = { viewClassRecord: false };

    render(<StudentRecordPage />);

    await waitFor(() => {
      expect(academicRecordApi.getAcademicRecords).toHaveBeenCalled();
    });
    expect(dailyClassReportApi.getDailyClassReports).not.toHaveBeenCalled();
    expect(classApi.getClasses).not.toHaveBeenCalled();
  });

  it('does not render the purge utility in the configuration modal', async () => {
    render(<StudentRecordPage />);
    fireEvent.click(screen.getByTitle('Cấu hình tiêu chí vắng mặt'));

    expect(await screen.findByText('Cấu hình & Tiện ích hệ thống')).toBeInTheDocument();
    expect(screen.queryByText('Dọn ghi nhận HSSV')).not.toBeInTheDocument();
    expect(screen.queryByText('Xem trước')).not.toBeInTheDocument();
    expect(screen.queryByText('Xác nhận dọn')).not.toBeInTheDocument();
  });

  it('offers 500 rows for student pagination and refetches page one', async () => {
    (academicRecordApi.getAcademicRecords as any).mockResolvedValue({
      data: [],
      meta: { total: 501 },
    });

    render(<StudentRecordPage />);

    await waitFor(() => {
      expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 40 }),
      );
    });

    fireEvent.click(screen.getAllByRole('combobox').at(-1)!);
    expect(await screen.findByRole('option', { name: '500' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '1000' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: '500' }));

    await waitFor(() => {
      expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 500 }),
      );
    });
  });
});
