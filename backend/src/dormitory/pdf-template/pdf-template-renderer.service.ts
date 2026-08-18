import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { PDF_PAGE_HEIGHT_PT, PDF_PAGE_WIDTH_PT, PdfTemplateLayout, PdfTemplateLayoutField } from './field-catalog';

export type PdfRenderResult = { buffer: Buffer; pageCount: number; warnings: string[] };

export function fittedFontSize(value: string, field: PdfTemplateLayoutField): number {
  const style = field.style;
  if (!value) return style.fontSize;
  const oneLineSize = (field.width * PDF_PAGE_WIDTH_PT - style.padding * 2) / Math.max(value.length * 0.52, 1);
  if (style.overflow !== 'shrink') return style.fontSize;
  return Math.max(style.minFontSize, Math.min(style.fontSize, oneLineSize));
}

@Injectable()
export class PdfTemplateRendererService {
  async render(sourcePdf: Buffer, layout: PdfTemplateLayout, values: Record<string, unknown>): Promise<PdfRenderResult> {
    let browser: any;
    try {
      const puppeteer = require('puppeteer');
      browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(this.overlayHtml(layout, values), { waitUntil: 'load' });
      const overlay = await page.pdf({ width: `${(PDF_PAGE_WIDTH_PT / 72).toFixed(4)}in`, height: `${(PDF_PAGE_HEIGHT_PT / 72).toFixed(4)}in`, printBackground: true, pageRanges: '1' });
      const document = await PDFDocument.load(sourcePdf, { updateMetadata: false });
      const overlayDocument = await PDFDocument.load(overlay, { updateMetadata: false });
      const [overlayPage] = await document.embedPages([overlayDocument.getPages()[0]]);
      document.getPages()[0].drawPage(overlayPage, { x: 0, y: 0, width: PDF_PAGE_WIDTH_PT, height: PDF_PAGE_HEIGHT_PT });
      return { buffer: Buffer.from(await document.save({ useObjectStreams: false })), pageCount: document.getPageCount(), warnings: [] };
    } catch {
      throw new ServiceUnavailableException('Không thể render PDF template lúc này.');
    } finally {
      if (browser) await browser.close().catch(() => undefined);
    }
  }

  private overlayHtml(layout: PdfTemplateLayout, values: Record<string, unknown>): string {
    const fields = [...layout.fields].sort((a, b) => a.zIndex - b.zIndex).map((field) => this.fieldHtml(field, values[field.key])).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      @page{size:${PDF_PAGE_WIDTH_PT}pt ${PDF_PAGE_HEIGHT_PT}pt;margin:0}
      *{box-sizing:border-box}html,body{margin:0;width:${PDF_PAGE_WIDTH_PT}pt;height:${PDF_PAGE_HEIGHT_PT}pt;background:transparent;overflow:hidden}
      .field{position:absolute;display:flex;white-space:pre-wrap;word-break:break-word;overflow:hidden;transform-origin:center center}
    </style></head><body>${fields}</body></html>`;
  }

  private fieldHtml(field: PdfTemplateLayoutField, rawValue: unknown): string {
    const value = this.escape(String(rawValue ?? ''));
    const style = field.style;
    const fontSize = fittedFontSize(String(rawValue ?? ''), field);
    const justify = style.verticalAlign === 'top' ? 'flex-start' : style.verticalAlign === 'bottom' ? 'flex-end' : 'center';
    const background = style.background === 'white' ? 'background:#fff;' : 'background:transparent;';
    const whiteSpace = style.overflow === 'wrap' ? 'white-space:pre-wrap;' : 'white-space:nowrap;';
    const clip = style.overflow === 'clip' ? 'text-overflow:clip;' : '';
    return `<span class="field" style="left:${field.x * PDF_PAGE_WIDTH_PT}pt;top:${field.y * PDF_PAGE_HEIGHT_PT}pt;width:${field.width * PDF_PAGE_WIDTH_PT}pt;height:${field.height * PDF_PAGE_HEIGHT_PT}pt;transform:rotate(${field.rotation}deg);z-index:${field.zIndex};font-family:${this.cssFont(style.fontFamily)};font-size:${fontSize.toFixed(2)}pt;min-height:0;font-weight:${style.fontWeight};color:${style.color};text-align:${style.horizontalAlign};align-items:${justify};line-height:${style.lineHeight};padding:${style.padding}pt;${background}${whiteSpace}${clip}">${value}</span>`;
  }

  private cssFont(value: string): string { return value === 'Times New Roman' ? '"Times New Roman",serif' : 'Arial,sans-serif'; }
  private escape(value: string): string { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' } as Record<string, string>)[character]); }
}
