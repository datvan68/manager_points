import { BadRequestException } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { DORMITORY_ROSTER_APPLICATION_DESCRIPTOR, createDefaultDormitoryLayout } from '../dormitory/pdf-template-adapter';
import { validateAndNormalizeLayout } from './layout.validation';
import { PdfTemplateIntakeService } from './pdf-template-intake.service';
import { PdfTemplateRegistry } from './registry';
import { PdfTemplateRendererService, calculatePdfFieldGeometry } from './pdf-template-renderer.service';
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

  it('verifies horizontal and vertical alignment geometry calculations on known page dimensions', () => {
    const pageWidth = 595.32;
    const pageHeight = 842.04;
    const baseItem = {
      x: 0.1,
      y: 0.2,
      width: 0.5,
      height: 0.1,
      style: { ...style, padding: 4, lineHeight: 1.2, fontSize: 12 },
    };

    // Expected box metrics:
    // boxWidth = 595.32 * 0.5 = 297.66
    // boxHeight = 842.04 * 0.1 = 84.204
    // boxTop = 842.04 * (1 - 0.2) = 673.632
    // boxBottom = 842.04 * (1 - 0.2 - 0.1) = 589.428
    // contentWidth = 297.66 - 8 = 289.66
    // contentHeight = 84.204 - 8 = 76.204
    // fontSize = 12, totalTextHeight (1 line) = 12
    const lineWidths = [100];

    // Left + Top
    const leftTopGeom = calculatePdfFieldGeometry(
      { ...baseItem, style: { ...baseItem.style, horizontalAlign: 'left', verticalAlign: 'top' } as any },
      pageWidth,
      pageHeight,
      lineWidths,
      12,
    );
    expect(leftTopGeom.boxTop).toBeCloseTo(673.632);
    expect(leftTopGeom.boxBottom).toBeCloseTo(589.428);
    expect(leftTopGeom.contentWidth).toBeCloseTo(289.66);
    expect(leftTopGeom.contentHeight).toBeCloseTo(76.204);
    // top baseline: boxTop - padding - fontSize = 673.632 - 4 - 12 = 657.632
    expect(leftTopGeom.firstLineBaselineY).toBeCloseTo(657.632);
    // left x: pageWidth * x + padding = 59.532 + 4 = 63.532
    expect(leftTopGeom.lineXs[0]).toBeCloseTo(63.532);

    // Center + Middle
    const centerMiddleGeom = calculatePdfFieldGeometry(
      { ...baseItem, style: { ...baseItem.style, horizontalAlign: 'center', verticalAlign: 'middle' } as any },
      pageWidth,
      pageHeight,
      lineWidths,
      12,
    );
    // middle: topBaseline - (contentHeight - totalTextHeight) / 2 = 657.632 - (76.204 - 12) / 2 = 657.632 - 32.102 = 625.530
    expect(centerMiddleGeom.firstLineBaselineY).toBeCloseTo(625.530);
    // center x: xBase + (contentWidth - textWidth) / 2 = 63.532 + (289.66 - 100) / 2 = 63.532 + 94.83 = 158.362
    expect(centerMiddleGeom.lineXs[0]).toBeCloseTo(158.362);

    // Right + Bottom
    const rightBottomGeom = calculatePdfFieldGeometry(
      { ...baseItem, style: { ...baseItem.style, horizontalAlign: 'right', verticalAlign: 'bottom' } as any },
      pageWidth,
      pageHeight,
      lineWidths,
      12,
    );
    // bottom: topBaseline - (contentHeight - totalTextHeight) = 657.632 - (76.204 - 12) = 593.428
    // Equivalently: boxBottom + padding + totalTextHeight - fontSize = 589.428 + 4 + 12 - 12 = 593.428
    expect(rightBottomGeom.firstLineBaselineY).toBeCloseTo(593.428);
    // right x: xBase + (contentWidth - textWidth) = 63.532 + (289.66 - 100) = 253.192
    expect(rightBottomGeom.lineXs[0]).toBeCloseTo(253.192);
  });

  it('verifies multiline alignment and vertical offset calculations', () => {
    const pageWidth = 600;
    const pageHeight = 800;
    const item = {
      x: 0,
      y: 0,
      width: 1,
      height: 0.5,
      style: { ...style, padding: 10, lineHeight: 1.5, fontSize: 10, horizontalAlign: 'center', verticalAlign: 'top' } as any,
    };
    // 2 lines: textWidths = [120, 80]
    // fontSize = 10, lineHeight = 15
    // totalTextHeight = (2 - 1) * 15 + 10 = 25
    const geom = calculatePdfFieldGeometry(item, pageWidth, pageHeight, [120, 80], 10);
    expect(geom.lineHeight).toBe(15);
    expect(geom.totalTextHeight).toBe(25);
    // Line 0 x: 10 + (580 - 120) / 2 = 10 + 230 = 240
    // Line 1 x: 10 + (580 - 80) / 2 = 10 + 250 = 260
    expect(geom.lineXs[0]).toBe(240);
    expect(geom.lineXs[1]).toBe(260);
  });

  it('computes field geometry accurately for custom direct font-size values', () => {
    const pageWidth = 595.32;
    const pageHeight = 842.04;
    const itemWithDirectFontSize = {
      x: 0.1,
      y: 0.2,
      width: 0.5,
      height: 0.05,
      style: { ...style, fontSize: 18, padding: 2, lineHeight: 1.15, horizontalAlign: 'left', verticalAlign: 'top' } as any,
    };
    const geom = calculatePdfFieldGeometry(itemWithDirectFontSize, pageWidth, pageHeight, [150], 18);
    // top baseline: pageHeight * (1 - 0.2) - padding - fontSize = 673.632 - 2 - 18 = 653.632
    expect(geom.firstLineBaselineY).toBeCloseTo(653.632);
    expect(geom.lineXs[0]).toBeCloseTo(59.532 + 2);
  });
});

const style = { fontFamily: 'Helvetica', fontSize: 12, minFontSize: 7, fontWeight: 400, color: '#000000', horizontalAlign: 'left', verticalAlign: 'top', lineHeight: 1.15, padding: 1, background: 'transparent', overflow: 'shrink', maxLines: 1 };
