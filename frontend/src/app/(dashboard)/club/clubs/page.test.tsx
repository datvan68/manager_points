import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ClubsListPage from './page';
import { clubApi, clubScheduleApi } from '@/api/club-api';
import { tokenStorage } from '@/api/auth-api';
import { semesterApi } from '@/api/semester-api';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/api/auth-api', () => ({
  tokenStorage: {
    getUser: vi.fn(),
  },
}));

vi.mock('@/api/club-api', () => ({
  clubApi: {
    getAll: vi.fn(),
    getMyFavoriteClubIds: vi.fn(),
    getMyClubs: vi.fn(),
    getStats: vi.fn(),
    joinClub: vi.fn(),
    switchClub: vi.fn(),
    getMyTransferPolicy: vi.fn(),
  },
  clubScheduleApi: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/api/semester-api', () => ({
  semesterApi: {
    getSemesters: vi.fn(),
  },
}));

vi.mock('@/components/modals/ConfirmModal', () => ({
  default: ({ isOpen, onClose, onConfirm, title, message, confirmLabel }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="confirm-modal">
        <h3>{title}</h3>
        <div>{message}</div>
        <button onClick={onClose}>Hủy</button>
        <button onClick={onConfirm}>{confirmLabel || 'Xác nhận'}</button>
      </div>
    );
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ClubsListPage Interactions', () => {
  const mockClubs = [
    {
      _id: 'club-1',
      name: 'Academic Club',
      code: 'AC1',
      category: 'academic',
      status: 'active',
      settings: {
        allow_self_registration: true,
        require_approval: true,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();

    (tokenStorage.getUser as any).mockReturnValue({
      _id: 'student-1',
      role: 'student',
    });

    (clubApi.getAll as any).mockResolvedValue(mockClubs);
    (clubApi.getMyFavoriteClubIds as any).mockResolvedValue([]);
    (clubApi.getMyClubs as any).mockResolvedValue([]);
    (clubApi.getStats as any).mockResolvedValue({
      active_members: 10,
      pending_members: 2,
      favorite_count: 5,
    });
    (semesterApi.getSemesters as any).mockResolvedValue([
      { _id: 'sem-1', status: 'active', name: 'Semester 1' },
    ]);
    (clubApi.getMyTransferPolicy as any).mockResolvedValue({
      self_service_changes_used: 0,
      self_service_changes_remaining: 3,
      occupied_club_id: null,
      first_schedule_start_time: null,
    });
    (clubScheduleApi.getAll as any).mockResolvedValue({
      items: [],
      total: 0,
    });
  });

  it('should not call joinClub API immediately when clicking join, but open confirmation modal', async () => {
    render(<ClubsListPage />);

    const joinBtn = await screen.findByText('Đăng ký tham gia');
    expect(joinBtn).toBeDefined();

    // Click join button
    fireEvent.click(joinBtn);

    // Verify API is not called yet
    expect(clubApi.joinClub).not.toHaveBeenCalled();

    // Verify modal is open
    expect(screen.getByTestId('confirm-modal')).toBeDefined();
    expect(screen.getByText('Xác nhận tham gia Câu lạc bộ')).toBeDefined();
  });

  it('should not call joinClub API and close modal when cancelling confirmation modal', async () => {
    render(<ClubsListPage />);

    const joinBtn = await screen.findByText('Đăng ký tham gia');
    fireEvent.click(joinBtn);

    const cancelBtn = screen.getByText('Hủy');
    fireEvent.click(cancelBtn);

    // Verify modal is closed
    expect(screen.queryByTestId('confirm-modal')).toBeNull();
    // Verify API is not called
    expect(clubApi.joinClub).not.toHaveBeenCalled();
    // Verify router did not push
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should call joinClub and redirect to club detail route on successful confirmed join', async () => {
    (clubApi.joinClub as any).mockResolvedValue({
      membership: { status: 'pending' },
    });

    render(<ClubsListPage />);

    const joinBtn = await screen.findByText('Đăng ký tham gia');
    fireEvent.click(joinBtn);

    const confirmBtn = screen.getByText('Xác nhận');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(clubApi.joinClub).toHaveBeenCalledWith('club-1', { semester_id: 'sem-1' });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/club/clubs/club-1');
    });
  });

  it('should redirect to target club detail route on successful confirmed switch', async () => {
    // Student occupies another club
    (clubApi.getMyTransferPolicy as any).mockResolvedValue({
      self_service_changes_used: 0,
      self_service_changes_remaining: 3,
      occupied_club_id: 'club-other',
      first_schedule_start_time: null,
    });

    (clubApi.switchClub as any).mockResolvedValue({
      membership: { status: 'active' },
    });

    render(<ClubsListPage />);

    // Since student occupies another club, the button content should map to "Chuyển sang CLB này"
    const switchBtn = await screen.findByText('Chuyển sang CLB này');
    expect(switchBtn).toBeDefined();

    fireEvent.click(switchBtn);

    // Verify switch confirm modal is open
    expect(screen.getByText('Xác nhận chuyển Câu lạc bộ')).toBeDefined();

    const confirmBtn = screen.getByText('Xác nhận chuyển');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(clubApi.switchClub).toHaveBeenCalledWith('club-1', { semester_id: 'sem-1' });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/club/clubs/club-1');
    });
  });
});
