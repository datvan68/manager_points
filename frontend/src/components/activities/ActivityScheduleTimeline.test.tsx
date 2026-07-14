import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ActivityScheduleTimeline from './ActivityScheduleTimeline';

// Mock sonner toast to avoid side effects
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ActivityScheduleTimeline', () => {
  const mockSchedules = [
    // Lịch quá khứ: Week 1
    {
      _id: 's1',
      title: 'Past Session 1',
      start_time: '2026-07-06T10:00:00Z',
      end_time: '2026-07-06T12:00:00Z',
      is_today: false,
      is_active: false,
      location: 'Room A',
      status: 'scheduled',
    },
    // Lịch hôm nay 2: Tuesday (Today) - later session
    {
      _id: 's3',
      title: 'Today Session 2',
      start_time: '2026-07-14T14:00:00Z',
      end_time: '2026-07-14T16:00:00Z',
      is_today: true,
      is_active: false,
      location: 'Room C',
      status: 'scheduled',
    },
    // Lịch hôm nay 1: Tuesday (Today) - earlier session
    {
      _id: 's2',
      title: 'Today Session 1',
      start_time: '2026-07-14T09:00:00Z',
      end_time: '2026-07-14T11:00:00Z',
      is_today: true,
      is_active: true,
      location: 'Room B',
      status: 'scheduled',
    },
    // Lịch tương lai: Week 3
    {
      _id: 's4',
      title: 'Future Session 1',
      start_time: '2026-07-22T10:00:00Z',
      end_time: '2026-07-22T12:00:00Z',
      is_today: false,
      is_active: false,
      location: 'Room D',
      status: 'scheduled',
    },
    // Hai lịch không phải hôm nay có trùng start_time để kiểm tra sắp xếp theo _id
    {
      _id: 's6',
      title: 'Future Session 3',
      start_time: '2026-07-25T10:00:00Z',
      end_time: '2026-07-25T12:00:00Z',
      is_today: false,
      is_active: false,
      location: 'Room F',
      status: 'scheduled',
    },
    {
      _id: 's5',
      title: 'Future Session 2',
      start_time: '2026-07-25T10:00:00Z',
      end_time: '2026-07-25T12:00:00Z',
      is_today: false,
      is_active: false,
      location: 'Room E',
      status: 'scheduled',
    },
  ];

  it('renders unique items sorted correctly with today schedules first and no week headings', () => {
    render(
      <ActivityScheduleTimeline
        schedules={mockSchedules}
        isStudent={true}
      />
    );

    // 1. Đảm bảo không có heading tuần nào được hiển thị
    expect(screen.queryByText(/Tuần \d+/)).not.toBeInTheDocument();

    // 2. Assert unique rendering of all items
    expect(screen.getByText('Past Session 1')).toBeInTheDocument();
    expect(screen.getByText('Today Session 1')).toBeInTheDocument();
    expect(screen.getByText('Today Session 2')).toBeInTheDocument();
    expect(screen.getByText('Future Session 1')).toBeInTheDocument();
    expect(screen.getByText('Future Session 2')).toBeInTheDocument();
    expect(screen.getByText('Future Session 3')).toBeInTheDocument();

    // 3. Assert today badges count
    const todayBadges = screen.getAllByText('Hôm nay');
    expect(todayBadges.length).toBe(2);

    // 4. Assert style highlight của card hôm nay được giữ nguyên
    const todayCard1 = screen.getByText('Today Session 1').closest('.rounded-2xl');
    const todayCard2 = screen.getByText('Today Session 2').closest('.rounded-2xl');
    const pastCard1 = screen.getByText('Past Session 1').closest('.rounded-2xl');

    expect(todayCard1).toHaveClass('border-blue-500');
    expect(todayCard1).toHaveClass('bg-blue-50/50');
    expect(todayCard2).toHaveClass('border-blue-500');
    expect(todayCard2).toHaveClass('bg-blue-50/50');
    
    expect(pastCard1).not.toHaveClass('border-blue-500');
    expect(pastCard1).not.toHaveClass('bg-blue-50/50');

    // 5. Assert sorting of items: today's first (by start_time, then _id), then others (by start_time, then _id)
    const titles = screen.getAllByRole('heading', { level: 4 }).map(el => el.textContent);
    expect(titles).toEqual([
      'Today Session 1',
      'Today Session 2',
      'Past Session 1',
      'Future Session 1',
      'Future Session 2',
      'Future Session 3',
    ]);
  });

  it('renders student viewer attendance status correctly', () => {
    const studentSchedules = [
      {
        _id: 's1',
        title: 'Session 1',
        start_time: '2026-07-14T09:00:00Z',
        is_today: true,
        my_attendance: { status: 'present' },
      },
      {
        _id: 's2',
        title: 'Session 2',
        start_time: '2026-07-14T10:00:00Z',
        is_today: true,
        my_attendance: { status: 'late' },
      },
      {
        _id: 's3',
        title: 'Session 3',
        start_time: '2026-07-14T11:00:00Z',
        is_today: true,
        my_attendance: { status: 'absent' },
      },
      {
        _id: 's4',
        title: 'Session 4',
        start_time: '2026-07-14T12:00:00Z',
        is_today: true,
        my_attendance: { status: 'excused' },
      },
      {
        _id: 's5',
        title: 'Session 5',
        start_time: '2026-07-14T13:00:00Z',
        is_today: true,
        my_attendance: null,
      },
    ];

    render(
      <ActivityScheduleTimeline
        schedules={studentSchedules}
        isStudent={true}
      />
    );

    // Kiểm tra "Trạng thái điểm danh:" xuất hiện
    const labels = screen.getAllByText('Trạng thái điểm danh:');
    expect(labels.length).toBe(5);

    // Kiểm tra từng nhãn tương ứng
    expect(screen.getByText('Có mặt')).toBeInTheDocument();
    expect(screen.getByText('Đi trễ')).toBeInTheDocument();
    expect(screen.getByText('Vắng')).toBeInTheDocument();
    expect(screen.getByText('Nghỉ phép')).toBeInTheDocument();
    expect(screen.getByText('Chưa điểm danh')).toBeInTheDocument();
  });

  it('renders admin/advisor viewer attendance count correctly', () => {
    const adminSchedules = [
      {
        _id: 's1',
        title: 'Session 1',
        start_time: '2026-07-14T09:00:00Z',
        is_today: true,
        attendance_records: [{ _id: 'r1' }, { _id: 'r2' }],
      },
      {
        _id: 's2',
        title: 'Session 2',
        start_time: '2026-07-14T10:00:00Z',
        is_today: true,
        attendance_records: [],
      },
      {
        _id: 's3',
        title: 'Session 3',
        start_time: '2026-07-14T11:00:00Z',
        is_today: true,
        attendance_records: null,
      },
    ];

    render(
      <ActivityScheduleTimeline
        schedules={adminSchedules}
        isAdminOrAdvisor={true}
      />
    );

    expect(screen.getByText('Đã điểm danh: 2')).toBeInTheDocument();
    expect(screen.getAllByText('Đã điểm danh: 0').length).toBe(2); // Cả s2 và s3 (null)
  });

  it('handles attendance button rendering and callback behaviors', () => {
    const onOpenAttendanceMock = vi.fn();

    const mixedSchedules = [
      {
        _id: 's1',
        title: 'Today Session',
        start_time: '2026-07-14T09:00:00Z',
        is_today: true,
      },
      {
        _id: 's2',
        title: 'Past Session',
        start_time: '2026-07-13T09:00:00Z',
        is_today: false,
      },
    ];

    // Case 1: isStudent=true, has onOpenAttendance. Nút Điểm danh chỉ trên s1 (Today)
    const { rerender } = render(
      <ActivityScheduleTimeline
        schedules={mixedSchedules}
        isStudent={true}
        onOpenAttendance={onOpenAttendanceMock}
      />
    );

    const attendBtns = screen.getAllByRole('button', { name: 'Điểm danh' });
    expect(attendBtns.length).toBe(1);
    
    // Nút "Điểm danh" nằm ở card "Today Session"
    const todayCard = screen.getByText('Today Session').closest('.rounded-2xl');
    expect(todayCard).toContainElement(attendBtns[0]);

    // Click nút và verify callback
    fireEvent.click(attendBtns[0]);
    expect(onOpenAttendanceMock).toHaveBeenCalledTimes(1);

    // Case 2: isAdminOrAdvisor=true, has onOpenAttendance. Nút Điểm danh hiển thị trên s1
    onOpenAttendanceMock.mockClear();
    rerender(
      <ActivityScheduleTimeline
        schedules={mixedSchedules}
        isAdminOrAdvisor={true}
        onOpenAttendance={onOpenAttendanceMock}
      />
    );
    const attendBtnsAdmin = screen.getAllByRole('button', { name: 'Điểm danh' });
    expect(attendBtnsAdmin.length).toBe(1);
    fireEvent.click(attendBtnsAdmin[0]);
    expect(onOpenAttendanceMock).toHaveBeenCalledTimes(1);

    // Case 3: viewer không hợp lệ (không phải student cũng không phải admin/advisor)
    rerender(
      <ActivityScheduleTimeline
        schedules={mixedSchedules}
        isStudent={false}
        isAdminOrAdvisor={false}
        onOpenAttendance={onOpenAttendanceMock}
      />
    );
    expect(screen.queryByRole('button', { name: 'Điểm danh' })).not.toBeInTheDocument();

    // Case 4: Không truyền onOpenAttendance
    rerender(
      <ActivityScheduleTimeline
        schedules={mixedSchedules}
        isStudent={true}
      />
    );
    expect(screen.queryByRole('button', { name: 'Điểm danh' })).not.toBeInTheDocument();
  });

  it('proves role-matrix behaviors: advisor, student, and admin views with roster toggle, empty details, status labels, and approval labels', () => {
    const matrixSchedules = [
      {
        _id: 's_matrix_1',
        title: 'Matrix Session 1',
        start_time: '2026-07-14T09:00:00Z',
        is_today: true,
        my_attendance: { status: 'present', approval_status: 'approved' },
        attendance_records: [
          {
            _id: 'rec_1',
            student_id: { _id: 'std_1', full_name: 'Alice Johnson', student_code: 'SV001' },
            status: 'present',
            check_in_time: '2026-07-14T09:05:00Z',
            approval_status: 'approved',
            note: 'On time',
          },
          {
            _id: 'rec_2',
            student_id: { _id: 'std_2', full_name: 'Bob Smith', student_code: 'SV002' },
            status: 'late',
            check_in_time: '2026-07-14T09:20:00Z',
            approval_status: 'pending',
            note: 'Traffic',
          }
        ]
      }
    ];

    // Case 1: Student Viewer (canViewOwnAttendance=true, canViewAttendanceRoster=false)
    const { rerender } = render(
      <ActivityScheduleTimeline
        schedules={matrixSchedules}
        canViewOwnAttendance={true}
        canViewAttendanceRoster={false}
      />
    );
    expect(screen.getByText('Trạng thái điểm danh:')).toBeInTheDocument();
    expect(screen.getByText('Có mặt')).toBeInTheDocument();
    expect(screen.queryByText('Đã điểm danh:')).not.toBeInTheDocument();
    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();

    // Case 2: Advisor Viewer (canViewOwnAttendance=false, canViewAttendanceRoster=true)
    rerender(
      <ActivityScheduleTimeline
        schedules={matrixSchedules}
        canViewOwnAttendance={false}
        canViewAttendanceRoster={true}
      />
    );
    expect(screen.queryByText('Trạng thái điểm danh:')).not.toBeInTheDocument();
    expect(screen.getByText('Đã điểm danh: 2')).toBeInTheDocument();
    
    // Toggle expand
    const detailBtn = screen.getByRole('button', { name: 'Chi tiết' });
    expect(detailBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(detailBtn);
    expect(detailBtn).toHaveAttribute('aria-expanded', 'true');

    // Verify roster fields
    expect(screen.getByText('DANH SÁCH ĐIỂM DANH:')).toBeInTheDocument();
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('SV001')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.getByText('SV002')).toBeInTheDocument();
    expect(screen.getByText('Note: On time')).toBeInTheDocument();
    expect(screen.getByText('Note: Traffic')).toBeInTheDocument();
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument(); // approval label for pending
    expect(screen.getAllByText('Đã duyệt').length).toBeGreaterThan(0); // approval status of Alice

    // Toggle collapse
    fireEvent.click(detailBtn);
    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();

    // Case 3: Admin Viewer with empty records
    const emptySchedules = [
      {
        _id: 's_empty',
        title: 'Empty Session',
        start_time: '2026-07-14T09:00:00Z',
        is_today: true,
        attendance_records: [],
      }
    ];
    rerender(
      <ActivityScheduleTimeline
        schedules={emptySchedules}
        canViewOwnAttendance={false}
        canViewAttendanceRoster={true}
      />
    );
    expect(screen.getByText('Đã điểm danh: 0')).toBeInTheDocument();
    const emptyDetailBtn = screen.getByRole('button', { name: 'Chi tiết' });
    fireEvent.click(emptyDetailBtn);
    expect(screen.getByText('Không có dữ liệu điểm danh')).toBeInTheDocument();
  });

  it('renders explicit empty state without headings or badges when schedules is empty', () => {
    render(<ActivityScheduleTimeline schedules={[]} />);
    expect(screen.queryByText(/Tuần \d+/)).not.toBeInTheDocument();
    expect(screen.queryByText('Hôm nay')).not.toBeInTheDocument();
    expect(screen.getByText('Chưa có lịch sinh hoạt nào được lên kế hoạch')).toBeInTheDocument();
  });
});
