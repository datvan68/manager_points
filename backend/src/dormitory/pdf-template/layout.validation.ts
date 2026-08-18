import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_PDF_TEMPLATE_LAYOUT,
  PDF_MAX_FIELDS,
  PDF_TEMPLATE_FIELD_KEYS,
  PDF_TEMPLATE_FORMATTERS,
  PdfTemplateLayout,
  PdfTemplateLayoutField,
} from './field-catalog';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const fieldKeySet = new Set<string>(PDF_TEMPLATE_FIELD_KEYS);
const formatterSet = new Set<string>(PDF_TEMPLATE_FORMATTERS);

function assertPlainObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException(`${name} không hợp lệ.`);
}

function assertNumber(value: unknown, name: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new BadRequestException(`${name} phải nằm trong khoảng ${min} đến ${max}.`);
  }
}

export function validateAndNormalizeLayout(input: unknown): PdfTemplateLayout {
  const source = input == null ? DEFAULT_PDF_TEMPLATE_LAYOUT : input;
  assertPlainObject(source, 'layout');
  const allowedLayoutKeys = new Set(['pageWidth', 'pageHeight', 'fields']);
  for (const key of Object.keys(source)) if (!allowedLayoutKeys.has(key)) throw new BadRequestException(`Thuộc tính layout không được phép: ${key}.`);
  if (source.pageWidth !== undefined && source.pageWidth !== 595.32) throw new BadRequestException('Chỉ hỗ trợ khổ A4 ngang 595.32pt.');
  if (source.pageHeight !== undefined && source.pageHeight !== 842.04) throw new BadRequestException('Chỉ hỗ trợ khổ A4 dọc 842.04pt.');
  if (!Array.isArray(source.fields) || source.fields.length > PDF_MAX_FIELDS) throw new BadRequestException(`Số field phải từ 0 đến ${PDF_MAX_FIELDS}.`);

  const keys = new Set<string>();
  const fields = source.fields.map((raw, index) => {
    assertPlainObject(raw, `fields[${index}]`);
    const allowedFieldKeys = new Set(['key', 'pageIndex', 'x', 'y', 'width', 'height', 'rotation', 'zIndex', 'formatter', 'style']);
    for (const key of Object.keys(raw)) if (!allowedFieldKeys.has(key)) throw new BadRequestException(`Thuộc tính field không được phép: ${key}.`);
    if (typeof raw.key !== 'string' || !fieldKeySet.has(raw.key)) throw new BadRequestException(`Field không được phép: ${String(raw.key)}.`);
    if (keys.has(raw.key)) throw new BadRequestException(`Field bị trùng: ${raw.key}.`);
    keys.add(raw.key);
    if (raw.pageIndex !== 0) throw new BadRequestException('MVP chỉ hỗ trợ pageIndex = 0.');
    assertNumber(raw.x, `fields[${index}].x`, 0, 1);
    assertNumber(raw.y, `fields[${index}].y`, 0, 1);
    assertNumber(raw.width, `fields[${index}].width`, 0.0001, 1);
    assertNumber(raw.height, `fields[${index}].height`, 0.0001, 1);
    if ((raw.x as number) + (raw.width as number) > 1.0000001 || (raw.y as number) + (raw.height as number) > 1.0000001) {
      throw new BadRequestException(`Field ${raw.key} vượt ngoài trang.`);
    }
    assertNumber(raw.rotation, `fields[${index}].rotation`, -180, 180);
    assertNumber(raw.zIndex, `fields[${index}].zIndex`, -10000, 10000);
    if (raw.formatter !== undefined && (typeof raw.formatter !== 'string' || !formatterSet.has(raw.formatter))) throw new BadRequestException(`Formatter không được phép: ${String(raw.formatter)}.`);
    const style = normalizeStyle(raw.style, index, raw.overflow);
    if (style.overflow === 'clip' && raw.key === 'name') throw new BadRequestException('Không cho phép clip cho field họ tên mặc định.');
    return {
      key: raw.key as PdfTemplateLayoutField['key'], pageIndex: 0 as const,
      x: raw.x as number, y: raw.y as number, width: raw.width as number, height: raw.height as number,
      rotation: raw.rotation as number, zIndex: raw.zIndex as number,
      formatter: raw.formatter as PdfTemplateLayoutField['formatter'], style,
    };
  });
  return { pageWidth: 595.32, pageHeight: 842.04, fields };
}

function normalizeStyle(raw: unknown, index: number, legacyOverflow?: unknown): PdfTemplateLayoutField['style'] {
  const source = raw == null ? {} : raw;
  assertPlainObject(source, `fields[${index}].style`);
  const allowed = new Set(['fontFamily', 'fontSize', 'minFontSize', 'fontWeight', 'color', 'horizontalAlign', 'verticalAlign', 'lineHeight', 'padding', 'background', 'overflow', 'maxLines']);
  for (const key of Object.keys(source)) if (!allowed.has(key)) throw new BadRequestException(`Thuộc tính style không được phép: ${key}.`);
  const fontFamily = source.fontFamily === undefined ? 'Arial' : source.fontFamily;
  if (!['Arial', 'Times New Roman'].includes(String(fontFamily))) throw new BadRequestException('Font không được phép.');
  const fontSize = source.fontSize === undefined ? 11 : source.fontSize;
  const minFontSize = source.minFontSize === undefined ? 7 : source.minFontSize;
  assertNumber(fontSize, `fields[${index}].style.fontSize`, 6, 48);
  assertNumber(minFontSize, `fields[${index}].style.minFontSize`, 5, fontSize as number);
  if (![400, 700].includes(Number(source.fontWeight ?? 400))) throw new BadRequestException('Font weight không được phép.');
  const color = String(source.color ?? '#000000');
  if (!HEX_COLOR.test(color)) throw new BadRequestException('Màu chữ không hợp lệ.');
  if (!['left', 'center', 'right'].includes(String(source.horizontalAlign ?? 'left'))) throw new BadRequestException('Căn ngang không hợp lệ.');
  if (!['top', 'middle', 'bottom'].includes(String(source.verticalAlign ?? 'middle'))) throw new BadRequestException('Căn dọc không hợp lệ.');
  assertNumber(Number(source.lineHeight ?? 1.15), `fields[${index}].style.lineHeight`, 0.8, 3);
  assertNumber(Number(source.padding ?? 0.5), `fields[${index}].style.padding`, 0, 12);
  if (!['transparent', 'white'].includes(String(source.background ?? 'transparent'))) throw new BadRequestException('Nền field không hợp lệ.');
  const overflow = source.overflow ?? legacyOverflow ?? 'shrink';
  if (!['shrink', 'wrap', 'clip'].includes(String(overflow))) throw new BadRequestException('Chế độ tràn không hợp lệ.');
  const maxLines = source.maxLines === undefined ? 1 : source.maxLines;
  if (!Number.isInteger(maxLines) || Number(maxLines) < 1 || Number(maxLines) > 8) throw new BadRequestException('Số dòng tối đa không hợp lệ.');
  return {
    fontFamily: fontFamily as 'Arial' | 'Times New Roman', fontSize: fontSize as number, minFontSize: minFontSize as number,
    fontWeight: Number(source.fontWeight ?? 400) as 400 | 700, color,
    horizontalAlign: String(source.horizontalAlign ?? 'left') as 'left' | 'center' | 'right',
    verticalAlign: String(source.verticalAlign ?? 'middle') as 'top' | 'middle' | 'bottom',
    lineHeight: Number(source.lineHeight ?? 1.15), padding: Number(source.padding ?? 0.5),
    background: String(source.background ?? 'transparent') as 'transparent' | 'white',
    overflow: String(overflow) as 'shrink' | 'wrap' | 'clip', maxLines: Number(maxLines),
  };
}
