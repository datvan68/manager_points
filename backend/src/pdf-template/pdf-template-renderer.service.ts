import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { PdfTemplateLayout, PdfTemplateLayoutItem, PdfTemplateStyle } from './types';

export type PdfRenderResult = { buffer: Buffer; pageCount: number; warnings: string[] };

function formatValue(value: unknown, formatter: string) {
  if (value == null) return '';
  if (formatter === 'gender_vi') return ({ Male: 'Nam', Female: 'Nữ', Other: 'Khác' } as Record<string, string>)[String(value)] || String(value);
  if (formatter === 'date_ddmmyyyy') { const date = new Date(String(value)); if (Number.isNaN(date.getTime())) return ''; return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`; }
  return String(value);
}

export function fittedFontSize(value: string, item: Pick<PdfTemplateLayoutItem, 'width' | 'style'>, pageWidth = 595.32) {
  if (!value) return item.style.fontSize;
  const available = item.width * pageWidth - item.style.padding * 2;
  const estimated = Math.max(value.length * 0.52, 1);
  return item.style.overflow === 'shrink' ? Math.max(item.style.minFontSize, Math.min(item.style.fontSize, available / estimated)) : item.style.fontSize;
}

@Injectable()
export class PdfTemplateRendererService {
  async render(sourcePdf: Buffer, layout: PdfTemplateLayout, values: Record<string, unknown>): Promise<PdfRenderResult> {
    const unicode = layout.items.some((item) => /[^\x00-\xff]/.test(formatValue(values[item.fieldKey], item.formatter)));
    if (unicode) return this.renderWithBrowser(sourcePdf, layout, values);
    try {
      const document = await PDFDocument.load(sourcePdf, { updateMetadata: false });
      const fonts = new Map<string, any>();
      for (const [pageIndex, page] of document.getPages().entries()) {
        const pageItems = layout.items.filter((item) => item.pageIndex === pageIndex).sort((a, b) => a.zIndex - b.zIndex);
        for (const item of pageItems) {
          const value = formatValue(values[item.fieldKey], item.formatter);
          if (!value) continue;
          const style = item.style; const key = `${style.fontFamily}:${style.fontWeight}`;
          const fontName = style.fontFamily === 'Times-Roman' ? (style.fontWeight === 700 ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman) : (style.fontWeight === 700 ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
          const font = fonts.get(key) || await document.embedFont(fontName); fonts.set(key, font);
          const width = page.getWidth() * item.width; const height = page.getHeight() * item.height;
          const fontSize = fittedFontSize(value, item, page.getWidth());
          if (style.background === 'white') page.drawRectangle({ x: page.getWidth() * item.x, y: page.getHeight() - (page.getHeight() * (item.y + item.height)), width, height, color: rgb(1, 1, 1), opacity: 1 });
          const lines = this.lines(value, font, fontSize, width - style.padding * 2, style.maxLines, style.overflow, item.fieldKey);
          if (!lines.length && value) throw new BadRequestException(`Giá trị không vừa field ${item.fieldKey}.`);
          const lineHeight = fontSize * style.lineHeight; const totalHeight = lines.length * lineHeight;
          const top = page.getHeight() - (page.getHeight() * item.y) - style.padding - fontSize;
          const y = style.verticalAlign === 'bottom' ? page.getHeight() - (page.getHeight() * (item.y + item.height)) + style.padding : style.verticalAlign === 'middle' ? top - Math.max(0, (height - totalHeight) / 2) + fontSize : top;
          lines.forEach((line, lineIndex) => {
            const textWidth = font.widthOfTextAtSize(line, fontSize); const xBase = page.getWidth() * item.x + style.padding;
            const x = style.horizontalAlign === 'right' ? xBase + width - style.padding * 2 - textWidth : style.horizontalAlign === 'center' ? xBase + (width - style.padding * 2 - textWidth) / 2 : xBase;
            page.drawText(line, { x, y: y - lineIndex * lineHeight, size: fontSize, font, color: this.color(style.color), rotate: degrees(item.rotation) });
          });
        }
      }
      return { buffer: Buffer.from(await document.save({ useObjectStreams: false }),), pageCount: document.getPageCount(), warnings: [] };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException('Không thể render PDF template lúc này.');
    }
  }

  private lines(value: string, font: any, size: number, maxWidth: number, maxLines: number, overflow: PdfTemplateStyle['overflow'], fieldKey: string) {
    if (overflow === 'clip' || overflow === 'shrink') return [value];
    const words = value.split(/\s+/); const result: string[] = []; let line = '';
    for (const word of words) { const next = line ? `${line} ${word}` : word; if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next; else { result.push(line); line = word; } }
    if (line) result.push(line);
    if (result.length > maxLines) throw new BadRequestException(`Giá trị vượt số dòng cho phép của field ${fieldKey}.`);
    return result;
  }

  private color(value: string) { return rgb(parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255); }

  private async renderWithBrowser(sourcePdf: Buffer, layout: PdfTemplateLayout, values: Record<string, unknown>): Promise<PdfRenderResult> {
    let browser: any;
    try {
      const puppeteer = require('puppeteer'); browser = await (puppeteer.default || puppeteer).launch({ headless: true, args: ['--no-sandbox'] });
      const page = await browser.newPage();
      const document = await PDFDocument.load(sourcePdf, { updateMetadata: false });
      for (const [pageIndex, target] of document.getPages().entries()) {
        const metadata = layout.pages[pageIndex] || { width: target.getWidth(), height: target.getHeight() };
        await page.setContent(this.overlayHtml(layout, values, pageIndex, metadata.width, metadata.height), { waitUntil: 'load' });
        const overlayBytes = await page.pdf({ width: `${(metadata.width / 72).toFixed(4)}in`, height: `${(metadata.height / 72).toFixed(4)}in`, printBackground: true, pageRanges: '1' });
        const overlay = await PDFDocument.load(overlayBytes, { updateMetadata: false });
        const [overlayPage] = await document.embedPages([overlay.getPages()[0]]);
        target.drawPage(overlayPage, { x: 0, y: 0, width: target.getWidth(), height: target.getHeight() });
      }
      return { buffer: Buffer.from(await document.save({ useObjectStreams: false })), pageCount: document.getPageCount(), warnings: [] };
    } catch (error) { throw new ServiceUnavailableException(`Không thể render glyph Unicode trong PDF template: ${error instanceof Error ? error.message : 'unknown error'}`); } finally { if (browser) await browser.close().catch(() => undefined); }
  }

  private overlayHtml(layout: PdfTemplateLayout, values: Record<string, unknown>, pageIndex: number, pageWidth: number, pageHeight: number) {
    const escape = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' } as Record<string, string>)[char]);
    const fields = layout.items.filter((item) => item.pageIndex === pageIndex).sort((a, b) => a.zIndex - b.zIndex).map((item) => { const raw = formatValue(values[item.fieldKey], item.formatter); const value = escape(raw); const s = item.style; const width = item.width * pageWidth; const fitted = s.overflow === 'shrink' ? Math.max(s.minFontSize, Math.min(s.fontSize, (width - s.padding * 2) / Math.max(raw.length * 0.52, 1))) : s.fontSize; const scale = s.overflow === 'shrink' ? Math.min(1, (width - s.padding * 2) / Math.max(raw.length * fitted * 0.52, 1)) : 1; const wrap = s.overflow === 'wrap'; return `<span style="left:${item.x * pageWidth}pt;top:${item.y * pageHeight}pt;width:${width}pt;height:${item.height * pageHeight}pt;font:${s.fontWeight} ${fitted}pt ${s.fontFamily};color:${s.color};text-align:${s.horizontalAlign};line-height:${s.lineHeight};padding:${s.padding}pt;white-space:${wrap ? 'pre-wrap' : 'nowrap'};word-break:${wrap ? 'break-word' : 'normal'};display:${wrap ? '-webkit-box' : 'block'};-webkit-line-clamp:${wrap ? s.maxLines : 'unset'};-webkit-box-orient:vertical;overflow:hidden;transform:rotate(${item.rotation}deg) scaleX(${scale});transform-origin:left top;">${value}</span>`; }).join('');
    return `<!doctype html><meta charset="utf-8"><style>@page{size:${pageWidth}pt ${pageHeight}pt;margin:0}html,body{margin:0;width:${pageWidth}pt;height:${pageHeight}pt;overflow:hidden}span{position:absolute;display:block;box-sizing:border-box;transform-origin:center center}</style>${fields}`;
  }
}
