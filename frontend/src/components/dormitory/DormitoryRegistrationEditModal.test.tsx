import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { dormitoryApi, DormRegistration } from '@/api/dormitory-api';
import { semesterApi } from '@/api/semester-api';
import DormitoryRegistrationEditModal, { buildEditRegistrationPayload, mapActiveSemester, normalizeDormitoryRegistrationSource } from './DormitoryRegistrationEditModal';

const registration = (source: DormRegistration['source'] = 'FORMAL'): DormRegistration => ({
  _id: 'registration-1', registration_code: 'DK-1', student_id: 'student-1', source,
  semester: 'HK1', academic_year: '2024-2025', date_of_birth: '2003-01-15', gender: 'Female', phone_number: '0912345678', priority_group: 'Không',
  preference: { room_type: 'Thường', notes: 'Gần cửa sổ' }, status: 'Chờ duyệt',
});

describe('DormitoryRegistrationEditModal', () => {
  it('normalizes missing or unknown registration sources to FORMAL', () => {
    expect(normalizeDormitoryRegistrationSource()).toBe('FORMAL');
    expect(normalizeDormitoryRegistrationSource('CLASSIFIED')).toBe('FORMAL');
    expect(normalizeDormitoryRegistrationSource('PUBLIC')).toBe('PUBLIC');
    expect(normalizeDormitoryRegistrationSource('ADMIN_TEMPORARY')).toBe('ADMIN_TEMPORARY');
  });
  let getSemesters: ReturnType<typeof vi.spyOn>;
  let update: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getSemesters = vi.spyOn(semesterApi, 'getSemesters').mockResolvedValue([{ _id: 'semester-2', semester_name: 'HK2 - 2025 - 2026', start_date: '', end_date: '', status: 'active' }]);
    update = vi.spyOn(dormitoryApi.registrations, 'update').mockResolvedValue({} as DormRegistration);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads one active semester on every open and overrides existing defaults', async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<DormitoryRegistrationEditModal open registration={registration()} onOpenChange={onOpenChange} />);

    expect(getSemesters).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText(/HK2 - 2025 - 2026/)).toBeInTheDocument());

    rerender(<DormitoryRegistrationEditModal open={false} registration={registration()} onOpenChange={onOpenChange} />);
    rerender(<DormitoryRegistrationEditModal open registration={registration()} onOpenChange={onOpenChange} />);
    await waitFor(() => expect(getSemesters).toHaveBeenCalledTimes(2));
  });

  it('shows the active-semester error and does not submit when mapping fails', async () => {
    getSemesters.mockResolvedValue([{ _id: 'bad', semester_name: 'Current', start_date: '', end_date: '', status: 'active' }]);
    render(<DormitoryRegistrationEditModal open registration={registration('ADMIN_TEMPORARY')} onOpenChange={vi.fn()} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: /lưu thay đổi/i });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(update).not.toHaveBeenCalled();
  });

  it('blocks saving when active-semester loading fails', async () => {
    getSemesters.mockRejectedValue(new Error('semester unavailable'));
    render(<DormitoryRegistrationEditModal open registration={registration()} onOpenChange={vi.fn()} />);

    expect(await screen.findByText('semester unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lưu thay đổi/i })).toBeDisabled();
    expect(update).not.toHaveBeenCalled();
  });

  it.each(['PUBLIC', 'ADMIN_TEMPORARY'] as const)('submits the complete form through the selected %s source route', async source => {
    const row = { ...registration(source), full_name: 'Applicant', student_code: 'APP-1' };
    render(<DormitoryRegistrationEditModal open registration={row} onOpenChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/HK2 - 2025 - 2026/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/i }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('registration-1', source, expect.objectContaining({ semester: 'HK2', academic_year: '2025-2026' })));
  });

  it('keeps source-aware payload shapes while sharing the complete form', () => {
    const form = {
      full_name: 'Nguyễn A', student_code: '', semester: 'HK2', academic_year: '2025-2026', date_of_birth: '2003-01-15', gender: 'Female' as const,
      phone_number: '0912345678', room_type: 'Máy lạnh' as const, notes: 'Gần khu học tập', priority_group: 'Không' as const, applicant_profile: {},
    };
    const formalPayload = buildEditRegistrationPayload('FORMAL', form);
    expect(formalPayload).not.toHaveProperty('full_name');
    expect(formalPayload).not.toHaveProperty('student_code');
    expect(formalPayload).not.toHaveProperty('room_type');
    expect(formalPayload).not.toHaveProperty('notes');
    expect(formalPayload).not.toHaveProperty('preference');
    const temporaryPayload = buildEditRegistrationPayload('ADMIN_TEMPORARY', form);
    expect(temporaryPayload).toMatchObject({ full_name: 'Nguyễn A', student_code: '', room_type: 'Máy lạnh', notes: 'Gần khu học tập' });
    expect(temporaryPayload).not.toHaveProperty('preference');
  });

  it('shows formal student identity as read-only and removes duplicate semester cards', async () => {
    const row = { ...registration(), student_id: { _id: 'student-1', full_name: 'Student In Class', student_code: 'SV001' } };
    render(<DormitoryRegistrationEditModal open registration={row} onOpenChange={vi.fn()} />);

    expect(await screen.findByDisplayValue('Student In Class')).toHaveAttribute('readonly');
    expect(screen.getByDisplayValue('SV001')).toHaveAttribute('readonly');
    expect(screen.getByDisplayValue('Thường')).toHaveAttribute('readonly');
    expect(screen.getByDisplayValue('Gần cửa sổ')).toHaveAttribute('readonly');
    expect(screen.queryByText('Kỳ active')).not.toBeInTheDocument();
    expect(screen.queryByText('Năm học active')).not.toBeInTheDocument();
  });

  it.each(['PUBLIC', 'ADMIN_TEMPORARY'] as const)('keeps identity, room type, and notes editable for %s', async source => {
    const row = { ...registration(source), full_name: 'Applicant', student_code: 'APP-1' };
    render(<DormitoryRegistrationEditModal open registration={row} onOpenChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/HK2 - 2025 - 2026/)).toBeInTheDocument());
    expect(screen.getByDisplayValue('Applicant')).not.toHaveAttribute('readonly');
    const roomTypeInput = screen.getAllByRole('textbox').find(input => input.getAttribute('placeholder')?.includes('ph'));
    expect(roomTypeInput).toBeTruthy();
    expect(roomTypeInput).not.toBeDisabled();
    const notes = screen.getAllByRole('textbox').find(input => input.tagName === 'TEXTAREA');
    expect(notes).toBeTruthy();
    expect(notes).not.toHaveAttribute('readonly');
  });

  it('exports strict active-semester validation for missing, duplicate, and malformed data', () => {
    expect(() => mapActiveSemester([])).toThrow('Chưa có học kỳ active');
    expect(() => mapActiveSemester([
      { _id: 'one', semester_name: 'HK1 - 2025 - 2026', start_date: '', end_date: '', status: 'active' },
      { _id: 'two', semester_name: 'HK2 - 2025 - 2026', start_date: '', end_date: '', status: 'active' },
    ])).toThrow('Có nhiều học kỳ');
  });
});
