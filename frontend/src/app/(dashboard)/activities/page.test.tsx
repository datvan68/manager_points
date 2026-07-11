import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock('@/components/activities/ActivityForm', () => ({
  default: ({ onSubmit }: any) => (
    <div data-testid="mock-activity-form">
      <button onClick={() => onSubmit({ _id: 'new-created-act-id', name: 'New Activity' })}>Submit Form</button>
    </div>
  ),
}));

vi.mock('@/components/activities/ActivityCardDesignModal', () => ({
  default: ({ open, onSave }: any) => open ? (
    <div data-testid="mock-design-modal">
      <button onClick={() => onSave({ preset: 'academic' })}>Lưu thiết kế</button>
    </div>
  ) : null,
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
    getUser: () => ({ id: 'user-1', role: 'teacher' }),
  },
}));

vi.mock('@/api/activity-api', () => ({
  activityApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    favoriteActivity: vi.fn(),
    unfavoriteActivity: vi.fn(),
    joinActivity: vi.fn(),
  },
  activityScheduleApi: {
    getAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    create: vi.fn(),
    delete: vi.fn(),
    cancelRecurrence: vi.fn(),
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
      expect(screen.getByText('IT Club Activity')).toBeInTheDocument();
    });
  });

  it('navigates to schedule route with openCreate=1 on successful create', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([]);
    vi.mocked(activityApi.create).mockResolvedValue({ _id: 'created-id-xyz', name: 'New Activity' } as any);

    render(<ActivitiesPage />);

    // Click trigger button to open dialog
    const createBtn = screen.getByText('Tạo Hoạt động Mới');
    fireEvent.click(createBtn);

    // Assert Form is rendered in dialog
    await waitFor(() => {
      expect(screen.getByText('Submit Form')).toBeInTheDocument();
    });

    // Trigger form submit
    fireEvent.click(screen.getByText('Submit Form'));

    // Assert navigation is triggered
    await waitFor(() => {
      expect(activityApi.create).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/activities/schedule?activityId=created-id-xyz&openCreate=1');
    });
  });

  it('navigates to schedule page when calendar header button is clicked', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([]);
    render(<ActivitiesPage />);

    const calBtn = screen.getByTestId('calendar-header-button');
    fireEvent.click(calBtn);

    expect(mockPush).toHaveBeenCalledWith('/activities/schedule');
  });

  it('handles design configure button click, opens modal, and reloads on successful save', async () => {
    const mockActivities = [
      {
        _id: 'act1',
        name: 'IT Club Activity',
        code: 'IT_CLUB',
        activity_type: 'club',
        participation_status: 'published',
        classroom: 'A.101',
        background_config: { preset: 'sport' }
      },
    ];

    vi.mocked(activityApi.getAll).mockResolvedValue(mockActivities as any);
    vi.mocked(activityApi.update).mockResolvedValue({} as any);

    render(<ActivitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('IT Club Activity')).toBeInTheDocument();
    });

    // open design modal
    const designBtn = screen.getByTestId('configure-design-button');
    fireEvent.click(designBtn);

    // Bấm Save trong mock modal
    const saveBtn = screen.getByText('Lưu thiết kế');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(activityApi.update).toHaveBeenCalledWith('act1', expect.objectContaining({
        background_config: expect.any(Object)
      }));
      expect(activityApi.getAll).toHaveBeenCalledTimes(2); // Initial and reload
    });
  });

  it('handles quick status change actions via single status callbacks', async () => {
    const mockActivities = [
      {
        _id: 'act1',
        name: 'IT Club Activity',
        code: 'IT_CLUB',
        activity_type: 'club',
        participation_status: 'published',
        classroom: 'A.101',
      },
    ];
    vi.mocked(activityApi.getAll).mockResolvedValue(mockActivities as any);
    vi.mocked(activityApi.update).mockResolvedValue({} as any);

    render(<ActivitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('IT Club Activity')).toBeInTheDocument();
    });

    // Switch to table view
    const listBtn = Array.from(screen.getAllByRole('button')).find(btn => btn.querySelector('svg.lucide-list'));
    fireEvent.click(listBtn!);

    // Bấm Đưa về nháp
    const draftBtn = screen.getByTitle('Đưa về nháp');
    fireEvent.click(draftBtn);

    await waitFor(() => {
      expect(activityApi.update).toHaveBeenCalledWith('act1', { participation_status: 'draft' });
    });

    // Bấm Công khai đăng ký
    const publishBtn = screen.getByTitle('Công khai đăng ký');
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(activityApi.update).toHaveBeenCalledWith('act1', { participation_status: 'published' });
    });

    // Bấm Hủy hoạt động
    const cancelBtn = screen.getByTitle('Hủy hoạt động');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(activityApi.update).toHaveBeenCalledWith('act1', { participation_status: 'cancelled' });
    });
  });

  it('handles bulk deactivate confirmation flow and calls activityApi.update for all selected IDs', async () => {
    const mockActivities = [
      { _id: 'act1', name: 'IT Club Activity', code: 'IT_CLUB', activity_type: 'club', participation_status: 'published' },
      { _id: 'act2', name: 'Sports Club', code: 'SP_CLUB', activity_type: 'event', participation_status: 'published' },
    ];
    vi.mocked(activityApi.getAll).mockResolvedValue(mockActivities as any);
    vi.mocked(activityApi.update).mockResolvedValue({} as any);

    render(<ActivitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('IT Club Activity')).toBeInTheDocument();
    });

    // Switch to table view
    const listBtn = Array.from(screen.getAllByRole('button')).find(btn => btn.querySelector('svg.lucide-list'));
    fireEvent.click(listBtn!);

    // Tick the select-all checkbox (the first checkbox)
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // select all

    // The bulk action toolbar should appear with "Vô hiệu hóa" and "Xóa" buttons.
    const deactivateBtn = screen.getByRole('button', { name: 'Vô hiệu hóa' });
    expect(deactivateBtn).toBeInTheDocument();
    fireEvent.click(deactivateBtn);

    // ConfirmModal for bulk deactivation should show up.
    expect(screen.getByText('Vô hiệu hóa nhiều hoạt động')).toBeInTheDocument();
    expect(screen.getByText('Bạn có chắc chắn muốn vô hiệu hóa 2 hoạt động đã chọn? Các hoạt động sẽ chuyển sang trạng thái không hoạt động.')).toBeInTheDocument();

    const modalConfirmBtn = Array.from(screen.getAllByRole('button')).find(btn => btn.textContent === 'Vô hiệu hóa' && btn.className.includes('bg-amber-600'));
    expect(modalConfirmBtn).toBeInTheDocument();
    fireEvent.click(modalConfirmBtn!);

    await waitFor(() => {
      expect(activityApi.update).toHaveBeenCalledWith('act1', { participation_status: 'cancelled' });
      expect(activityApi.update).toHaveBeenCalledWith('act2', { participation_status: 'cancelled' });
    });
  });

  it('handles bulk delete confirmation flow and calls activityApi.delete for all selected IDs', async () => {
    const mockActivities = [
      { _id: 'act1', name: 'IT Club Activity', code: 'IT_CLUB', activity_type: 'club', participation_status: 'published' },
      { _id: 'act2', name: 'Sports Club', code: 'SP_CLUB', activity_type: 'event', participation_status: 'published' },
    ];
    vi.mocked(activityApi.getAll).mockResolvedValue(mockActivities as any);
    vi.mocked(activityApi.delete).mockResolvedValue({} as any);

    render(<ActivitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('IT Club Activity')).toBeInTheDocument();
    });

    // Switch to table view
    const listBtn = Array.from(screen.getAllByRole('button')).find(btn => btn.querySelector('svg.lucide-list'));
    fireEvent.click(listBtn!);

    // Tick the select-all checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // Click "Xóa" bulk action button
    const bulkDeleteBtn = Array.from(screen.getAllByRole('button')).find(btn => btn.textContent === 'Xóa' && btn.className.includes('bg-red-600'));
    expect(bulkDeleteBtn).toBeInTheDocument();
    fireEvent.click(bulkDeleteBtn!);

    // ConfirmModal for bulk delete should show up.
    expect(screen.getByText('Xóa nhiều hoạt động')).toBeInTheDocument();
    expect(screen.getByText('Bạn có chắc chắn muốn xóa 2 hoạt động đã chọn? Hành động này không thể hoàn tác.')).toBeInTheDocument();

    // Confirm button inside ConfirmModal is "Xóa"
    const modalConfirmBtn = Array.from(screen.getAllByRole('button')).find(btn => btn.textContent === 'Xóa' && btn.className.includes('bg-[#D92D20]'));
    expect(modalConfirmBtn).toBeInTheDocument();
    fireEvent.click(modalConfirmBtn!);

    await waitFor(() => {
      expect(activityApi.delete).toHaveBeenCalledWith('act1');
      expect(activityApi.delete).toHaveBeenCalledWith('act2');
    });
  });

  it('does NOT reload all activities on successful single status change, favorite click, and join confirm', async () => {
    const mockActivities = [
      {
        _id: 'act1',
        name: 'IT Club Activity',
        code: 'IT_CLUB',
        activity_type: 'club',
        participation_status: 'published',
        classroom: 'A.101',
        membership_status: 'none',
        is_favorited: false,
        favorite_count: 2,
        semester_id: { _id: 'sem1' }
      },
    ];

    vi.mocked(activityApi.getAll).mockResolvedValue(mockActivities as any);
    vi.mocked(activityApi.update).mockResolvedValue({ _id: 'act1', participation_status: 'draft' } as any);
    vi.mocked(activityApi.favoriteActivity).mockResolvedValue({ activity_id: 'act1', is_favorited: true, favorite_count: 3 } as any);
    vi.mocked(activityApi.joinActivity).mockResolvedValue({ membership: { status: 'pending' } } as any);

    render(<ActivitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('IT Club Activity')).toBeInTheDocument();
    });

    // Initial load: getAll called 1 time
    expect(activityApi.getAll).toHaveBeenCalledTimes(1);

    // 1. Trigger join activity in Grid View
    const joinBtn = screen.getByRole('button', { name: 'Đăng ký' });
    fireEvent.click(joinBtn);

    // Wait for modal to render and click Confirm
    await waitFor(() => {
      expect(screen.getByText('Xác nhận đăng ký tham gia')).toBeInTheDocument();
    });
    const confirmJoinBtn = screen.getByRole('button', { name: 'Xác nhận' });
    fireEvent.click(confirmJoinBtn);

    await waitFor(() => {
      expect(activityApi.joinActivity).toHaveBeenCalledWith('act1', { semester_id: 'sem1' });
    });

    // 2. Trigger favorite click in Grid View
    // Heart button on Grid Card (the only button in Grid view card besides join)
    const favBtn = screen.getAllByRole('button').find(btn => btn.querySelector('svg.lucide-heart'));
    expect(favBtn).toBeDefined();
    fireEvent.click(favBtn!);

    await waitFor(() => {
      expect(activityApi.favoriteActivity).toHaveBeenCalledWith('act1');
    });

    // 3. Switch to table view and trigger status change
    const listBtn = Array.from(screen.getAllByRole('button')).find(btn => btn.querySelector('svg.lucide-list'));
    fireEvent.click(listBtn!);

    const draftBtn = screen.getByTitle('Đưa về nháp');
    fireEvent.click(draftBtn);

    await waitFor(() => {
      expect(activityApi.update).toHaveBeenCalledWith('act1', { participation_status: 'draft' });
    });

    // Throughout status, favorite, join operations, activityApi.getAll should still only have been called 1 time (the initial load)
    expect(activityApi.getAll).toHaveBeenCalledTimes(1);
  });
});
