import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: 'admin1',
      role: 'admin',
    },
    isLoading: false,
  }),
}));

vi.mock('@/components/guards/RouteGuard', () => ({
  RouteGuard: ({ children }: any) => <div>{children}</div>,
  usePermission: () => ({
    canManageSemester: true,
  }),
}));

vi.mock('@/api/auth-api', () => ({
  tokenStorage: {
    getAccessToken: () => 'mock-token',
    getUser: () => ({ id: 'admin1', role: 'admin' }),
  },
}));

vi.mock('@/api/department-api', () => ({
  departmentApi: {
    getDepartments: vi.fn().mockResolvedValue([
      { _id: 'dept1', name: 'CNTT' },
    ]),
  },
}));

vi.mock('@/api/class-api', () => ({
  classApi: {
    getClasses: vi.fn().mockResolvedValue([
      { _id: 'class1', class_name: 'DTH19', dept_id: 'dept1' },
    ]),
  },
}));

vi.mock('@/api/semester-api', () => ({
  semesterApi: {
    getSemesters: vi.fn().mockResolvedValue([
      { _id: 'sem1', semester_name: 'HK1 2024-2025', status: 'active' },
    ]),
  },
}));

vi.mock('@/api/summaries-point-api', () => ({
  summariesPointApi: {
    getSummariesPoints: vi.fn(),
    getClassApprovalStatus: vi.fn(),
    exportSummaryExcel: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock('@/components/ui/pagination', () => ({
  CustomPagination: ({ currentPage, pageSize, totalItems, onPageChange, onPageSizeChange, pageSizeOptions }: any) => (
    <div data-testid="custom-pagination">
      <span data-testid="current-page">{currentPage}</span>
      <span data-testid="page-size">{pageSize}</span>
      <span data-testid="page-size-options">{pageSizeOptions?.join(',')}</span>
      <button data-testid="btn-change-page-size" onClick={() => onPageSizeChange(40)}>
        Set 40
      </button>
    </div>
  ),
}));

import ProtectedGradingPage from './page';
import { summariesPointApi } from '@/api/summaries-point-api';

describe('GradingPage - Pagination & Export Scope Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (summariesPointApi.getSummariesPoints as any).mockResolvedValue({
      data: [
        {
          _id: 'sum1',
          student_id: { _id: 'std1', student_code: 'SV001', full_name: 'Nguyen Van A' },
          total_score: 85,
          grading: 'Tốt',
          status: 'locked',
        },
      ],
      meta: { total: 1, page: 1, limit: 40, totalPages: 1 },
    });
    (summariesPointApi.getClassApprovalStatus as any).mockResolvedValue({});
    (summariesPointApi.exportSummaryExcel as any).mockResolvedValue(new Blob(['mock']));

    if (typeof window !== 'undefined') {
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock');
      window.URL.revokeObjectURL = vi.fn();
    }

    sessionStorage.clear();
    sessionStorage.setItem('grading_selectedDept', 'dept1');
    sessionStorage.setItem('grading_selectedClass', 'class1');
    sessionStorage.setItem('grading_selectedSem', 'sem1');
    sessionStorage.setItem('grading_appliedDept', 'dept1');
    sessionStorage.setItem('grading_appliedClass', 'class1');
    sessionStorage.setItem('grading_appliedSem', 'sem1');
  });

  it('renders page and sets default pageSize to 40 with 40 in options', async () => {
    render(<ProtectedGradingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('custom-pagination')).toBeInTheDocument();
    });

    expect(screen.getByTestId('page-size').textContent).toBe('40');
    expect(screen.getByTestId('page-size-options').textContent).toContain('40');
  });

  it('resets currentPage to 1 when page size changes', async () => {
    render(<ProtectedGradingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('custom-pagination')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-change-page-size'));

    expect(screen.getByTestId('current-page').textContent).toBe('1');
    expect(screen.getByTestId('page-size').textContent).toBe('40');
  });

  it('opens export modal when Admin clicks Xuất Excel', async () => {
    render(<ProtectedGradingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('custom-pagination')).toBeInTheDocument();
    });

    const exportBtn = screen.getByTitle('Xuất Excel theo phạm vi và học kỳ đã xác nhận');
    fireEvent.click(exportBtn);

    expect(screen.getByText('Phạm vi xuất file Excel')).toBeInTheDocument();
    expect(screen.getByText('Xác nhận xuất')).toBeInTheDocument();

    const confirmBtn = screen.getByText('Xác nhận xuất');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(summariesPointApi.exportSummaryExcel).toHaveBeenCalledWith({
        semesterId: 'sem1',
        classId: 'class1',
        scope: 'class',
        mode: 'all_filtered',
      });
    });
  });
});
