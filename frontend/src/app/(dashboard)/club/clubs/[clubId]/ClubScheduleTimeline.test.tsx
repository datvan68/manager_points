import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ClubScheduleTimeline from './ClubScheduleTimeline';
import { ClubTimelineResponse } from '@/api/club-api';

describe('ClubScheduleTimeline Component', () => {
  const studentData: ClubTimelineResponse = {
    viewer_mode: 'student',
    timezone: 'Asia/Ho_Chi_Minh',
    week_start: '2026-07-06T00:00:00.000Z',
    week_end: '2026-07-13T00:00:00.000Z',
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
        is_today: true,
        is_active: false,
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
        is_today: false,
        is_active: false,
        my_attendance: null,
      },
    ],
  };

  const staffData: ClubTimelineResponse = {
    viewer_mode: 'staff',
    timezone: 'Asia/Ho_Chi_Minh',
    week_start: '2026-07-06T00:00:00.000Z',
    week_end: '2026-07-13T00:00:00.000Z',
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
        is_today: true,
        is_active: false,
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
        is_today: false,
        is_active: false,
        attendance_records: [],
      },
    ],
  };

  it('renders student mode correctly with today and weekly sections', () => {
    render(<ClubScheduleTimeline data={studentData} />);

    // Section headers
    expect(screen.getByText("Lịch hôm nay")).toBeInTheDocument();
    expect(screen.getByText('Lịch tuần này')).toBeInTheDocument();

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
  });

  it('renders active schedules with Happening now badge', () => {
    const activeData: ClubTimelineResponse = {
      viewer_mode: 'student',
      timezone: 'Asia/Ho_Chi_Minh',
      week_start: '2026-07-06T00:00:00.000Z',
      week_end: '2026-07-13T00:00:00.000Z',
      items: [
        {
          _id: 's3',
          club_id: 'club123',
          title: 'Active Session',
          schedule_type: 'regular',
          start_time: '2026-07-06T18:00:00.000Z',
          end_time: '2026-07-06T20:00:00.000Z',
          semester_id: 'sem1',
          status: 'ongoing',
          created_by: 'user1',
          createdAt: '2026-07-01T00:00:00.000Z',
          is_today: true,
          is_active: true,
          my_attendance: null,
        },
      ],
    };

    render(<ClubScheduleTimeline data={activeData} />);
    expect(screen.getByText('Happening now')).toBeInTheDocument();
  });

  it('renders No club schedules today inside today section when there are no today items', () => {
    const noTodayData: ClubTimelineResponse = {
      viewer_mode: 'student',
      timezone: 'Asia/Ho_Chi_Minh',
      week_start: '2026-07-06T00:00:00.000Z',
      week_end: '2026-07-13T00:00:00.000Z',
      items: [
        {
          _id: 's4',
          club_id: 'club123',
          title: 'Later This Week Session',
          schedule_type: 'regular',
          start_time: '2026-07-07T18:00:00.000Z',
          end_time: '2026-07-07T20:00:00.000Z',
          semester_id: 'sem1',
          status: 'scheduled',
          created_by: 'user1',
          createdAt: '2026-07-01T00:00:00.000Z',
          is_today: false,
          is_active: false,
          my_attendance: null,
        },
      ],
    };

    render(<ClubScheduleTimeline data={noTodayData} />);
    expect(screen.getByText('No club schedules today')).toBeInTheDocument();
    expect(screen.getByText('Later This Week Session')).toBeInTheDocument();
  });

  it('renders empty list state with No club schedules this week', () => {
    const emptyData: ClubTimelineResponse = {
      viewer_mode: 'student',
      timezone: 'Asia/Ho_Chi_Minh',
      week_start: '2026-07-06T00:00:00.000Z',
      week_end: '2026-07-13T00:00:00.000Z',
      items: [],
    };
    render(<ClubScheduleTimeline data={emptyData} />);
    expect(screen.getByText('No club schedules this week')).toBeInTheDocument();
  });
});
