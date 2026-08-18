import { PdfTemplateStyle, PdfTemplateTypeDescriptor } from '../types';

const style: PdfTemplateStyle = { fontFamily: 'Helvetica', fontSize: 12, minFontSize: 7, fontWeight: 400, color: '#000000', horizontalAlign: 'left', verticalAlign: 'top', lineHeight: 1.15, padding: 1, background: 'transparent', overflow: 'shrink', maxLines: 1 };

export const TEST_MULTI_PAGE_DESCRIPTOR: PdfTemplateTypeDescriptor = {
  moduleCode: 'TEST', featureCode: 'MULTI_PAGE', templateTypeCode: 'TEST_MULTI_PAGE', displayName: 'Test multi-page template', sourcePermission: 'TEST_READ',
  fields: [
    { key: 'report.title', label: 'Title', dataType: 'string', sensitive: false, syntheticSample: 'Synthetic title', allowedFormatters: ['plain'], defaultStyle: style },
    { key: 'report.code', label: 'Code', dataType: 'string', sensitive: false, syntheticSample: 'T-001', allowedFormatters: ['plain'], defaultStyle: style },
  ],
  pagePolicy: { minPages: 2, maxPages: 2 },
  syntheticFixture: (name) => ({ name, values: { 'report.title': name === 'long' ? 'A long synthetic title' : 'Synthetic title', 'report.code': 'T-001' } }),
};

