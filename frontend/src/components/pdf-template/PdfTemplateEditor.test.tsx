import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PdfTemplateEditor, { canRenderPdfOverlays } from './PdfTemplateEditor';
import { pdfTemplateApi, PdfTemplateMetadata } from '@/api/pdf-template-api';

const mockMetadata: PdfTemplateMetadata = {
  moduleCode: 'DORMITORY',
  featureCode: 'ROSTER',
  templateTypeCode: 'DORMITORY_ROSTER_APPLICATION',
  displayName: 'Đơn đăng ký KTX',
  configured: true,
  version: 1,
  checksum: 'abc123',
  sourceFilename: 'dormitory-roster-application.pdf',
  pageCount: 1,
  sourceBytes: 12345,
  updatedBy: null,
  updatedAt: null,
  sourcePermission: 'DORMITORY_ROSTER_MANAGE',
  fields: [
    {
      key: 'student.fullName',
      label: 'Họ và tên',
      dataType: 'string',
      sensitive: false,
      syntheticSample: 'Nguyễn Văn A',
      allowedFormatters: ['plain'],
      defaultStyle: {
        fontFamily: 'Helvetica',
        fontSize: 12,
        minFontSize: 8,
        fontWeight: 400,
        color: '#000000',
        horizontalAlign: 'left',
        verticalAlign: 'top',
        lineHeight: 1.15,
        padding: 2,
        background: 'transparent',
        overflow: 'shrink',
        maxLines: 1,
      },
    },
  ],
  pages: [{ pageIndex: 0, width: 595.32, height: 842.04, rotation: 0 }],
  layout: {
    pages: [{ pageIndex: 0, width: 595.32, height: 842.04, rotation: 0 }],
    items: [
      {
        id: 'item-1',
        fieldKey: 'student.fullName',
        formatter: 'plain',
        pageIndex: 0,
        x: 0.1,
        y: 0.1,
        width: 0.3,
        height: 0.05,
        rotation: 0,
        zIndex: 0,
        style: {
          fontFamily: 'Helvetica',
          fontSize: 12,
          minFontSize: 8,
          fontWeight: 400,
          color: '#000000',
          horizontalAlign: 'left',
          verticalAlign: 'top',
          lineHeight: 1.15,
          padding: 2,
          background: 'transparent',
          overflow: 'shrink',
          maxLines: 1,
        },
      },
    ],
  },
};

describe('PdfTemplateEditor', () => {
  beforeEach(() => {
    vi.spyOn(pdfTemplateApi, 'source').mockImplementation(() => new Promise(() => {}));
  });

  it('keeps overlays hidden until the active page finishes rendering', () => {
    expect(canRenderPdfOverlays('loading', null, 0)).toBe(false);
    expect(canRenderPdfOverlays('error', 0, 0)).toBe(false);
    expect(canRenderPdfOverlays('ready', 1, 0)).toBe(false);
    expect(canRenderPdfOverlays('ready', 0, 0)).toBe(true);
  });

  it('renders editor section with local canvas overflow-auto container for zoom', () => {
    const { container } = render(
      <PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />,
    );

    const editorSection = screen.getByRole('region', { name: 'PDF template editor' });
    expect(editorSection).toHaveClass('space-y-4');

    // Canvas container must have overflow-auto for local zoom scrolling
    const canvasScrollContainer = container.querySelector('.overflow-auto.rounded-2xl.border.bg-slate-100');
    expect(canvasScrollContainer).toBeInTheDocument();
    expect(canvasScrollContainer).toHaveClass('overflow-auto');
  });
});
