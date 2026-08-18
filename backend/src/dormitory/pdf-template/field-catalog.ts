import { createHash } from 'crypto';

export const PDF_TEMPLATE_CODE = 'DORMITORY_APPLICATION' as const;
export const PDF_PAGE_WIDTH_PT = 595.32;
export const PDF_PAGE_HEIGHT_PT = 842.04;
export const PDF_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const PDF_MAX_FIELDS = 100;

export const PDF_TEMPLATE_FIELD_KEYS = [
  'name', 'dob', 'gender', 'className', 'faculty', 'ethnicity', 'religion',
  'phone', 'citizenId', 'citizenIssueDate', 'citizenIssuePlace',
  'permanentAddress', 'fatherName', 'fatherAge', 'fatherAddress',
  'fatherContactAddress', 'fatherOccupation', 'fatherPhone', 'motherName',
  'motherAge', 'motherAddress', 'motherContactAddress', 'motherOccupation',
  'motherPhone', 'priority',
] as const;

export type PdfTemplateFieldKey = (typeof PDF_TEMPLATE_FIELD_KEYS)[number];

export const PDF_TEMPLATE_FORMATTERS = ['plain', 'date_ddmmyyyy', 'gender_vi'] as const;
export type PdfTemplateFormatter = (typeof PDF_TEMPLATE_FORMATTERS)[number];

export type PdfTemplateLayoutField = {
  key: PdfTemplateFieldKey;
  pageIndex: 0;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  formatter?: PdfTemplateFormatter;
  style: {
    fontFamily: 'Arial' | 'Times New Roman';
    fontSize: number;
    minFontSize: number;
    fontWeight: 400 | 700;
    color: string;
    horizontalAlign: 'left' | 'center' | 'right';
    verticalAlign: 'top' | 'middle' | 'bottom';
    lineHeight: number;
    padding: number;
    background: 'transparent' | 'white';
    overflow: 'shrink' | 'wrap' | 'clip';
    maxLines: number;
  };
};

export type PdfTemplateLayout = {
  pageWidth: number;
  pageHeight: number;
  fields: PdfTemplateLayoutField[];
};

export type PdfTemplateFieldDefinition = {
  key: PdfTemplateFieldKey;
  label: string;
  formatter: PdfTemplateFormatter;
};

export const PDF_TEMPLATE_FIELD_CATALOG: readonly PdfTemplateFieldDefinition[] = [
  ['name', 'Họ và tên', 'plain'], ['dob', 'Ngày sinh', 'date_ddmmyyyy'],
  ['gender', 'Giới tính', 'gender_vi'], ['className', 'Lớp', 'plain'],
  ['faculty', 'Khoa', 'plain'], ['ethnicity', 'Dân tộc', 'plain'],
  ['religion', 'Tôn giáo', 'plain'], ['phone', 'Điện thoại', 'plain'],
  ['citizenId', 'Số căn cước', 'plain'], ['citizenIssueDate', 'Ngày cấp căn cước', 'date_ddmmyyyy'],
  ['citizenIssuePlace', 'Nơi cấp căn cước', 'plain'], ['permanentAddress', 'Địa chỉ thường trú', 'plain'],
  ['fatherName', 'Họ tên cha', 'plain'], ['fatherAge', 'Tuổi cha', 'plain'],
  ['fatherAddress', 'Địa chỉ cha', 'plain'], ['fatherContactAddress', 'Nơi ở hiện tại của cha', 'plain'],
  ['fatherOccupation', 'Nghề nghiệp cha', 'plain'], ['fatherPhone', 'Điện thoại cha', 'plain'],
  ['motherName', 'Họ tên mẹ', 'plain'], ['motherAge', 'Tuổi mẹ', 'plain'],
  ['motherAddress', 'Địa chỉ mẹ', 'plain'], ['motherContactAddress', 'Nơi ở hiện tại của mẹ', 'plain'],
  ['motherOccupation', 'Nghề nghiệp mẹ', 'plain'], ['motherPhone', 'Điện thoại mẹ', 'plain'],
  ['priority', 'Diện chính sách', 'plain'],
].map(([key, label, formatter]) => ({ key: key as PdfTemplateFieldKey, label, formatter: formatter as PdfTemplateFormatter }));

const DEFAULT_STYLE: PdfTemplateLayoutField['style'] = {
  fontFamily: 'Arial', fontSize: 11, minFontSize: 7, fontWeight: 400,
  color: '#000000', horizontalAlign: 'left', verticalAlign: 'middle',
  lineHeight: 1.15, padding: 0.5, background: 'transparent', overflow: 'shrink', maxLines: 1,
};

const DEFAULT_BOUNDS: Array<[PdfTemplateFieldKey, number, number, number, number]> = [
  ['name', 296, 191, 240, 18], ['dob', 323.5, 215, 77, 18], ['gender', 459, 215, 77, 18],
  ['className', 218, 239, 142, 18], ['faculty', 396.8, 239, 139, 18],
  ['ethnicity', 241, 263, 56, 18], ['religion', 354.5, 263, 49, 18], ['phone', 466.4, 263, 69.6, 18],
  ['citizenId', 235.2, 287, 70, 18], ['citizenIssueDate', 362.5, 287, 63, 18], ['citizenIssuePlace', 480.7, 287, 55, 18],
  ['permanentAddress', 203, 311, 332, 18], ['fatherName', 152.4, 335, 239.6, 18], ['fatherAge', 396.8, 335, 139.2, 18],
  ['fatherAddress', 203, 359, 332, 18], ['fatherContactAddress', 194.9, 383, 341.1, 18],
  ['fatherOccupation', 194.9, 407, 114.9, 18], ['fatherPhone', 375.9, 407, 160.1, 18],
  ['motherName', 152.4, 431, 196, 18], ['motherAge', 386.4, 431, 149.6, 18],
  ['motherAddress', 203, 455, 332, 18], ['motherContactAddress', 194.9, 479, 341.1, 18],
  ['motherOccupation', 194.9, 503, 114.9, 18], ['motherPhone', 375.9, 503, 160.1, 18],
  ['priority', 302.8, 527, 233.3, 18],
];

export const DEFAULT_PDF_TEMPLATE_LAYOUT: PdfTemplateLayout = {
  pageWidth: PDF_PAGE_WIDTH_PT,
  pageHeight: PDF_PAGE_HEIGHT_PT,
  fields: DEFAULT_BOUNDS.map(([key, left, top, width, height], index) => ({
    key, pageIndex: 0, x: left / PDF_PAGE_WIDTH_PT, y: top / PDF_PAGE_HEIGHT_PT,
    width: width / PDF_PAGE_WIDTH_PT, height: height / PDF_PAGE_HEIGHT_PT,
    rotation: 0, zIndex: index, formatter: PDF_TEMPLATE_FIELD_CATALOG.find((field) => field.key === key)?.formatter,
    style: { ...DEFAULT_STYLE },
  })),
};

export function layoutChecksum(layout: PdfTemplateLayout): string {
  return createHash('sha256').update(JSON.stringify(layout)).digest('hex');
}

function formatDate(value: unknown): string {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
}

export function resolveRosterPdfValues(roster: any, student: any): Record<PdfTemplateFieldKey, unknown> {
  const linkedStudent = roster?.identity_state === 'LINKED' && student ? student : null;
  const profile = roster?.applicant_profile || {};
  const parent = (key: 'father' | 'mother') => profile[key] || {};
  return {
    name: linkedStudent?.full_name || roster?.full_name || '',
    dob: formatDate(linkedStudent?.date_bir || roster?.date_of_birth),
    gender: ({ Male: 'Nam', Female: 'Nữ', Other: 'Khác' } as Record<string, string>)[linkedStudent?.sex || roster?.gender] || '',
    className: linkedStudent?.class_id?.class_name || '', faculty: linkedStudent?.class_id?.dept_id?.name || '',
    ethnicity: profile.ethnicity || '', religion: profile.religion || '', phone: roster?.phone_number || '',
    citizenId: profile.citizen_id_number || '', citizenIssueDate: formatDate(profile.citizen_id_issue_date),
    citizenIssuePlace: profile.citizen_id_issue_place || '', permanentAddress: profile.permanent_address || '',
    fatherName: parent('father').full_name || '', fatherAge: parent('father').age || '',
    fatherAddress: parent('father').permanent_address || '', fatherContactAddress: parent('father').contact_address || '',
    fatherOccupation: parent('father').occupation || '', fatherPhone: parent('father').phone_number || '',
    motherName: parent('mother').full_name || '', motherAge: parent('mother').age || '',
    motherAddress: parent('mother').permanent_address || '', motherContactAddress: parent('mother').contact_address || '',
    motherOccupation: parent('mother').occupation || '', motherPhone: parent('mother').phone_number || '',
    priority: profile.priority_certificate_details || '',
  };
}

