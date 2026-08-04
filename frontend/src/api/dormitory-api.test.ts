import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dormitoryApi } from './dormitory-api';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('dormitoryApi.registrations.create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes the CreateDormRegistrationInput DTO without extra fields', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ _id: 'registration-1' })),
    });

    await dormitoryApi.registrations.create({
      student_id: '507f1f77bcf86cd799439011',
      ky_hoc: '1',
      nam_hoc: '2026',
      ngay_sinh: '2003-01-15',
      gioi_tinh: 'Female',
      so_dien_thoai: '0912345678',
      doi_tuong_uu_tien: 'Khó khăn',
      nguyen_vong: { loai_phong: 'Máy lạnh', ghi_chu: 'Gần khu học tập' },
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      student_id: '507f1f77bcf86cd799439011',
      ky_hoc: '1',
      nam_hoc: '2026',
      ngay_sinh: '2003-01-15',
      gioi_tinh: 'Female',
      so_dien_thoai: '0912345678',
      doi_tuong_uu_tien: 'Khó khăn',
      nguyen_vong: { loai_phong: 'Máy lạnh', ghi_chu: 'Gần khu học tập' },
    });
  });
});
