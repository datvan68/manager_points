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
  updatedAt: null,
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

  it('executes delete with confirm and prompt verification on configured cards', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('DORMITORY_ROSTER_APPLICATION');
    deleteApi.mockResolvedValue({});

    render(<PdfTemplateCatalog />);

    const deleteBtn = await screen.findByRole('button', { name: 'Xóa' });
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(promptSpy).toHaveBeenCalled();
    await waitFor(() =>
      expect(deleteApi).toHaveBeenCalledWith('DORMITORY_ROSTER_APPLICATION', 2)
    );
  });

  it('cancels delete if user rejects confirm or mistypes prompt', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('DORMITORY_ROSTER_APPLICATION');

    render(<PdfTemplateCatalog />);

    const deleteBtn = await screen.findByRole('button', { name: 'Xóa' });
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteApi).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    promptSpy.mockReturnValue('WRONG_CODE');

    fireEvent.click(deleteBtn);
    expect(promptSpy).toHaveBeenCalled();
    expect(deleteApi).not.toHaveBeenCalled();
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
    expect(screen.queryByRole('button', { name: 'Tải PDF lên' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument();
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
