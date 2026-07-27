import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import StudentRecordPage from './page';
import { academicRecordApi } from '@/api/academic-record-api';
import { classApi } from '@/api/class-api';
import { criteriaApi } from '@/api/criteria-api';
import { dailyClassReportApi } from '@/api/daily-class-report-api';

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
    user: { id: 'user1', role: 'teacher' },
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
    configRecord: true
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
    expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));

    // Resolve first fetch with 20 items
    await act(async () => {
      resolveFirstFetch({
        data: Array.from({ length: 20 }).map((_, i) => ({
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
        data: Array.from({ length: 20 }).map((_, i) => ({
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
});
