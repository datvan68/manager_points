import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockReplace = vi.fn();
const mockSearchParamsGet = vi.fn().mockReturnValue(null);

// 1. Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
  }),
  useParams: () => ({
    activityId: 'act1',
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParamsGet(key),
  }),
}));


const mockAuth = {
  user: {
    id: 'user1',
    studentId: 'student1',
    role: { role_code: 'TEACHER' },
    roleCode: 'TEACHER',
  } as any,
  isAdmin: true,
};

// 2. Mock Auth Provider
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: mockAuth.user,
    isLoading: false,
  }),
  isAdminUser: () => mockAuth.isAdmin,
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
    uploadMedia: vi.fn(),
    update: vi.fn(),
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

vi.mock('@/api/semester-api', () => ({
  semesterApi: {
    getSemesters: vi.fn().mockResolvedValue([]),
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
import { criteriaApi } from '@/api/criteria-api';
import { semesterApi } from '@/api/semester-api';
import ActivityDetailPage from './page';

describe('ActivityDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = {
      id: 'user1',
      studentId: 'student1',
      role: { role_code: 'TEACHER' },
      roleCode: 'TEACHER',
    };
    mockAuth.isAdmin = true;
    mockSearchParamsGet.mockReturnValue(null);
    vi.mocked(semesterApi.getSemesters).mockResolvedValue([]);
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

  it('navigates to attendance tab when a valid user clicks the attendance button on a today schedule', async () => {
    // Switch to Schedule tab click
    // 1. Setup mock activity, schedules (including today)
    const mockActivity = {
      _id: 'act1',
      name: 'Active Student Event',
      code: 'STUDENT_EVENT',
      activity_type: 'event',
      participation_status: 'published',
      classroom: 'B.202',
      advisor_id: { full_name: 'Jane Doe' },
      semester_id: { _id: 'sem1', semester_name: 'Học kỳ 1' },
      createdAt: '2026-07-10T00:00:00Z',
      updatedAt: '2026-07-10T00:00:00Z',
    };

    const mockSchedules = {
      viewer_mode: 'student',
      items: [
        {
          _id: 'sched1',
          title: 'Weekly Sync Meeting',
          start_time: '2026-07-14T09:00:00Z',
          end_time: '2026-07-14T10:00:00Z',
          location: 'Zoom',
          status: 'published',
          semester_id: 'sem1',
          created_by: 'user1',
          createdAt: '2026-07-10T00:00:00Z',
          is_today: true,
        },
        {
          _id: 'sched2',
          title: 'Past Week Sync',
          start_time: '2026-07-08T09:00:00Z',
          end_time: '2026-07-08T10:00:00Z',
          location: 'Room 101',
          status: 'published',
          semester_id: 'sem1',
          created_by: 'user1',
          createdAt: '2026-07-10T00:00:00Z',
        },
        {
          _id: 'sched3',
          title: 'Future Week Sync',
          start_time: '2026-07-22T09:00:00Z',
          end_time: '2026-07-22T10:00:00Z',
          location: 'Room 102',
          status: 'published',
          semester_id: 'sem1',
          created_by: 'user1',
          createdAt: '2026-07-10T00:00:00Z',
        }
      ],
      timezone: 'Asia/Ho_Chi_Minh',
    };

    vi.mocked(activityApi.getById).mockResolvedValue(mockActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue(mockSchedules as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);

    render(<ActivityDetailPage />);

    // Wait for timeline API call to complete
    await waitFor(() => {
      expect(activityScheduleApi.getActivityTimeline).toHaveBeenCalledWith('act1');
    });

    // The schedule is rendered with the information panel.
    let attendanceBtn: HTMLElement | null = null;
    await waitFor(() => {
      expect(screen.getByText('Lịch trình & dòng thời gian')).toBeInTheDocument();
      expect(screen.getByText('Weekly Sync Meeting')).toBeInTheDocument();
      const card = screen.getByText('Weekly Sync Meeting').closest('.group') as HTMLElement | null;
      attendanceBtn = within(card as HTMLElement).getAllByRole('button')[1] as HTMLElement;
      expect(attendanceBtn).toBeInTheDocument();
    });

    // Click the attendance button
    fireEvent.click(attendanceBtn!);

    // Expect replace called with tab=attendance
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('tab=attendance'));
  });

  it('does not show attendance button for an invalid user (not active member/not admin)', async () => {
    // 1. Setup mock user is a student role, but NOT active member (status pending)
    mockAuth.user = {
      id: 'user-student',
      studentId: 'student-123',
      role: { role_code: 'STUDENT' },
      roleCode: 'STUDENT',
    };
    mockAuth.isAdmin = false;

    const mockMembers = [
      {
        _id: 'member-1',
        student_id: { _id: 'student-123', user_id: 'user-student' },
        status: 'pending',
      }
    ];

    const mockActivity = {
      _id: 'act1',
      name: 'Pending Student Event',
      code: 'STUDENT_EVENT',
      activity_type: 'event',
      participation_status: 'published',
      classroom: 'B.202',
      advisor_id: { full_name: 'Jane Doe' },
      semester_id: { _id: 'sem1', semester_name: 'Học kỳ 1' },
    };

    const mockSchedules = {
      viewer_mode: 'student',
      items: [
        {
          _id: 'sched1',
          title: 'Weekly Sync Meeting',
          start_time: '2026-07-14T09:00:00Z',
          end_time: '2026-07-14T10:00:00Z',
          location: 'Zoom',
          status: 'published',
          semester_id: 'sem1',
          created_by: 'user1',
          createdAt: '2026-07-10T00:00:00Z',
          is_today: true,
        },
        {
          _id: 'sched2',
          title: 'Past Week Sync',
          start_time: '2026-07-08T09:00:00Z',
          end_time: '2026-07-08T10:00:00Z',
          location: 'Room 101',
          status: 'published',
          semester_id: 'sem1',
          created_by: 'user1',
          createdAt: '2026-07-10T00:00:00Z',
        },
        {
          _id: 'sched3',
          title: 'Future Week Sync',
          start_time: '2026-07-22T09:00:00Z',
          end_time: '2026-07-22T10:00:00Z',
          location: 'Room 102',
          status: 'published',
          semester_id: 'sem1',
          created_by: 'user1',
          createdAt: '2026-07-10T00:00:00Z',
        }
      ],
      timezone: 'Asia/Ho_Chi_Minh',
    };

    vi.mocked(activityApi.getById).mockResolvedValue(mockActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue(mockMembers as any);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue(mockSchedules as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);

    render(<ActivityDetailPage />);

    // Wait for timeline API call to complete
    await waitFor(() => {
      expect(activityScheduleApi.getActivityTimeline).toHaveBeenCalledWith('act1');
    });

    // Wait for timeline to render but attendance button must NOT appear.
    await waitFor(() => {
      expect(screen.getByText('Weekly Sync Meeting')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Điểm danh' })).not.toBeInTheDocument();
    });
  });

  it('updates URL search parameters when tab is changed', async () => {
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
    });

    const membersTab = screen.getByText('Thành viên (0)');
    fireEvent.click(membersTab);

    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('tab=members'));
  });

  it('calls activityScheduleApi.getActivityTimeline with route ID and displays schedules with general information', async () => {
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

    const mockSchedules = {
      viewer_mode: 'student',
      items: [
        {
          _id: 'sched2',
          title: 'Past Week Sync',
          start_time: '2026-07-08T09:00:00Z',
          end_time: '2026-07-08T10:00:00Z',
          location: 'Room 101',
          status: 'published',
          semester_id: 'sem1',
          created_by: 'user1',
          createdAt: '2026-07-10T00:00:00Z',
        },
        {
          _id: 'sched1',
          title: 'Weekly Sync Meeting',
          start_time: '2026-07-15T09:00:00Z',
          end_time: '2026-07-15T10:00:00Z',
          location: 'Zoom',
          status: 'published',
          semester_id: 'sem1',
          created_by: 'user1',
          createdAt: '2026-07-10T00:00:00Z',
        },
        {
          _id: 'sched3',
          title: 'Future Week Sync',
          start_time: '2026-07-22T09:00:00Z',
          end_time: '2026-07-22T10:00:00Z',
          location: 'Room 102',
          status: 'published',
          semester_id: 'sem1',
          created_by: 'user1',
          createdAt: '2026-07-10T00:00:00Z',
        }
      ],
      timezone: 'Asia/Ho_Chi_Minh',
    };

    vi.mocked(activityApi.getById).mockResolvedValue(mockActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue(mockSchedules as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);

    render(<ActivityDetailPage />);

    await waitFor(() => {
      expect(activityScheduleApi.getActivityTimeline).toHaveBeenCalledWith('act1');
    });

    await waitFor(() => {
      // Assert visibility of earliest and latest schedule titles
      expect(screen.getByText('Past Week Sync')).toBeInTheDocument();
      expect(screen.getByText('Room 101')).toBeInTheDocument();
      expect(screen.getByText('Weekly Sync Meeting')).toBeInTheDocument();
      expect(screen.getByText('Zoom')).toBeInTheDocument();
      expect(screen.getByText('Future Week Sync')).toBeInTheDocument();
      expect(screen.getByText('Room 102')).toBeInTheDocument();
    });
  });

  it('renders a completion rule whose populated activity_id matches the route activity and semester', async () => {
    const mockActivity = {
      _id: 'act1',
      name: 'Dynamic Event Activity',
      code: 'DYNAMIC_EVENT',
      activity_type: 'event',
      participation_status: 'published',
      classroom: 'B.202',
      advisor_id: { full_name: 'Jane Doe' },
      semester_id: { _id: 'sem1', semester_name: 'Semester 1' },
      createdAt: '2026-07-10T00:00:00Z',
      updatedAt: '2026-07-10T00:00:00Z',
    };

    const matchingRule = {
      _id: 'rule-match',
      activity_id: { _id: 'act1', name: 'Dynamic Event Activity' },
      semester_id: { _id: 'sem1', semester_name: 'Semester 1' },
      minimum_attendance: 4,
      criterion_ids: [{ _id: 'crit-1' }],
      status: 'active' as const,
    };

    const wrongActivityRule = {
      _id: 'rule-other-activity',
      activity_id: { _id: 'act-other', name: 'Other Activity' },
      semester_id: { _id: 'sem1', semester_name: 'Semester 1' },
      minimum_attendance: 9,
      criterion_ids: [{ _id: 'crit-2', criterion_name: 'Other Criterion' }],
      status: 'active',
    };

    vi.mocked(activityApi.getById).mockResolvedValue(mockActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue({ items: [] } as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([wrongActivityRule, matchingRule] as any);
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue([
      { _id: 'crit-1', criterion_name: 'Community Service', criterion_code: 'COMMUNITY', max_score: 10 },
    ] as any);

    render(<ActivityDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Dynamic Event Activity')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button').find((button) => button.textContent?.includes('Quy'))!);

    await waitFor(() => {
      expect(document.body.textContent).toContain('4');
      expect(screen.getByText('Community Service')).toBeInTheDocument();
      expect(screen.queryByText('crit-1')).not.toBeInTheDocument();
      expect(screen.queryByText('Other Criterion')).not.toBeInTheDocument();
    });
  });

  it('completion rule configuration flow - handles creation when no rule exists', async () => {
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

    const mockCriteria = [
      { _id: 'crit-1', criterion_name: 'Tiêu chí 1', criterion_code: 'CRIT1', max_score: 10 }
    ];

    vi.mocked(activityApi.getById).mockResolvedValue(mockActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue({ items: [] } as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue(mockCriteria as any);
    vi.mocked(activityCompletionRuleApi.create).mockResolvedValue({} as any);

    render(<ActivityDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Cấu hình quy tắc hoàn thành')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cấu hình quy tắc hoàn thành'));

    await waitFor(() => {
      expect(screen.getByText('Tiêu chí 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tiêu chí 1'));

    const submitBtn = screen.getByRole('button', { name: 'Lưu cấu hình quy tắc' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(activityCompletionRuleApi.create).toHaveBeenCalledWith({
        activity_id: 'act1',
        semester_id: 'sem1',
        minimum_attendance: 3,
        criterion_ids: ['crit-1'],
        status: 'active',
      });
    });
  });

  it('completion rule configuration flow - handles update when rule exists', async () => {
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

    const mockRule = {
      _id: 'rule-123',
      activity_id: 'act1',
      semester_id: 'sem1',
      minimum_attendance: 5,
      criterion_ids: ['crit-1'],
      status: 'active' as const,
    };

    const mockCriteria = [
      { _id: 'crit-1', criterion_name: 'Tiêu chí 1', criterion_code: 'CRIT1', max_score: 10 }
    ];

    vi.mocked(activityApi.getById).mockResolvedValue(mockActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue({ items: [] } as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([mockRule]);
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue(mockCriteria as any);
    vi.mocked(activityCompletionRuleApi.update).mockResolvedValue({} as any);

    render(<ActivityDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Cấu hình quy tắc hoàn thành')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cấu hình quy tắc hoàn thành'));

    await waitFor(() => {
      expect(screen.getAllByText('Tiêu chí 1').length).toBeGreaterThan(0);
    });

    const submitBtn = screen.getByRole('button', { name: 'Lưu cấu hình quy tắc' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(activityCompletionRuleApi.update).toHaveBeenCalledWith('rule-123', {
        activity_id: 'act1',
        semester_id: 'sem1',
        minimum_attendance: 5,
        criterion_ids: ['crit-1'],
        status: 'active',
      });
    });
  });

  it('page-level tests: consumes student API payload and shows student status without leaking other rosters', async () => {
    mockAuth.user = {
      id: 'student-id-123',
      studentId: 'student-id-123',
      role: { role_code: 'STUDENT' },
      roleCode: 'STUDENT',
    };
    mockAuth.isAdmin = false;

    const mockActivity = {
      _id: 'act1',
      name: 'Test Activity',
      code: 'TEST_ACT',
      activity_type: 'event',
      participation_status: 'published',
      classroom: 'B.202',
      semester_id: { _id: 'sem1', semester_name: 'Học kỳ 1' },
    };

    const studentMembership = [
      {
        student_id: { _id: 'student-id-123', user_id: 'student-id-123' },
        status: 'active',
      }
    ];

    const mockStudentTimeline = {
      viewer_mode: 'student',
      items: [
        {
          _id: 's_1',
          title: 'Timeline Session 1',
          start_time: '2026-07-14T09:00:00Z',
          end_time: '2026-07-14T10:00:00Z',
          my_attendance: { status: 'present' },
          is_today: true,
        }
      ],
      timezone: 'Asia/Ho_Chi_Minh'
    };

    vi.mocked(activityApi.getById).mockResolvedValue(mockActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue(studentMembership as any);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue(mockStudentTimeline as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);

    render(<ActivityDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Activity')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Timeline Session 1')).toBeInTheDocument();
      expect(screen.getByText('Trạng thái điểm danh:')).toBeInTheDocument();
      expect(screen.getByText('Có mặt')).toBeInTheDocument();
      expect(screen.queryByText('Đã điểm danh:')).not.toBeInTheDocument();
    });
  });

  it('page-level tests: consumes staff API payload and shows roster details to advisor accounts', async () => {
    mockAuth.user = {
      id: 'advisor-id-123',
      role: { role_code: 'TEACHER' },
      roleCode: 'TEACHER',
    };
    mockAuth.isAdmin = false;

    const mockActivity = {
      _id: 'act1',
      name: 'Test Activity',
      code: 'TEST_ACT',
      activity_type: 'event',
      participation_status: 'published',
      classroom: 'B.202',
      semester_id: { _id: 'sem1', semester_name: 'Học kỳ 1' },
    };

    const mockStaffTimeline = {
      viewer_mode: 'staff',
      items: [
        {
          _id: 's_1',
          title: 'Timeline Session 1',
          start_time: '2026-07-14T09:00:00Z',
          end_time: '2026-07-14T10:00:00Z',
          attendance_records: [
            {
              _id: 'rec_1',
              student_id: { _id: 'std_1', full_name: 'Bob Johnson', student_code: 'SV001' },
              status: 'present',
              approval_status: 'approved',
            }
          ],
          is_today: true,
        }
      ],
      timezone: 'Asia/Ho_Chi_Minh'
    };

    vi.mocked(activityApi.getById).mockResolvedValue(mockActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue(mockStaffTimeline as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);

    render(<ActivityDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Activity')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Timeline Session 1')).toBeInTheDocument();
      expect(screen.queryByText('Trạng thái điểm danh:')).not.toBeInTheDocument();
      expect(screen.getByText('Đã điểm danh: 1')).toBeInTheDocument();
    });
  });


  it('uses the active semester from semesterApi instead of activity.semester_id', async () => {
    const mockActivity = {
      _id: 'act1',
      name: 'Semester Source Activity',
      code: 'SEM_SOURCE',
      activity_type: 'event',
      participation_status: 'published',
      classroom: 'B.202',
      advisor_id: { full_name: 'Jane Doe' },
      semester_id: 'sem-old',
    };

    vi.mocked(activityApi.getById).mockResolvedValue(mockActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue({ items: [] } as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);
    vi.mocked(semesterApi.getSemesters).mockResolvedValue([
      { _id: 'sem-future', semester_name: 'Semester Future', status: 'upcoming' },
      { _id: 'sem-active', semester_name: 'Semester Active', status: 'active' },
      { _id: 'sem-old', semester_name: 'Semester Old', status: 'inactive' },
    ] as any);

    render(<ActivityDetailPage />);

    await waitFor(() => {
      expect(semesterApi.getSemesters).toHaveBeenCalled();
      expect(document.body.textContent).toContain('Semester Active');
    });
  });

  it('renders em dash when no active semester exists', async () => {
    const mockActivity = {
      _id: 'act1',
      name: 'No Active Semester Activity',
      code: 'NO_ACTIVE',
      activity_type: 'event',
      participation_status: 'published',
      classroom: 'B.202',
      advisor_id: { full_name: 'Jane Doe' },
      semester_id: { _id: 'sem-old', semester_name: 'Semester Old' },
    };

    vi.mocked(activityApi.getById).mockResolvedValue(mockActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue({ items: [] } as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);
    vi.mocked(semesterApi.getSemesters).mockResolvedValue([
      { _id: 'sem-old', semester_name: 'Semester Old', status: 'inactive' },
      { _id: 'sem-next', semester_name: 'Semester Next', status: 'upcoming' },
    ] as any);

    render(<ActivityDetailPage />);

    await waitFor(() => {
      expect(document.body.textContent).toContain('\u2014');
    });
  });

  it('displays each schedule location before falling back to activity classroom in the combined view', async () => {
    const mockActivity = {
      _id: 'act1',
      name: 'Schedule Location Activity',
      code: 'SCHEDULE_ROOM',
      activity_type: 'event',
      participation_status: 'published',
      classroom: 'Default Room',
      advisor_id: { full_name: 'Jane Doe' },
      semester_id: { _id: 'sem1', semester_name: 'Semester 1' },
    };

    vi.mocked(activityApi.getById).mockResolvedValue(mockActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue({
      items: [
        {
          _id: 'sched-1',
          title: 'Has Specific Room',
          start_time: '2026-07-14T09:00:00Z',
          end_time: '2026-07-14T10:00:00Z',
          location: 'Room 701',
        },
        {
          _id: 'sched-2',
          title: 'Uses Default Room',
          start_time: '2026-07-14T11:00:00Z',
          end_time: '2026-07-14T12:00:00Z',
          location: '',
        },
      ],
    } as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);
    vi.mocked(semesterApi.getSemesters).mockResolvedValue([
      { _id: 'sem1', semester_name: 'Semester 1', status: 'active' },
    ] as any);

    render(<ActivityDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Schedule Location Activity')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Has Specific Room')).toBeInTheDocument();
      expect(screen.getByText('Room 701')).toBeInTheDocument();
      expect(screen.getByText('Uses Default Room')).toBeInTheDocument();
      expect(screen.getByText('Default Room')).toBeInTheDocument();
    });
  });

  it('normalizes relative logo URLs and renders the image without cropping', async () => {
    const mockActivity = {
      _id: 'act1',
      name: 'Logo Activity',
      code: 'LOGO_ACTIVITY',
      activity_type: 'event',
      participation_status: 'published',
      classroom: 'A.101',
      logo_url: '/uploads/logo.png',
      advisor_id: { full_name: 'Jane Doe' },
      semester_id: { _id: 'sem1', name: 'Semester 1' },
      settings: {},
      createdAt: '2026-07-10T00:00:00Z',
      updatedAt: '2026-07-10T00:00:00Z',
    };

    vi.mocked(activityApi.getById).mockResolvedValue(mockActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue({ items: [] } as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);

    render(<ActivityDetailPage />);

    await waitFor(() => {
      const image = screen.getByRole('img', { name: 'Logo Activity' });
      expect(image).toHaveAttribute('src', expect.stringContaining('/uploads/logo.png'));
      expect(image).toHaveClass('object-contain', 'object-center');
    });

    fireEvent.error(screen.getByRole('img', { name: 'Logo Activity' }));

    await waitFor(() => expect(screen.getByText('LO')).toBeInTheDocument());
  });

  it.each(['none', 'pending', 'rejected', 'inactive', 'left'])(
    'keeps the combined detail visible and hides attendance for a %s membership',
    async (status) => {
      mockAuth.user = {
        id: 'student-user',
        studentId: 'student-1',
        role: { role_code: 'STUDENT' },
        roleCode: 'STUDENT',
      };
      mockAuth.isAdmin = false;
      mockSearchParamsGet.mockReturnValue('attendance');
      vi.mocked(activityApi.getById).mockResolvedValue({
        _id: 'act1', name: 'Combined Activity', code: 'COMBINED', activity_type: 'event',
        participation_status: 'published', classroom: 'A.101', semester_id: { _id: 'sem1' },
      } as any);
      vi.mocked(activityApi.getMembers).mockResolvedValue(status === 'none' ? [] : [{
        student_id: { _id: 'student-1', user_id: 'student-user' }, status,
      }] as any);
      vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue({ items: [{
        _id: 'schedule-1', title: 'Visible Schedule', start_time: '2026-07-14T09:00:00Z', end_time: '2026-07-14T10:00:00Z',
      }] } as any);
      vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);

      render(<ActivityDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Combined Activity')).toBeInTheDocument();
        expect(screen.getByText('Visible Schedule')).toBeInTheDocument();
        expect(screen.queryByText('Điểm danh')).not.toBeInTheDocument();
        expect(screen.queryByText('Trạng thái điểm danh:')).not.toBeInTheDocument();
      });
    },
  );

  it('shows the combined view for the legacy schedule query', async () => {
    mockSearchParamsGet.mockReturnValue('schedule');
    vi.mocked(activityApi.getById).mockResolvedValue({
      _id: 'act1', name: 'Legacy Schedule Activity', code: 'LEGACY', activity_type: 'event',
      participation_status: 'published', classroom: 'A.101', semester_id: { _id: 'sem1' },
    } as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue({ items: [{
      _id: 'schedule-1', title: 'Legacy Schedule Entry', start_time: '2026-07-14T09:00:00Z', end_time: '2026-07-14T10:00:00Z',
    }] } as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);

    render(<ActivityDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Giới thiệu hoạt động')).toBeInTheDocument();
      expect(screen.getByText('Legacy Schedule Entry')).toBeInTheDocument();
    });
  });

  it('removes a custom logo and restores the activity-code fallback', async () => {
    const mockActivity = {
      _id: 'act1',
      name: 'Removable Logo Activity',
      code: 'REMOVE_ACTIVITY',
      activity_type: 'event',
      participation_status: 'published',
      classroom: 'A.101',
      logo_url: '/uploads/logo.png',
      advisor_id: { full_name: 'Jane Doe' },
      semester_id: { _id: 'sem1', name: 'Semester 1' },
      settings: {},
      createdAt: '2026-07-10T00:00:00Z',
      updatedAt: '2026-07-10T00:00:00Z',
    };
    const fallbackActivity = { ...mockActivity, logo_url: '' };
    vi.mocked(activityApi.getById).mockResolvedValueOnce(mockActivity as any).mockResolvedValue(fallbackActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue({ items: [] } as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);
    vi.mocked(activityApi.update).mockResolvedValue(fallbackActivity as any);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ActivityDetailPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Xóa logo' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Xóa logo' }));

    await waitFor(() => {
      expect(activityApi.update).toHaveBeenCalledWith('act1', { logo_url: '' });
      expect(screen.getByText('RE')).toBeInTheDocument();
    });
  });

  it('does not render the removed administrator metadata card', async () => {
    const mockActivity = {
      _id: 'act1',
      name: 'Administrator Activity',
      code: 'ADMIN_ACTIVITY',
      activity_type: 'club',
      participation_status: 'published',
      category: 'academic',
      classroom: 'C.303',
      founded_date: '2026-01-01T00:00:00Z',
      activity_start_date: '2026-02-01T00:00:00Z',
      activity_end_date: '2026-06-01T00:00:00Z',
      advisor_id: { full_name: 'Advisor Name', email: 'advisor@example.com' },
      president_id: { full_name: 'President Name' },
      vice_president_ids: [{ full_name: 'Vice President Name' }],
      semester_id: { _id: 'sem1', name: 'Semester 1' },
      active_members_count: 12,
      max_members: 30,
      settings: {
        allow_self_registration: true,
        require_approval: true,
        attendance_point_enabled: true,
        point_per_attendance: 2,
        criterion_id: 'criterion-1',
      },
      createdAt: '2026-07-10T00:00:00Z',
      updatedAt: '2026-07-10T00:00:00Z',
    };
    vi.mocked(activityApi.getById).mockResolvedValue(mockActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue({ items: [] } as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([{
      _id: 'rule-1',
      activity_id: 'act1',
      semester_id: 'sem1',
      minimum_attendance: 3,
      criterion_ids: ['criterion-1'],
      status: 'active',
    }] as any);
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue([{ _id: 'criterion-1', criterion_name: 'Leadership' }] as any);

    render(<ActivityDetailPage />);

    await waitFor(() => {
      expect(screen.queryByText('Thông tin đầy đủ dành cho quản trị viên')).not.toBeInTheDocument();
      expect(screen.getByText('Chi tiết hoạt động')).toBeInTheDocument();
    });
  });

  it('does not expose administrator metadata or logo controls to unauthorized users', async () => {
    mockAuth.isAdmin = false;
    mockAuth.user = { id: 'student-user', studentId: 'student1', role: { role_code: 'STUDENT' }, roleCode: 'STUDENT' } as any;
    const mockActivity = {
      _id: 'act1',
      name: 'Student Activity',
      code: 'STUDENT_ACTIVITY',
      activity_type: 'event',
      participation_status: 'published',
      classroom: 'A.101',
      logo_url: '/uploads/logo.png',
      advisor_id: { full_name: 'Jane Doe' },
      semester_id: { _id: 'sem1', name: 'Semester 1' },
      settings: {},
      createdAt: '2026-07-10T00:00:00Z',
      updatedAt: '2026-07-10T00:00:00Z',
    };
    vi.mocked(activityApi.getById).mockResolvedValue(mockActivity as any);
    vi.mocked(activityApi.getMembers).mockResolvedValue([]);
    vi.mocked(activityScheduleApi.getActivityTimeline).mockResolvedValue({ items: [] } as any);
    vi.mocked(activityCompletionRuleApi.getAll).mockResolvedValue([]);

    render(<ActivityDetailPage />);

    await waitFor(() => {
      expect(screen.queryByText('Thông tin đầy đủ dành cho quản trị viên')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Xóa logo' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cập nhật logo' })).not.toBeInTheDocument();
    });
  });
});
