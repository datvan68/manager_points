import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApplicantProfileFields, buildPublicRegistrationPayload, emptyApplicantProfile, publicRoomTypeForGender } from './PublicDormitoryRegistrationModal';

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
