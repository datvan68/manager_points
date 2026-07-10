import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: 'user1',
      studentId: 'student1',
      role: { role_code: 'TEACHER' },
    },
    isLoading: false,
  }),
  isAdminUser: () => true,
}));

vi.mock('@/api/auth-api', () => ({
  authApi: {
    getUsers: vi.fn().mockResolvedValue([]),
  },
  tokenStorage: {
    getAccessToken: () => 'mock-token',
  },
}));

vi.mock('@/api/activity-api', () => ({
  activityApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/api/semester-api', () => ({
  semesterApi: {
    getSemesters: vi.fn(),
  },
}));

vi.mock('@/api/criteria-api', () => ({
  criteriaApi: {
    getCriteria: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
import ActivitiesPage from './page';
import { activityApi } from '@/api/activity-api';
import { semesterApi } from '@/api/semester-api';

describe('ActivitiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page with mock activities list', async () => {
    const mockActivities = [
      {
        _id: 'act1',
        name: 'IT Club Activity',
        code: 'IT_CLUB',
        activity_type: 'club',
        participation_status: 'published',
        classroom: 'A.101',
        advisor_id: { full_name: 'Advisor Name' },
        createdAt: '2026-07-10T00:00:00Z',
        updatedAt: '2026-07-10T00:00:00Z',
      },
    ];

    const mockSemesters = [
      { _id: 'sem1', semester_name: 'Học kỳ 1 2025-2026', start_date: '2025-09-01', end_date: '2026-01-15', status: 'active' },
    ];

    vi.mocked(activityApi.getAll).mockResolvedValue(mockActivities as any);
    vi.mocked(semesterApi.getSemesters).mockResolvedValue(mockSemesters as any);

    render(<ActivitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('Quản lý Hoạt động')).toBeInTheDocument();
      expect(screen.getByText('IT Club Activity')).toBeInTheDocument();
    });
  });
});
