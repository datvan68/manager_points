import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pdfTemplateApi } from './pdf-template-api';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('PDF template API', () => {
  beforeEach(() => fetchMock.mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue(JSON.stringify({ version: 2 })) }));

  it('uses the catalog and direct-save endpoints', async () => {
    await pdfTemplateApi.catalog();
    await pdfTemplateApi.save('DORMITORY_ROSTER_APPLICATION', 1, { pages: [], items: [] });
    expect(fetchMock.mock.calls[0][0]).toContain('/pdf-templates/catalog');
    expect(fetchMock.mock.calls[1][0]).toContain('/pdf-templates/DORMITORY_ROSTER_APPLICATION');
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    expect(fetchMock.mock.calls[1][1].body).toBeInstanceOf(FormData);
  });
});

