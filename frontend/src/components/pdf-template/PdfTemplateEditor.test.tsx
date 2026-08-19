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
    expect(editorSection).toHaveClass('flex', 'flex-col', 'overflow-hidden');

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

  it('opens focused preview dialog with concise header, fixture context, PDF viewer, and explicit close button', async () => {
    const previewSpy = vi.spyOn(pdfTemplateApi, 'preview').mockResolvedValue(
      new Blob(['dummy pdf preview content'], { type: 'application/pdf' })
    );

    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    await screen.findByRole('button', { name: 'student.fullName' });

    const previewButton = screen.getByRole('button', { name: 'Preview' });
    fireEvent.click(previewButton);

    expect(previewSpy).toHaveBeenCalledWith(
      'DORMITORY_ROSTER_APPLICATION',
      expect.any(Object),
      'short',
      undefined
    );

    const dialog = await screen.findByRole('dialog', { name: 'Synthetic PDF preview' });
    expect(dialog).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Synthetic preview' })).toBeInTheDocument();
    expect(screen.getByText(/Fixture:/)).toBeInTheDocument();
    expect(screen.getByText('short')).toBeInTheDocument();

    const iframe = screen.getByTitle('Synthetic PDF preview') as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.src).toContain('blob:mock-pdf-url');

    expect(screen.getByRole('button', { name: 'Đóng preview' })).toBeInTheDocument();
  });

  it('closes preview dialog, revokes object URL, and restores focus to Preview button when close button is clicked', async () => {
    vi.spyOn(pdfTemplateApi, 'preview').mockResolvedValue(
      new Blob(['preview content'], { type: 'application/pdf' })
    );

    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    await screen.findByRole('button', { name: 'student.fullName' });

    const previewButton = screen.getByRole('button', { name: 'Preview' });
    fireEvent.click(previewButton);

    const closeBtn = await screen.findByRole('button', { name: 'Đóng preview' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-pdf-url');
    expect(document.activeElement).toBe(previewButton);
  });

  it('closes preview dialog, revokes object URL, and restores focus when Escape key is pressed', async () => {
    vi.spyOn(pdfTemplateApi, 'preview').mockResolvedValue(
      new Blob(['preview content'], { type: 'application/pdf' })
    );

    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    await screen.findByRole('button', { name: 'student.fullName' });

    const previewButton = screen.getByRole('button', { name: 'Preview' });
    fireEvent.click(previewButton);

    await screen.findByTitle('Synthetic PDF preview');

    // Press Escape on window
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-pdf-url');
    expect(document.activeElement).toBe(previewButton);
  });

  it('handles preview loading, error state, and retry action in preview dialog', async () => {
    const previewSpy = vi
      .spyOn(pdfTemplateApi, 'preview')
      .mockRejectedValueOnce(new Error('Máy chủ preview không phản hồi.'))
      .mockResolvedValueOnce(new Blob(['preview retry blob'], { type: 'application/pdf' }));

    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    await screen.findByRole('button', { name: 'student.fullName' });

    const previewButton = screen.getByRole('button', { name: 'Preview' });
    fireEvent.click(previewButton);

    // Error message appears in dialog
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('Máy chủ preview không phản hồi.');

    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    expect(retryBtn).toBeInTheDocument();

    // Click retry
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(previewSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByTitle('Synthetic PDF preview')).toBeInTheDocument();
    });
  });

  it('preserves unsaved editor state across preview open and close cycle', async () => {
    vi.spyOn(pdfTemplateApi, 'preview').mockResolvedValue(
      new Blob(['preview content'], { type: 'application/pdf' })
    );

    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    fireEvent.click(fieldElement);

    // Modify width in sidebar
    const widthInput = screen.getByLabelText('width') as HTMLInputElement;
    fireEvent.change(widthInput, { target: { value: '0.45' } });
    expect(widthInput.value).toBe('0.45');

    // Open preview
    const previewButton = screen.getByRole('button', { name: 'Preview' });
    fireEvent.click(previewButton);
    await screen.findByRole('dialog');

    // Close preview
    const closeBtn = screen.getByRole('button', { name: 'Đóng preview' });
    fireEvent.click(closeBtn);

    // Confirm width value was preserved
    const widthInputAfter = screen.getByLabelText('width') as HTMLInputElement;
    expect(widthInputAfter.value).toBe('0.45');
  });

  it('scales fontSize proportionally from initial font size by height ratio during corner resize', async () => {
    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    fireEvent.click(fieldElement);

    const fontSizeInput = screen.getByLabelText('Font size') as HTMLInputElement;
    expect(fontSizeInput.value).toBe('12');

    const seHandle = screen.getByTitle('Resize southeast');

    // Initial height is 0.05. Page height is 842.04.
    // Dragging down by ~42.102 px (0.05 height) doubles height from 0.05 to 0.10.
    // Height ratio = 0.10 / 0.05 = 2.0 -> fontSize = 12 * 2 = 24.
    fireEvent.pointerDown(seHandle, {
      pointerId: 1,
      clientX: 200,
      clientY: 100,
    });

    fireEvent.pointerMove(seHandle, {
      pointerId: 1,
      clientX: 250,
      clientY: 142.102,
    });

    fireEvent.pointerUp(seHandle, {
      pointerId: 1,
    });

    expect(fontSizeInput.value).toBe('24');
  });

  it('clamps scaled fontSize to supported range [6, 48] during extreme corner resize', async () => {
    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    fireEvent.click(fieldElement);

    const fontSizeInput = screen.getByLabelText('Font size') as HTMLInputElement;
    const seHandle = screen.getByTitle('Resize southeast');

    // Extreme increase: height expands 5x -> raw font size = 60 -> clamped to 48
    fireEvent.pointerDown(seHandle, { pointerId: 1, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(seHandle, { pointerId: 1, clientX: 250, clientY: 350 });
    fireEvent.pointerUp(seHandle, { pointerId: 1 });

    expect(fontSizeInput.value).toBe('48');

    // Extreme decrease: height shrinks drastically past anchor -> raw font size < 6 -> clamped to 6
    const nwHandle = screen.getByTitle('Resize northwest');
    fireEvent.pointerDown(nwHandle, { pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(nwHandle, { pointerId: 2, clientX: 200, clientY: 600 });
    fireEvent.pointerUp(nwHandle, { pointerId: 2 });

    expect(Number(fontSizeInput.value)).toBe(6);
  });

  it('keeps font size unchanged during horizontal-only resize gesture', async () => {
    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    fireEvent.click(fieldElement);

    const fontSizeInput = screen.getByLabelText('Font size') as HTMLInputElement;
    expect(fontSizeInput.value).toBe('12');

    const seHandle = screen.getByTitle('Resize southeast');

    // Resize only horizontally (delta Y = 0)
    fireEvent.pointerDown(seHandle, { pointerId: 1, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(seHandle, { pointerId: 1, clientX: 300, clientY: 100 });
    fireEvent.pointerUp(seHandle, { pointerId: 1 });

    expect(fontSizeInput.value).toBe('12');
  });

  it('renders canvas fieldKey label using effective style.fontSize scaled by active zoom and with contrast styling', async () => {
    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });

    // Label element inside field
    const labelElement = fieldElement.querySelector('div');
    expect(labelElement).toBeInTheDocument();
    // Default zoom is 1, initial fontSize is 12 -> style fontSize should be 12px
    expect(labelElement?.style.fontSize).toBe('12px');

    // Change zoom to 200% (zoom = 2)
    const zoomSelect = screen.getByLabelText('Zoom');
    fireEvent.change(zoomSelect, { target: { value: '2' } });

    // Wait for overlay to re-render after zoom change
    const updatedField = await screen.findByRole('button', { name: 'student.fullName' });
    const updatedLabel = updatedField.querySelector('div');
    expect(updatedLabel?.style.fontSize).toBe('24px');

    // When clicked / selected, field button receives selected high-contrast classes
    fireEvent.click(updatedField);
    expect(updatedField.className).toContain('text-blue-950');
    expect(updatedField.className).toContain('font-bold');
  });

  it('renders command bar with 41px visual rhythm, back button, title, and compact control groups', async () => {
    const onBack = vi.fn();
    const { container } = render(
      <PdfTemplateEditor
        metadata={mockMetadata}
        mode="edit"
        onSaved={vi.fn()}
        onBack={onBack}
        onDirtyChange={vi.fn()}
      />
    );

    await screen.findByRole('button', { name: 'student.fullName' });

    // Command bar with 41px height rhythm
    const commandBar = container.querySelector('.h-\\[41px\\]');
    expect(commandBar).toBeInTheDocument();
    expect(commandBar).toHaveClass('bg-white/45', 'backdrop-blur-md', 'border-b', 'border-white/70');

    // Back button, Title & Metadata
    const backBtn = screen.getByRole('button', { name: /← Quay lại/ });
    expect(backBtn).toBeInTheDocument();
    expect(screen.getByText('Sửa mẫu PDF')).toBeInTheDocument();
    expect(screen.getByText(/Đơn đăng ký KTX/)).toBeInTheDocument();

    // Controls
    expect(screen.getByText('Thay PDF nền')).toBeInTheDocument();
    expect(screen.getByLabelText('Trang PDF')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom')).toBeInTheDocument();
    expect(screen.getByLabelText('Snap')).toBeInTheDocument();
    expect(screen.getByLabelText('Grid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('honors horizontalAlign and verticalAlign styling on canvas field overlays', async () => {
    const customMetadata: PdfTemplateMetadata = {
      ...mockMetadata,
      layout: {
        pages: [{ pageIndex: 0, width: 595.32, height: 842.04, rotation: 0 }],
        items: [
          {
            id: 'item-custom-align',
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
              ...mockMetadata.fields[0].defaultStyle,
              horizontalAlign: 'center',
              verticalAlign: 'bottom',
              padding: 4,
            },
          },
        ],
      },
    };

    render(
      <PdfTemplateEditor
        metadata={customMetadata}
        onSaved={vi.fn()}
        onDirtyChange={vi.fn()}
      />
    );

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    const innerContainer = fieldElement.querySelector('div');
    expect(innerContainer).toHaveClass('justify-center', 'text-center', 'items-end');
    expect(innerContainer?.style.padding).toBe('4px');
  });

  it('opens ConfirmModal when Save is clicked and saves template when confirmed', async () => {
    const validateSpy = vi.spyOn(pdfTemplateApi, 'validate').mockResolvedValue({ valid: true, pages: [], warnings: [] });
    const saveSpy = vi.spyOn(pdfTemplateApi, 'save').mockResolvedValue({
      templateTypeCode: 'DORMITORY_ROSTER_APPLICATION',
      version: 2,
      configured: true,
      checksum: 'newcheck',
      layout: mockMetadata.layout!,
      updatedBy: 'tester',
      updatedAt: '2026-08-19T00:00:00Z',
    });
    const onSaved = vi.fn();

    render(
      <PdfTemplateEditor
        metadata={mockMetadata}
        onSaved={onSaved}
        onDirtyChange={vi.fn()}
      />
    );

    await screen.findByRole('button', { name: 'student.fullName' });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    // Save ConfirmModal appears
    expect(screen.getByRole('heading', { name: 'Xác nhận lưu template' })).toBeInTheDocument();
    expect(screen.getByText('Lưu template này thành cấu hình hiện hành?')).toBeInTheDocument();

    // Click confirm button in ConfirmModal
    const confirmBtn = screen.getByRole('button', { name: 'Lưu template' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalled();
      expect(saveSpy).toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it('cancels save when cancel is clicked in save ConfirmModal without calling API', async () => {
    const validateSpy = vi.spyOn(pdfTemplateApi, 'validate');
    const saveSpy = vi.spyOn(pdfTemplateApi, 'save');
    const onSaved = vi.fn();

    render(
      <PdfTemplateEditor
        metadata={mockMetadata}
        onSaved={onSaved}
        onDirtyChange={vi.fn()}
      />
    );

    await screen.findByRole('button', { name: 'student.fullName' });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    expect(screen.getByRole('heading', { name: 'Xác nhận lưu template' })).toBeInTheDocument();

    // Click Cancel in ConfirmModal
    const cancelBtn = screen.getByRole('button', { name: 'Hủy' });
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole('heading', { name: 'Xác nhận lưu template' })).not.toBeInTheDocument();
    expect(validateSpy).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('navigates immediately on back when clean, and prompts with ConfirmModal when dirty', async () => {
    const onBack = vi.fn();
    const onDirtyChange = vi.fn();

    render(
      <PdfTemplateEditor
        metadata={mockMetadata}
        onSaved={vi.fn()}
        onBack={onBack}
        onDirtyChange={onDirtyChange}
      />
    );

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    const backBtn = screen.getByRole('button', { name: /← Quay lại/ });

    // When clean: click back calls onBack immediately
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'Xác nhận rời trang' })).not.toBeInTheDocument();

    // Now make it dirty by modifying a field
    fireEvent.click(fieldElement);
    const widthInput = screen.getByLabelText('width') as HTMLInputElement;
    fireEvent.change(widthInput, { target: { value: '0.45' } });

    // Now click back -> ConfirmModal appears
    fireEvent.click(backBtn);
    expect(screen.getByRole('heading', { name: 'Xác nhận rời trang' })).toBeInTheDocument();
    expect(screen.getByText('Bạn có thay đổi chưa lưu. Rời trang sẽ mất các thay đổi này?')).toBeInTheDocument();

    // Click cancel (Ở lại) -> modal closes and onBack is not called again
    const stayBtn = screen.getByRole('button', { name: 'Ở lại' });
    fireEvent.click(stayBtn);
    expect(screen.queryByRole('heading', { name: 'Xác nhận rời trang' })).not.toBeInTheDocument();
    expect(onBack).toHaveBeenCalledTimes(1);

    // Click back again and confirm
    fireEvent.click(backBtn);
    const leaveBtn = screen.getByRole('button', { name: 'Rời trang' });
    fireEvent.click(leaveBtn);
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it('guards replacing background PDF with ConfirmModal when dirty', async () => {
    render(
      <PdfTemplateEditor
        metadata={mockMetadata}
        onSaved={vi.fn()}
        onDirtyChange={vi.fn()}
      />
    );

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    fireEvent.click(fieldElement);

    // Make dirty
    const widthInput = screen.getByLabelText('width') as HTMLInputElement;
    fireEvent.change(widthInput, { target: { value: '0.45' } });

    // Attempt replacing PDF
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(['dummy content'], 'new-source.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // ConfirmModal for replacing PDF appears
    expect(screen.getByRole('heading', { name: 'Xác nhận thay PDF nền' })).toBeInTheDocument();
    expect(screen.getByText('Thay PDF nền sẽ có thể làm sai vị trí các field. Tiếp tục?')).toBeInTheDocument();

    // Confirm replacement
    const confirmReplaceBtn = screen.getByRole('button', { name: 'Thay PDF' });
    fireEvent.click(confirmReplaceBtn);

    expect(screen.getByText('PDF mới đã chọn; hãy preview và kiểm tra trước khi lưu.')).toBeInTheDocument();
  });

  it('attaches beforeunload listener when dirty and prevents default', async () => {
    render(
      <PdfTemplateEditor
        metadata={mockMetadata}
        onSaved={vi.fn()}
        onDirtyChange={vi.fn()}
      />
    );

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    fireEvent.click(fieldElement);

    // Make dirty
    const widthInput = screen.getByLabelText('width') as HTMLInputElement;
    fireEvent.change(widthInput, { target: { value: '0.45' } });

    // Dispatch beforeunload event
    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
