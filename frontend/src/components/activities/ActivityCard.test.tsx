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
    create: vi.fn(),
    delete: vi.fn(),
    cancelRecurrence: vi.fn(),
  },
}));

import ActivityCard from './ActivityCard';

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
    const joinBtn = screen.getByText('Đăng ký');
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

  it('renders correct labels for all four membership states', () => {
    const states: ('none' | 'pending' | 'active' | 'rejected')[] = ['none', 'pending', 'active', 'rejected'];
    const expectedLabels = ['Đăng ký', 'Chờ duyệt', 'Đang tham gia', 'Bị từ chối'];

    states.forEach((state, index) => {
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

      expect(screen.getByText(expectedLabels[index])).toBeInTheDocument();
      unmount();
    });
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

    const joinBtn = screen.getByText('Đăng ký');
    expect(joinBtn).toBeInTheDocument();
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

    const joinBtn = screen.getByText('Đang xử lý...');
    expect(joinBtn).toBeInTheDocument();
    expect(joinBtn).toBeDisabled();

    fireEvent.click(joinBtn);
    expect(onJoinClick).not.toHaveBeenCalled();
  });
});
