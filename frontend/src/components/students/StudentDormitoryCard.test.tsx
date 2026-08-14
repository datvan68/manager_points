import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StudentDormitoryCard, { formatVndPrice, getEffectiveRoomLabel, getEffectiveBedLabel } from './StudentDormitoryCard';
import { dormitoryApi, SelfDormitoryRegistration } from '@/api/dormitory-api';
import { semesterApi } from '@/api/semester-api';
import { toast } from 'sonner';

// Mock auth provider
const mockUseAuth = vi.fn();
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock dormitoryApi
vi.mock('@/api/dormitory-api', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    dormitoryApi: {
      ...actual.dormitoryApi,
      registrations: {
        ...actual.dormitoryApi?.registrations,
        updateMine: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

describe('StudentDormitoryCard helper functions', () => {
  it('formatVndPrice formats numbers to VND currency or returns fallback', () => {
    expect(formatVndPrice(1500000)).toMatch(/1\.500\.000/);
    expect(formatVndPrice(0)).toBe('Chưa có giá');
    expect(formatVndPrice(null)).toBe('Chưa có giá');
    expect(formatVndPrice(undefined)).toBe('Chưa có giá');
    expect(formatVndPrice(-100)).toBe('Chưa có giá');
  });

  it('getEffectiveRoomLabel returns room name, code, or fallback', () => {
    expect(getEffectiveRoomLabel({ room_id: { room_name: 'P101' } } as any)).toBe('P101');
    expect(getEffectiveRoomLabel({ room_id: { room_code: '101' } } as any)).toBe('101');
    expect(getEffectiveRoomLabel({ assigned_room_name: 'Phòng A' } as any)).toBe('Phòng A');
    expect(getEffectiveRoomLabel({} as any)).toBe('Chưa xếp phòng');
  });

  it('getEffectiveBedLabel returns bed code or fallback', () => {
    expect(getEffectiveBedLabel({ bed_id: { bed_code: 'G01' } } as any)).toBe('G01');
    expect(getEffectiveBedLabel({} as any)).toBe('Chưa xếp giường');
  });
});

describe('StudentDormitoryCard rendering and behaviors', () => {
  const mockRegistrationData: SelfDormitoryRegistration = {
    has_dormitory_registration: true,
    registration: {
      _id: 'reg-123',
      registration_code: 'DK-2025-001',
      student_id: 'student-1',
      semester: 'HK1',
      academic_year: '2025-2026',
      status: 'Đã duyệt',
      phone_number: '0912345678',
      priority_group: 'Khó khăn',
      preference: {
        room_type: 'Máy lạnh',
        notes: 'Gần cửa sổ',
      },
      room_id: {
        _id: 'room-1',
        room_name: 'Phòng 204',
        room_code: '204',
        room_price: 2500000,
        room_type: 'Máy lạnh',
      } as any,
      bed_id: {
        _id: 'bed-1',
        bed_code: 'G02',
      } as any,
      active_contract: {
        _id: 'contract-1',
        contract_code: 'HD-2025-01',
        start_date: '2025-09-01T00:00:00.000Z',
        end_date: '2026-01-31T00:00:00.000Z',
        status: 'Hiệu lực',
      } as any,
      editable_fields: ['phone_number', 'preference', 'priority_group'],
    },
    history: [],
  };

  const studentObj = {
    _id: 'student-1',
    user_id: 'user-student-1',
    full_name: 'Trần Văn B',
    student_code: 'SV2025001',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(semesterApi, 'getSemesters').mockResolvedValue([
      { _id: 'semester-2', semester_name: 'HK2 - 2025 - 2026', start_date: '', end_date: '', status: 'active' },
    ]);
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-admin',
        role: 'Admin',
        roleName: 'Admin',
        roleCode: 'ADMIN',
        permissions: ['DORM_REG_UPDATE', 'DORM_REG_READ'],
      },
    });
  });

  it('AC1: renders an explicit non-resident state when student has no linked registration', () => {
    render(
      <StudentDormitoryCard
        registrationData={{ has_dormitory_registration: false, registration: null, history: [] }}
        student={studentObj as any}
      />
    );
    expect(screen.getByText('Thông tin KTX')).toBeInTheDocument();
    expect(screen.getByText('Không ở trong KTX')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /xem chi tiết ktx/i })).not.toBeInTheDocument();
  });

  it('AC4: renders Thông tin KTX card showing effective room and VND price', () => {
    render(
      <StudentDormitoryCard
        registrationData={mockRegistrationData}
        student={studentObj as any}
      />
    );

    expect(screen.getByText('Thông tin KTX')).toBeInTheDocument();
    expect(screen.getByText('Phòng 204')).toBeInTheDocument();
    expect(screen.getByText('G02')).toBeInTheDocument();
    expect(screen.getByText(/2\.500\.000/)).toBeInTheDocument();
    expect(screen.getByText('HK1 - 2025-2026')).toBeInTheDocument();
  });

  it('AC4: displays fallback when room or price is absent', () => {
    const unassignedData: SelfDormitoryRegistration = {
      has_dormitory_registration: true,
      registration: {
        _id: 'reg-456',
        registration_code: 'DK-2025-002',
        student_id: 'student-1',
        semester: 'HK2',
        academic_year: '2025-2026',
        status: 'Chờ duyệt',
        phone_number: '0988888888',
        priority_group: 'Không',
        room_id: undefined,
        bed_id: undefined,
        editable_fields: ['phone_number', 'preference', 'priority_group'],
      },
      history: [],
    };

    render(
      <StudentDormitoryCard
        registrationData={unassignedData}
        student={studentObj as any}
      />
    );

    expect(screen.getByText('Chưa xếp phòng')).toBeInTheDocument();
    expect(screen.getByText('Chưa xếp giường')).toBeInTheDocument();
    expect(screen.getByText('Chưa có giá')).toBeInTheDocument();
  });

  it('AC5: advance icon opens the edit registration form directly', () => {
    render(
      <StudentDormitoryCard
        registrationData={mockRegistrationData}
        student={studentObj as any}
      />
    );

    const advanceButton = screen.getByRole('button', { name: /xem chi tiết ktx/i });
    expect(advanceButton).toBeInTheDocument();

    fireEvent.click(advanceButton);

    expect(screen.getByText('Sửa đơn đăng ký')).toBeInTheDocument();
    expect(screen.queryByText('Chi tiết đăng ký Ký túc xá')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('0912345678')).toBeInTheDocument();
    expect(screen.getByText('Khó khăn')).toBeInTheDocument();
  });

  it('AC6: read-only user (e.g. Teacher without update permissions) cannot see edit button', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-teacher',
        role: 'Teacher',
        roleName: 'Teacher',
        roleCode: 'TEACHER',
        permissions: [],
      },
    });

    render(
      <StudentDormitoryCard
        registrationData={mockRegistrationData}
        student={studentObj as any}
      />
    );

    const advanceButton = screen.getByRole('button', { name: /xem chi tiết ktx/i });
    fireEvent.click(advanceButton);

    expect(screen.getByText('Sửa đơn đăng ký')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /chỉnh sửa/i })).not.toBeInTheDocument();
  });

  it('AC6: authorized staff can edit and submit update successfully', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    (dormitoryApi.registrations.update as any).mockResolvedValue({ _id: 'reg-123' });

    render(
      <StudentDormitoryCard
        registrationData={mockRegistrationData}
        student={studentObj as any}
        onRefresh={onRefresh}
      />
    );

    // Open modal
    fireEvent.click(screen.getByRole('button', { name: /xem chi tiết ktx/i }));

    // Edit phone number
    await waitFor(() => expect(screen.getByText('HK2')).toBeInTheDocument());
    const phoneInput = screen.getByDisplayValue('0912345678');
    fireEvent.change(phoneInput, { target: { value: '0999999999' } });
    const ethnicityInput = screen.getByText('Dân tộc').parentElement?.querySelector('input');
    expect(ethnicityInput).toBeTruthy();
    fireEvent.change(ethnicityInput as HTMLInputElement, { target: { value: 'Kinh' } });

    // Submit
    const saveButton = screen.getByRole('button', { name: /lưu thay đổi/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(dormitoryApi.registrations.update).toHaveBeenCalledWith(
        'reg-123',
        'FORMAL',
        expect.objectContaining({
          phone_number: '0999999999',
          applicant_profile: { ethnicity: 'Kinh' },
        })
      );
      expect(toast.success).toHaveBeenCalledWith('Cập nhật thông tin KTX thành công!');
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it('AC6: failed update preserves entered data and shows an error', async () => {
    (dormitoryApi.registrations.update as any).mockRejectedValue(new Error('Lỗi máy chủ khi cập nhật'));

    render(
      <StudentDormitoryCard
        registrationData={mockRegistrationData}
        student={studentObj as any}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /xem chi tiết ktx/i }));

    await waitFor(() => expect(screen.getByText('HK2')).toBeInTheDocument());
    const phoneInput = screen.getByDisplayValue('0912345678');
    fireEvent.change(phoneInput, { target: { value: '0977777777' } });

    fireEvent.click(screen.getByRole('button', { name: /lưu thay đổi/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Lỗi máy chủ khi cập nhật');
      // Verify data is preserved
      expect(screen.getByDisplayValue('0977777777')).toBeInTheDocument();
    });
  });

  it('AC5: closing the modal returns focus to the trigger button', async () => {
    vi.useFakeTimers();
    render(
      <StudentDormitoryCard
        registrationData={mockRegistrationData}
        student={studentObj as any}
      />
    );

    const advanceButton = screen.getByRole('button', { name: /xem chi tiết ktx/i });
    fireEvent.click(advanceButton);
    expect(screen.getByText('Sửa đơn đăng ký')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hủy/i }));

    vi.advanceTimersByTime(150);
    expect(document.activeElement).toBe(advanceButton);
    vi.useRealTimers();
  });

  it('AC6: eligible student self-service user can update allowed fields via updateMine', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-student-1',
        role: 'Student',
        roleName: 'Student',
        roleCode: 'STUDENT',
        studentId: 'student-1',
        permissions: [],
      },
    });

    (dormitoryApi.registrations.updateMine as any).mockResolvedValue({ _id: 'reg-123' });
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <StudentDormitoryCard
        registrationData={mockRegistrationData}
        student={studentObj as any}
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /xem chi tiết ktx/i }));
    await waitFor(() => expect(screen.getByText('HK2')).toBeInTheDocument());
    const phoneInput = screen.getByDisplayValue('0912345678');
    fireEvent.change(phoneInput, { target: { value: '0988776655' } });

    fireEvent.click(screen.getByRole('button', { name: /lưu thay đổi/i }));

    await waitFor(() => {
      expect(dormitoryApi.registrations.updateMine).toHaveBeenCalledWith({
        phone_number: '0988776655',
        priority_group: 'Khó khăn',
        preference: {
          room_type: 'Máy lạnh',
          notes: 'Gần cửa sổ',
        },
      });
      expect(toast.success).toHaveBeenCalledWith('Cập nhật thông tin KTX thành công!');
      expect(onRefresh).toHaveBeenCalled();
    });
  });
});
