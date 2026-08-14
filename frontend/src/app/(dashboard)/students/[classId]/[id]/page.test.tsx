import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StudentProfilePage from './page';
import { classApi } from '@/api/class-api';
import { studentApi } from '@/api/student-api';
import { semesterApi } from '@/api/semester-api';
import { summariesPointApi } from '@/api/summaries-point-api';
import { academicRecordApi } from '@/api/academic-record-api';
import { dormitoryApi } from '@/api/dormitory-api';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useParams: () => ({ classId: 'class-1', id: 'student-1' }),
}));

// Mock framer-motion to render children directly
vi.mock('framer-motion', () => ({
  motion: {
    main: ({ children, className }: any) => <main className={className}>{children}</main>,
    div: ({ children, className }: any) => <div className={className}>{children}</div>,
  },
}));

// Mock auth provider
const mockUseAuth = vi.fn();
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock header provider
vi.mock('@/providers/header-provider', () => ({
  HeaderCustomMappings: () => null,
}));

// Mock APIs
vi.mock('@/api/class-api', () => ({
  classApi: {
    getClass: vi.fn(),
  },
}));

vi.mock('@/api/student-api', () => ({
  studentApi: {
    getStudent: vi.fn(),
  },
}));

vi.mock('@/api/semester-api', () => ({
  semesterApi: {
    getSemesters: vi.fn(),
  },
}));

vi.mock('@/api/summaries-point-api', () => ({
  summariesPointApi: {
    getSummariesPoints: vi.fn(),
  },
}));

vi.mock('@/api/academic-record-api', () => ({
  academicRecordApi: {
    getAcademicRecordsByStudent: vi.fn(),
  },
}));

vi.mock('@/api/dormitory-api', () => ({
  dormitoryApi: {
    registrations: {
      getByStudent: vi.fn(),
      updateMine: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('StudentProfilePage with virtualized records and dormitory card', () => {
  const mockStudent = {
    _id: 'student-1',
    full_name: 'Nguyễn Văn Test',
    student_code: 'SV2025001',
    date_bir: '2004-05-12',
    sex: 'Male',
    email: 'test@example.com',
    class_id: {
      _id: 'class-1',
      class_name: 'CTK44',
      dept_id: { name: 'Công nghệ thông tin' },
    },
  };

  const mockClass = {
    _id: 'class-1',
    class_name: 'CTK44',
  };

  const mockRecordsPage1 = Array.from({ length: 10 }, (_, i) => ({
    _id: `rec-${i + 1}`,
    student_id: 'student-1',
    record_title: `Ghi nhận số ${i + 1}`,
    criterion_id: {
      _id: `crit-${i + 1}`,
      criterion_name: `Tiêu chí ${i + 1}`,
      criterion_type: i % 2 === 0 ? 'khen_thuong' : 'ky_luat',
      score_per_unit: i % 2 === 0 ? 5 : -5,
    },
    recorded_at: '2025-10-15T00:00:00.000Z',
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-admin',
        role: 'Admin',
        roleName: 'Admin',
        permissions: ['DORM_REG_UPDATE'],
      },
    });

    (classApi.getClass as any).mockResolvedValue(mockClass);
    (studentApi.getStudent as any).mockResolvedValue(mockStudent);
    (semesterApi.getSemesters as any).mockResolvedValue([
      { _id: 'sem-1', semester_name: 'HK1 - 2025 - 2026', status: 'active' },
    ]);
    (summariesPointApi.getSummariesPoints as any).mockResolvedValue({
      data: [{ _id: 'sum-1', semester_id: 'sem-1', total_score: 88 }],
    });
  });

  it('AC1 & AC2: initial load requests first page with pagination params rather than fetching all', async () => {
    (academicRecordApi.getAcademicRecordsByStudent as any).mockResolvedValue({
      data: mockRecordsPage1,
      total: 11,
      page: 1,
      limit: 10,
      totalPages: 2,
      has_more: true,
    });
    (dormitoryApi.registrations.getByStudent as any).mockResolvedValue({
      has_dormitory_registration: false,
      registration: null,
      history: [],
    });

    render(<StudentProfilePage />);

    await waitFor(() => {
      expect(academicRecordApi.getAcademicRecordsByStudent).toHaveBeenCalledWith(
        'student-1',
        { page: 1, limit: 10 }
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText('Nguyễn Văn Test')[0]).toBeInTheDocument();
      expect(screen.getByText('11 bản ghi')).toBeInTheDocument();
    });
  });

  it('AC4: shows non-resident dormitory state when student has no dormitory registration', async () => {
    (academicRecordApi.getAcademicRecordsByStudent as any).mockResolvedValue({
      data: mockRecordsPage1,
      total: 10,
      page: 1,
      limit: 10,
      totalPages: 1,
      has_more: false,
    });
    (dormitoryApi.registrations.getByStudent as any).mockResolvedValue({
      has_dormitory_registration: false,
      registration: null,
      history: [],
    });

    render(<StudentProfilePage />);

    await waitFor(() => {
      expect(screen.getAllByText('Nguyễn Văn Test')[0]).toBeInTheDocument();
    });

    expect(screen.getByText('Thông tin KTX')).toBeInTheDocument();
    expect(screen.getByText('Không ở trong KTX')).toBeInTheDocument();
  });

  it('AC4: renders Thông tin KTX card when student has linked dormitory registration', async () => {
    (academicRecordApi.getAcademicRecordsByStudent as any).mockResolvedValue({
      data: mockRecordsPage1,
      total: 10,
      page: 1,
      limit: 10,
      totalPages: 1,
      has_more: false,
    });
    (dormitoryApi.registrations.getByStudent as any).mockResolvedValue({
      has_dormitory_registration: true,
      registration: {
        _id: 'reg-100',
        registration_code: 'DK-2025-100',
        semester: 'HK1',
        academic_year: '2025-2026',
        status: 'Đã duyệt',
        room_id: { room_name: 'Phòng 302', room_code: '302', room_price: 2000000 },
        bed_id: { bed_code: 'G01' },
      },
      history: [],
    });

    render(<StudentProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Thông tin KTX')).toBeInTheDocument();
      expect(screen.getByText('Phòng 302')).toBeInTheDocument();
      expect(screen.getByText(/2\.000\.000/)).toBeInTheDocument();
    });
  });

  it('AC2: renders empty state when records array is empty', async () => {
    (academicRecordApi.getAcademicRecordsByStudent as any).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      has_more: false,
    });
    (dormitoryApi.registrations.getByStudent as any).mockResolvedValue({
      has_dormitory_registration: false,
      registration: null,
      history: [],
    });

    render(<StudentProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Sinh viên chưa có ghi nhận rèn luyện nào.')).toBeInTheDocument();
    });
  });

  it('AC1: virtual region has accessible role and aria-label with bounded container', async () => {
    (academicRecordApi.getAcademicRecordsByStudent as any).mockResolvedValue({
      data: mockRecordsPage1,
      total: 10,
      page: 1,
      limit: 10,
      totalPages: 1,
      has_more: false,
    });
    (dormitoryApi.registrations.getByStudent as any).mockResolvedValue({
      has_dormitory_registration: false,
      registration: null,
      history: [],
    });

    render(<StudentProfilePage />);

    await waitFor(() => {
      const region = screen.getByRole('region', { name: 'Danh sách ghi nhận rèn luyện' });
      expect(region).toBeInTheDocument();
      expect(region).toHaveClass('overflow-y-auto');
    });
  });

  it('AC2: displays end of list message when has_more is false', async () => {
    (academicRecordApi.getAcademicRecordsByStudent as any).mockResolvedValue({
      data: mockRecordsPage1.slice(0, 3),
      total: 3,
      page: 1,
      limit: 10,
      totalPages: 1,
      has_more: false,
    });
    (dormitoryApi.registrations.getByStudent as any).mockResolvedValue({
      has_dormitory_registration: false,
      registration: null,
      history: [],
    });

    render(<StudentProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Đã hiển thị tất cả ghi nhận')).toBeInTheDocument();
    });
  });

  it('AC3: handles backward-compatible plain array from getAcademicRecordsByStudent', async () => {
    (academicRecordApi.getAcademicRecordsByStudent as any).mockResolvedValue(mockRecordsPage1.slice(0, 2));
    (dormitoryApi.registrations.getByStudent as any).mockResolvedValue({
      has_dormitory_registration: false,
      registration: null,
      history: [],
    });

    render(<StudentProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('2 bản ghi')).toBeInTheDocument();
      expect(screen.getByText(/Hiển thị 2\/2 bản ghi/)).toBeInTheDocument();
    });
  });
});
