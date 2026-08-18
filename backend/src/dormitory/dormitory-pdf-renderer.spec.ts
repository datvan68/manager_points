import { createDefaultDormitoryLayout } from './pdf-template-adapter';
import { fittedFontSize } from '../pdf-template/pdf-template-renderer.service';

describe('dormitory-pdf-renderer contract', () => {
  it('keeps long values above configured minimum font size', () => {
    const field = createDefaultDormitoryLayout([{ pageIndex: 0, width: 595.32, height: 842.04, rotation: 0 }]).items[0];
    expect(fittedFontSize('Nguyễn Văn Bảo đảm tiếng Việt', field)).toBeGreaterThanOrEqual(field.style.minFontSize);
  });
});
