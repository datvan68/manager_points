import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
      role: { role_code: 'STUDENT' },
    },
  }),
  isAdminUser: () => false,
}));

vi.mock('@/api/auth-api', () => ({
  tokenStorage: {
    getUser: () => ({ id: 'user-1', role: 'student' }),
  },
}));

vi.mock('@/api/activity-api', () => ({
  activityApi: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  activityScheduleApi: {
    getAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getActivityTimeline: vi.fn().mockResolvedValue({ items: [] }),
    create: vi.fn(),
    delete: vi.fn(),
    cancelRecurrence: vi.fn(),
  },
}));

import ActivityCard from './ActivityCard';
import { activityScheduleApi } from '@/api/activity-api';

const getCurrentWednesdayTime = (hour: number) => {
  const date = new Date();
  const day = date.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - daysFromMonday + 2);
  date.setHours(hour, 0, 0, 0);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 19);
};

describe('ActivityCard', () => {
  const mockActivity = {
    _id: 'act1',
    name: 'Football Club',
    code: 'FB_CLUB',
    category: 'sports',
    participation_status: 'published',
    classroom: 'Gymnasium',
    active_members_count: 5,
    max_members: 20,
    favorite_count: 10,
    is_favorited: false,
    membership_status: 'none',
    background_config: {
      preset: 'sport',
    },
    advisor_id: { full_name: 'Coach Carter' },
  };

  const onJoinClick = vi.fn();
  const onFavoriteClick = vi.fn();
  const onEditClick = vi.fn();
  const onDeleteClick = vi.fn();
  const onNavigateToDetail = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue({ items: [] } as any);
    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: [], total: 0 } as any);
  });

  it('renders configured background and details correctly', () => {
    render(
      <ActivityCard
        activity={mockActivity}
        onJoinClick={onJoinClick}
        onFavoriteClick={onFavoriteClick}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        canManage={false}
        onNavigateToDetail={onNavigateToDetail}
      />
    );

    expect(screen.getByText('Football Club')).toBeInTheDocument();
    expect(screen.getByText('FB_CLUB')).toBeInTheDocument();
    expect(screen.getByText('Gymnasium')).toBeInTheDocument();
  });

  it('requests schedules via timeline and renders current-week schedule with backend member count', async () => {
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValueOnce({
      items: [
        {
          _id: 'schedule-1',
          activity_id: 'act1',
          title: 'Weekly session',
          schedule_type: 'regular',
          start_time: getCurrentWednesdayTime(8),
          end_time: getCurrentWednesdayTime(10),
          status: 'scheduled',
          semester_id: 'semester-1',
          created_by: 'user-1',
          createdAt: '2026-07-01T00:00:00Z',
        },
      ],
    } as any);

    render(
      <ActivityCard
        activity={{ ...mockActivity, schedule_summary: undefined }}
        onJoinClick={onJoinClick}
        onFavoriteClick={onFavoriteClick}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        canManage={false}
        onNavigateToDetail={onNavigateToDetail}
      />
    );

    await waitFor(() => {
      expect(activityScheduleApi.getActivityTimeline).toHaveBeenCalledWith('act1');
    });

    expect(await screen.findByText('T4: 08:00 - 10:00')).toBeInTheDocument();
    expect(screen.getByText('5/20')).toBeInTheDocument();
  });

  it('loads schedules when the activity provides an empty schedule summary', async () => {
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValueOnce({
      items: [
        {
          _id: 'schedule-2',
          activity_id: 'act1',
          title: 'Empty-summary regression session',
          schedule_type: 'regular',
          start_time: getCurrentWednesdayTime(8),
          end_time: getCurrentWednesdayTime(10),
          status: 'scheduled',
          semester_id: 'semester-1',
          created_by: 'user-1',
          createdAt: '2026-07-01T00:00:00Z',
        },
      ],
    } as any);

    render(
      <ActivityCard
        activity={{ ...mockActivity, schedule_summary: [] }}
        onJoinClick={onJoinClick}
        onFavoriteClick={onFavoriteClick}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        canManage={false}
        onNavigateToDetail={onNavigateToDetail}
      />
    );

    await waitFor(() => {
      expect(activityScheduleApi.getActivityTimeline).toHaveBeenCalledWith('act1');
    });

    expect(await screen.findByText('T4: 08:00 - 10:00')).toBeInTheDocument();
    expect(screen.queryByText('Chưa xếp lịch')).not.toBeInTheDocument();
  });

  it('loads schedules from a data-wrapped timeline response', async () => {
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValueOnce({
      data: {
        items: [{
          _id: 'schedule-3', activity_id: 'act1', title: 'Wrapped response session',
          schedule_type: 'regular', start_time: getCurrentWednesdayTime(8),
          end_time: getCurrentWednesdayTime(10), status: 'scheduled',
        }],
      },
    } as any);

    render(
      <ActivityCard
        activity={{ ...mockActivity, schedule_summary: [] }}
        onJoinClick={onJoinClick} onFavoriteClick={onFavoriteClick}
        onEditClick={onEditClick} onDeleteClick={onDeleteClick}
        canManage={false} onNavigateToDetail={onNavigateToDetail}
      />
    );

    expect(await screen.findByText('T4: 08:00 - 10:00')).toBeInTheDocument();
  });

  it('falls back to getAll when timeline access is denied', async () => {
    vi.mocked(activityScheduleApi.getActivityTimeline).mockRejectedValueOnce(new Error('Forbidden'));
    vi.mocked(activityScheduleApi.getAll).mockResolvedValueOnce({
      items: [{
        _id: 'fallback-1', activity_id: 'act1', title: 'Fallback session',
        schedule_type: 'regular', start_time: getCurrentWednesdayTime(8),
        end_time: getCurrentWednesdayTime(10), status: 'scheduled',
      }],
      total: 1,
    } as any);

    render(
      <ActivityCard
        activity={{ ...mockActivity, schedule_summary: [] }}
        onJoinClick={onJoinClick} onFavoriteClick={onFavoriteClick}
        onEditClick={onEditClick} onDeleteClick={onDeleteClick}
        canManage={false} onNavigateToDetail={onNavigateToDetail}
      />
    );

    expect(await screen.findByText('T4: 08:00 - 10:00')).toBeInTheDocument();
    expect(activityScheduleApi.getAll).toHaveBeenCalledWith({ activity_id: 'act1', limit: 100 });
  });

  it('triggers onNavigateToDetail when card is clicked, but NOT when favorite or join is clicked', async () => {
    render(
      <ActivityCard
        activity={mockActivity}
        onJoinClick={onJoinClick}
        onFavoriteClick={onFavoriteClick}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        canManage={false}
        onNavigateToDetail={onNavigateToDetail}
      />
    );

    // Click favorite button (Heart)
    const favBtn = screen.getByRole('button', { name: '' }); // Heart button has no text label
    fireEvent.click(favBtn);
    expect(onFavoriteClick).toHaveBeenCalledTimes(1);
    expect(onNavigateToDetail).not.toHaveBeenCalled();

    // Click join button
    const joinBtn = screen.getAllByRole('button').at(-1)!;
    fireEvent.click(joinBtn);
    expect(onJoinClick).toHaveBeenCalledTimes(1);
    expect(onNavigateToDetail).not.toHaveBeenCalled();

    // Click the card itself
    const cardTitle = screen.getByText('Football Club');
    fireEvent.click(cardTitle);
    expect(onNavigateToDetail).toHaveBeenCalledWith('act1');
  });

  it('renders fallback styles gracefully when background config is missing', () => {
    const noBgActivity = {
      ...mockActivity,
      background_config: undefined,
    };

    render(
      <ActivityCard
        activity={noBgActivity}
        onJoinClick={onJoinClick}
        onFavoriteClick={onFavoriteClick}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        canManage={false}
        onNavigateToDetail={onNavigateToDetail}
      />
    );

    expect(screen.getByText('Football Club')).toBeInTheDocument();
  });

  it('renders design icon for manager, and calls onConfigureDesign on click with isolation', () => {
    const onConfigureDesign = vi.fn();
    render(
      <ActivityCard
        activity={mockActivity}
        onJoinClick={onJoinClick}
        onFavoriteClick={onFavoriteClick}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        canManage={true}
        onNavigateToDetail={onNavigateToDetail}
        onConfigureDesign={onConfigureDesign}
      />
    );

    const designBtn = screen.getByTestId('configure-design-button');
    expect(designBtn).toBeInTheDocument();

    fireEvent.click(designBtn);
    expect(onConfigureDesign).toHaveBeenCalledWith(mockActivity);
    expect(onNavigateToDetail).not.toHaveBeenCalled();
  });

  it('renders action area for all four membership states', () => {
    const states: ('none' | 'pending' | 'active' | 'rejected')[] = ['none', 'pending', 'active', 'rejected'];

    states.forEach((state) => {
      const activityWithState = {
        ...mockActivity,
        membership_status: state,
      };

      const { unmount } = render(
        <ActivityCard
          activity={activityWithState}
          onJoinClick={onJoinClick}
          onFavoriteClick={onFavoriteClick}
          onEditClick={onEditClick}
          onDeleteClick={onDeleteClick}
          canManage={false}
          onNavigateToDetail={onNavigateToDetail}
        />
      );

      expect(screen.getByText('Football Club')).toBeInTheDocument();
      unmount();
    });
  });

  it('uses the requested labels for active and rejected memberships', () => {
    const { rerender } = render(
      <ActivityCard
        activity={{ ...mockActivity, membership_status: 'active' }}
        onJoinClick={onJoinClick}
        onFavoriteClick={onFavoriteClick}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        canManage={false}
        onNavigateToDetail={onNavigateToDetail}
      />
    );
    expect(screen.getByText('Đã tham gia')).toBeInTheDocument();

    rerender(
      <ActivityCard
        activity={{ ...mockActivity, membership_status: 'rejected' }}
        onJoinClick={onJoinClick}
        onFavoriteClick={onFavoriteClick}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        canManage={false}
        onNavigateToDetail={onNavigateToDetail}
      />
    );
    expect(screen.getByText('Bị từ chối')).toBeInTheDocument();
  });

  it('does not render Sửa and Xóa buttons on the grid card even when canManage={true}', () => {
    render(
      <ActivityCard
        activity={mockActivity}
        onJoinClick={onJoinClick}
        onFavoriteClick={onFavoriteClick}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        canManage={true}
        onNavigateToDetail={onNavigateToDetail}
      />
    );

    expect(screen.queryByText('Sửa')).not.toBeInTheDocument();
    expect(screen.queryByText('Xóa')).not.toBeInTheDocument();
  });

  it('triggers onJoinClick callback when a student with membership_status="none" clicks the Đăng ký action', () => {
    const activityWithNone = {
      ...mockActivity,
      membership_status: 'none',
    };
    render(
      <ActivityCard
        activity={activityWithNone}
        onJoinClick={onJoinClick}
        onFavoriteClick={onFavoriteClick}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        canManage={false}
        onNavigateToDetail={onNavigateToDetail}
      />
    );

    const joinBtn = screen.getByRole('button', { name: 'Đăng ký' });
    expect(joinBtn).toBeInTheDocument();
    expect(joinBtn).toHaveClass('backdrop-blur-sm', 'border-white/80', 'bg-white/50');
    fireEvent.click(joinBtn);
    expect(onJoinClick).toHaveBeenCalledTimes(1);
    expect(onJoinClick).toHaveBeenCalledWith(activityWithNone);
  });

  it('disables the Đăng ký button when joinPending is true', () => {
    const activityWithNone = {
      ...mockActivity,
      membership_status: 'none',
    };
    render(
      <ActivityCard
        activity={activityWithNone}
        onJoinClick={onJoinClick}
        onFavoriteClick={onFavoriteClick}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        canManage={false}
        onNavigateToDetail={onNavigateToDetail}
        joinPending={true}
      />
    );

    const joinBtn = screen.getByRole('button', { name: 'Đang xử lý...' });
    expect(joinBtn).toBeInTheDocument();
    expect(joinBtn).toBeDisabled();

    fireEvent.click(joinBtn);
    expect(onJoinClick).not.toHaveBeenCalled();
  });

  it('does not render the registration action when attendance does not require registration', () => {
    render(
      <ActivityCard
        activity={{
          ...mockActivity,
          settings: { require_registration_for_attendance: false },
        }}
        onJoinClick={onJoinClick}
        onFavoriteClick={onFavoriteClick}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        canManage={false}
        onNavigateToDetail={onNavigateToDetail}
      />
    );

    expect(screen.queryByRole('button', { name: 'Đăng ký' })).not.toBeInTheDocument();
    expect(onJoinClick).not.toHaveBeenCalled();
  });
});
