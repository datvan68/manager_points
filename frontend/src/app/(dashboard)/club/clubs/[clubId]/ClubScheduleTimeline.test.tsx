import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ClubScheduleTimeline from './ClubScheduleTimeline';
import { ClubTimelineResponse } from '@/api/club-api';

describe('ClubScheduleTimeline Component', () => {
  const studentData: ClubTimelineResponse = {
    viewer_mode: 'student',
    items: [
      {
        _id: 's1',
        club_id: 'club123',
        title: 'Weekly Training Session',
        description: 'First practice session of the week.',
        schedule_type: 'regular',
        location: 'Hall A',
        start_time: '2026-07-06T18:00:00.000Z',
        end_time: '2026-07-06T20:00:00.000Z',
        semester_id: 'sem1',
        status: 'completed',
        created_by: 'user1',
        createdAt: '2026-07-01T00:00:00.000Z',
        my_attendance: {
          _id: 'att1',
          club_id: 'club123',
          schedule_id: 's1',
          student_id: 'student123',
          semester_id: 'sem1',
          status: 'present',
          approval_status: 'approved',
          synced_to_academic_record: true,
          createdAt: '2026-07-06T19:00:00.000Z',
          recorded_by: 'user1',
          recorded_by_role: 'president',
          recorded_at: '2026-07-06T19:00:00.000Z',
        },
      },
      {
        _id: 's2',
        club_id: 'club123',
        title: 'Strategy Meeting',
        description: 'Monthly schedule planning.',
        schedule_type: 'meeting',
        location: 'Room 102',
        start_time: '2026-07-07T18:00:00.000Z',
        end_time: '2026-07-07T20:00:00.000Z',
        semester_id: 'sem1',
        status: 'scheduled',
        created_by: 'user1',
        createdAt: '2026-07-01T00:00:00.000Z',
        my_attendance: null,
      },
    ],
  };

  const staffData: ClubTimelineResponse = {
    viewer_mode: 'staff',
    items: [
      {
        _id: 's1',
        club_id: 'club123',
        title: 'Weekly Training Session',
        description: 'First practice session of the week.',
        schedule_type: 'regular',
        location: 'Hall A',
        start_time: '2026-07-06T18:00:00.000Z',
        end_time: '2026-07-06T20:00:00.000Z',
        semester_id: 'sem1',
        status: 'completed',
        created_by: 'user1',
        createdAt: '2026-07-01T00:00:00.000Z',
        attendance_records: [
          {
            _id: 'att1',
            student_id: {
              _id: 'stu1',
              full_name: 'John Doe',
              student_code: 'SV123',
            },
            status: 'present',
            check_in_time: '2026-07-06T18:05:00.000Z',
            approval_status: 'approved',
            recorded_at: '2026-07-06T18:05:00.000Z',
            note: 'On time',
          },
        ],
      },
      {
        _id: 's2',
        club_id: 'club123',
        title: 'Strategy Meeting',
        description: 'Monthly schedule planning.',
        schedule_type: 'meeting',
        location: 'Room 102',
        start_time: '2026-07-07T18:00:00.000Z',
        end_time: '2026-07-07T20:00:00.000Z',
        semester_id: 'sem1',
        status: 'cancelled',
        created_by: 'user1',
        createdAt: '2026-07-01T00:00:00.000Z',
        attendance_records: [],
      },
    ],
  };

  it('renders student mode correctly with title, details, and personal badges', () => {
    render(<ClubScheduleTimeline data={studentData} />);

    // Titles
    expect(screen.getByText('Weekly Training Session')).toBeInTheDocument();
    expect(screen.getByText('Strategy Meeting')).toBeInTheDocument();

    // Badges
    expect(screen.getByText('Đã hoàn thành')).toBeInTheDocument();
    expect(screen.getByText('Đã lên lịch')).toBeInTheDocument();

    // Attendance State
    expect(screen.getByText('Có mặt')).toBeInTheDocument();
    expect(screen.getByText('Đã duyệt')).toBeInTheDocument();
    expect(screen.getByText('Chưa điểm danh')).toBeInTheDocument();

    // Privacy verification: no expand buttons and no other student names
    expect(screen.queryByText('Chi tiết (1)')).not.toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('renders staff mode with expand/collapse buttons and toggles details correctly', () => {
    render(<ClubScheduleTimeline data={staffData} />);

    expect(screen.getByText('Weekly Training Session')).toBeInTheDocument();
    expect(screen.getByText('Đã hủy')).toBeInTheDocument();

    // Check that attendance details are hidden by default
    expect(screen.queryByText('DANH SÁCH ĐIỂM DANH:')).not.toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();

    // Expand first schedule
    const expandButtons = screen.getAllByRole('button', { name: /Toggle details view/i });
    fireEvent.click(expandButtons[0]);

    // Verify expanded details
    expect(screen.getByText('DANH SÁCH ĐIỂM DANH:')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('SV123')).toBeInTheDocument();
    expect(screen.getByText('Note: On time')).toBeInTheDocument();
    expect(screen.getAllByText('Có mặt').length).toBeGreaterThan(0);

    // Expand second schedule (empty list)
    fireEvent.click(expandButtons[1]);
    expect(screen.getByText('Không có dữ liệu điểm danh')).toBeInTheDocument();
  });

  it('renders empty list state gracefully', () => {
    const emptyData: ClubTimelineResponse = {
      viewer_mode: 'student',
      items: [],
    };
    render(<ClubScheduleTimeline data={emptyData} />);
    expect(screen.getByText('Chưa có lịch sinh hoạt nào được lên kế hoạch')).toBeInTheDocument();
  });
});
