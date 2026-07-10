import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// 1. Mock navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// 2. Mock Auth Provider
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: 'user1',
      studentId: 'student1',
      roleCode: 'STUDENT',
      role: 'student',
    },
    isLoading: false,
  }),
}));

// 3. Mock Activity API
vi.mock('@/api/activity-api', () => ({
  activityApi: {
    getMyActivities: vi.fn(),
    getAll: vi.fn(),
  },
  activityScheduleApi: {
    getMySchedules: vi.fn(),
  },
  activityAttendanceApi: {
    getMyAttendance: vi.fn(),
  },
  activityCompletionRuleApi: {
    getAll: vi.fn(),
  },
}));

// 4. Mock Semesters API
vi.mock('@/api/semester-api', () => ({
  semesterApi: {
    getSemesters: vi.fn(),
  },
}));

// 5. Mock Academic Records API
vi.mock('@/api/academic-record-api', () => ({
  academicRecordApi: {
    getAcademicRecords: vi.fn(),
  },
}));

// 6. Mock Sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// 7. Import after mocks
import { activityApi, activityScheduleApi, activityAttendanceApi, activityCompletionRuleApi } from '@/api/activity-api';
import { semesterApi } from '@/api/semester-api';
import { academicRecordApi } from '@/api/academic-record-api';
import MyActivitiesPage from './page';

describe('MyActivitiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render student dashboard with title and semester selector', async () => {
    vi.mocked(semesterApi.getSemesters).mockResolvedValue([
      { _id: 'sem1', semester_name: 'Học kỳ 1', status: 'active', start_date: '2025-09-01', end_date: '2026-01-15' },
    ]);
    vi.mocked(activityApi.getMyActivities).mockResolvedValue([]);
    vi.mocked(activityApi.getAll).mockResolvedValue([]);
    vi.mocked(activityAttendanceApi.getMyAttendance).mockResolvedValue([]);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);
    vi.mocked(academicRecordApi.getAcademicRecords).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getMySchedules).mockResolvedValue([]);

    render(<MyActivitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('Hoạt động của tôi')).toBeInTheDocument();
      expect(screen.getByText('Học kỳ:')).toBeInTheDocument();
    });
  });
});
