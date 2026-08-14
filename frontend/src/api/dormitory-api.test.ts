import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dormitoryApi } from './dormitory-api';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('dormitoryApi.registrations.create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes the canonical registration DTO without legacy field names', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ _id: 'registration-1' })),
    });

    await dormitoryApi.registrations.create({
      student_id: '507f1f77bcf86cd799439011',
      semester: '1',
      academic_year: '2026',
      date_of_birth: '2003-01-15',
      gender: 'Female',
      phone_number: '0912345678',
      priority_group: 'Khó khăn',
      preference: { room_type: 'Máy lạnh', notes: 'Gần khu học tập' },
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      student_id: '507f1f77bcf86cd799439011',
      semester: '1',
      academic_year: '2026',
      date_of_birth: '2003-01-15',
      gender: 'Female',
      phone_number: '0912345678',
      priority_group: 'Khó khăn',
      preference: { room_type: 'Máy lạnh', notes: 'Gần khu học tập' },
    });
  });
});

describe('dormitoryApi.registrations.update/delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the source discriminator in the update and delete requests', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue(JSON.stringify({ success: true, id: 'registration-1', source: 'PUBLIC' })) });

    await dormitoryApi.registrations.update('registration-1', 'PUBLIC', { full_name: 'Nguyễn A' });
    await dormitoryApi.registrations.delete('registration-1', 'PUBLIC');

    expect(mockFetch.mock.calls[0][0]).toContain('/dormitory/registrations/registration-1?source=PUBLIC');
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ full_name: 'Nguyễn A' });
    expect(mockFetch.mock.calls[1][0]).toContain('/dormitory/registrations/registration-1?source=PUBLIC');
    expect(mockFetch.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
  });

  it('serializes temporary edit fields at the top level without preference', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue(JSON.stringify({ _id: 'registration-1' })) });

    await dormitoryApi.registrations.update('registration-1', 'ADMIN_TEMPORARY', {
      full_name: 'Nguyễn A', semester: 'HK2', academic_year: '2025-2026', date_of_birth: '2003-01-15', gender: 'Female',
      phone_number: '0912345678', room_type: 'Máy lạnh', notes: 'Gần khu học tập', priority_group: 'Không',
    });

    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      full_name: 'Nguyễn A', semester: 'HK2', academic_year: '2025-2026', date_of_birth: '2003-01-15', gender: 'Female',
      phone_number: '0912345678', room_type: 'Máy lạnh', notes: 'Gần khu học tập', priority_group: 'Không',
    });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).not.toHaveProperty('preference');
  });
});

describe('dormitoryApi.registrations.unassignRoom', () => {
  it('posts the registration id to the unassign endpoint', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue(JSON.stringify({ message: 'ok' })) });
    await dormitoryApi.registrations.unassignRoom('registration-1');
    expect(mockFetch.mock.calls[0][0]).toContain('/dormitory/registrations/unassign-room');
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ registration_id: 'registration-1' });
  });
});

describe('dormitoryApi self-service and PDF endpoints', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses self-scoped endpoints without a client supplied student id', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue(JSON.stringify({ has_dormitory_registration: false, registration: null, history: [] })) });
    await dormitoryApi.registrations.getMine();
    await dormitoryApi.registrations.updateMine({ phone_number: '0912345678' });
    expect(mockFetch.mock.calls[0][0]).toContain('/dormitory/registrations/me');
    expect(mockFetch.mock.calls[1][0]).toContain('/dormitory/registrations/me');
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({ phone_number: '0912345678' });
  });

  it('requests server-generated application PDF with the selected disposition', async () => {
    mockFetch.mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })) });
    await dormitoryApi.registrations.getApplicationPdf('registration-1', 'PUBLIC', 'inline');
    expect(mockFetch.mock.calls[0][0]).toContain('/dormitory/registrations/registration-1/application-pdf?source=PUBLIC&disposition=inline');
  });
});
