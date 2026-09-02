import { render, screen, waitFor, act, cleanup, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import StudentRecordPage from './page';
import { academicRecordApi } from '@/api/academic-record-api';
import { classApi } from '@/api/class-api';
import { criteriaApi } from '@/api/criteria-api';
import { dailyClassReportApi } from '@/api/daily-class-report-api';

let mockRecordPermissions: Record<string, boolean> = {};
let mockRealtimeOptions: any = null;
const mockXlsx = vi.hoisted(() => ({
  utils: {
    json_to_sheet: vi.fn((data: unknown[]) => data),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

// --- MOCKS ---



// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, prop) => (props: any) => {
      const Tag = typeof prop === 'string' ? prop : 'div';
      return <Tag {...props} />;
    }
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
  useSearchParams: vi.fn(() => ({
    get: vi.fn(),
  })),
}));

vi.mock('@/api/academic-record-api', () => ({
  academicRecordApi: {
    getAcademicRecords: vi.fn(),
    getAcademicRecordsByStudent: vi.fn().mockResolvedValue([]),
    getDeletedAcademicRecords: vi.fn().mockResolvedValue([]),
    bulkDeleteAcademicRecords: vi.fn(),
    bulkForceDeleteAcademicRecords: vi.fn(),
    deleteAcademicRecord: vi.fn(),
  }
}));

vi.mock('xlsx', () => mockXlsx);

vi.mock('@/api/class-api', () => ({
  classApi: {
    getClasses: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('@/api/criteria-api', () => ({
  criteriaApi: {
    getCriteria: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('@/api/criteria-api', () => ({
  criteriaApi: {
    getCriteria: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('@/api/daily-class-report-api', () => ({
  dailyClassReportApi: {
    getDailyClassReports: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    getDeletedDailyClassReports: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user1', role: 'teacher', permissions: [] },
  })),
}));

vi.mock('@/hooks/useGradingRealtime', () => ({
  useGradingRealtime: vi.fn((options: any) => {
    mockRealtimeOptions = options;
    return { status: 'connected' };
  })
}));

const makeAcademicRecord = (index: number) => ({
  _id: `record-${index}`,
  student_id: {
    _id: `student-${index}`,
    student_code: `SV${index}`,
    full_name: `Student ${index}`,
    class_id: 'class-1',
  },
  points_effect: -5,
  record_title: `Record ${index}`,
  recorded_at: '2026-08-25T00:00:00.000Z',
});

const makeStudentGroup = (
  studentId = 'student-1',
  recordId = 'record-1',
  recordCount = 1,
  recordTypes = ['ky_luat'],
  totalPoints = -5,
  recordTypeCounts = recordTypes.length === 1
    ? { khen_thuong: 0, cong_diem: 0, ky_luat: recordCount }
    : { khen_thuong: 1, cong_diem: 1, ky_luat: Math.max(0, recordCount - 2) },
) => ({
  studentId,
  latestRecord: {
    _id: recordId,
    student_id: {
      _id: studentId,
      student_code: 'SV001',
      full_name: 'Student 1',
      class_id: 'class-1',
    },
    points_effect: -5,
    record_title: 'Latest record',
    semester_id: 'semester-1',
    recorded_at: '2026-08-25T00:00:00.000Z',
    createdAt: '2026-08-25T00:00:00.000Z',
  },
  recordCount,
  recordTypeCounts,
  recordTypes,
  totalPoints,
});

vi.mock('@/components/guards/RouteGuard', () => ({
  RouteGuard: ({ children }: any) => <>{children}</>,
  usePermission: vi.fn(() => ({
    viewStudentRecord: true,
    createStudentRecord: true,
    editStudentRecord: true,
    deleteStudentRecord: true,
    viewClassRecord: true,
    createClassRecord: true,
    editClassRecord: true,
    deleteClassRecord: true,
    configRecord: true,
    ...mockRecordPermissions,
  })),
}));

vi.mock('@/components/layout/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }));
vi.mock('@/components/layout/Header', () => ({ default: () => <div data-testid="header" /> }));

let mockIntersectionObserverCallback: IntersectionObserverCallback;

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    mockIntersectionObserverCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.IntersectionObserver = MockIntersectionObserver as any;

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('StudentRecordPage Infinite Scroll', () => {
  let resolveFirstFetch: any;
  let resolveSecondFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    (classApi.getClasses as any).mockResolvedValue([]);
    (criteriaApi.getCriteria as any).mockResolvedValue([]);
    (academicRecordApi.getDeletedAcademicRecords as any).mockResolvedValue([]);
    (dailyClassReportApi.getDeletedDailyClassReports as any).mockResolvedValue([]);
    resolveFirstFetch = null;
    resolveSecondFetch = null;
    mockRecordPermissions = {};
    mockRealtimeOptions = null;
    mockXlsx.utils.json_to_sheet.mockClear();
    mockXlsx.utils.book_new.mockClear();
    mockXlsx.utils.book_append_sheet.mockClear();
    mockXlsx.writeFile.mockClear();
  });
  
  afterEach(() => {
    if (resolveFirstFetch) resolveFirstFetch({ data: [], meta: { total: 0 } });
    if (resolveSecondFetch) resolveSecondFetch({ data: [], meta: { total: 0 } });
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should handle pagination correctly and prevent duplicate fetches during scroll', async () => {
    const firstFetchPromise = new Promise(resolve => { resolveFirstFetch = resolve; });
    const secondFetchPromise = new Promise(resolve => { resolveSecondFetch = resolve; });

    (academicRecordApi.getAcademicRecords as any)
      .mockReturnValueOnce(firstFetchPromise)
      .mockReturnValueOnce(secondFetchPromise)
      .mockResolvedValue({ data: [], meta: { total: 40 } });

    render(<StudentRecordPage />);

    // Wait for the first fetch to be initiated
    await waitFor(() => {
      expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledTimes(1);
    });
    expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 40 }));

    // Resolve first fetch with 40 items
    await act(async () => {
      resolveFirstFetch({
        data: Array.from({ length: 40 }).map((_, i) => ({
          _id: `id-1-${i}`,
          points_effect: 10,
          record_title: `Record 1-${i}`,
        })),
        meta: { total: 40 } // total 40 means hasMoreRecords = true
      });
    });

    // Simulate scroll to trigger IntersectionObserver
    await act(async () => {
      mockIntersectionObserverCallback([{ isIntersecting: true }] as any, null as any);
    });

    // Verify second fetch is initiated
    expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledTimes(2);
    expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));

    // Trigger IntersectionObserver AGAIN before second fetch resolves
    await act(async () => {
      mockIntersectionObserverCallback([{ isIntersecting: true }] as any, null as any);
    });

    // Should NOT call the API again, because isFetchingRef is true
    expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledTimes(2);

    // Resolve second fetch
    await act(async () => {
      resolveSecondFetch({
        data: Array.from({ length: 40 }).map((_, i) => ({
          _id: `id-2-${i}`,
          points_effect: 10,
          record_title: `Record 2-${i}`,
        })),
        meta: { total: 40 }
      });
    });

    // After resolving, hasMoreRecords should be false (40 items total fetched)
    // Trigger IntersectionObserver one more time
    await act(async () => {
      mockIntersectionObserverCallback([{ isIntersecting: true }] as any, null as any);
    });

    expect(academicRecordApi.getAcademicRecords).toHaveBeenCalled();
  });

  it('uses 40 rows for the class situation tab and avoids row scaling', async () => {
    (dailyClassReportApi.getDailyClassReports as any).mockResolvedValue({
      data: [{
        _id: 'report-1',
        class_id: { class_name: 'CS-101-A' },
        report_date: '2026-08-24',
        total_present: 10,
        total_absent: 0,
        recordedStudentsCount: 0,
        teacher_name: 'Teacher',
        reported_by: { _id: 'reporter-1', user_name: 'reporter@example.com' },
      }],
      meta: { total: 1 },
    });

    render(<StudentRecordPage />);
    fireEvent.click(screen.getByText('Tình hình lớp học'));

    await waitFor(() => {
      expect(dailyClassReportApi.getDailyClassReports).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 40 }),
      );
    });

    const classRow = screen
      .getAllByText('CS-101-A')
      .map((element) => element.closest('tr'))
      .find((row) => row !== null);
    expect(classRow).not.toHaveClass('hover:scale-[1.002]');
    expect(await screen.findAllByText('reporter@example.com')).not.toHaveLength(0);
    expect(screen.queryByText('Teacher')).not.toBeInTheDocument();
  });

  it('renders grouped totals and detail history from effectivePoints with signed values', async () => {
    (academicRecordApi.getAcademicRecords as any).mockResolvedValue({
      data: [{
        studentId: 'student-1',
        latestRecord: {
          _id: 'record-latest',
          student_id: {
            _id: 'student-1',
            student_code: 'SV001',
            full_name: 'Student 1',
            class_id: 'class-1',
          },
          record_title: 'Latest record',
          recorded_at: '2026-08-25T00:00:00.000Z',
        },
        recordCount: 2,
        recordTypes: ['ky_luat', 'cong_diem'],
        totalPoints: -3,
      }],
      meta: { total: 1 },
    });

    render(<StudentRecordPage />);

    expect((await screen.findAllByText('-3')).length).toBeGreaterThan(0);
    (academicRecordApi.getAcademicRecords as any).mockResolvedValueOnce({
      data: [
        { _id: 'negative', points_effect: 99, effectivePoints: -1, record_title: 'Negative' },
        { _id: 'positive', points_effect: -99, effectivePoints: 5, record_title: 'Positive' },
      ],
    });
    fireEvent.click(screen.getByText('Chi tiết'));

    await waitFor(() => {
      expect(screen.getByText(/-1/)).toBeInTheDocument();
      expect(screen.getByText(/\+5/)).toBeInTheDocument();
      expect(screen.queryByText(/\+7/)).not.toBeInTheDocument();
    });
  });

  it('renders a saved class note in the class report card', async () => {
    (dailyClassReportApi.getDailyClassReports as any).mockResolvedValue({
      data: [{
        _id: 'report-note', class_id: { class_name: 'CS-101-A' }, report_date: '2026-08-24',
        total_present: 10, total_absent: 0, recordedStudentsCount: 0,
        teacher_name: 'Teacher', class_note: 'Ghi chú đã lưu',
      }],
      meta: { total: 1 },
    });

    render(<StudentRecordPage />);
    fireEvent.click(screen.getByText('Tình hình lớp học'));

    expect(await screen.findAllByText('Ghi chú đã lưu')).not.toHaveLength(0);
    expect(screen.getAllByText('Không xác định')).not.toHaveLength(0);
  });

  it('does not request class resources when READ_CLASS_RECORD is absent', async () => {
    mockRecordPermissions = { viewClassRecord: false };

    render(<StudentRecordPage />);

    await waitFor(() => {
      expect(academicRecordApi.getAcademicRecords).toHaveBeenCalled();
    });
    expect(dailyClassReportApi.getDailyClassReports).not.toHaveBeenCalled();
    expect(classApi.getClasses).not.toHaveBeenCalled();
  });

  it('does not render the purge utility in the configuration modal', async () => {
    render(<StudentRecordPage />);
    fireEvent.click(screen.getByTitle('Cấu hình tiêu chí vắng mặt'));

    expect(await screen.findByText('Cấu hình & Tiện ích hệ thống')).toBeInTheDocument();
    expect(screen.queryByText('Dọn ghi nhận HSSV')).not.toBeInTheDocument();
    expect(screen.queryByText('Xem trước')).not.toBeInTheDocument();
    expect(screen.queryByText('Xác nhận dọn')).not.toBeInTheDocument();
  });

  it('renders the configuration dialog as compact responsive glass sections', async () => {
    render(<StudentRecordPage />);
    fireEvent.click(screen.getByTitle('Cấu hình tiêu chí vắng mặt'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveClass('max-h-[calc(100vh-2rem)]', 'overflow-y-auto', 'rounded-2xl', 'shadow-sm');
    expect(dialog).toHaveClass('bg-white/45', 'backdrop-blur-xl');
    expect(dialog.querySelector('.grid')).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'gap-4');
    expect(screen.queryByText('Tiêu chí tính vắng')).not.toBeInTheDocument();
    expect(screen.getByText('Tiện ích')).toBeInTheDocument();
    expect(screen.getByText('Cấu hình hiển thị')).toBeInTheDocument();
  });

  it('hides student import when create permission is absent', async () => {
    mockRecordPermissions = { createStudentRecord: false };
    render(<StudentRecordPage />);
    fireEvent.click(screen.getByTitle('Cấu hình tiêu chí vắng mặt'));

    expect(await screen.findByText('Cấu hình & Tiện ích hệ thống')).toBeInTheDocument();
    expect(screen.queryByText('Import Ghi nhận')).not.toBeInTheDocument();
    expect(screen.getByText('Thùng rác')).toBeInTheDocument();
  });

  it('renders the trash dialog as responsive glass content with both tabs and states', async () => {
    (academicRecordApi.getDeletedAcademicRecords as any).mockResolvedValue([
      makeAcademicRecord(1),
    ]);
    (dailyClassReportApi.getDeletedDailyClassReports as any).mockResolvedValue([
      {
        _id: 'deleted-report-1',
        class_id: { class_name: 'CS-101-A' },
        report_date: '2026-08-24',
        reported_by: { user_name: 'Teacher' },
      },
    ]);

    render(<StudentRecordPage />);
    fireEvent.click(screen.getByTitle('Cấu hình tiêu chí vắng mặt'));
    fireEvent.click(await screen.findByText('Thùng rác'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveClass('max-h-[calc(100vh-1rem)]', 'overflow-hidden', 'rounded-2xl', 'shadow-sm');
    expect(dialog).toHaveClass('bg-white/45', 'backdrop-blur-xl');
    expect(screen.getByRole('tab', { name: /Vi phạm sinh viên/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Báo cáo của lớp/ })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getAllByText('Student 1')).not.toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Khôi phục Student 1' })).not.toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Xóa vĩnh viễn Student 1' })).not.toHaveLength(0);

    fireEvent.click(screen.getByRole('tab', { name: /Báo cáo của lớp/ }));
    expect((await screen.findAllByText('CS-101-A')).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Khôi phục CS-101-A' })).not.toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Xóa vĩnh viễn CS-101-A' })).not.toHaveLength(0);
  });

  it('keeps the trash empty state and navigation controls accessible', async () => {
    render(<StudentRecordPage />);
    fireEvent.click(screen.getByTitle('Cấu hình tiêu chí vắng mặt'));
    fireEvent.click(await screen.findByText('Thùng rác'));

    expect(await screen.findByText('Thùng rác ghi nhận vi phạm trống.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Báo cáo của lớp/ }));
    expect(await screen.findByText('Thùng rác báo cáo lớp trống.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quay lại cấu hình' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đóng thùng rác' })).toBeInTheDocument();
  });

  it('offers 500 rows for student pagination and refetches page one', async () => {
    (academicRecordApi.getAcademicRecords as any).mockResolvedValue({
      data: [],
      meta: { total: 501 },
    });

    render(<StudentRecordPage />);

    await waitFor(() => {
      expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 40 }),
      );
    });

    fireEvent.click(screen.getAllByRole('combobox').at(-1)!);
    expect(await screen.findByRole('option', { name: '500' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '1000' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: '500' }));

    await waitFor(() => {
      expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 500 }),
      );
    });
  });

  it('renders one student group, shows the filtered count, and opens full student history', async () => {
    const group = makeStudentGroup('student-1', 'latest-record-1', 3);
    (academicRecordApi.getAcademicRecords as any).mockResolvedValue({
      data: [group],
      meta: { total: 1, totalPages: 1, has_more: false },
    });
    (academicRecordApi.getAcademicRecords as any)
      .mockResolvedValueOnce({
        data: [group],
        meta: { total: 1, totalPages: 1, has_more: false },
      })
      .mockResolvedValueOnce([
      group.latestRecord,
      { ...group.latestRecord, _id: 'history-record-2' },
      ]);

    render(<StudentRecordPage />);

    await waitFor(() => {
      expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledWith(
        expect.objectContaining({ groupBy: 'student', page: 1, limit: 40 }),
      );
    });
    expect(await screen.findAllByText('Student 1')).toHaveLength(2);
    expect(screen.getAllByText('3 lần ghi nhận').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'Chi tiết' })[0]);
    await waitFor(() => {
      expect(academicRecordApi.getAcademicRecords).toHaveBeenLastCalledWith(
        { studentId: 'student-1' },
      );
    });
  });

  it('uses one latest-record column and keeps grouped row actions read-only', async () => {
    const group = makeStudentGroup('student-1', 'latest-record-1', 3);
    (academicRecordApi.getAcademicRecords as any).mockResolvedValue({
      data: [group],
      meta: { total: 1, totalPages: 1, has_more: false },
    });

    render(<StudentRecordPage />);

    expect(await screen.findByRole('columnheader', { name: 'Ghi nhận gần nhất' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Tiêu chí' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Ngày ghi nhận' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Latest record').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ngày: 25/08/2026').length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('Xem chi tiết').length).toBeGreaterThan(0);
    expect(screen.queryByTitle('Chỉnh sửa')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Xóa')).not.toBeInTheDocument();
    expect(screen.queryByText('Sửa ghi nhận')).not.toBeInTheDocument();
  });

  it('does not expose Excel export actions on the student situation tab', async () => {
    const group = makeStudentGroup('student-1', 'latest-record-1', 2);
    (academicRecordApi.getAcademicRecords as any).mockResolvedValueOnce({
      data: [group],
      meta: { total: 1, totalPages: 1, has_more: false },
    });

    render(<StudentRecordPage />);
    await screen.findAllByText('Student 1');

    expect(screen.queryByRole('button', { name: 'Xuất Excel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xuất Excel các sinh viên đã chọn' })).not.toBeInTheDocument();
    expect(mockXlsx.utils.json_to_sheet).not.toHaveBeenCalled();
    expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledTimes(1);
  });

  it('renders de-duplicated grouped type icons and the mixed-sign grouped total', async () => {
    const group = makeStudentGroup(
      'student-1',
      'latest-record-1',
      4,
      ['khen_thuong', 'cong_diem', 'ky_luat'],
      2,
    );
    (academicRecordApi.getAcademicRecords as any).mockResolvedValue({
      data: [group],
      meta: { total: 1, totalPages: 1, has_more: false },
    });

    render(<StudentRecordPage />);

    const rewardIcons = await screen.findAllByLabelText('Khen thưởng');
    const bonusIcons = await screen.findAllByLabelText('Cộng điểm');
    const disciplineIcons = await screen.findAllByLabelText('Kỷ luật');
    expect(rewardIcons[0]).toHaveClass('text-emerald-600');
    expect(bonusIcons[0]).toHaveClass('text-blue-600');
    expect(disciplineIcons[0]).toHaveClass('text-rose-600');
    expect(disciplineIcons[0].tagName.toLowerCase()).toBe('svg');
    expect(screen.getAllByText('+2')).not.toHaveLength(0);
    const groupedRow = screen
      .getAllByText('Student 1')
      .map((element) => element.closest('tr'))
      .find((row) => row !== null);
    expect(groupedRow).not.toBeNull();
    expect(groupedRow?.querySelector('[aria-label="Số lượng ghi nhận theo loại"]')).toBeNull();
    expect(screen.queryByText('Khen thưởng')).not.toBeInTheDocument();
    expect(screen.queryByText('Cộng điểm')).not.toBeInTheDocument();
    expect(screen.queryByText('Kỷ luật')).not.toBeInTheDocument();
  });

  it('loads every active student record in either drawer with history context', async () => {
    const group = makeStudentGroup('student-1', 'latest-record-1', 3);
    const history = [
      {
        ...group.latestRecord,
        _id: 'history-record-newest',
        record_title: 'Newest history record',
        createdAt: '2026-08-27T00:00:00.000Z',
        daily_report_id: 'class-report-1',
      },
      {
        ...group.latestRecord,
        _id: 'history-record-middle',
        record_title: 'Middle history record',
        createdAt: '2026-08-26T00:00:00.000Z',
      },
      {
        ...group.latestRecord,
        _id: 'history-record-oldest',
        record_title: 'Oldest history record',
        createdAt: '2026-08-25T00:00:00.000Z',
      },
    ];
    (academicRecordApi.getAcademicRecords as any)
      .mockResolvedValueOnce({
        data: [group],
        meta: { total: 1, totalPages: 1, has_more: false },
      })
      .mockResolvedValueOnce(history);

    render(<StudentRecordPage />);

    await screen.findAllByText('Student 1');
    fireEvent.click(screen.getByTitle('Xem chi tiết'));

    await waitFor(() => {
      expect(academicRecordApi.getAcademicRecords).toHaveBeenLastCalledWith(
        { studentId: 'student-1' },
      );
    });
    expect(await screen.findByText('Newest history record')).toBeInTheDocument();
    expect(screen.getByText('Middle history record')).toBeInTheDocument();
    expect(screen.getByText('Oldest history record')).toBeInTheDocument();
    expect(screen.getByText('Ghi nhận lớp')).toBeInTheDocument();
  });

  it('does not mark recent records without a class report source', async () => {
    const group = makeStudentGroup('student-1', 'latest-record-1', 1);
    const history = [{
      ...group.latestRecord,
      _id: 'history-record-manual',
      record_title: 'Manual history record',
      createdAt: '2026-08-27T00:00:00.000Z',
    }];
    (academicRecordApi.getAcademicRecords as any)
      .mockResolvedValueOnce({ data: [group], meta: { total: 1, totalPages: 1, has_more: false } })
      .mockResolvedValueOnce(history);

    render(<StudentRecordPage />);
    await screen.findAllByText('Student 1');
    fireEvent.click(screen.getByTitle('Xem chi tiết'));

    expect(await screen.findByText('Manual history record')).toBeInTheDocument();
    expect(screen.queryByText('Ghi nhận lớp')).not.toBeInTheDocument();
  });

  it('renders the filtered total and reconciled per-type counts', async () => {
    const group = makeStudentGroup(
      'student-1',
      'latest-record-1',
      12,
      ['khen_thuong', 'cong_diem', 'ky_luat'],
      4,
      { khen_thuong: 5, cong_diem: 5, ky_luat: 2 },
    );
    (academicRecordApi.getAcademicRecords as any).mockResolvedValue({
      data: [group],
      meta: { total: 1, totalPages: 1, has_more: false },
    });

    render(<StudentRecordPage />);

    expect(await screen.findAllByText('Tổng: 12')).not.toHaveLength(0);
    expect(screen.getAllByText('Kỷ luật: 2')).not.toHaveLength(0);
    expect(screen.getAllByText('Khen thưởng: 5')).not.toHaveLength(0);
    expect(screen.getAllByText('Cộng điểm: 5')).not.toHaveLength(0);
  });

  it('expands selected student groups to filtered, de-duplicated child IDs', async () => {
    const group1 = makeStudentGroup('student-1', 'latest-1', 2, ['ky_luat'], -10);
    const group2Base = makeStudentGroup('student-2', 'latest-2', 2, ['cong_diem'], 10);
    const group2 = {
      ...group2Base,
      latestRecord: {
        ...group2Base.latestRecord,
        student_id: {
          ...group2Base.latestRecord.student_id,
          _id: 'student-2',
          student_code: 'SV002',
          full_name: 'Student 2',
        },
      },
    };
    (academicRecordApi.getAcademicRecords as any)
      .mockResolvedValueOnce({
        data: [group1, group2],
        meta: { total: 2, totalPages: 1, has_more: false },
      })
      .mockResolvedValueOnce([
        { _id: 'child-1' },
        { _id: 'child-2' },
        { _id: 'child-1' },
      ])
      .mockResolvedValueOnce([
        { _id: 'child-2' },
        { _id: 'child-3' },
      ])
      .mockResolvedValue({ data: [], meta: { total: 0 } });
    (academicRecordApi.bulkDeleteAcademicRecords as any).mockResolvedValue({
      requested: 3,
      succeeded: ['child-1', 'child-2', 'child-3'],
      failed: [],
      succeededCount: 3,
      failedCount: 0,
    });

    render(<StudentRecordPage />);
    await screen.findAllByText('Student 1');
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Xóa \(2\)/ }));

    expect(await screen.findByText(/2 sinh viên/)).toBeInTheDocument();
    expect(screen.getByText(/3 ghi nhận/)).toBeInTheDocument();
    expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledWith({
      studentId: 'student-1',
      semesterId: 'semester-1',
      classId: undefined,
      startDate: undefined,
      endDate: undefined,
      creator: undefined,
    });
    const confirmDelete = screen.getAllByRole('button', { name: 'Xóa', exact: true })
      .find((button) => button.className.includes('bg-[#D92D20]'));
    fireEvent.click(confirmDelete!);

    await waitFor(() => {
      expect(academicRecordApi.bulkDeleteAcademicRecords).toHaveBeenCalledWith([
        'child-1', 'child-2', 'child-3',
      ]);
    });
  });

  it('keeps a grouped row selected when one child delete fails', async () => {
    const group = makeStudentGroup('student-1', 'latest-1', 2, ['ky_luat'], -10);
    (academicRecordApi.getAcademicRecords as any)
      .mockResolvedValueOnce({ data: [group], meta: { total: 1, totalPages: 1, has_more: false } })
      .mockResolvedValueOnce([{ _id: 'child-1' }, { _id: 'child-2' }])
      .mockResolvedValue({ data: [group], meta: { total: 1, totalPages: 1, has_more: false } });
    (academicRecordApi.bulkDeleteAcademicRecords as any).mockResolvedValue({
      requested: 2,
      succeeded: ['child-1'],
      failed: [{ id: 'child-2', message: 'Không đủ quyền' }],
      succeededCount: 1,
      failedCount: 1,
    });

    render(<StudentRecordPage />);
    await screen.findAllByText('Student 1');
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Xóa \(1\)/ }));
    expect(await screen.findByText(/1 sinh viên/)).toBeInTheDocument();
    expect(screen.getByText(/2 ghi nhận/)).toBeInTheDocument();
    const confirmDelete = screen.getAllByRole('button', { name: 'Xóa', exact: true })
      .find((button) => button.className.includes('bg-[#D92D20]'));
    fireEvent.click(confirmDelete!);

    await waitFor(() => {
      expect(academicRecordApi.bulkDeleteAcademicRecords).toHaveBeenCalledWith(['child-1', 'child-2']);
      expect(screen.getByText(/vẫn được giữ lại trong danh sách chọn/)).toBeInTheDocument();
      expect(screen.getAllByText('Student 1').length).toBeGreaterThan(0);
    });
  });

  it('refreshes immediately, coalesces an SSE burst, and trails an event during fetch', async () => {
    const initialGroup = makeStudentGroup('student-1', 'latest-record-1', 1);
    const updatedGroup = makeStudentGroup('student-1', 'latest-record-2', 2);
    let resolveRefresh!: (value: unknown) => void;
    const refreshPromise = new Promise((resolve) => { resolveRefresh = resolve; });
    (academicRecordApi.getAcademicRecords as any)
      .mockResolvedValueOnce({ data: [initialGroup], meta: { total: 1, totalPages: 1, has_more: false } })
      .mockReturnValueOnce(refreshPromise)
      .mockResolvedValue({ data: [updatedGroup], meta: { total: 1, totalPages: 1, has_more: false } });

    render(<StudentRecordPage />);
    await waitFor(() => expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledTimes(1));

    await act(async () => {
      mockRealtimeOptions.onEvent({ type: 'academic_record_changed' });
      mockRealtimeOptions.onEvent({ type: 'academic_record_changed' });
    });

    expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveRefresh({ data: [updatedGroup], meta: { total: 1, totalPages: 1, has_more: false } });
    });

    await waitFor(() => expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledTimes(3));
    expect(await screen.findAllByText('Student 1')).toHaveLength(2);
    expect(screen.getAllByText('2 lần ghi nhận').length).toBeGreaterThan(0);
  });

  it('defers row reconciliation until all sequential delete batches finish and blocks duplicate deletes', async () => {
    const records = Array.from({ length: 26 }, (_, index) => makeAcademicRecord(index + 1));
    let resolveFirstBatch!: (value: unknown) => void;
    let resolveSecondBatch!: (value: unknown) => void;
    const firstBatch = new Promise((resolve) => { resolveFirstBatch = resolve; });
    const secondBatch = new Promise((resolve) => { resolveSecondBatch = resolve; });

    (academicRecordApi.getAcademicRecords as any)
      .mockResolvedValueOnce({ data: records, meta: { total: records.length } })
      .mockResolvedValue({ data: [], meta: { total: 0 } });
    (academicRecordApi.bulkDeleteAcademicRecords as any)
      .mockReturnValueOnce(firstBatch)
      .mockReturnValueOnce(secondBatch);

    render(<StudentRecordPage />);
    await screen.findAllByText('Student 1');
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Xóa \(26\)/ }));
    expect(await screen.findByText('Chỉ các ID trong bản xem trước này được gửi đến API xoá mềm.')).toBeInTheDocument();
    const confirmDelete = screen.getAllByRole('button', { name: 'Xóa', exact: true })
      .find((button) => button.className.includes('bg-[#D92D20]'));
    fireEvent.click(confirmDelete!);

    await waitFor(() => {
      expect(academicRecordApi.bulkDeleteAcademicRecords).toHaveBeenCalledTimes(1);
    });
    expect(academicRecordApi.bulkDeleteAcademicRecords).toHaveBeenCalledWith(
      records.slice(0, 25).map((record) => record._id),
    );

    await act(async () => {
      resolveFirstBatch({
        requested: 25,
        succeeded: records.slice(0, 25).map((record) => record._id),
        failed: [],
        succeededCount: 25,
        failedCount: 0,
      });
    });

    await waitFor(() => {
      expect(academicRecordApi.bulkDeleteAcademicRecords).toHaveBeenCalledTimes(2);
      expect(screen.getAllByText('Student 1')).not.toHaveLength(0);
      expect(screen.getAllByText('Student 26')).not.toHaveLength(0);
      expect(screen.getByText(/Đã xử lý 25\/26/)).toBeInTheDocument();
    });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '26');
    const remainingDeleteButton = screen
      .getAllByText('Xóa (26)')
      .map((element) => element.closest('button'))
      .find((button) => button !== null);
    expect(remainingDeleteButton).toBeDisabled();

    await act(async () => {
      resolveSecondBatch({
        requested: 1,
        succeeded: ['record-26'],
        failed: [],
        succeededCount: 1,
        failedCount: 0,
      });
    });

    await waitFor(() => {
      expect(academicRecordApi.getAcademicRecords).toHaveBeenCalledTimes(2);
      expect(screen.queryAllByText('Student 1')).toHaveLength(0);
      expect(screen.getByText('Đã xoá thành công toàn bộ ghi nhận đã chọn.')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-delete-status')).toHaveTextContent('Hoàn tất');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '26');
    });
  });

  it('keeps failed rows selected and visible after a partial soft delete', async () => {
    const records = [makeAcademicRecord(1), makeAcademicRecord(2)];
    (academicRecordApi.getAcademicRecords as any)
      .mockResolvedValueOnce({ data: records, meta: { total: records.length } })
      .mockResolvedValue({ data: [records[1]], meta: { total: 1 } });
    (academicRecordApi.bulkDeleteAcademicRecords as any).mockResolvedValue({
      requested: 2,
      succeeded: ['record-1'],
      failed: [{ id: 'record-2', message: 'Không đủ quyền' }],
      succeededCount: 1,
      failedCount: 1,
    });

    render(<StudentRecordPage />);
    await screen.findAllByText('Student 1');
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Xóa \(2\)/ }));
    expect(await screen.findByText('Chỉ các ID trong bản xem trước này được gửi đến API xoá mềm.')).toBeInTheDocument();
    const confirmDelete = screen.getAllByRole('button', { name: 'Xóa', exact: true })
      .find((button) => button.className.includes('bg-[#D92D20]'));
    fireEvent.click(confirmDelete!);

    await waitFor(() => {
      expect(screen.queryAllByText('Student 1')).toHaveLength(0);
      expect(screen.getAllByText('Student 2')).not.toHaveLength(0);
      expect(screen.getAllByText('Xóa (1)')).not.toHaveLength(0);
      expect(screen.getByText(/vẫn được giữ lại trong danh sách chọn/)).toBeInTheDocument();
      expect(screen.getByTestId('bulk-delete-status')).toHaveTextContent('Hoàn tất một phần');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    });
  });

  it('reconciles the trash once after force delete completes', async () => {
    const record = makeAcademicRecord(1);
    (academicRecordApi.getAcademicRecords as any).mockResolvedValue({ data: [], meta: { total: 0 } });
    (academicRecordApi.getDeletedAcademicRecords as any)
      .mockResolvedValueOnce([record])
      .mockResolvedValueOnce([]);
    (academicRecordApi.bulkForceDeleteAcademicRecords as any).mockResolvedValue({
      requested: 1,
      succeeded: ['record-1'],
      failed: [],
      succeededCount: 1,
      failedCount: 0,
    });

    render(<StudentRecordPage />);
    fireEvent.click(screen.getByTitle('Cấu hình tiêu chí vắng mặt'));
    fireEvent.click(await screen.findByText('Thùng rác'));
    await screen.findAllByText('Student 1');
    fireEvent.click(screen.getByText('Xóa tất cả'));
    fireEvent.click(await screen.findByRole('button', { name: 'Xoá tất cả', exact: true }));

    await waitFor(() => {
      expect(academicRecordApi.bulkForceDeleteAcademicRecords).toHaveBeenCalledWith(['record-1']);
      expect(screen.queryAllByText('Student 1')).toHaveLength(0);
      expect(academicRecordApi.getDeletedAcademicRecords).toHaveBeenCalledTimes(2);
    });
  });
});
