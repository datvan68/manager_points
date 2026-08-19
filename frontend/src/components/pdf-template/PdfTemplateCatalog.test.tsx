import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { catalog, deleteApi, push, replace } = vi.hoisted(() => ({
  catalog: vi.fn(),
  deleteApi: vi.fn(),
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
  },
}));

import PdfTemplateCatalog from './PdfTemplateCatalog';

const rosterItem = {
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

const contractItem = {
  moduleCode: 'DORMITORY',
  featureCode: 'DORMITORY_CONTRACT',
  templateTypeCode: 'DORMITORY_RESIDENCE_CONTRACT',
  displayName: 'Mẫu đơn hợp đồng nội trú',
  configured: false,
  version: 0,
  checksum: null,
  sourceFilename: null,
  pageCount: 0,
  sourceBytes: 0,
  updatedBy: null,
  updatedAt: null,
};

const residenceInfoItem = {
  moduleCode: 'DORMITORY',
  featureCode: 'DORMITORY_ROSTER',
  templateTypeCode: 'DORMITORY_RESIDENCE_INFO',
  displayName: 'Mẫu đơn thông tin cư trú',
  configured: false,
  version: 0,
  checksum: null,
  sourceFilename: null,
  pageCount: 0,
  sourceBytes: 0,
  updatedBy: null,
  updatedAt: null,
};

const unrelatedItem = {
  ...contractItem,
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
      items: [rosterItem, contractItem, residenceInfoItem],
      total: 3,
      page: 1,
      pageSize: 100,
    });
  });

  it('renders one card per registered PDF type ordered by displayName with correct status badges', async () => {
    render(<PdfTemplateCatalog />);

    expect(await screen.findByText('Mẫu đơn đăng ký KTX')).toBeInTheDocument();
    expect(screen.getByText('Mẫu đơn hợp đồng nội trú')).toBeInTheDocument();
    expect(screen.getByText('Mẫu đơn thông tin cư trú')).toBeInTheDocument();

    const unconfiguredBadges = screen.getAllByText('Chưa tải lên');
    const configuredBadges = screen.getAllByText('Đã tải lên');

    expect(unconfiguredBadges.length).toBe(2);
    expect(configuredBadges.length).toBe(1);

    // Verify displayName ascending ordering in Vietnamese: 'đ' < 'h' < 't'
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual([
      'Mẫu đơn đăng ký KTX',
      'Mẫu đơn hợp đồng nội trú',
      'Mẫu đơn thông tin cư trú',
    ]);

    // Verify filter panel, table, visible pagination, and header dropdown are NOT present
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Bộ lọc PDF template')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Collection chưa cấu hình')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Phân trang PDF template')).not.toBeInTheDocument();
  });

  it('never renders "Tải lên mẫu" button on configured or unconfigured cards', async () => {
    render(<PdfTemplateCatalog />);

    expect(await screen.findByText('Mẫu đơn đăng ký KTX')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tải lên mẫu' })).not.toBeInTheDocument();
    expect(screen.queryByText('Tải lên mẫu')).not.toBeInTheDocument();
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

    const uploadBtns = await screen.findAllByRole('button', { name: 'Tải PDF lên' });
    expect(uploadBtns.length).toBe(2);
    fireEvent.click(uploadBtns[0]);

    expect(push).toHaveBeenCalledWith(
      '/dormitory/pdf-template/new?templateTypeCode=DORMITORY_RESIDENCE_CONTRACT&returnTo=test%3D1'
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

    const modalConfirmBtns = screen.getAllByRole('button', { name: 'Xóa' });
    const modalConfirmBtn = modalConfirmBtns[modalConfirmBtns.length - 1];
    fireEvent.click(modalConfirmBtn);

    await waitFor(() => {
      expect(deleteApi).toHaveBeenCalledWith('DORMITORY_ROSTER_APPLICATION', 2);
    });
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
      items: [rosterItem, unrelatedItem],
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
      ...contractItem,
      templateTypeCode: 'PAGE_2_COLLECTION',
      displayName: 'Mẫu trang 2',
    };

    catalog.mockImplementation((query: Record<string, string | number>) => {
      if (query.page === 1) {
        return Promise.resolve({
          items: [rosterItem],
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
    expect(screen.getAllByText('Chưa cập nhật').length).toBe(2);
    expect(screen.getAllByText('Ngày cập nhật:').length).toBe(3);
  });

  it('renders error state and retries loading when retry button is clicked', async () => {
    catalog.mockRejectedValueOnce(new Error('Network failure'));

    render(<PdfTemplateCatalog />);

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('Network failure');

    catalog.mockResolvedValueOnce({
      items: [rosterItem],
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
