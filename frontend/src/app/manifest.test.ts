import { describe, expect, it, vi } from 'vitest';
import manifest from './manifest';

describe('manifest branding cache', () => {
  it('uses the configured revalidation window and branding icon version', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'Tên mới', shortName: 'TM', version: 'v2' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await manifest();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/app-branding'),
      { next: { revalidate: 300 } },
    );
    expect(result.name).toBe('Tên mới');
    expect(result.icons?.[0]).toMatchObject({
      src: expect.stringContaining('/app-branding/icons/192/v2.png'),
    });
  });

  it('returns the static fallback when branding API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const result = await manifest();
    expect(result).toMatchObject({
      name: 'HOCSINHSINHVIEN - Hệ thống quản lý',
      short_name: 'HSSV',
    });
    expect(result.icons?.[0]).toMatchObject({ src: '/icons/icon-192.png' });
  });
});
