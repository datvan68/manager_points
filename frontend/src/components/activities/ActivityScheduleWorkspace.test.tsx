import React from 'react';
import { render, screen, fireEvent, waitFor, createEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ActivityScheduleWorkspace from './ActivityScheduleWorkspace';
import { activityApi, activityScheduleApi } from '@/api/activity-api';
import { semesterApi } from '@/api/semester-api';
import { toBlob } from 'html-to-image';

vi.mock('@/api/activity-api', () => ({
  activityApi: {
    getAll: vi.fn(),
  },
  activityScheduleApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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

vi.mock('html-to-image', () => ({
  toBlob: vi.fn().mockResolvedValue({ size: 1, type: 'image/png' } as Blob),
}));

describe('ActivityScheduleWorkspace', () => {
  const mockActivities = [
    { _id: '60c72b2f9b1e8a001c8e4a50', name: 'Academic Club', code: 'AC_CLUB', category: 'academic' },
  ];

  const mockSemesters = [
    { _id: '60c72b2f9b1e8a001c8e4a52', semester_name: 'Semester 1', start_date: '2026-01-01', end_date: '2026-06-30', status: 'active' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(activityApi.getAll).mockResolvedValue(mockActivities as any);
    vi.mocked(semesterApi.getSemesters).mockResolvedValue(mockSemesters as any);
    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(activityScheduleApi.update).mockResolvedValue({} as any);
  });

  it('renders dropdown filters and week headers correctly', async () => {
    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

    await waitFor(() => {
      expect(screen.getByText('Hiện tại')).toBeInTheDocument();
    });
  });

  it('does NOT render Activity and Semester selectors on toolbar', async () => {
    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

    await waitFor(() => {
      expect(screen.queryByText('Chọn Hoạt động')).not.toBeInTheDocument();
      expect(screen.queryByText('Học kỳ')).not.toBeInTheDocument();
    });
  });

  it('automatically opens create schedule dialog when openCreateOnLoad is true', async () => {
    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" openCreateOnLoad={true} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ví dụ: Sinh hoạt định kỳ tuần 12')).toBeInTheDocument();
    });
  });

  it('handles week navigation correctly', async () => {
    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

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

    const { container } = render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" openCreateOnLoad={true} />);

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
    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);
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
        activity_id: '60c72b2f9b1e8a001c8e4a50',
        semester_id: '60c72b2f9b1e8a001c8e4a52'
      }
    ];
    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockWeekSchedules, total: 1 });

    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);
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

  it('uses one range calendar and removes obsolete recurrence controls', async () => {
    const today = new Date();
    const startStr = today.toISOString();
    const endStr = new Date(today.getTime() + 7200000).toISOString();

    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({
      items: [
        {
          _id: 'sched-shared-controls',
          title: 'Shared Control Meeting',
          start_time: startStr,
          end_time: endStr,
          activity_id: '60c72b2f9b1e8a001c8e4a50',
          semester_id: '60c72b2f9b1e8a001c8e4a52'
        }
      ] as any,
      total: 1
    });

    const { container } = render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

    await waitFor(() => {
      expect(screen.getByText('Shared Control Meeting')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cấu hình chuỗi lặp'));

    await waitFor(() => {
      expect(screen.getByText('Cấu hình chuỗi lịch lặp lại')).toBeInTheDocument();
    });

    const modal = screen.getByText('Cấu hình chuỗi lịch lặp lại').closest('.fixed') as HTMLElement;
    expect(modal.querySelectorAll('select')).toHaveLength(0);
    expect(modal.querySelectorAll('input[type="date"]')).toHaveLength(0);
    expect(screen.queryByText('Kiểu kết thúc lặp')).not.toBeInTheDocument();
    expect(screen.queryByText('Chu kỳ lặp')).not.toBeInTheDocument();
    expect(screen.getByText('Khoảng ngày lặp')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Chọn khoảng ngày'));
    expect(screen.getByText('T2')).toBeInTheDocument();
    expect(screen.getByText('Xác nhận')).toBeInTheDocument();
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
        activity_id: '60c72b2f9b1e8a001c8e4a50',
        semester_id: '60c72b2f9b1e8a001c8e4a52',
        recurrence_id: 'rec-series-1'
      }
    ];
    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockWeekSchedules, total: 1 });
    vi.mocked(activityScheduleApi.cancelRecurrence).mockResolvedValue({} as any);

    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

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
    const { container } = render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

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
    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

    await waitFor(() => {
      expect(screen.getByText('Cấu hình chuỗi lặp')).toBeInTheDocument();
    });

    const recurrenceBtn = screen.getByText('Cấu hình chuỗi lặp').closest('button');
    const refreshBtn = screen.getByTitle('Sao chép ảnh lịch tuần');

    expect(recurrenceBtn).toBeInTheDocument();
    expect(refreshBtn).toBeInTheDocument();

    const toolbar = recurrenceBtn?.parentElement;
    expect(toolbar).toBeInTheDocument();
    expect(toolbar?.contains(refreshBtn)).toBe(true);
  });

  it('does not have vertical day border-r/divide-x classes on desktop, and has no overflow-x-auto class', async () => {
    const { container } = render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

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
    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" openCreateOnLoad={true} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ví dụ: Sinh hoạt định kỳ tuần 12')).toBeInTheDocument();
    });

    expect(screen.getByText('Giới hạn người tham gia')).toBeInTheDocument();
    expect(screen.getByText('Ngày sinh hoạt')).toBeInTheDocument();
    expect(screen.getByText('Thiết lập lặp lại lịch sinh hoạt')).toBeInTheDocument();
  });

  it('hides title and description in session configuration mode while keeping location and times', async () => {
    const today = new Date();
    const startStr = today.toISOString();
    const endStr = new Date(today.getTime() + 7200000).toISOString();

    const mockWeekSchedules: any[] = [
      {
        _id: 'sched1',
        title: 'Meeting 1',
        start_time: startStr,
        end_time: endStr,
        activity_id: '60c72b2f9b1e8a001c8e4a50',
        semester_id: '60c72b2f9b1e8a001c8e4a52',
        max_attendees: 15
      }
    ];
    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockWeekSchedules, total: 1 });

    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);
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
    expect(screen.queryByPlaceholderText('Ví dụ: Sinh hoạt định kỳ tuần 12')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Nội dung chi tiết sinh hoạt...')).not.toBeInTheDocument();

    expect(screen.getByPlaceholderText('Ví dụ: Phòng máy B.202')).toBeInTheDocument();
    expect(screen.getByText('Giờ bắt đầu')).toBeInTheDocument();
    expect(screen.getByText('Giờ kết thúc')).toBeInTheDocument();
  });

  it('correctly handles drag/save of existing non-recurring schedule with populated objects, calling update with scalar IDs', async () => {
    const mockSchedules: any[] = [
      {
        _id: 'existing-schedule-id',
        title: 'Existing Meeting',
        start_time: '2026-07-15T08:00:00.000Z',
        end_time: '2026-07-15T10:00:00.000Z',
        activity_id: { _id: '60c72b2f9b1e8a001c8e4a50', name: 'Academic Club', code: 'AC_CLUB', category: 'academic' },
        semester_id: { _id: '60c72b2f9b1e8a001c8e4a52', semester_name: 'Semester 1', start_date: '2026-01-01', end_date: '2026-06-30' },
        location: 'Room 101',
        schedule_type: 'regular'
      }
    ];

    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockSchedules, total: 1 });

    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

    await waitFor(() => {
      expect(screen.getByText('Existing Meeting')).toBeInTheDocument();
    });

    expect(screen.getByText('Đã xếp lịch')).toBeInTheDocument();
    expect(screen.queryByText(/Đã xếp \(/)).not.toBeInTheDocument();

    const scheduleCard = screen.getByText('Existing Meeting');
    const cells = screen.getAllByText('Trống');
    const dropTarget = cells[0];

    const dragStartEvent = createEvent.dragStart(scheduleCard);
    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(type: string, val: string) { this.data[type] = val; },
      getData(type: string) { return this.data[type]; }
    };
    Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer });
    fireEvent(scheduleCard, dragStartEvent);

    const dropEvent = createEvent.drop(dropTarget);
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
    fireEvent(dropTarget, dropEvent);

    await waitFor(() => {
      expect(screen.getByText('Chưa lưu')).toBeInTheDocument();
    });

    const saveBtn = screen.getByTitle('Lưu');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(activityScheduleApi.update).toHaveBeenCalledWith(
        'existing-schedule-id',
        expect.objectContaining({
          activity_id: '60c72b2f9b1e8a001c8e4a50',
          semester_id: '60c72b2f9b1e8a001c8e4a52',
        })
      );
      expect(activityScheduleApi.delete).not.toHaveBeenCalled();
    });
  });

  it('renders compact mode with more than one session, and preserves detailed layout with one session', async () => {
    const today = new Date();
    const startStr = today.toISOString();
    const endStr = new Date(today.getTime() + 7200000).toISOString();

    const mockSchedules: any[] = [
      {
        _id: 'sched1',
        title: 'Meeting 1',
        start_time: startStr,
        end_time: endStr,
        activity_id: '60c72b2f9b1e8a001c8e4a50',
        semester_id: '60c72b2f9b1e8a001c8e4a52',
        location: 'Room 301',
        schedule_type: 'regular'
      },
      {
        _id: 'sched2',
        title: 'Meeting 2',
        start_time: startStr,
        end_time: endStr,
        activity_id: '60c72b2f9b1e8a001c8e4a50',
        semester_id: '60c72b2f9b1e8a001c8e4a52',
        location: 'Room 302',
        schedule_type: 'regular'
      }
    ];

    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockSchedules, total: 2 });

    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

    await waitFor(() => {
      // 1 in sidebar, 2 in compact cards = 3
      const academicClubs = screen.getAllByText('Academic Club');
      expect(academicClubs.length).toBe(3);
    });

    const compactCard = screen.getAllByText('Academic Club')[1];
    fireEvent.doubleClick(compactCard);

    await waitFor(() => {
      expect(screen.getByText('Cấu hình buổi sinh hoạt')).toBeInTheDocument();
    });
  });

  it('renders detailed layout for single session', async () => {
    const today = new Date();
    const startStr = today.toISOString();
    const endStr = new Date(today.getTime() + 7200000).toISOString();

    const mockSchedules: any[] = [
      {
        _id: 'sched1',
        title: 'Meeting 1',
        start_time: startStr,
        end_time: endStr,
        activity_id: '60c72b2f9b1e8a001c8e4a50',
        semester_id: '60c72b2f9b1e8a001c8e4a52',
        location: 'Room 301',
        schedule_type: 'regular'
      }
    ];

    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockSchedules, total: 1 });

    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

    await waitFor(() => {
      expect(screen.getByText('Meeting 1')).toBeInTheDocument();
      // Academic Club should only appear 1 time (in sidebar)
      const academicClubs = screen.getAllByText('Academic Club');
      expect(academicClubs.length).toBe(1);
    });
  });

  it('removes the bulk save button from the toolbar', async () => {
    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);
    await waitFor(() => expect(screen.getByText('Cấu hình chuỗi lặp')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Lưu tất cả/ })).not.toBeInTheDocument();
  });
  it('simplified modal layout handles role, attributes, title, field hiding, focus classes, and closure', async () => {
    const today = new Date();
    const startStr = today.toISOString();
    const endStr = new Date(today.getTime() + 7200000).toISOString();

    const mockWeekSchedules: any[] = [
      {
        _id: 'sched1',
        title: 'Meeting 1',
        start_time: startStr,
        end_time: endStr,
        activity_id: '60c72b2f9b1e8a001c8e4a50',
        semester_id: '60c72b2f9b1e8a001c8e4a52',
        location: 'Room 301',
        schedule_type: 'regular'
      }
    ];

    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockWeekSchedules, total: 1 });

    const { container } = render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);
    await waitFor(() => {
      expect(screen.getByText('Meeting 1')).toBeInTheDocument();
    });

    const meetingCard = screen.getByText('Meeting 1');
    fireEvent.doubleClick(meetingCard);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const modalForm = screen.getByRole('dialog');
    expect(modalForm).toHaveAttribute('aria-modal', 'false');
    expect(modalForm).toHaveAttribute('aria-labelledby', 'dialog-title');
    expect(modalForm.className).toContain('rounded-2xl');
    expect(modalForm.className).not.toContain('rounded-3xl');

    const modalContainer = modalForm.parentElement;
    expect(modalContainer).toBeInTheDocument();
    expect(modalContainer?.style.position).toBe('fixed');
    expect(modalContainer?.style.top).toBe('6px');
    expect(modalContainer?.style.left).toBe('12px');
    expect(modalContainer?.style.width).toBe('280px');
    expect(modalContainer?.className).not.toContain('bg-black/40');
    expect(modalContainer?.className).not.toContain('backdrop-blur-sm');

    const titleElement = container.querySelector('#dialog-title');
    expect(titleElement).toBeInTheDocument();
    expect(titleElement?.textContent).toBe('C\u1ea5u h\u00ecnh bu\u1ed5i sinh ho\u1ea1t');

    expect(screen.queryByText('Ti\u00eau \u0111\u1ec1 bu\u1ed5i')).not.toBeInTheDocument();
    expect(screen.queryByText('M\u00f4 t\u1ea3 n\u1ed9i dung')).not.toBeInTheDocument();
    expect(screen.queryByText('Gi\u1edbi h\u1ea1n ng\u01b0\u1eddi tham gia')).not.toBeInTheDocument();
    expect(screen.queryByText('Ng\u00e0y sinh ho\u1ea1t')).not.toBeInTheDocument();
    expect(screen.queryByText('Thi\u1ebft l\u1eadp l\u1eb7p l\u1ea1i l\u1ecbch sinh ho\u1ea1t')).not.toBeInTheDocument();

    expect(screen.getByText('\u0110\u1ecba \u0111i\u1ec3m')).toBeInTheDocument();
    expect(screen.getByText('Gi\u1edd b\u1eaft \u0111\u1ea7u')).toBeInTheDocument();
    expect(screen.getByText('Gi\u1edd k\u1ebft th\u00fac')).toBeInTheDocument();

    const locationInput = screen.getByPlaceholderText('V\u00ed d\u1ee5: Ph\u00f2ng m\u00e1y B.202');
    expect(locationInput.className).toContain('focus:ring-2');
    expect(locationInput.className).toContain('focus:ring-blue-600');
    expect(locationInput.className).toContain('focus:border-blue-600');
    expect(locationInput.className).toContain('rounded-lg');

    const closeBtn = modalForm.querySelector('button');
    expect(closeBtn?.className).toContain('focus:ring-2');
    expect(closeBtn?.className).toContain('focus:ring-blue-600');
    expect(closeBtn?.className).toContain('focus:border-blue-600');

    if (closeBtn) {
      fireEvent.click(closeBtn);
    }
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByText('Meeting 1'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'H\u1ee7y b\u1ecf' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByText('Meeting 1'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('keeps the compact dialog open during scroll and time-picker interaction', async () => {
    const today = new Date();
    const startStr = today.toISOString();
    const endStr = new Date(today.getTime() + 7200000).toISOString();

    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({
      items: [
        {
          _id: 'sched-scroll-1',
          title: 'Meeting Scroll',
          start_time: startStr,
          end_time: endStr,
          activity_id: '60c72b2f9b1e8a001c8e4a50',
          semester_id: '60c72b2f9b1e8a001c8e4a52',
          location: 'Room 401',
          schedule_type: 'regular'
        } as any
      ],
      total: 1
    });

    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

    await waitFor(() => {
      expect(screen.getByText('Meeting Scroll')).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByText('Meeting Scroll'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const locationInput = screen.getByPlaceholderText('V\u00ed d\u1ee5: Ph\u00f2ng m\u00e1y B.202');
    fireEvent.change(locationInput, { target: { value: 'Room 999' } });
    fireEvent.scroll(window);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Room 999')).toBeInTheDocument();

    const dialog = screen.getByRole('dialog');
    const timeButtons = within(dialog).getAllByRole('button').filter((button) => /\d{2}:\d{2}/.test(button.textContent || ''));
    expect(timeButtons.length).toBeGreaterThanOrEqual(2);
    const initialStartTime = timeButtons[0].textContent || '';

    fireEvent.click(timeButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: '09' }));

    await waitFor(() => {
      const updatedMainDialog = screen.getAllByRole('dialog')[0];
      const updatedTimeButtons = within(updatedMainDialog).getAllByRole('button').filter((button) => /\d{2}:\d{2}/.test(button.textContent || ''));
      expect(updatedMainDialog).toBeInTheDocument();
      expect(updatedTimeButtons[0].textContent).not.toBe(initialStartTime);
    });
  });

  it('prefills create dialog location from the selected activity classroom when no saved value exists', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([
      { _id: '60c72b2f9b1e8a001c8e4a50', name: 'Academic Club', code: 'AC_CLUB', category: 'academic', classroom: 'Ph\u00f2ng h\u1ecdc 204' },
    ] as any);

    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" openCreateOnLoad={true} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ph\u00f2ng h\u1ecdc 204')).toBeInTheDocument();
    });
  });

  it('correctly handles location precedence for saved and pending configurations', async () => {
    // 1. Saved location exists:
    const today = new Date();
    const startStr = today.toISOString();
    const endStr = new Date(today.getTime() + 7200000).toISOString();

    const mockActivitiesWithClassroom = [
      { _id: '60c72b2f9b1e8a001c8e4a50', name: 'Academic Club', code: 'AC_CLUB', category: 'academic', classroom: 'Phòng học 102' },
    ];
    vi.mocked(activityApi.getAll).mockResolvedValue(mockActivitiesWithClassroom as any);

    const mockSavedScheduleWithLocation: any[] = [
      {
        _id: 'sched1',
        title: 'Meeting 1',
        start_time: startStr,
        end_time: endStr,
        activity_id: '60c72b2f9b1e8a001c8e4a50',
        semester_id: '60c72b2f9b1e8a001c8e4a52',
        location: 'Phòng Máy B.101',
        schedule_type: 'regular'
      }
    ];

    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockSavedScheduleWithLocation, total: 1 });

    const { unmount } = render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);
    await waitFor(() => {
      expect(screen.getByText('Meeting 1')).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByText('Meeting 1'));
    await waitFor(() => {
      expect(screen.getByDisplayValue('Phòng Máy B.101')).toBeInTheDocument();
    });
    unmount();

    // 2. Saved location empty/missing -> fallbacks to activity classroom:
    const mockSavedScheduleNoLocation: any[] = [
      {
        _id: 'sched1',
        title: 'Meeting 1',
        start_time: startStr,
        end_time: endStr,
        activity_id: '60c72b2f9b1e8a001c8e4a50',
        semester_id: '60c72b2f9b1e8a001c8e4a52',
        location: ' ', // empty location
        schedule_type: 'regular'
      }
    ];

    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockSavedScheduleNoLocation, total: 1 });

    const { unmount: unmount2 } = render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);
    await waitFor(() => {
      expect(screen.getByText('Meeting 1')).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByText('Meeting 1'));
    await waitFor(() => {
      expect(screen.getByDisplayValue('Phòng học 102')).toBeInTheDocument();
    });
    unmount2();

    // 3. Both saved location and classroom empty -> fallback to the default room:
    const mockActivitiesNoClassroom = [
      { _id: '60c72b2f9b1e8a001c8e4a50', name: 'Academic Club', code: 'AC_CLUB', category: 'academic', classroom: ' ' },
    ];
    vi.mocked(activityApi.getAll).mockResolvedValue(mockActivitiesNoClassroom as any);
    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockSavedScheduleNoLocation, total: 1 });

    const { unmount: unmount3 } = render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);
    await waitFor(() => {
      expect(screen.getByText('Meeting 1')).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByText('Meeting 1'));
    await waitFor(() => {
      expect((screen.getByPlaceholderText('V\u00ed d\u1ee5: Ph\u00f2ng m\u00e1y B.202') as HTMLInputElement).value).toBe('Ph\u00f2ng sinh ho\u1ea1t');
    });
    unmount3();
  });

  it('correctly initializes weekOffset from source_week_start_date and respects navigation lock stability', async () => {
    // Reset activity mocks for this test:
    vi.mocked(activityApi.getAll).mockResolvedValue(mockActivities as any);

    // Current date's week monday:
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const currentMonday = new Date(today.getTime() + diff * 24 * 60 * 60 * 1000);

    // Target source week: 4 weeks ahead
    const targetSourceMonday = new Date(currentMonday.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
    const sourceWeekStr = targetSourceMonday.toISOString().split('T')[0];

    const mockSchedules: any[] = [
      {
        _id: 'sched-with-recurrence',
        title: 'Meeting 1',
        start_time: targetSourceMonday.toISOString(),
        end_time: new Date(targetSourceMonday.getTime() + 7200000).toISOString(),
        activity_id: '60c72b2f9b1e8a001c8e4a50',
        semester_id: '60c72b2f9b1e8a001c8e4a52',
        status: 'active',
        recurrence_id: 'rec1',
        recurrence: {
          source_week_start_date: sourceWeekStr
        }
      }
    ];

    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockSchedules, total: 1 });

    const { rerender } = render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

    // Wait for loadSchedules and check that weekOffset became 4:
    await waitFor(() => {
      expect(screen.getByText(/Tuần \+4/)).toBeInTheDocument();
    });

    // Simulate navigation to week +5 (Next week button click)
    const currentBtn = screen.getByText('Hiện tại');
    const navContainer = currentBtn.parentElement;
    const navButtons = navContainer?.querySelectorAll('button') || [];
    const nextBtn = navButtons[navButtons.length - 1];
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Tuần \+5/)).toBeInTheDocument();

    // Rerender (triggering possible hook runs with different prop/data state)
    // and check that weekOffset remains locked at +5
    rerender(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" activityType="new-type" />);
    expect(screen.getByText(/Tuần \+5/)).toBeInTheDocument();
  });

  it('displays correct visual styles when current week is the source week', async () => {
    // Current date's week monday:
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const currentMonday = new Date(today.getTime() + diff * 24 * 60 * 60 * 1000);
    const sourceWeekStr = currentMonday.toISOString().split('T')[0];

    const mockSchedules: any[] = [
      {
        _id: 'sched-with-recurrence',
        title: 'Meeting 1',
        start_time: currentMonday.toISOString(),
        end_time: new Date(currentMonday.getTime() + 7200000).toISOString(),
        activity_id: '60c72b2f9b1e8a001c8e4a50',
        semester_id: '60c72b2f9b1e8a001c8e4a52',
        status: 'active',
        recurrence_id: 'rec1',
        recurrence: {
          source_week_start_date: sourceWeekStr
        }
      }
    ];

    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockSchedules, total: 1 });

    const { container } = render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

    await waitFor(() => {
      expect(screen.getByText('Tuần hiện tại & Tuần nguồn')).toBeInTheDocument();
    });

    const badge = screen.getByText('Tuần hiện tại & Tuần nguồn');
    expect(badge.className).toContain('bg-purple-600');
    expect(badge.className).toContain('text-white');
    expect(badge.className).toContain('border-purple-700');

    // Right Side Grid container:
    const gridContainer = container.querySelector('.lg\\:col-span-10');
    expect(gridContainer?.className).toContain('border-purple-300');
    expect(gridContainer?.className).toContain('ring-2');
    expect(gridContainer?.className).toContain('ring-purple-500/10');

    // Column header "Nguồn" instead of "Ca"
    expect(screen.getByText('Nguồn')).toBeInTheDocument();
    expect(screen.queryByText('Ca')).not.toBeInTheDocument();
  });

  it('updates the position of the compact configuration dialog when scroll events occur', async () => {
    const today = new Date();
    const startStr = today.toISOString();
    const endStr = new Date(today.getTime() + 7200000).toISOString();

    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({
      items: [
        {
          _id: 'sched-scroll-test',
          title: 'Meeting Scroll Test',
          start_time: startStr,
          end_time: endStr,
          activity_id: '60c72b2f9b1e8a001c8e4a50',
          semester_id: '60c72b2f9b1e8a001c8e4a52',
          location: 'Room 401',
          schedule_type: 'regular'
        } as any
      ],
      total: 1
    });

    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

    await waitFor(() => {
      expect(screen.getByText('Meeting Scroll Test')).toBeInTheDocument();
    });

    const meetingCardText = screen.getByText('Meeting Scroll Test');
    const cardElement = meetingCardText.closest('.rounded-lg') || meetingCardText;

    cardElement.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 100,
      right: 380,
      top: 150,
      bottom: 200,
      width: 280,
      height: 50,
    });

    fireEvent.doubleClick(cardElement);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const containerElement = dialog.parentElement;
    expect(containerElement?.style.top).toBe('206px'); // bottom (200) + 6 = 206px

    // Simulate card moving on scroll
    cardElement.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 100,
      right: 380,
      top: 100,
      bottom: 150,
      width: 280,
      height: 50,
    });

    fireEvent.scroll(window);

    expect(containerElement?.style.top).toBe('156px'); // bottom (150) + 6 = 156px
  });

  it('renders updated delete modal and invokes handler exactly once', async () => {
    const today = new Date();
    const startStr = today.toISOString();
    const endStr = new Date(today.getTime() + 7200000).toISOString();

    const mockWeekSchedules: any[] = [
      {
        _id: 'sched-del-1',
        title: 'Meeting Delete',
        start_time: startStr,
        end_time: endStr,
        activity_id: '60c72b2f9b1e8a001c8e4a50',
        semester_id: '60c72b2f9b1e8a001c8e4a52',
        recurrence_id: 'rec-series-1'
      }
    ];
    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockWeekSchedules, total: 1 });
    vi.mocked(activityScheduleApi.delete).mockResolvedValue({} as any);

    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

    await waitFor(() => {
      expect(screen.getByText('Meeting Delete')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle('Xóa');
    fireEvent.click(deleteBtn);

    // Verify modal title and copy
    expect(screen.getByText('Xác nhận xóa lịch trình')).toBeInTheDocument();
    expect(screen.getByText(/Chú ý: Đây là một buổi sinh hoạt thuộc chuỗi lịch lặp định kỳ/)).toBeInTheDocument();

    const confirmBtn = screen.getByText('Xóa TOÀN BỘ chuỗi lịch lặp');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(activityScheduleApi.delete).toHaveBeenCalledTimes(1);
      expect(activityScheduleApi.delete).toHaveBeenCalledWith('sched-del-1', true);
    });
  });

  it('renders updated cancel recurrence modal and invokes handler exactly once', async () => {
    const today = new Date();
    const startStr = today.toISOString();
    const endStr = new Date(today.getTime() + 7200000).toISOString();

    const mockWeekSchedules: any[] = [
      {
        _id: 'sched-rec-cancel',
        title: 'Meeting Recurrence Cancel',
        start_time: startStr,
        end_time: endStr,
        activity_id: '60c72b2f9b1e8a001c8e4a50',
        semester_id: '60c72b2f9b1e8a001c8e4a52',
        recurrence_id: 'rec-series-2'
      }
    ];
    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: mockWeekSchedules, total: 1 });
    vi.mocked(activityScheduleApi.cancelRecurrence).mockResolvedValue({} as any);

    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);

    await waitFor(() => {
      expect(screen.getByText('Meeting Recurrence Cancel')).toBeInTheDocument();
    });

    const stopRecurrenceBtn = screen.getByTitle('Dừng lặp từ buổi này');
    fireEvent.click(stopRecurrenceBtn);

    // Verify modal title and copy
    expect(screen.getByText('Hủy chuỗi lặp lại')).toBeInTheDocument();
    expect(screen.getByText(/Các buổi sinh hoạt trong quá khứ và buổi hiện tại sẽ được giữ nguyên/)).toBeInTheDocument();

    const confirmStopBtn = screen.getByText('Xác Nhận Dừng Lặp');
    fireEvent.click(confirmStopBtn);

    await waitFor(() => {
      expect(activityScheduleApi.cancelRecurrence).toHaveBeenCalledTimes(1);
      expect(activityScheduleApi.cancelRecurrence).toHaveBeenCalledWith('sched-rec-cancel');
    });
  });

  it('copies a non-empty weekly schedule image through the compact toolbar action', async () => {
    vi.mocked(activityScheduleApi.getAll).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(toBlob).mockResolvedValue({ size: 1, type: 'image/png' } as Blob);
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    const ClipboardItemMock = class ClipboardItem {
      constructor(public readonly items: Record<string, Blob>) {}
    };
    vi.stubGlobal('ClipboardItem', ClipboardItemMock);
    Object.defineProperty(window, 'ClipboardItem', {
      configurable: true,
      value: ClipboardItemMock,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write: clipboardWrite },
    });

    render(<ActivityScheduleWorkspace initialActivityId="60c72b2f9b1e8a001c8e4a50" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sao chép ảnh lịch tuần' })).toBeInTheDocument());
    const weeklySchedule = screen.getByText('Ca').closest('.col-span-12');
    expect(weeklySchedule).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Sao chép ảnh lịch tuần' }));

    await waitFor(() => {
      expect(toBlob).toHaveBeenCalledTimes(1);
      expect(clipboardWrite).toHaveBeenCalledTimes(1);
    });
    const captureTarget = vi.mocked(toBlob).mock.calls[0]?.[0] as HTMLElement;
    expect(captureTarget).not.toBe(weeklySchedule);
    expect(captureTarget).not.toBeInTheDocument();
    expect(toBlob).toHaveBeenCalledWith(captureTarget, expect.objectContaining({ backgroundColor: '#ffffff' }));
    expect(weeklySchedule).not.toHaveStyle({ height: 'auto', overflow: 'visible' });
    expect(screen.getByRole('button', { name: 'Sao chép ảnh lịch tuần' })).not.toBeDisabled();
  });
});
