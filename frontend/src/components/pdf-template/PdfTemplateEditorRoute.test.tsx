import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { metadataApi, sourceApi, push } = vi.hoisted(() => ({
  metadataApi: vi.fn(),
  sourceApi: vi.fn(),
  push: vi.fn(),
}));

const mockPermissions = { manage: true };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams('returnTo=testParam%3D1'),
}));

vi.mock('@/components/guards/RouteGuard', () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePermission: () => mockPermissions,
}));

vi.mock('@/api/pdf-template-api', () => ({
  pdfTemplateApi: {
    metadata: metadataApi,
    source: sourceApi,
  },
}));

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

import PdfTemplateEditorRoute from './PdfTemplateEditorRoute';

const mockMetadataConfigured = {
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

const mockMetadataUnconfigured = {
  ...mockMetadataConfigured,
  configured: false,
  layout: null,
};

describe('PdfTemplateEditorRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions.manage = true;
    metadataApi.mockResolvedValue(mockMetadataConfigured);
    sourceApi.mockResolvedValue(new Blob(['dummy pdf'], { type: 'application/pdf' }));
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({} as any);
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-pdf-url');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('displays unauthorized message when user lacks manage permission', () => {
    mockPermissions.manage = false;
    render(<PdfTemplateEditorRoute templateTypeCode="DORMITORY_ROSTER_APPLICATION" mode="edit" />);

    expect(screen.getByText('Bạn không có quyền quản lý PDF template.')).toBeInTheDocument();
  });

  it('displays loading indicator initially while metadata is being fetched', () => {
    metadataApi.mockReturnValue(new Promise(() => {}));
    render(<PdfTemplateEditorRoute templateTypeCode="DORMITORY_ROSTER_APPLICATION" mode="edit" />);

    expect(screen.getByText('Đang tải metadata...')).toBeInTheDocument();
  });

  it('renders error state when metadata loading fails and supports navigating back', async () => {
    metadataApi.mockRejectedValue(new Error('Không tìm thấy template.'));
    render(<PdfTemplateEditorRoute templateTypeCode="DORMITORY_ROSTER_APPLICATION" mode="edit" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không tìm thấy template.');

    const backBtn = screen.getByRole('button', { name: 'Quay lại' });
    fireEvent.click(backBtn);

    expect(push).toHaveBeenCalledWith('/dormitory/pdf-template?testParam=1');
  });

  it('errors when mode is new but template is already configured', async () => {
    metadataApi.mockResolvedValue(mockMetadataConfigured);
    render(<PdfTemplateEditorRoute templateTypeCode="DORMITORY_ROSTER_APPLICATION" mode="new" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Collection này đã được cấu hình.');
  });

  it('errors when mode is edit but template is not configured', async () => {
    metadataApi.mockResolvedValue(mockMetadataUnconfigured);
    render(<PdfTemplateEditorRoute templateTypeCode="DORMITORY_ROSTER_APPLICATION" mode="edit" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Collection này chưa có template để sửa.');
  });

  it('renders PdfTemplateEditor without a separate route-level top banner in edit mode', async () => {
    metadataApi.mockResolvedValue(mockMetadataConfigured);
    render(<PdfTemplateEditorRoute templateTypeCode="DORMITORY_ROSTER_APPLICATION" mode="edit" />);

    await screen.findByRole('region', { name: 'PDF template editor' });

    // In-editor command bar renders mode title and metadata
    expect(await screen.findByText('Sửa mẫu PDF')).toBeInTheDocument();
    expect(screen.getByText(/Đơn đăng ký KTX/)).toBeInTheDocument();

    // Editor back button navigates back via onBack
    const backBtn = screen.getByRole('button', { name: /← Quay lại/ });
    fireEvent.click(backBtn);
    expect(push).toHaveBeenCalledWith('/dormitory/pdf-template?testParam=1');
  });

  it('renders PdfTemplateEditor in new mode for unconfigured template', async () => {
    metadataApi.mockResolvedValue(mockMetadataUnconfigured);
    render(<PdfTemplateEditorRoute templateTypeCode="DORMITORY_ROSTER_APPLICATION" mode="new" />);

    await screen.findByRole('region', { name: 'PDF template editor' });
    expect(await screen.findByText('Thêm mẫu PDF')).toBeInTheDocument();
    expect(screen.getByText('Chưa có PDF nền. Chọn source PDF để bắt đầu thiết kế.')).toBeInTheDocument();
  });
});
