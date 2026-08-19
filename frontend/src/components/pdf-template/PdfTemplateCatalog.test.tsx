import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { catalog, deleteApi, metadataApi, saveApi, push, replace } = vi.hoisted(() => ({
  catalog: vi.fn(),
  deleteApi: vi.fn(),
  metadataApi: vi.fn(),
  saveApi: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

const mockPermissions = { read: true, manage: true, delete: true };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/dormitory/pdf-template',
  useSearchParams: () => new URLSearchParams('test=1'),
}));

vi.mock('@/components/guards/RouteGuard', () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePermission: () => mockPermissions,
}));

vi.mock('@/api/pdf-template-api', () => ({
  pdfTemplateApi: {
    catalog,
    delete: deleteApi,
    metadata: metadataApi,
    save: saveApi,
  },
}));

import PdfTemplateCatalog from './PdfTemplateCatalog';

const configuredItem = {
  moduleCode: 'DORMITORY',
  featureCode: 'DORMITORY_ROSTER',
  templateTypeCode: 'DORMITORY_ROSTER_APPLICATION',
  displayName: 'Mẫu đơn đăng ký KTX',
  configured: true,
  version: 2,
  checksum: 'configured-checksum',
  sourceFilename: 'configured.pdf',
  pageCount: 1,
  sourceBytes: 100,
  updatedBy: null,
  updatedAt: '2026-08-15T10:30:00.000Z',
};

const unconfiguredItem = {
  ...configuredItem,
  templateTypeCode: 'SECOND_REGISTERED_COLLECTION',
  displayName: 'Bản cam kết nội trú',
  configured: false,
  version: 0,
  checksum: null,
  sourceFilename: null,
  pageCount: 0,
  sourceBytes: 0,
  updatedAt: null,
};

const mockLayout = {
  pages: [{ pageIndex: 0, width: 595.32, height: 842.04, rotation: 0 }],
  items: [
    {
      id: 'field-1',
      fieldKey: 'student.fullName',
      formatter: 'plain',
      pageIndex: 0,
      x: 0.1,
      y: 0.1,
      width: 0.3,
      height: 0.025,
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
};

const mockMetadataResponse = {
  ...configuredItem,
  sourcePermission: 'DORMITORY_ROSTER_MANAGE',
  fields: [],
  pages: [{ pageIndex: 0, width: 595.32, height: 842.04, rotation: 0 }],
  layout: mockLayout,
};

const unrelatedItem = {
  ...unconfiguredItem,
  moduleCode: 'STUDENT',
  templateTypeCode: 'STUDENT_TRANSCRIPT',
  displayName: 'Bảng điểm sinh viên',
};

describe('PdfTemplateCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions.read = true;
    mockPermissions.manage = true;
    mockPermissions.delete = true;

    catalog.mockResolvedValue({
      items: [configuredItem, unconfiguredItem],
      total: 2,
      page: 1,
      pageSize: 100,
    });
  });

  it('renders one card per registered PDF type ordered by displayName with correct status badges', async () => {
    render(<PdfTemplateCatalog />);

    expect(await screen.findByText('Bản cam kết nội trú')).toBeInTheDocument();
    expect(screen.getByText('Mẫu đơn đăng ký KTX')).toBeInTheDocument();

    const unconfiguredBadge = screen.getByText('Chưa tải lên');
    const configuredBadge = screen.getByText('Đã tải lên');

    expect(unconfiguredBadge).toBeInTheDocument();
    expect(configuredBadge).toBeInTheDocument();

    // Verify displayName ascending ordering
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['Bản cam kết nội trú', 'Mẫu đơn đăng ký KTX']);

    // Verify filter panel, table, visible pagination, and header dropdown are NOT present
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Bộ lọc PDF template')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Collection chưa cấu hình')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Phân trang PDF template')).not.toBeInTheDocument();
  });

  it('navigates to edit route when "Chỉnh sửa" is clicked on a configured template', async () => {
    render(<PdfTemplateCatalog />);

    const editBtn = await screen.findByRole('button', { name: 'Chỉnh sửa' });
    fireEvent.click(editBtn);

    expect(push).toHaveBeenCalledWith(
      '/dormitory/pdf-template/DORMITORY_ROSTER_APPLICATION/edit?returnTo=test%3D1'
    );
  });

  it('navigates to new route when "Tải PDF lên" is clicked on an unconfigured template', async () => {
    render(<PdfTemplateCatalog />);

    const uploadBtn = await screen.findByRole('button', { name: 'Tải PDF lên' });
    fireEvent.click(uploadBtn);

    expect(push).toHaveBeenCalledWith(
      '/dormitory/pdf-template/new?templateTypeCode=SECOND_REGISTERED_COLLECTION&returnTo=test%3D1'
    );
  });

  it('navigates using custom routeBase', async () => {
    render(<PdfTemplateCatalog routeBase="/custom/pdf-template" />);

    const editBtn = await screen.findByRole('button', { name: 'Chỉnh sửa' });
    fireEvent.click(editBtn);

    expect(push).toHaveBeenCalledWith(
      '/custom/pdf-template/DORMITORY_ROSTER_APPLICATION/edit?returnTo=test%3D1'
    );
  });

  it('opens ConfirmModal when "Xóa" is clicked, and closes without deleting when cancelled', async () => {
    render(<PdfTemplateCatalog />);

    const deleteBtn = await screen.findByRole('button', { name: 'Xóa' });
    fireEvent.click(deleteBtn);

    expect(await screen.findByRole('heading', { name: 'Xóa mẫu PDF' })).toBeInTheDocument();
    expect(
      screen.getByText(/Xóa PDF và toàn bộ layout của “Mẫu đơn đăng ký KTX” \(DORMITORY_ROSTER_APPLICATION\)\?/)
    ).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'Hủy' });
    fireEvent.click(cancelBtn);

    expect(deleteApi).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Xóa mẫu PDF' })).not.toBeInTheDocument();
    });
  });

  it('deletes template when confirmed in ConfirmModal and reloads catalog', async () => {
    deleteApi.mockResolvedValue({});

    render(<PdfTemplateCatalog />);

    const deleteBtn = await screen.findByRole('button', { name: 'Xóa' });
    fireEvent.click(deleteBtn);

    expect(await screen.findByRole('heading', { name: 'Xóa mẫu PDF' })).toBeInTheDocument();

    // Confirm button in the modal
    const modalConfirmBtns = screen.getAllByRole('button', { name: 'Xóa' });
    const modalConfirmBtn = modalConfirmBtns[modalConfirmBtns.length - 1];
    fireEvent.click(modalConfirmBtn);

    await waitFor(() => {
      expect(deleteApi).toHaveBeenCalledWith('DORMITORY_ROSTER_APPLICATION', 2);
    });
    // Catalog should be reloaded
    expect(catalog).toHaveBeenCalledTimes(2);
  });

  it('displays error message when deletion fails in ConfirmModal', async () => {
    deleteApi.mockRejectedValueOnce(new Error('Lỗi máy chủ khi xóa'));

    render(<PdfTemplateCatalog />);

    const deleteBtn = await screen.findByRole('button', { name: 'Xóa' });
    fireEvent.click(deleteBtn);

    expect(await screen.findByRole('heading', { name: 'Xóa mẫu PDF' })).toBeInTheDocument();

    const modalConfirmBtns = screen.getAllByRole('button', { name: 'Xóa' });
    const modalConfirmBtn = modalConfirmBtns[modalConfirmBtns.length - 1];
    fireEvent.click(modalConfirmBtn);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Lỗi máy chủ khi xóa');
  });

  it('filters by lockedModuleCode when provided', async () => {
    catalog.mockResolvedValue({
      items: [configuredItem, unrelatedItem],
      total: 2,
      page: 1,
      pageSize: 100,
    });

    render(<PdfTemplateCatalog lockedModuleCode="DORMITORY" />);

    await waitFor(() =>
      expect(catalog).toHaveBeenCalledWith(
        expect.objectContaining({ moduleCode: 'DORMITORY' })
      )
    );

    expect(await screen.findByText('Mẫu đơn đăng ký KTX')).toBeInTheDocument();
    expect(screen.queryByText('Bảng điểm sinh viên')).not.toBeInTheDocument();
  });

  it('loads subsequent pages in parallel when total exceeds pageSize', async () => {
    const page2Item = {
      ...unconfiguredItem,
      templateTypeCode: 'PAGE_2_COLLECTION',
      displayName: 'Mẫu trang 2',
    };

    catalog.mockImplementation((query: Record<string, string | number>) => {
      if (query.page === 1) {
        return Promise.resolve({
          items: [configuredItem],
          total: 101,
          page: 1,
          pageSize: 100,
        });
      }
      return Promise.resolve({
        items: [page2Item],
        total: 101,
        page: 2,
        pageSize: 100,
      });
    });

    render(<PdfTemplateCatalog />);

    expect(await screen.findByText('Mẫu đơn đăng ký KTX')).toBeInTheDocument();
    expect(await screen.findByText('Mẫu trang 2')).toBeInTheDocument();
    expect(catalog).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 100 }));
    expect(catalog).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 100 }));
  });

  it('renders vertical scroll container with correct styling classes', async () => {
    render(<PdfTemplateCatalog />);

    const main = await screen.findByRole('main');
    expect(main).toHaveClass('min-h-0');
    expect(main).toHaveClass('flex-1');
    expect(main).toHaveClass('space-y-6');
    expect(main).toHaveClass('overflow-y-auto');
    expect(main).toHaveClass('p-6');
  });

  it('displays permission denied message when user lacks read permission', async () => {
    mockPermissions.read = false;

    render(<PdfTemplateCatalog />);

    expect(screen.getByText('Bạn không có quyền xem PDF template.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Quản lý mẫu PDF' })).not.toBeInTheDocument();
  });

  it('hides action buttons when user lacks manage or delete permissions', async () => {
    mockPermissions.manage = false;
    mockPermissions.delete = false;

    render(<PdfTemplateCatalog />);

    expect(await screen.findByText('Mẫu đơn đăng ký KTX')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tải lên mẫu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tải PDF lên' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument();
  });

  it('displays formatted "Ngày cập nhật" or "Chưa cập nhật" on cards', async () => {
    render(<PdfTemplateCatalog />);

    expect(await screen.findByText('Mẫu đơn đăng ký KTX')).toBeInTheDocument();
    expect(screen.getByText('Chưa cập nhật')).toBeInTheDocument();
    expect(screen.getAllByText('Ngày cập nhật:').length).toBe(2);
  });

  it('triggers file selection and replaces PDF source after ConfirmModal confirmation', async () => {
    metadataApi.mockResolvedValue(mockMetadataResponse);
    saveApi.mockResolvedValue({});

    const { container } = render(<PdfTemplateCatalog />);

    const uploadSourceBtn = await screen.findByRole('button', { name: 'Tải lên mẫu' });
    fireEvent.click(uploadSourceBtn);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const newPdfFile = new File(['dummy new pdf'], 'new-template.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [newPdfFile] } });

    // ConfirmModal should open
    expect(await screen.findByRole('heading', { name: 'Thay thế file PDF nguồn' })).toBeInTheDocument();
    expect(
      screen.getByText(/Thay thế file PDF nguồn cho “Mẫu đơn đăng ký KTX”.*bằng file “new-template.pdf”\?/)
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Thay thế' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(saveApi).toHaveBeenCalledWith(
        'DORMITORY_ROSTER_APPLICATION',
        2,
        mockLayout,
        newPdfFile
      );
    });

    // Should reload catalog
    expect(catalog).toHaveBeenCalledTimes(2);
  });

  it('cancels PDF replacement when cancel button in ConfirmModal is clicked', async () => {
    metadataApi.mockResolvedValue(mockMetadataResponse);

    const { container } = render(<PdfTemplateCatalog />);

    const uploadSourceBtn = await screen.findByRole('button', { name: 'Tải lên mẫu' });
    fireEvent.click(uploadSourceBtn);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const newPdfFile = new File(['dummy new pdf'], 'new-template.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [newPdfFile] } });

    expect(await screen.findByRole('heading', { name: 'Thay thế file PDF nguồn' })).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'Hủy' });
    fireEvent.click(cancelBtn);

    expect(saveApi).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Thay thế file PDF nguồn' })).not.toBeInTheDocument();
    });
  });

  it('displays actionable error when metadata layout has no items', async () => {
    metadataApi.mockResolvedValue({
      ...mockMetadataResponse,
      layout: { pages: [], items: [] },
    });

    const { container } = render(<PdfTemplateCatalog />);

    const uploadSourceBtn = await screen.findByRole('button', { name: 'Tải lên mẫu' });
    fireEvent.click(uploadSourceBtn);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const newPdfFile = new File(['dummy new pdf'], 'new-template.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [newPdfFile] } });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('chưa có layout hợp lệ');
    expect(saveApi).not.toHaveBeenCalled();
  });

  it('displays error message when saving replaced PDF source fails', async () => {
    metadataApi.mockResolvedValue(mockMetadataResponse);
    saveApi.mockRejectedValueOnce(new Error('Lỗi xung đột version khi lưu'));

    const { container } = render(<PdfTemplateCatalog />);

    const uploadSourceBtn = await screen.findByRole('button', { name: 'Tải lên mẫu' });
    fireEvent.click(uploadSourceBtn);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const newPdfFile = new File(['dummy new pdf'], 'new-template.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [newPdfFile] } });

    expect(await screen.findByRole('heading', { name: 'Thay thế file PDF nguồn' })).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Thay thế' });
    fireEvent.click(confirmBtn);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Lỗi xung đột version khi lưu');
  });

  it('renders error state and retries loading when retry button is clicked', async () => {
    catalog.mockRejectedValueOnce(new Error('Network failure'));

    render(<PdfTemplateCatalog />);

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('Network failure');

    catalog.mockResolvedValueOnce({
      items: [configuredItem],
      total: 1,
      page: 1,
      pageSize: 100,
    });

    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    fireEvent.click(retryBtn);

    expect(await screen.findByText('Mẫu đơn đăng ký KTX')).toBeInTheDocument();
  });

  it('renders empty state when there are no templates', async () => {
    catalog.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 100,
    });

    render(<PdfTemplateCatalog />);

    expect(await screen.findByText('Không có collection nào.')).toBeInTheDocument();
  });
});
