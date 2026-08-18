import { BadRequestException } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { DORMITORY_ROSTER_APPLICATION_DESCRIPTOR, createDefaultDormitoryLayout } from '../dormitory/pdf-template-adapter';
import { validateAndNormalizeLayout } from './layout.validation';
import { PdfTemplateIntakeService } from './pdf-template-intake.service';
import { PdfTemplateRegistry } from './registry';
import { PdfTemplateRendererService } from './pdf-template-renderer.service';
import { TEST_MULTI_PAGE_DESCRIPTOR } from './test-fixtures/second-descriptor';
import { PDFDocument } from 'pdf-lib';

describe('shared PDF template contracts', () => {
  const pages = [{ pageIndex: 0, width: 595.32, height: 842.04, rotation: 0 }];

  it('registers the KTX descriptor and isolates field keys', () => {
    const registry = new PdfTemplateRegistry([DORMITORY_ROSTER_APPLICATION_DESCRIPTOR]);
    registry.onModuleInit();
    expect(registry.get('DORMITORY_ROSTER_APPLICATION').fields.map((field) => field.key)).toContain('student.fullName');
    expect(() => registry.get('UNKNOWN')).toThrow();
    expect(() => new PdfTemplateRegistry([DORMITORY_ROSTER_APPLICATION_DESCRIPTOR, DORMITORY_ROSTER_APPLICATION_DESCRIPTOR])).toThrow('Duplicate');
  });

  it('normalizes geometry and rejects arbitrary paths/prototype keys', () => {
    const layout = validateAndNormalizeLayout(createDefaultDormitoryLayout(pages), DORMITORY_ROSTER_APPLICATION_DESCRIPTOR, pages);
    expect(layout.items).toHaveLength(25);
    expect(layout.items.every((item) => item.x + item.width <= 1 && item.y + item.height <= 1)).toBe(true);
    expect(() => validateAndNormalizeLayout({ ...layout, items: [{ ...layout.items[0], fieldKey: 'student.__proto__' }] }, DORMITORY_ROSTER_APPLICATION_DESCRIPTOR, pages)).toThrow(BadRequestException);
    expect(() => validateAndNormalizeLayout({ ...layout, items: [{ ...layout.items[0], x: 0.9 }] }, DORMITORY_ROSTER_APPLICATION_DESCRIPTOR, pages)).toThrow(BadRequestException);
  });

  it('accepts the supplied static PDF and rejects spoofed MIME', async () => {
    const buffer = await readFile(join(__dirname, '..', 'dormitory', 'templates', 'dormitory-roster-application.pdf'));
    const intake = new PdfTemplateIntakeService();
    const source = await intake.validate(buffer, 'ktx.pdf', 'application/pdf');
    expect(source.pages).toHaveLength(1);
    await expect(intake.validate(buffer, 'ktx.pdf', 'text/plain')).rejects.toThrow(BadRequestException);
  });

  it('renders a synthetic static value without changing page geometry', async () => {
    const buffer = await readFile(join(__dirname, '..', 'dormitory', 'templates', 'dormitory-roster-application.pdf'));
    const layout = createDefaultDormitoryLayout(pages);
    const result = await new PdfTemplateRendererService().render(buffer, layout, { 'student.fullName': 'Test Student' });
    expect(result.pageCount).toBe(1);
    expect(result.buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  }, 30000);

  it('proves a disjoint multipage descriptor reuses the same validator and renderer', async () => {
    const document = await PDFDocument.create(); document.addPage([595.32, 842.04]); document.addPage([595.32, 842.04]);
    const source = Buffer.from(await document.save()); const intake = new PdfTemplateIntakeService(); const parsed = await intake.validate(source, 'multi.pdf', 'application/pdf');
    const registry = new PdfTemplateRegistry([DORMITORY_ROSTER_APPLICATION_DESCRIPTOR, TEST_MULTI_PAGE_DESCRIPTOR]); registry.onModuleInit();
    const layout = validateAndNormalizeLayout({ pages: parsed.pages, items: [{ id: 'title-1', fieldKey: 'report.title', formatter: 'plain', pageIndex: 0, x: 0.1, y: 0.1, width: 0.8, height: 0.05, rotation: 0, zIndex: 0, style } as any] }, TEST_MULTI_PAGE_DESCRIPTOR, parsed.pages);
    const result = await new PdfTemplateRendererService().render(source, layout, TEST_MULTI_PAGE_DESCRIPTOR.syntheticFixture('short').values);
    expect(registry.get('TEST_MULTI_PAGE').fields.map((field) => field.key)).not.toContain('student.fullName');
    expect(result.pageCount).toBe(2);
  }, 30000);
});

const style = { fontFamily: 'Helvetica', fontSize: 12, minFontSize: 7, fontWeight: 400, color: '#000000', horizontalAlign: 'left', verticalAlign: 'top', lineHeight: 1.15, padding: 1, background: 'transparent', overflow: 'shrink', maxLines: 1 };
