import { describe, expect, it } from 'vitest';
import { canRenderPdfOverlays } from './PdfTemplateEditor';

describe('PdfTemplateEditor render gating', () => {
  it('keeps overlays hidden until the active page finishes rendering', () => {
    expect(canRenderPdfOverlays('loading', null, 0)).toBe(false);
    expect(canRenderPdfOverlays('error', 0, 0)).toBe(false);
    expect(canRenderPdfOverlays('ready', 1, 0)).toBe(false);
    expect(canRenderPdfOverlays('ready', 0, 0)).toBe(true);
  });
});
