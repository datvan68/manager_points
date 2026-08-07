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
