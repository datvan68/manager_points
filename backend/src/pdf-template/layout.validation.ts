import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PdfTemplateLayout, PdfTemplateStyle, PdfTemplateTypeDescriptor, PDF_TEMPLATE_MAX_ITEMS, PDF_TEMPLATE_MAX_ITEMS_PER_PAGE } from './types';

const COLOR = /^#[0-9a-f]{6}$/i;
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);

function object(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException(`${label} không hợp lệ.`);
  return value as Record<string, any>;
}

function number(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new BadRequestException(`${label} không hợp lệ.`);
  return value;
}

function style(raw: unknown, fallback: PdfTemplateStyle): PdfTemplateStyle {
  const source = raw == null ? {} : object(raw, 'style');
  const allowed = new Set(['fontFamily', 'fontSize', 'minFontSize', 'fontWeight', 'color', 'horizontalAlign', 'verticalAlign', 'lineHeight', 'padding', 'background', 'overflow', 'maxLines']);
  for (const key of Object.keys(source)) if (!allowed.has(key) || forbiddenKeys.has(key)) throw new BadRequestException(`Style chứa thuộc tính không được phép: ${key}.`);
  const result = { ...fallback, ...source } as PdfTemplateStyle;
  if (!['Helvetica', 'Times-Roman'].includes(result.fontFamily)) throw new BadRequestException('Font không được phép.');
  number(result.fontSize, 'fontSize', 6, 48);
  number(result.minFontSize, 'minFontSize', 5, result.fontSize);
  if (![400, 700].includes(result.fontWeight)) throw new BadRequestException('Font weight không được phép.');
  if (!COLOR.test(result.color)) throw new BadRequestException('Màu chữ không hợp lệ.');
  if (!['left', 'center', 'right'].includes(result.horizontalAlign) || !['top', 'middle', 'bottom'].includes(result.verticalAlign)) throw new BadRequestException('Căn chữ không hợp lệ.');
  number(result.lineHeight, 'lineHeight', 0.8, 3); number(result.padding, 'padding', 0, 12);
  if (!['transparent', 'white'].includes(result.background) || !['wrap', 'shrink', 'clip'].includes(result.overflow)) throw new BadRequestException('Style không được phép.');
  if (!Number.isInteger(result.maxLines) || result.maxLines < 1 || result.maxLines > 8) throw new BadRequestException('maxLines không hợp lệ.');
  return result;
}

export function validateAndNormalizeLayout(input: unknown, descriptor: PdfTemplateTypeDescriptor, pages: Array<{ width: number; height: number; rotation: number }>): PdfTemplateLayout {
  const source = object(input, 'layout');
  if (pages.length < descriptor.pagePolicy.minPages || pages.length > descriptor.pagePolicy.maxPages) throw new BadRequestException('Số trang không phù hợp với template type.');
  const dimensions = descriptor.pagePolicy.allowedDimensions;
  if (dimensions && pages.some((page) => Math.abs(page.width - dimensions.width) > dimensions.tolerance || Math.abs(page.height - dimensions.height) > dimensions.tolerance)) throw new BadRequestException('Kích thước trang không phù hợp với template type.');
  if (!Array.isArray(source.pages) || source.pages.length !== pages.length) throw new BadRequestException('Layout phải mô tả đúng số trang của PDF.');
  if (!Array.isArray(source.items) || source.items.length > PDF_TEMPLATE_MAX_ITEMS) throw new BadRequestException('Số item vượt giới hạn.');
  const fields = new Map(descriptor.fields.map((field) => [field.key, field]));
  const ids = new Set<string>(); const pageCounts = new Map<number, number>();
  const normalizedPages = source.pages.map((raw: unknown, index: number) => {
    const page = object(raw, `pages[${index}]`);
    if (page.pageIndex !== index || page.width !== pages[index].width || page.height !== pages[index].height || page.rotation !== pages[index].rotation) throw new BadRequestException(`Metadata trang ${index + 1} không khớp source.`);
    return { pageIndex: index, width: number(page.width, 'page.width', 1, 10000), height: number(page.height, 'page.height', 1, 10000), rotation: number(page.rotation, 'page.rotation', -360, 360) };
  });
  const items = source.items.map((raw: unknown, index: number) => {
    const item = object(raw, `items[${index}]`);
    const allowed = new Set(['id', 'fieldKey', 'formatter', 'pageIndex', 'x', 'y', 'width', 'height', 'rotation', 'zIndex', 'style']);
    for (const key of Object.keys(item)) if (!allowed.has(key) || forbiddenKeys.has(key)) throw new BadRequestException(`Item chứa thuộc tính không được phép: ${key}.`);
    const field = fields.get(item.fieldKey);
    if (!field || forbiddenKeys.has(String(item.fieldKey))) throw new BadRequestException(`Field không thuộc template: ${String(item.fieldKey)}.`);
    const pageIndex = number(item.pageIndex, 'pageIndex', 0, pages.length - 1);
    if (!Number.isInteger(pageIndex)) throw new BadRequestException('pageIndex phải là số nguyên.');
    const formatter = item.formatter ?? field.allowedFormatters[0];
    if (!field.allowedFormatters.includes(formatter)) throw new BadRequestException(`Formatter không được phép cho ${field.key}.`);
    const id = String(item.id || randomUUID());
    if (ids.has(id)) throw new BadRequestException(`Item bị trùng id: ${id}.`); ids.add(id);
    for (const key of ['x', 'y', 'width', 'height']) number(item[key], key, key === 'width' || key === 'height' ? 0.0001 : 0, 1);
    if (item.x + item.width > 1.0000001 || item.y + item.height > 1.0000001) throw new BadRequestException(`Item ${id} vượt ngoài trang.`);
    number(item.rotation, 'rotation', -360, 360); number(item.zIndex, 'zIndex', -10000, 10000);
    pageCounts.set(pageIndex, (pageCounts.get(pageIndex) || 0) + 1);
    if ((pageCounts.get(pageIndex) || 0) > PDF_TEMPLATE_MAX_ITEMS_PER_PAGE) throw new BadRequestException('Số item trên trang vượt giới hạn.');
    return { id, fieldKey: field.key, formatter, pageIndex, x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation, zIndex: item.zIndex, style: style(item.style, field.defaultStyle) };
  });
  return { pages: normalizedPages, items };
}
