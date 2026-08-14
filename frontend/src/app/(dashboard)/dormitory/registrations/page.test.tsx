import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { dormitoryApi } from '@/api/dormitory-api';
import { applyRoomAssignment, buildEditRegistrationPayload, createdDateLabel, getPublicRegistrationUrl, hasAssignedBed, isAvailableBed, mapActiveSemester, priorityLabel, REGISTRATION_TABLE_CLASS_NAME, RoomAssignmentPopover, roomLabel, roomQuantityLabel, roomStatusLabel, selectedPdfRegistration, sourceLabel, studentCode } from './page';

const registrationPageSource = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');

describe('KTX registration active semester mapping', () => {
  it('maps the active semester label to the registration payload fields', () => {
    expect(mapActiveSemester([
      { _id: 'semester-1', semester_name: 'HK2 - 2025 - 2026', start_date: '', end_date: '', status: 'active' },
    ])).toEqual({ semester: 'HK2', academic_year: '2025-2026' });
  });

  it('rejects missing, duplicate, and malformed active semesters', () => {
    expect(() => mapActiveSemester([])).toThrow('Chưa có học kỳ active');
    expect(() => mapActiveSemester([
      { _id: 'semester-1', semester_name: 'HK1 - 2025 - 2026', start_date: '', end_date: '', status: 'active' },
      { _id: 'semester-2', semester_name: 'HK2 - 2025 - 2026', start_date: '', end_date: '', status: 'active' },
    ])).toThrow('Có nhiều học kỳ');
    expect(() => mapActiveSemester([
      { _id: 'semester-1', semester_name: 'Học kỳ hiện tại', start_date: '', end_date: '', status: 'active' },
    ])).toThrow('Không đọc được định dạng');
  });
});

describe('KTX public registration QR destination', () => {
  it('uses the same-origin public registration route', () => {
    expect(getPublicRegistrationUrl('https://ktx.example.edu/')).toBe('https://ktx.example.edu/public/dormitory/register');
  });
});

describe('KTX registration table display mapping', () => {
  it('uses the requested student-code, priority, and source labels', () => {
    const row = { student_id: null, priority_group: 'Không', source: 'PUBLIC' } as any;
    expect(studentCode(row)).toBe('Chưa có mã SV');
    expect(priorityLabel(row)).toBe('Không');
    expect(sourceLabel(row.source)).toBe('QR');
    expect(sourceLabel('FORMAL')).toBe('Thủ công');
    expect(priorityLabel({ priority_group: 'Khó khăn' } as any)).toBe('Có');
    expect(studentCode({ student_id: { student_code: '  ' } } as any)).toBe('Chưa có mã SV');
    expect(createdDateLabel('not-a-date')).toBe('—');
    expect(roomLabel({ assigned_room_name: 'A101' } as any)).toBe('A101');
    expect(roomLabel({} as any)).toBe('Chưa xếp phòng');
  });
});

describe('KTX registration edit payloads', () => {
  const form = {
    full_name: 'Nguyễn A', student_code: '', semester: 'HK2', academic_year: '2025-2026', date_of_birth: '2003-01-15',
    gender: 'Female' as const, phone_number: '0912345678', room_type: 'Máy lạnh' as const, notes: 'Gần khu học tập', priority_group: 'Không' as const,
    applicant_profile: { ethnicity: 'Kinh', father: { full_name: 'Nguyễn Văn B' } },
  };

  it('keeps temporary updates flat so the API never receives preference', () => {
    const payload = buildEditRegistrationPayload('ADMIN_TEMPORARY', form);
    expect(payload).toMatchObject({ room_type: 'Máy lạnh', notes: 'Gần khu học tập' });
    expect(payload).not.toHaveProperty('preference');
  });

  it('keeps nested preference for formal registration updates', () => {
    const payload = buildEditRegistrationPayload('FORMAL', form);
    expect(payload.preference).toEqual({ room_type: 'Máy lạnh', notes: 'Gần khu học tập' });
    expect(payload.applicant_profile).toEqual({ ethnicity: 'Kinh', father: { full_name: 'Nguyễn Văn B' } });
  });
});

it('uses compact typography', () => {
  expect(REGISTRATION_TABLE_CLASS_NAME).toBe('text-xs');
});

it('only opens top-level PDF preview when exactly one registration is selected', () => {
  const rows = [{ _id: 'one' }, { _id: 'two' }] as any;
  expect(selectedPdfRegistration(rows, [])).toBeUndefined();
  expect(selectedPdfRegistration(rows, ['one', 'two'])).toBeUndefined();
  expect(selectedPdfRegistration(rows, ['two'])).toBe(rows[1]);
});

describe('KTX registration PDF actions', () => {
  it('renders text-only preview and export controls without Eye or Download glyphs', () => {
    expect(registrationPageSource).not.toMatch(/\b(?:Eye|Download)\b/);
    expect(registrationPageSource).not.toContain('<Eye');
    expect(registrationPageSource).not.toContain('<Download');
    expect(registrationPageSource).toContain('>Xem trước</button>');
    expect(registrationPageSource).toContain('>Xuất PDF</button>');
    expect(registrationPageSource).toContain('<Button onClick={() => void downloadPdf(pdfRow)}>Xuất PDF</Button>');
  });

  it('preserves selected-row and source-aware preview/export flows', () => {
    expect(registrationPageSource).toContain('onClick={openSelectedPdfPreview}');
    expect(registrationPageSource).toContain("row.source as DormRegistrationSource, 'inline'");
    expect(registrationPageSource).toContain("row.source as DormRegistrationSource, 'attachment'");
    expect(registrationPageSource).toContain('aria-label="Xuất PDF đã chọn"');
    expect(registrationPageSource).toContain('<Button variant="outline" onClick={() => setPdfRow(null)}>Đóng</Button>');
  });

  it('keeps the standalone top-toolbar PDF button absent', () => {
    expect(registrationPageSource).not.toContain('<Button type="button" variant="outline" aria-label="Xuất PDF đã chọn"');
  });
});

it('formats room options and only accepts available beds', () => {
  expect(roomQuantityLabel({ available_bed_count: 2 })).toBe('Còn 2 giường trống');
  expect(roomQuantityLabel({ available_bed_count: 2, max_students: 8 })).toBe('Còn 2/8 giường trống');
  expect(roomStatusLabel('Trống')).toBe('Trống');
  expect(roomStatusLabel('Bảo trì')).toBe('Bảo trì');
  expect(isAvailableBed({ status: 'Trống' } as any)).toBe(true);
  expect(isAvailableBed({ status: 'Đang sử dụng' } as any)).toBe(false);
  expect(hasAssignedBed({ bed_id: 'bed-1' } as any)).toBe(true);
  expect(hasAssignedBed({ source: 'FORMAL', assigned_room_name: 'A101' } as any)).toBe(true);
  expect(hasAssignedBed({ source: 'PUBLIC', room_code: 'A101' } as any)).toBe(false);
});

it('applies a room assignment to one table row without reloading the list', () => {
  const room = { _id: 'room-1', room_code: 'A101', room_name: 'Phòng A101' } as any;
  const bed = { _id: 'bed-1', bed_code: 'G01', room_id: 'room-1', status: 'Đang sử dụng' } as any;

  expect(applyRoomAssignment({ _id: 'registration-1' } as any, { room, bed })).toEqual(expect.objectContaining({
    room_id: room,
    bed_id: bed,
    assigned_room_name: 'Phòng A101',
  }));
});

it('clears both room and bed when applying an unassignment result', () => {
  const row = { _id: 'registration-1', room_id: { _id: 'room-1' }, bed_id: { _id: 'bed-1' }, assigned_room_name: 'Phòng A101' } as any;
  expect(applyRoomAssignment(row, { room: null, bed: { _id: 'bed-1' } as any })).toEqual(expect.objectContaining({
    room_id: undefined,
    bed_id: undefined,
    assigned_room_name: undefined,
  }));
});

it('opens only the room picker belonging to the clicked table layout', async () => {
  const suggestRooms = vi.spyOn(dormitoryApi.registrations, 'suggestRooms').mockResolvedValue([
    { _id: 'room-1', room_code: 'A101', room_name: 'Phòng A101', status: 'Trống', available_bed_count: 2, bed_count: 8 } as any,
  ]);
  const row = { _id: 'registration-1', student_id: { full_name: 'Nguyễn Văn A' } } as any;

  render(
    <>
      <RoomAssignmentPopover row={row} onAssigned={vi.fn()} />
      <RoomAssignmentPopover row={row} onAssigned={vi.fn()} />
    </>,
  );

  const triggers = screen.getAllByRole('button', { name: 'Thêm phòng cho Nguyễn Văn A' });
  fireEvent.click(triggers[0]);

  await waitFor(() => expect(suggestRooms).toHaveBeenCalledTimes(1));
  expect(triggers[0]).toHaveAttribute('aria-expanded', 'true');
  expect(triggers[1]).toHaveAttribute('aria-expanded', 'false');
  expect(await screen.findByText('Chọn phòng')).toBeInTheDocument();
  expect(screen.getByText('Phòng A101')).toBeInTheDocument();
  expect(screen.getByText('Còn 2 giường trống')).toBeInTheDocument();
});

it('shows every bed and assigns exactly one available bed after a room is selected', async () => {
  vi.spyOn(dormitoryApi.registrations, 'suggestRooms').mockResolvedValue([
    { _id: 'room-1', room_code: 'A101', room_name: 'Phòng A101', status: 'Trống', available_bed_count: 2, bed_count: 8 } as any,
  ]);
  vi.spyOn(dormitoryApi.beds, 'getByRoom').mockResolvedValue([
    { _id: 'bed-used', room_id: 'room-1', status: 'Đang sử dụng' } as any,
    { _id: 'bed-free', room_id: 'room-1', status: 'Trống' } as any,
  ]);
  const assignRoom = vi.spyOn(dormitoryApi.registrations, 'assignRoom').mockResolvedValue({});
  const onAssigned = vi.fn();

  render(<RoomAssignmentPopover row={{ _id: 'registration-1', student_id: { full_name: 'Nguyễn Văn A' } } as any} onAssigned={onAssigned} />);

  fireEvent.click(screen.getByRole('button', { name: 'Thêm phòng cho Nguyễn Văn A' }));
  fireEvent.click(await screen.findByRole('button', { name: /Phòng A101/ }));
  expect(await screen.findByText('bed-used')).toBeInTheDocument();
  expect(await screen.findByText('bed-free')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /bed-free/ }));
  await waitFor(() => expect(assignRoom).toHaveBeenCalledWith({
    registration_id: 'registration-1',
    room_id: 'room-1',
    bed_id: 'bed-free',
  }));
  expect(onAssigned).toHaveBeenCalledTimes(1);
  expect(onAssigned).toHaveBeenCalledWith(expect.objectContaining({
    room: expect.objectContaining({ _id: 'room-1' }),
    bed: expect.objectContaining({ _id: 'bed-free' }),
  }));
});

it('keeps the current bed visible and marks it as selected without submitting it', async () => {
  vi.spyOn(dormitoryApi.registrations, 'suggestRooms').mockResolvedValue([
    { _id: 'room-1', room_code: 'A101', room_name: 'Phòng A101', status: 'Đầy', available_bed_count: 0, max_students: 1 } as any,
  ]);
  vi.spyOn(dormitoryApi.beds, 'getByRoom').mockResolvedValue([
    { _id: 'bed-current', bed_code: 'G01', room_id: 'room-1', status: 'Đang sử dụng' } as any,
  ]);
  const assignRoom = vi.spyOn(dormitoryApi.registrations, 'assignRoom').mockResolvedValue({});

  render(<RoomAssignmentPopover row={{ _id: 'registration-1', room_id: 'room-1', bed_id: 'bed-current', student_id: { full_name: 'Nguyễn Văn A' } } as any} onAssigned={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: 'Đổi phòng cho Nguyễn Văn A' }));
  fireEvent.click(await screen.findByRole('button', { name: /Phòng A101/ }));
  expect(await screen.findByText('Đang chọn')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /G01/ })).toBeDisabled();
  expect(assignRoom).not.toHaveBeenCalled();
});
