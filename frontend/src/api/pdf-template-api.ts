import { API_BASE } from './config';
import { handleResponse, httpClient } from './http-client';

export type PdfTemplateStyle = { fontFamily: 'Helvetica' | 'Times-Roman'; fontSize: number; minFontSize: number; fontWeight: 400 | 700; color: string; horizontalAlign: 'left' | 'center' | 'right'; verticalAlign: 'top' | 'middle' | 'bottom'; lineHeight: number; padding: number; background: 'transparent' | 'white'; overflow: 'wrap' | 'shrink' | 'clip'; maxLines: number };
export type PdfTemplatePage = { pageIndex: number; width: number; height: number; rotation: number };
export type PdfTemplateItem = { id: string; fieldKey: string; formatter: string; pageIndex: number; x: number; y: number; width: number; height: number; rotation: number; zIndex: number; style: PdfTemplateStyle };
export type PdfTemplateLayout = { pages: PdfTemplatePage[]; items: PdfTemplateItem[] };
export type PdfTemplateCatalogItem = { moduleCode: string; featureCode: string; templateTypeCode: string; displayName: string; configured: boolean; version: number; checksum: string | null; sourceFilename: string | null; pageCount: number; sourceBytes: number; updatedBy: string | null; updatedAt: string | null };
export type PdfTemplateMetadata = PdfTemplateCatalogItem & { sourcePermission: string; fields: Array<{ key: string; label: string; dataType: string; sensitive: boolean; syntheticSample: string; allowedFormatters: string[]; defaultStyle: PdfTemplateStyle }>; sourceFilename: string | null; sourceBytes: number; pages: PdfTemplatePage[] | null; layout: PdfTemplateLayout | null; audit?: { updatedBy: string | null; updatedAt: string } | null };

async function json<T>(url: string, init?: RequestInit): Promise<T> { return handleResponse(await httpClient(url, init)); }

export const pdfTemplateApi = {
  async catalog() { return json<PdfTemplateCatalogItem[]>(`${API_BASE}/pdf-templates/catalog`); },
  async metadata(code: string) { return json<PdfTemplateMetadata>(`${API_BASE}/pdf-templates/${encodeURIComponent(code)}`); },
  async source(code: string): Promise<Blob> { const response = await httpClient(`${API_BASE}/pdf-templates/${encodeURIComponent(code)}/source`); if (!response.ok) { await handleResponse<never>(response); } return response.blob(); },
  async preview(code: string, layout: PdfTemplateLayout, fixture: string, source?: File): Promise<Blob> { const form = new FormData(); form.append('layout', JSON.stringify(layout)); form.append('fixture', fixture); if (source) form.append('source', source); const response = await httpClient(`${API_BASE}/pdf-templates/${encodeURIComponent(code)}/preview`, { method: 'POST', body: form }); if (!response.ok) { await handleResponse<never>(response); } return response.blob(); },
  async validate(code: string, layout: PdfTemplateLayout, source?: File) { const form = new FormData(); form.append('layout', JSON.stringify(layout)); if (source) form.append('source', source); return json<any>(`${API_BASE}/pdf-templates/${encodeURIComponent(code)}/validate`, { method: 'POST', body: form }); },
  async save(code: string, version: number, layout: PdfTemplateLayout, source?: File) { const form = new FormData(); form.append('version', String(version)); form.append('layout', JSON.stringify(layout)); if (source) form.append('source', source); return json<any>(`${API_BASE}/pdf-templates/${encodeURIComponent(code)}`, { method: 'PUT', body: form }); },
};
