import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { dormitoryApi } from '@/api/dormitory-api';
import { ApplicantProfileFields, buildPublicRegistrationPayload, emptyApplicantProfile, PublicDormitoryRegistrationModal, publicRoomTypeForGender } from './PublicDormitoryRegistrationModal';

vi.mock('@/api/dormitory-api', () => ({
  dormitoryApi: { public: { getActiveSemester: vi.fn(), register: vi.fn() } },
}));

vi.mock('@/components/calendar/CustomCalendar', () => ({
  CustomCalendar: ({ onRangeSelect, onRangeConfirm, onCancel, onConfirm }: any) => (
    <div data-testid="issue-date-calendar">
      <button type="button" onClick={() => onRangeSelect(new Date(2024, 0, 2), new Date(2024, 0, 2))}>Select issue date</button>
      <button type="button" onClick={onCancel}>Cancel issue date</button>
      <button type="button" onClick={() => { onRangeConfirm(new Date(2024, 0, 2), null); onConfirm(); }}>Confirm issue date</button>
    </div>
  ),
}));

describe('public KTX registration room type', () => {
  it('allows the requested room type only for female applicants', () => {
    expect(publicRoomTypeForGender('Female', 'Máy lạnh')).toBe('Máy lạnh');
    expect(publicRoomTypeForGender('Male', 'Máy lạnh')).toBe('Thường');
    expect(publicRoomTypeForGender('Other', 'Máy lạnh')).toBe('Thường');
  });
});

it('matches the create modal layout and submits the existing public payload', async () => {
  vi.mocked(dormitoryApi.public.getActiveSemester).mockResolvedValue({ semester_name: 'HK 2025-2026' } as any);
  vi.mocked(dormitoryApi.public.register).mockResolvedValue({ success: true, roster_entry_code: 'KTX-001' } as any);
  const onOpenChange = vi.fn();
  render(<PublicDormitoryRegistrationModal qrRoomId="room-1" onOpenChange={onOpenChange} />);

  expect(await screen.findByText('HK 2025-2026')).toBeInTheDocument();
  expect(screen.getByText('Thông tin cá nhân')).toBeInTheDocument();
  expect(screen.getByText('Loại phòng và ghi chú')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Gửi đăng ký' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  expect(onOpenChange).toHaveBeenCalledWith(false);

  fireEvent.change(screen.getByPlaceholderText('Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
  fireEvent.change(screen.getByPlaceholderText('SV001'), { target: { value: 'SV001' } });
  fireEvent.click(screen.getByRole('button', { name: 'Chọn ngày sinh' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select issue date' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm issue date' }));
  fireEvent.click(screen.getByRole('combobox', { name: 'Giới tính' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Nữ' }));
  fireEvent.change(screen.getByPlaceholderText('0912345678'), { target: { value: '0912345678' } });
  fireEvent.change(screen.getByPlaceholderText('Thông tin cần lưu ý...'), { target: { value: 'Tầng 2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi đăng ký' }));

  await waitFor(() => expect(dormitoryApi.public.register).toHaveBeenCalledWith(expect.objectContaining({
    full_name: 'Nguyễn Văn A', student_code: 'SV001', gender: 'Female', phone_number: '0912345678', notes: 'Tầng 2', room_type: 'Thường', qr_room_id: 'room-1',
  })));
});

it('persists populated applicant and parent profile fields while omitting blank fields', () => {
  const applicant_profile = emptyApplicantProfile();
  applicant_profile.ethnicity = 'Kinh';
  applicant_profile.citizen_id_issue_date = '2024-01-02';
  applicant_profile.father!.full_name = 'Nguyễn Văn B';
  const payload = buildPublicRegistrationPayload({ full_name: 'Nguyễn Văn A', student_code: '', date_of_birth: '2003-01-15', gender: 'Male', phone_number: '0912345678', room_type: 'Máy lạnh', notes: '', applicant_profile });
  expect(payload.applicant_profile).toEqual({ ethnicity: 'Kinh', citizen_id_issue_date: '2024-01-02', father: { full_name: 'Nguyễn Văn B' } });
});

it('wires the applicant issue date calendar and keeps the API date format', () => {
  const onChange = vi.fn();
  render(<ApplicantProfileFields value={emptyApplicantProfile()} onChange={onChange} />);

  fireEvent.click(screen.getByRole('button', { name: 'Ngày cấp CCCD/CMND' }));
  expect(screen.getByTestId('issue-date-calendar')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Select issue date' }));
  expect(onChange).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel issue date' }));
  expect(screen.queryByTestId('issue-date-calendar')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Ngày cấp CCCD/CMND' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm issue date' }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ citizen_id_issue_date: '2024-01-02' }));
  expect(screen.queryByTestId('issue-date-calendar')).not.toBeInTheDocument();
});
