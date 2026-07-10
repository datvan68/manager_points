import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// 1. Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useParams: () => ({
    activityId: 'act1',
  }),
}));

// 2. Mock Auth Provider
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

// 3. Mock Auth API
vi.mock('@/api/auth-api', () => ({
  authApi: {
    getUsers: vi.fn().mockResolvedValue([]),
  },
  tokenStorage: {
    getAccessToken: () => 'mock-token',
  },
}));

// 4. Mock Activity API
vi.mock('@/api/activity-api', () => ({
  activityApi: {
    getById: vi.fn(),
    getMembers: vi.fn(),
    joinActivity: vi.fn(),
    approveMember: vi.fn(),
    updateMember: vi.fn(),
    removeMember: vi.fn(),
  },
  activityScheduleApi: {
    getActivityTimeline: vi.fn(),
    register: vi.fn(),
    cancelRegistration: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  activityCompletionRuleApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

// 5. Mock Criteria API
vi.mock('@/api/criteria-api', () => ({
  criteriaApi: {
    getCriteria: vi.fn().mockResolvedValue([]),
  },
}));

// 6. Mock Sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// 7. Import after mocks
import { activityApi, activityScheduleApi, activityCompletionRuleApi } from '@/api/activity-api';
import ActivityDetailPage from './page';

describe('ActivityDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page with mock activity detail', async () => {
    const mockActivity = {
      _id: 'act1',
      name: 'Dynamic Event Activity',
      code: 'DYNAMIC_EVENT',
      activity_type: 'event',
      participation_status: 'published',
      classroom: 'B.202',
      advisor_id: { full_name: 'Jane Doe' },
      semester_id: { _id: 'sem1', semester_name: 'Học kỳ 1' },
      createdAt: '2026-07-10T00:00:00Z',
      updatedAt: '2026-07-10T00:00:00Z',
    };

    vi.mocked(activityApi.getById).mockResolvedValue(mockActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue({ items: [] } as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);

    render(<ActivityDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Dynamic Event Activity')).toBeInTheDocument();
      expect(screen.getByText('Thông tin chung')).toBeInTheDocument();
      expect(screen.getByText('Thành viên (0)')).toBeInTheDocument();
    });
  });
});
