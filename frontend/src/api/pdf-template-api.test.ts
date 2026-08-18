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

  it('uses explicit create and versioned delete endpoints', async () => {
    await pdfTemplateApi.create('DORMITORY_ROSTER_APPLICATION', { pages: [], items: [] }, new File(['%PDF-'], 'source.pdf', { type: 'application/pdf' }));
    await pdfTemplateApi.delete('DORMITORY_ROSTER_APPLICATION', 3);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[1][0]).toContain('?version=3');
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
  });

  it('rejects a source response with a non-PDF MIME type', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, headers: new Headers({ 'content-type': 'text/html' }), blob: vi.fn() });
    await expect(pdfTemplateApi.source('DORMITORY_ROSTER_APPLICATION')).rejects.toThrow('không phải PDF');
  });

  it('returns a non-empty PDF source after validating the response MIME', async () => {
    const blob = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    fetchMock.mockResolvedValueOnce({ ok: true, headers: new Headers({ 'content-type': 'application/pdf' }), blob: vi.fn().mockResolvedValue(blob) });

    await expect(pdfTemplateApi.source('DORMITORY_ROSTER_APPLICATION')).resolves.toBe(blob);
  });

  it('rejects an empty PDF source instead of letting the editor render it', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, headers: new Headers({ 'content-type': 'application/pdf' }), blob: vi.fn().mockResolvedValue(new Blob([], { type: 'application/pdf' })) });

    await expect(pdfTemplateApi.source('DORMITORY_ROSTER_APPLICATION')).rejects.toThrow('Source PDF rỗng');
  });
});
