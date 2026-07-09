import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ClubDetailPage from './page';
import { clubApi, clubScheduleApi } from '@/api/club-api';
import { tokenStorage } from '@/api/auth-api';
import { studentApi } from '@/api/student-api';
import { semesterApi } from '@/api/semester-api';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useParams: () => ({
    clubId: 'club-1',
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
}));

vi.mock('@/api/auth-api', () => ({
  tokenStorage: {
    getUser: vi.fn(),
  },
}));

vi.mock('@/api/club-api', () => ({
  clubApi: {
    getById: vi.fn(),
    getMembers: vi.fn(),
    getMyClubs: vi.fn(),
    leaveClub: vi.fn(),
    joinClub: vi.fn(),
  },
  clubScheduleApi: {
    getClubTimeline: vi.fn(),
  },
}));

vi.mock('@/api/student-api', () => ({
  studentApi: {
    getStudents: vi.fn(),
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

vi.mock('@/hooks/useAttendanceSession', () => ({
  useAttendanceSession: () => ({
    session: null,
    loading: false,
    qrData: null,
    checkins: [],
    error: null,
    resetCheckinStatus: vi.fn(),
    checkinQr: vi.fn(),
    checkinProximity: vi.fn(),
    openSession: vi.fn(),
    closeSession: vi.fn(),
  }),
}));

vi.mock('@/components/attendance/AttendanceMethodSelector', () => ({
  default: () => <div data-testid="attendance-method-selector" />,
}));
vi.mock('@/components/attendance/AttendanceSessionStatus', () => ({
  default: () => <div data-testid="attendance-session-status" />,
}));
vi.mock('@/components/attendance/QrDisplayPanel', () => ({
  default: () => <div data-testid="qr-display-panel" />,
}));
vi.mock('@/components/attendance/QrScannerModal', () => ({
  default: () => <div data-testid="qr-scanner-modal" />,
}));
vi.mock('@/components/attendance/ProximityPanel', () => ({
  default: () => <div data-testid="proximity-panel" />,
}));
vi.mock('@/components/attendance/ProximityCheckinButton', () => ({
  default: () => <div data-testid="proximity-checkin-button" />,
}));
vi.mock('./ClubScheduleTimeline', () => ({
  default: () => <div data-testid="club-schedule-timeline" />,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ClubDetailPage Interactions', () => {
  const mockClub = {
    _id: 'club-1',
    name: 'Academic Club',
    code: 'AC1',
    category: 'academic',
    status: 'active',
    cover_url: '',
    semester_id: { _id: 'sem-1', name: 'Semester 1' },
    settings: {
      allow_self_registration: true,
      require_approval: true,
      attendance_point_enabled: false,
      point_per_attendance: 0,
    },
    advisor_id: 'advisor-1',
  };

  const mockMembers = [
    {
      _id: 'm-1',
      status: 'active',
      role: 'member',
      student_id: { _id: 'student-1', full_name: 'John Student', student_code: 'SV01' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    (clubApi.getById as any).mockResolvedValue(mockClub);
    (clubApi.getMembers as any).mockResolvedValue(mockMembers);
    (clubApi.getMyClubs as any).mockResolvedValue([]);
    (clubScheduleApi.getClubTimeline as any).mockResolvedValue({ items: [], total: 0 });
    (studentApi.getStudents as any).mockResolvedValue([]);
    (semesterApi.getSemesters as any).mockResolvedValue([]);
  });

  it('should hide cover banner, stats row, and members tab for active student member', async () => {
    (tokenStorage.getUser as any).mockReturnValue({
      _id: 'student-1',
      role: 'student',
    });
    // Active membership for this club
    (clubApi.getMyClubs as any).mockResolvedValue([
      { club_id: 'club-1', status: 'active' },
    ]);

    render(<ClubDetailPage />);

    // Wait for loader to disappear
    await screen.findByText('Academic Club');

    // Stats row element "Thành viên chính thức" should NOT be visible
    expect(screen.queryByText('Thành viên chính thức')).toBeNull();

    // Tab button "Thành viên" should NOT be visible
    expect(screen.queryByText(/Thành viên \(\d+\)/)).toBeNull();

    // Rời CLB button should be visible
    expect(screen.getByText('Rời CLB')).toBeDefined();
  });

  it('should show cover banner, stats row, and members tab for admin user', async () => {
    (tokenStorage.getUser as any).mockReturnValue({
      _id: 'admin-1',
      role: 'admin',
    });

    render(<ClubDetailPage />);

    await screen.findByText('Academic Club');

    // Stats row element "Thành viên chính thức" should be visible
    expect(screen.getByText('Thành viên chính thức')).toBeDefined();

    // Tab button "Thành viên (1)" should be visible
    expect(screen.getByText('Thành viên (1)')).toBeDefined();

    // Leave button should NOT be visible
    expect(screen.queryByText('Rời CLB')).toBeNull();
  });

  it('should show cover banner, stats row, and members tab for non-member student', async () => {
    (tokenStorage.getUser as any).mockReturnValue({
      _id: 'student-2',
      role: 'student',
    });
    // No membership in this club
    (clubApi.getMyClubs as any).mockResolvedValue([]);

    render(<ClubDetailPage />);

    await screen.findByText('Academic Club');

    expect(screen.getByText('Thành viên chính thức')).toBeDefined();
    expect(screen.getByText('Thành viên (1)')).toBeDefined();

    // Join button should be visible
    expect(screen.getByText('Gửi Đơn Đăng Ký Tham Gia')).toBeDefined();
  });

  it('should render disabled waiting status button for pending student', async () => {
    (tokenStorage.getUser as any).mockReturnValue({
      _id: 'student-1',
      role: 'student',
    });
    (clubApi.getMyClubs as any).mockResolvedValue([
      { club_id: 'club-1', status: 'pending' },
    ]);

    render(<ClubDetailPage />);

    await screen.findByText('Academic Club');

    const pendingBtn = screen.getByText('Đang chờ duyệt');
    expect(pendingBtn).toBeDefined();
    expect(pendingBtn.hasAttribute('disabled')).toBe(true);
  });

  it('should open danger confirmation modal when active student clicks leave, cancel makes no API call, confirm calls leaveClub and reloads', async () => {
    (tokenStorage.getUser as any).mockReturnValue({
      _id: 'student-1',
      role: 'student',
    });
    (clubApi.getMyClubs as any).mockResolvedValue([
      { club_id: 'club-1', status: 'active' },
    ]);

    (clubApi.leaveClub as any).mockResolvedValue({ success: true });

    render(<ClubDetailPage />);

    await screen.findByText('Academic Club');

    const leaveBtn = screen.getByText('Rời CLB');
    fireEvent.click(leaveBtn);

    // Confirmation modal should be open
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal')).not.toBeNull();
    });
    expect(screen.getByText('Xác nhận rời Câu lạc bộ')).toBeDefined();

    // Test Cancel
    const cancelBtn = screen.getByText('Hủy');
    fireEvent.click(cancelBtn);
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal')).toBeNull();
    });
    expect(clubApi.leaveClub).not.toHaveBeenCalled();

    // Re-open modal and Confirm
    fireEvent.click(leaveBtn);
    let modal: HTMLElement;
    await waitFor(() => {
      modal = screen.getByTestId('confirm-modal');
      expect(modal).toBeDefined();
    });
    
    const confirmBtn = within(modal!).getByText('Rời CLB');
    
    // Before click, change getMyClubs to mock the non-member state transition
    (clubApi.getMyClubs as any).mockResolvedValue([]);

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(clubApi.leaveClub).toHaveBeenCalledWith('club-1', { semester_id: 'sem-1' });
    });

    // Verify detail UI transitions to non-member state (loadData runs and resolves myMembershipStatus to 'none')
    await waitFor(() => {
      expect(screen.getByText('Gửi Đơn Đăng Ký Tham Gia')).toBeDefined();
    });
  });
});
