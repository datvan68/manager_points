import { BadRequestException } from '@nestjs/common';
import { DEFAULT_PDF_TEMPLATE_LAYOUT } from './field-catalog';
import { validateAndNormalizeLayout } from './layout.validation';

describe('PDF template layout contract', () => {
  it('keeps normalized geometry in bounds', () => {
    const layout = validateAndNormalizeLayout(DEFAULT_PDF_TEMPLATE_LAYOUT);
    expect(layout.fields.length).toBeGreaterThan(20);
    expect(layout.fields.every((field) => field.x >= 0 && field.y >= 0 && field.x + field.width <= 1 && field.y + field.height <= 1)).toBe(true);
  });

  it('rejects unknown keys, duplicate fields and unsafe expressions', () => {
    expect(() => validateAndNormalizeLayout({ ...DEFAULT_PDF_TEMPLATE_LAYOUT, fields: [{ ...DEFAULT_PDF_TEMPLATE_LAYOUT.fields[0], key: 'constructor' }] })).toThrow(BadRequestException);
    expect(() => validateAndNormalizeLayout({ ...DEFAULT_PDF_TEMPLATE_LAYOUT, fields: [DEFAULT_PDF_TEMPLATE_LAYOUT.fields[0], DEFAULT_PDF_TEMPLATE_LAYOUT.fields[0]] })).toThrow(BadRequestException);
    expect(() => validateAndNormalizeLayout({ ...DEFAULT_PDF_TEMPLATE_LAYOUT, fields: [{ ...DEFAULT_PDF_TEMPLATE_LAYOUT.fields[0], style: { ...DEFAULT_PDF_TEMPLATE_LAYOUT.fields[0].style, overflow: 'clip' } }] })).toThrow(BadRequestException);
  });
});

