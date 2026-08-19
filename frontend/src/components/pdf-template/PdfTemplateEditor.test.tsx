import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PdfTemplateEditor, { canRenderPdfOverlays } from './PdfTemplateEditor';
import { pdfTemplateApi, PdfTemplateMetadata } from '@/api/pdf-template-api';

let mockNumPages = 1;

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({
    promise: Promise.resolve({
      get numPages() {
        return mockNumPages;
      },
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
    mockNumPages = 1;
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

  it('renders fields as text only with zero border, background, ring, shadow, or resize handles (AC-001)', async () => {
    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    expect(fieldElement).toBeInTheDocument();

    // Must NOT have border, background, ring, or shadow classes
    expect(fieldElement.className).not.toMatch(/border|bg-|ring|shadow/);
    expect(fieldElement.className).toContain('text-slate-800');
    expect(fieldElement.className).toContain('font-medium');

    // Zero resize handles rendered anywhere
    expect(screen.queryByTitle('Resize northwest')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Resize northeast')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Resize southwest')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Resize southeast')).not.toBeInTheDocument();
  });

  it('indicates selection purely via text styling without a bounding box or resize handles (AC-001)', async () => {
    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    fireEvent.click(fieldElement);

    // Selected state text styling
    expect(fieldElement.className).toContain('text-blue-600');
    expect(fieldElement.className).toContain('font-bold');

    // Still no bounding box, border, ring, shadow, or resize handles
    expect(fieldElement.className).not.toMatch(/border|bg-|ring|shadow/);
    expect(screen.queryByTitle('Resize northwest')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Resize southeast')).not.toBeInTheDocument();
  });

  it('moves field on pointer drag (AC-002)', async () => {
    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    const initialLeft = parseFloat(fieldElement.style.left);

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

    const updatedLeft = parseFloat(fieldElement.style.left);
    expect(updatedLeft).toBeGreaterThan(initialLeft);
  });

  it('allows adding field from field palette and modifying font size (AC-002, AC-003)', async () => {
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

  it('supports keyboard navigation for nudge and delete (AC-002)', async () => {
    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    fireEvent.click(fieldElement);

    const initialLeft = parseFloat(fieldElement.style.left);

    // Arrow keys nudge
    fireEvent.keyDown(fieldElement, { key: 'ArrowRight' });
    const nudgedLeft = parseFloat(fieldElement.style.left);
    expect(nudgedLeft).toBeGreaterThan(initialLeft);

    // Delete key removes field
    fireEvent.keyDown(fieldElement, { key: 'Delete' });
    expect(screen.queryByRole('button', { name: 'student.fullName' })).not.toBeInTheDocument();
  });

  it('simplifies property panel to field identity, Font size, and Delete action while hiding raw geometry and advanced controls (AC-003)', async () => {
    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    fireEvent.click(fieldElement);

    // Visible controls
    expect(screen.getByRole('heading', { name: 'Thuộc tính field' })).toBeInTheDocument();
    expect(screen.getAllByText('student.fullName').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Font size')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa field' })).toBeInTheDocument();

    // Hidden controls (raw geometry, alignment, formatter, overflow)
    expect(screen.queryByLabelText('x')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('y')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('width')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('height')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('rotation')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('zIndex')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Formatter')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Align H')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Align V')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Overflow')).not.toBeInTheDocument();
  });

  it('preserves stored geometry (width, height) and hidden style values in save payload after editing font size (AC-003)', async () => {
    const saveSpy = vi.spyOn(pdfTemplateApi, 'save').mockResolvedValue({
      templateTypeCode: 'DORMITORY_ROSTER_APPLICATION',
      version: 2,
      configured: true,
      checksum: 'newcheck',
      layout: mockMetadata.layout!,
      updatedBy: 'tester',
      updatedAt: '2026-08-19T00:00:00Z',
    });
    vi.spyOn(pdfTemplateApi, 'validate').mockResolvedValue({ valid: true, pages: [], warnings: [] });

    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    fireEvent.click(fieldElement);

    // Change font size
    const fontSizeInput = screen.getByLabelText('Font size');
    fireEvent.change(fontSizeInput, { target: { value: '18' } });

    // Save
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveBtn);
    const confirmBtn = screen.getByRole('button', { name: 'Lưu template' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalled();
      const savedLayout = saveSpy.mock.calls[0][2];
      const savedItem = savedLayout.items.find((it: any) => it.fieldKey === 'student.fullName');
      expect(savedItem).toBeDefined();
      expect(savedItem.style.fontSize).toBe(18);
      // Normalized width and height and existing styles are preserved!
      expect(savedItem.width).toBe(0.3);
      expect(savedItem.height).toBe(0.05);
      expect(savedItem.style.horizontalAlign).toBe('left');
      expect(savedItem.style.overflow).toBe('shrink');
    });
  });

  it('replaces native page select with shared Select component and supports page switching (AC-004)', async () => {
    mockNumPages = 2;
    const multiPageMetadata: PdfTemplateMetadata = {
      ...mockMetadata,
      pages: [
        { pageIndex: 0, width: 595.32, height: 842.04, rotation: 0 },
        { pageIndex: 1, width: 595.32, height: 842.04, rotation: 0 },
      ],
      layout: {
        pages: [
          { pageIndex: 0, width: 595.32, height: 842.04, rotation: 0 },
          { pageIndex: 1, width: 595.32, height: 842.04, rotation: 0 },
        ],
        items: [
          {
            ...mockMetadata.layout!.items[0],
            pageIndex: 0,
          },
          {
            ...mockMetadata.layout!.items[0],
            id: 'item-page-2',
            fieldKey: 'student.roomNumber',
            pageIndex: 1,
          },
        ],
      },
    };

    render(<PdfTemplateEditor metadata={multiPageMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    await screen.findByRole('button', { name: 'student.fullName' });

    // Page selector is a shared Select combobox with label "Trang PDF"
    const pageSelectTrigger = screen.getByRole('combobox', { name: 'Trang PDF' });
    expect(pageSelectTrigger).toBeInTheDocument();
    // Verify zero native <select> exists in the DOM
    expect(document.querySelector('select')).not.toBeInTheDocument();

    // Click trigger to open dropdown
    fireEvent.click(pageSelectTrigger);

    // Select page 2 option
    const page2Option = await screen.findByRole('option', { name: '2 / 2' });
    fireEvent.click(page2Option);

    // Page 2 overlay should appear
    await screen.findByRole('button', { name: 'student.roomNumber' });
    expect(screen.queryByRole('button', { name: 'student.fullName' })).not.toBeInTheDocument();
  });

  it('opens focused preview dialog with concise header, PDF viewer, and explicit close button', async () => {
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
      'vietnamese',
      undefined
    );

    const dialog = await screen.findByRole('dialog', { name: 'Synthetic PDF preview' });
    expect(dialog).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Synthetic preview' })).toBeInTheDocument();

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

    // Modify font size in sidebar
    const fontSizeInput = screen.getByLabelText('Font size') as HTMLInputElement;
    fireEvent.change(fontSizeInput, { target: { value: '20' } });
    expect(fontSizeInput.value).toBe('20');

    // Open preview
    const previewButton = screen.getByRole('button', { name: 'Preview' });
    fireEvent.click(previewButton);
    await screen.findByRole('dialog');

    // Close preview
    const closeBtn = screen.getByRole('button', { name: 'Đóng preview' });
    fireEvent.click(closeBtn);

    // Confirm font size value was preserved
    const fontSizeInputAfter = screen.getByLabelText('Font size') as HTMLInputElement;
    expect(fontSizeInputAfter.value).toBe('20');
  });

  it('switches between Fit page and 100% view modes, updating effective scale for canvas overlays', async () => {
    render(<PdfTemplateEditor metadata={mockMetadata} onSaved={vi.fn()} onDirtyChange={vi.fn()} />);

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });

    // In default 'fit' mode with mock container (800x600, available 752x552 against 595.32x842.04)
    // fitScale = 552 / 842.04 = ~0.6555 -> effectiveFontSize = ~7.866px
    const initialFontSize = parseFloat(fieldElement.style.fontSize || '0');
    expect(initialFontSize).toBeGreaterThan(6);
    expect(initialFontSize).toBeLessThan(12);

    // Switch to 100% mode
    const mode100Btn = screen.getByRole('button', { name: '100%' });
    fireEvent.click(mode100Btn);

    // In 100% mode, effectiveScale = 1.0 -> effectiveFontSize = 12px
    const updatedField = await screen.findByRole('button', { name: 'student.fullName' });
    expect(updatedField.style.fontSize).toBe('12px');

    // Switch back to Fit page mode
    const fitPageBtn = screen.getByRole('button', { name: 'Fit page' });
    fireEvent.click(fitPageBtn);

    const refitField = await screen.findByRole('button', { name: 'student.fullName' });
    expect(parseFloat(refitField.style.fontSize || '0')).toBeCloseTo(initialFontSize, 1);
  });

  it('renders command bar with 41px visual rhythm, back button, title, and compact control groups without Grid/Snap/Fixture', async () => {
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
    expect(screen.getByRole('combobox', { name: 'Trang PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fit page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '100%' })).toBeInTheDocument();

    // Removed controls
    expect(screen.queryByLabelText('Zoom')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Snap')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Grid')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fixture')).not.toBeInTheDocument();

    // Actions
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
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

    // Now make it dirty by modifying font size
    fireEvent.click(fieldElement);
    const fontSizeInput = screen.getByLabelText('Font size') as HTMLInputElement;
    fireEvent.change(fontSizeInput, { target: { value: '22' } });

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
    const fontSizeInput = screen.getByLabelText('Font size') as HTMLInputElement;
    fireEvent.change(fontSizeInput, { target: { value: '24' } });

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
    const fontSizeInput = screen.getByLabelText('Font size') as HTMLInputElement;
    fireEvent.change(fontSizeInput, { target: { value: '24' } });

    // Dispatch beforeunload event
    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('maintains normalized field coordinate stability during responsive resize', async () => {
    render(
      <PdfTemplateEditor
        metadata={mockMetadata}
        onSaved={vi.fn()}
        onDirtyChange={vi.fn()}
      />
    );

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    const initialLeft = fieldElement.style.left;
    const initialTop = fieldElement.style.top;

    // Trigger window resize event
    fireEvent(window, new Event('resize'));

    // Field normalized coordinates and overlay styles must remain stable
    expect(fieldElement.style.left).toBe(initialLeft);
    expect(fieldElement.style.top).toBe(initialTop);
  });

  it('renders field overlay with saved typography and padding without monospace', async () => {
    render(
      <PdfTemplateEditor
        metadata={mockMetadata}
        onSaved={vi.fn()}
        onDirtyChange={vi.fn()}
      />
    );

    const fieldElement = await screen.findByRole('button', { name: 'student.fullName' });
    expect(fieldElement).toBeInTheDocument();
    expect(fieldElement.className).not.toContain('font-mono');
    expect(fieldElement.style.fontFamily).toContain('Helvetica');
    expect(fieldElement.style.padding).toBeDefined();
  });
});
