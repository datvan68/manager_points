import { DEFAULT_PDF_TEMPLATE_LAYOUT } from './pdf-template/field-catalog';
import { fittedFontSize } from './pdf-template/pdf-template-renderer.service';

describe('dormitory-pdf-renderer contract', () => {
  it('keeps long values above configured minimum font size', () => {
    const field = DEFAULT_PDF_TEMPLATE_LAYOUT.fields[0];
    expect(fittedFontSize('Nguyễn Văn Bảo đảm tiếng Việt', field)).toBeGreaterThanOrEqual(field.style.minFontSize);
  });
});

