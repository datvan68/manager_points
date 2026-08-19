import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PdfTemplateEditor, { canRenderPdfOverlays } from './PdfTemplateEditor';
import { pdfTemplateApi, PdfTemplateMetadata } from '@/api/pdf-template-api';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: () =>
        Promise.resolve({
          getViewport: ({ scale }: { scale: number }) => ({
            width: 595.32 * scale,
            height: 842.04 * scale,
            rotation: 0,
          }),
          render: () => ({
            promise: Promise.resolve(),
            cancel: vi.fn(),
          }),
        }),
      destroy: () => Promise.resolve(),
    }),
  }),
}));

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
      allowedFormatters: ['plain', 'uppercase'],
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
    {
      key: 'student.roomNumber',
      label: 'Số phòng',
      dataType: 'string',
      sensitive: false,
      syntheticSample: 'A101',
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
    vi.clearAllMocks();
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({} as any);
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-pdf-url');
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(pdfTemplateApi, 'source').mockResolvedValue(
      new Blob(['dummy pdf content'], { type: 'application/pdf' })
    );
  });

  it('keeps overlays hidden until the active page finishes rendering', () => {
    expect(canRenderPdfOverlays('loading', null, 0)).toBe(false);
    expect(canRenderPdfOverlays('error', 0, 0)).toBe(false);
    expect(canRenderPdfOverlays('ready', 1, 0)).toBe(false);
    expect(canRenderPdfOverlays('ready', 0, 0)).toBe(true);
  });

  it('renders editor section with local canvas overflow-auto container for zoom', async () => {
    const { container } = render(
      <PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />
    );

    const editorSection = await screen.findByRole('region', { name: 'PDF template editor' });
    expect(editorSection).toHaveClass('space-y-4');

    // Canvas container must have overflow-auto for local zoom scrolling
    const canvasScrollContainer = container.querySelector(
      '.overflow-auto.rounded-2xl.border.bg-slate-100'
    );
    expect(canvasScrollContainer).toBeInTheDocument();
    expect(canvasScrollContainer).toHaveClass('overflow-auto');
  });

  it('displays 4 visible corner resize handles when a field is selected', async () => {
    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    // Wait for PDF rendering to finish and overlay to appear
    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    expect(fieldElement).toBeInTheDocument();

    // Click field to select it
    fireEvent.click(fieldElement);

    // Verify 4 resize handles are rendered with correct accessible titles
    expect(screen.getByTitle('Resize northwest')).toBeInTheDocument();
    expect(screen.getByTitle('Resize northeast')).toBeInTheDocument();
    expect(screen.getByTitle('Resize southwest')).toBeInTheDocument();
    expect(screen.getByTitle('Resize southeast')).toBeInTheDocument();
  });

  it('resizes field using corner handle gesture without unexpected move', async () => {
    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    fireEvent.click(fieldElement);

    const seHandle = screen.getByTitle('Resize southeast');

    // Pointer down on resize handle
    fireEvent.pointerDown(seHandle, {
      pointerId: 1,
      clientX: 200,
      clientY: 100,
    });

    // Pointer move
    fireEvent.pointerMove(seHandle, {
      pointerId: 1,
      clientX: 250,
      clientY: 130,
    });

    // Pointer up
    fireEvent.pointerUp(seHandle, {
      pointerId: 1,
    });

    // Verify properties panel shows updated dimensions
    const widthInput = screen.getByLabelText('width') as HTMLInputElement;
    expect(Number(widthInput.value)).toBeGreaterThan(0.3);
  });

  it('moves field on pointer drag', async () => {
    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });

    // Drag field
    fireEvent.pointerDown(fieldElement, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });

    fireEvent.pointerMove(fieldElement, {
      pointerId: 1,
      clientX: 160,
      clientY: 160,
    });

    fireEvent.pointerUp(fieldElement, {
      pointerId: 1,
    });

    const xInput = screen.getByLabelText('x') as HTMLInputElement;
    expect(Number(xInput.value)).toBeGreaterThan(0.1);
  });

  it('allows adding field from field palette and modifying properties', async () => {
    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    await screen.findByRole('button', { name: 'student.fullName' });

    // Click "Số phòng" in field palette
    const addRoomBtn = screen.getByRole('button', { name: /Số phòng/ });
    fireEvent.click(addRoomBtn);

    // Selected item properties panel appears
    expect(screen.getByRole('heading', { name: 'Thuộc tính field' })).toBeInTheDocument();
    expect(screen.getAllByText('student.roomNumber').length).toBeGreaterThanOrEqual(1);

    // Modify font size
    const fontSizeInput = screen.getByLabelText('Font size') as HTMLInputElement;
    fireEvent.change(fontSizeInput, { target: { value: '16' } });
    expect(fontSizeInput.value).toBe('16');

    // Delete field via properties panel
    const deleteFieldBtn = screen.getByRole('button', { name: 'Xóa field' });
    fireEvent.click(deleteFieldBtn);

    // Properties panel should close
    expect(screen.queryByRole('heading', { name: 'Thuộc tính field' })).not.toBeInTheDocument();
  });

  it('supports keyboard navigation for nudge and delete', async () => {
    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    fireEvent.click(fieldElement);

    // Arrow keys nudge
    fireEvent.keyDown(fieldElement, { key: 'ArrowRight' });
    const xInput = screen.getByLabelText('x') as HTMLInputElement;
    expect(Number(xInput.value)).toBeCloseTo(0.101);

    // Delete key removes field
    fireEvent.keyDown(fieldElement, { key: 'Delete' });
    expect(screen.queryByRole('button', { name: 'student.fullName' })).not.toBeInTheDocument();
  });
});
