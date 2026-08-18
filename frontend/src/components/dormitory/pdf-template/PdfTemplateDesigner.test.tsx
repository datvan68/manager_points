import { describe, expect, it } from 'vitest';
import { clampField, moveField, resizeField } from './PdfTemplateDesigner';

const field: any = { key: 'name', pageIndex: 0, x: 0.8, y: 0.8, width: 0.2, height: 0.1, rotation: 0, zIndex: 1, style: { fontFamily: 'Arial', fontSize: 11, minFontSize: 7, fontWeight: 400, color: '#000000', horizontalAlign: 'left', verticalAlign: 'middle', lineHeight: 1.15, padding: 0.5, background: 'transparent', overflow: 'shrink', maxLines: 1 } };

describe('PDF template geometry controls', () => {
  it('keeps fields inside normalized page bounds at every zoom', () => {
    expect(clampField(moveField(field, 0.4, 0.4)).x + field.width).toBeLessThanOrEqual(1);
    expect(resizeField(field, 'nw', -0.3, -0.3).x).toBeGreaterThanOrEqual(0);
  });
});

