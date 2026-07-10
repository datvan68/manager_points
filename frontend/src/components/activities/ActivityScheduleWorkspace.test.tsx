import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ActivityScheduleWorkspace from './ActivityScheduleWorkspace';
import { activityApi, activityScheduleApi } from '@/api/activity-api';
import { semesterApi } from '@/api/semester-api';

vi.mock('@/api/activity-api', () => ({
  activityApi: {
    getAll: vi.fn(),
  },
  activityScheduleApi: {
    getAll: vi.fn(),
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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ActivityScheduleWorkspace', () => {
  const mockActivities = [
    { _id: 'act1', name: 'Academic Club', code: 'AC_CLUB', category: 'academic' },
  ];

  const mockSemesters = [
    { _id: 'sem1', semester_name: 'Semester 1', start_date: '2026-01-01', end_date: '2026-06-30', status: 'active' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(activityApi.getAll).mockResolvedValue(mockActivities as any);
    vi.mocked(semesterApi.getSemesters).mockResolvedValue(mockSemesters as any);
    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: [], total: 0 });
  });

  it('renders dropdown filters and week headers correctly', async () => {
    render(<ActivityScheduleWorkspace initialActivityId="act1" />);

    await waitFor(() => {
      expect(screen.getByText('Hiện tại')).toBeInTheDocument();
    });
  });

  it('does NOT render Activity and Semester selectors on toolbar', async () => {
    render(<ActivityScheduleWorkspace initialActivityId="act1" />);

    await waitFor(() => {
      expect(screen.queryByText('Chọn Hoạt động')).not.toBeInTheDocument();
      expect(screen.queryByText('Học kỳ')).not.toBeInTheDocument();
    });
  });

  it('automatically opens create schedule dialog when openCreateOnLoad is true', async () => {
    render(<ActivityScheduleWorkspace initialActivityId="act1" openCreateOnLoad={true} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ví dụ: Sinh hoạt định kỳ tuần 12')).toBeInTheDocument();
    });
  });

  it('handles week navigation correctly', async () => {
    render(<ActivityScheduleWorkspace initialActivityId="act1" />);

    await waitFor(() => {
      expect(screen.getByText('Hiện tại')).toBeInTheDocument();
    });

    const currentBtn = screen.getByText('Hiện tại');
    const nextBtn = currentBtn.nextElementSibling;
    if (nextBtn) {
      fireEvent.click(nextBtn);
    }

    // Navigation updates dates range header
    expect(screen.getByText(/Tuần \+1/)).toBeInTheDocument();
  });

  it('submits recurring weekly schedule payload matching api schema', async () => {
    vi.mocked(activityScheduleApi.create).mockResolvedValue({ _id: 'new-sched-id' } as any);

    const { container } = render(<ActivityScheduleWorkspace initialActivityId="act1" openCreateOnLoad={true} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ví dụ: Sinh hoạt định kỳ tuần 12')).toBeInTheDocument();
    });

    // Prefill required fields
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Sinh hoạt định kỳ tuần 12'), { target: { value: 'Weekly Meeting' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Phòng máy B.202'), { target: { value: 'Room 303' } });

    const dateInput = container.querySelector('input[type="date"]');
    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: '2026-05-15' } });
    }

    // Enable recurrence checkbox
    const recurrenceCheckbox = screen.getByRole('checkbox');
    fireEvent.click(recurrenceCheckbox);

    // Submit form
    const submitBtn = screen.getByText('Xác Nhận');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(activityScheduleApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Weekly Meeting',
          location: 'Room 303',
          recurrence: expect.objectContaining({
            type: 'weekly',
            until: expect.any(String),
          }),
        })
      );
    });
  });

  it('renders activities palette on the left side', async () => {
    render(<ActivityScheduleWorkspace initialActivityId="act1" />);
    await waitFor(() => {
      expect(screen.getByText('Kéo hoạt động xếp lịch')).toBeInTheDocument();
      expect(screen.getByText('Academic Club')).toBeInTheDocument();
    });
  });

  it('triggers advanced recurrence configuration modal', async () => {
    const today = new Date();
    const startStr = today.toISOString();
    const endStr = new Date(today.getTime() + 7200000).toISOString();

    const mockWeekSchedules: any[] = [
      {
        _id: 'sched1',
        title: 'Meeting 1',
        start_time: startStr,
        end_time: endStr,
        club_id: 'act1',
        semester_id: 'sem1'
      }
    ];
    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockWeekSchedules, total: 1 });

    render(<ActivityScheduleWorkspace initialActivityId="act1" />);
    await waitFor(() => {
      expect(screen.getByText('Meeting 1')).toBeInTheDocument();
    });

    // Click config recurrence button
    const recurrenceBtn = screen.getByText('Cấu hình chuỗi lặp');
    fireEvent.click(recurrenceBtn);

    // Modal title should appear
    await waitFor(() => {
      expect(screen.getByText('Cấu hình chuỗi lịch lặp lại')).toBeInTheDocument();
    });
  });

  it('calls cancelRecurrence API successfully when stopping series', async () => {
    const today = new Date();
    const startStr = today.toISOString();
    const endStr = new Date(today.getTime() + 7200000).toISOString();

    const mockWeekSchedules: any[] = [
      {
        _id: 'sched-rec-1',
        title: 'Recurring Meeting',
        start_time: startStr,
        end_time: endStr,
        club_id: 'act1',
        semester_id: 'sem1',
        recurrence_id: 'rec-series-1'
      }
    ];
    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockWeekSchedules, total: 1 });
    vi.mocked(activityScheduleApi.cancelRecurrence).mockResolvedValue({} as any);

    render(<ActivityScheduleWorkspace initialActivityId="act1" />);

    // Wait for schedule to render in weekly cell and show action buttons on hover
    await waitFor(() => {
      expect(screen.getByText('Recurring Meeting')).toBeInTheDocument();
    });

    const stopRecurrenceBtn = screen.getByTitle('Dừng lặp từ buổi này');
    fireEvent.click(stopRecurrenceBtn);

    // Click confirm in stop recurrence dialog
    const confirmStopBtn = screen.getByText('Xác Nhận Dừng Lặp');
    fireEvent.click(confirmStopBtn);

    await waitFor(() => {
      expect(activityScheduleApi.cancelRecurrence).toHaveBeenCalledWith('sched-rec-1');
    });
  });

  it('renders a compact layout with col-span-12 lg:col-span-2 palette and col-span-12 lg:col-span-10 board', async () => {
    const { container } = render(<ActivityScheduleWorkspace initialActivityId="act1" />);

    await waitFor(() => {
      expect(screen.getByText('Kéo hoạt động xếp lịch')).toBeInTheDocument();
    });

    const paletteContainer = container.querySelector('.lg\\:col-span-2');
    expect(paletteContainer).toBeInTheDocument();
    expect(paletteContainer?.className).toContain('col-span-12');

    const boardContainer = container.querySelector('.lg\\:col-span-10');
    expect(boardContainer).toBeInTheDocument();
    expect(boardContainer?.className).toContain('col-span-12');
  });

  it('places recurrence and refresh controls together in the week navigation toolbar', async () => {
    render(<ActivityScheduleWorkspace initialActivityId="act1" />);

    await waitFor(() => {
      expect(screen.getByText('Cấu hình chuỗi lặp')).toBeInTheDocument();
    });

    const recurrenceBtn = screen.getByText('Cấu hình chuỗi lặp').closest('button');
    const refreshBtn = screen.getByTitle('Làm mới lịch');

    expect(recurrenceBtn).toBeInTheDocument();
    expect(refreshBtn).toBeInTheDocument();

    const toolbar = recurrenceBtn?.parentElement;
    expect(toolbar).toBeInTheDocument();
    expect(toolbar?.contains(refreshBtn)).toBe(true);
  });

  it('does not have vertical day border-r/divide-x classes on desktop, and has no overflow-x-auto class', async () => {
    const { container } = render(<ActivityScheduleWorkspace initialActivityId="act1" />);

    await waitFor(() => {
      const divideXElements = container.querySelectorAll('.divide-x');
      divideXElements.forEach(el => {
        expect(el.className).toContain('lg:divide-x-0');
      });

      const borderRElements = container.querySelectorAll('.border-r');
      borderRElements.forEach(el => {
        expect(el.className).toContain('lg:border-r-0');
      });

      const overflowXElements = container.querySelectorAll('.overflow-x-auto');
      expect(overflowXElements.length).toBe(0);
    });
  });

  it('renders all form fields (capacity, date, recurrence) in initial create mode', async () => {
    render(<ActivityScheduleWorkspace initialActivityId="act1" openCreateOnLoad={true} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ví dụ: Sinh hoạt định kỳ tuần 12')).toBeInTheDocument();
    });

    expect(screen.getByText('Giới hạn người tham gia')).toBeInTheDocument();
    expect(screen.getByText('Ngày sinh hoạt')).toBeInTheDocument();
    expect(screen.getByText('Thiết lập lặp lại lịch sinh hoạt')).toBeInTheDocument();
  });

  it('renders only basic fields (title, desc, location, times) in session configuration mode (isSimplifiedModal)', async () => {
    const today = new Date();
    const startStr = today.toISOString();
    const endStr = new Date(today.getTime() + 7200000).toISOString();

    const mockWeekSchedules: any[] = [
      {
        _id: 'sched1',
        title: 'Meeting 1',
        start_time: startStr,
        end_time: endStr,
        club_id: 'act1',
        semester_id: 'sem1',
        max_attendees: 15
      }
    ];
    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockWeekSchedules, total: 1 });

    render(<ActivityScheduleWorkspace initialActivityId="act1" />);
    await waitFor(() => {
      expect(screen.getByText('Meeting 1')).toBeInTheDocument();
    });

    const meetingCard = screen.getByText('Meeting 1');
    fireEvent.doubleClick(meetingCard);

    await waitFor(() => {
      expect(screen.getByText('Cấu hình buổi sinh hoạt')).toBeInTheDocument();
    });

    expect(screen.queryByText('Giới hạn người tham gia')).not.toBeInTheDocument();
    expect(screen.queryByText('Ngày sinh hoạt')).not.toBeInTheDocument();
    expect(screen.queryByText('Thiết lập lặp lại lịch sinh hoạt')).not.toBeInTheDocument();

    expect(screen.getByPlaceholderText('Ví dụ: Phòng máy B.202')).toBeInTheDocument();
    expect(screen.getByText('Giờ bắt đầu')).toBeInTheDocument();
    expect(screen.getByText('Giờ kết thúc')).toBeInTheDocument();
  });
});
