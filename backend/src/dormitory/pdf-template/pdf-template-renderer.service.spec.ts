import { DEFAULT_PDF_TEMPLATE_LAYOUT } from './field-catalog';
import { fittedFontSize } from './pdf-template-renderer.service';

describe('PDF template renderer sizing', () => {
  it('shrinks long values without changing normalized geometry', () => {
    const field = DEFAULT_PDF_TEMPLATE_LAYOUT.fields.find((item) => item.key === 'phone')!;
    const size = fittedFontSize('Một giá trị tiếng Việt rất dài cần vừa khung', field);
    expect(size).toBeGreaterThanOrEqual(field.style.minFontSize);
    expect(size).toBeLessThanOrEqual(field.style.fontSize);
    expect(field.x).toBeLessThanOrEqual(1);
  });
});

