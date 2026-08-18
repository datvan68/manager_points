import type { Types } from 'mongoose';

export const PDF_TEMPLATE_READ = 'PDF_TEMPLATE_READ' as const;
export const PDF_TEMPLATE_MANAGE = 'PDF_TEMPLATE_MANAGE' as const;
export const PDF_TEMPLATE_DELETE = 'PDF_TEMPLATE_DELETE' as const;
export const PDF_TEMPLATE_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const PDF_TEMPLATE_MAX_PAGES = 10;
export const PDF_TEMPLATE_MAX_ITEMS_PER_PAGE = 100;
export const PDF_TEMPLATE_MAX_ITEMS = 500;

export type PdfTemplateDataType = 'string' | 'date' | 'number';
export type PdfTemplateFormatter = 'plain' | 'date_ddmmyyyy' | 'gender_vi';
export type PdfTemplateOverflow = 'wrap' | 'shrink' | 'clip';

export type PdfTemplateFieldDefinition = {
  key: string;
  label: string;
  dataType: PdfTemplateDataType;
  sensitive: boolean;
  syntheticSample: string;
  allowedFormatters: readonly PdfTemplateFormatter[];
  defaultStyle: PdfTemplateStyle;
  constraints?: { maxLength?: number; required?: boolean };
};

export type PdfTemplateStyle = {
  fontFamily: 'Helvetica' | 'Times-Roman';
  fontSize: number;
  minFontSize: number;
  fontWeight: 400 | 700;
  color: string;
  horizontalAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  lineHeight: number;
  padding: number;
  background: 'transparent' | 'white';
  overflow: PdfTemplateOverflow;
  maxLines: number;
};

export type PdfTemplatePage = {
  pageIndex: number;
  width: number;
  height: number;
  rotation: number;
};

export type PdfTemplateLayoutItem = {
  id: string;
  fieldKey: string;
  formatter: PdfTemplateFormatter;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  style: PdfTemplateStyle;
};

export type PdfTemplateLayout = {
  pages: PdfTemplatePage[];
  items: PdfTemplateLayoutItem[];
};

export type PdfTemplateSyntheticFixture = {
  name: 'short' | 'long' | 'missing' | 'vietnamese';
  values: Record<string, unknown>;
};

export type PdfTemplateTypeDescriptor = {
  moduleCode: string;
  featureCode: string;
  templateTypeCode: string;
  displayName: string;
  sourcePermission: string;
  fields: readonly PdfTemplateFieldDefinition[];
  pagePolicy: { minPages: number; maxPages: number; allowedDimensions?: { width: number; height: number; tolerance: number } };
  syntheticFixture: (name: PdfTemplateSyntheticFixture['name']) => PdfTemplateSyntheticFixture;
  resolveValues?: (context: unknown) => Record<string, unknown> | Promise<Record<string, unknown>>;
};

export type PdfTemplateAudit = { updatedBy: Types.ObjectId | null; updatedAt: Date };
