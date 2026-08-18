import { DEFAULT_PDF_TEMPLATE_LAYOUT } from './pdf-template/field-catalog';
import { validateAndNormalizeLayout } from './pdf-template/layout.validation';

describe('dormitory-pdf-template contract', () => {
  it('exposes the one-page normalized KTX layout', () => {
    const layout = validateAndNormalizeLayout(DEFAULT_PDF_TEMPLATE_LAYOUT);
    expect(layout.pageWidth).toBe(595.32);
    expect(layout.pageHeight).toBe(842.04);
    expect(layout.fields.length).toBe(25);
  });
});

