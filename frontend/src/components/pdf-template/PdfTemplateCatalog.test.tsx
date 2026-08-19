import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { catalog, push, replace } = vi.hoisted(() => ({
  catalog: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/dormitory/pdf-template',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/guards/RouteGuard', () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePermission: () => ({ read: true, manage: true, delete: true }),
}));

vi.mock('@/api/pdf-template-api', () => ({
  pdfTemplateApi: {
    catalog,
    delete: vi.fn(),
  },
}));

import PdfTemplateCatalog from './PdfTemplateCatalog';

const configured = {
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

const unconfigured = {
  ...configured,
  templateTypeCode: 'SECOND_REGISTERED_COLLECTION',
  displayName: 'Collection chưa cấu hình',
  configured: false,
  version: 0,
  checksum: null,
  sourceFilename: null,
  pageCount: 0,
  sourceBytes: 0,
};

const unrelatedUnconfigured = {
  ...unconfigured,
  moduleCode: 'STUDENT',
  templateTypeCode: 'STUDENT_TRANSCRIPT',
  displayName: 'Bảng điểm sinh viên',
};

describe('PdfTemplateCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    catalog.mockImplementation((query: Record<string, string | number>) => query.configured === 'false'
      ? Promise.resolve({ items: [unconfigured, { ...configured, templateTypeCode: 'SHOULD_BE_FILTERED', displayName: 'Should be filtered', configured: true }], total: 2, page: 1, pageSize: 100 })
      : Promise.resolve({ items: [configured], total: 1, page: 1, pageSize: 20 }));
  });

  it('loads add choices independently from the visible table result and navigates using default routeBase', async () => {
    render(<PdfTemplateCatalog />);

    const picker = await screen.findByRole('combobox', { name: 'Collection chưa cấu hình' });
    await waitFor(() => expect(catalog).toHaveBeenCalledWith(expect.objectContaining({ configured: 'false', pageSize: 100 })));
    expect(screen.getByRole('option', { name: 'Collection chưa cấu hình' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Mẫu đơn đăng ký KTX' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Should be filtered' })).not.toBeInTheDocument();

    fireEvent.change(picker, { target: { value: 'SECOND_REGISTERED_COLLECTION' } });
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/dormitory/pdf-template/new?templateTypeCode=SECOND_REGISTERED_COLLECTION'));
  });

  it('navigates edit and new using custom routeBase', async () => {
    render(<PdfTemplateCatalog routeBase="/custom/pdf-template" />);

    const editBtn = await screen.findByRole('button', { name: 'Sửa' });
    fireEvent.click(editBtn);
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/custom/pdf-template/DORMITORY_ROSTER_APPLICATION/edit'));
  });

  it('locks module code and hides module dropdown when lockedModuleCode is provided', async () => {
    catalog.mockImplementation((query: Record<string, string | number>) => query.configured === 'false'
      ? Promise.resolve({ items: [unconfigured, unrelatedUnconfigured], total: 2, page: 1, pageSize: 100 })
      : Promise.resolve({ items: [configured], total: 1, page: 1, pageSize: 20 }));

    render(<PdfTemplateCatalog lockedModuleCode="DORMITORY" />);

    await waitFor(() => expect(catalog).toHaveBeenCalledWith(expect.objectContaining({ moduleCode: 'DORMITORY' })));
    expect(screen.queryByLabelText('Module')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Collection chưa cấu hình' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Bảng điểm sinh viên' })).not.toBeInTheDocument();
  });

  it('provides a vertical scroll region for the table page', async () => {
    render(<PdfTemplateCatalog />);
    const main = await screen.findByRole('main');
    expect(main).toHaveClass('overflow-y-auto');
    expect(main).toHaveClass('min-h-0');
  });

  it('loads subsequent unconfigured pages when the registry exceeds one page', async () => {
    const thirdCollection = { ...unconfigured, templateTypeCode: 'THIRD_REGISTERED_COLLECTION', displayName: 'Collection trang 2' };
    catalog.mockImplementation((query: Record<string, string | number>) => {
      if (query.configured === 'false') {
        return Promise.resolve(query.page === 1
          ? { items: [unconfigured], total: 101, page: 1, pageSize: 100 }
          : { items: [thirdCollection], total: 101, page: 2, pageSize: 100 });
      }
      return Promise.resolve({ items: [configured], total: 1, page: 1, pageSize: 20 });
    });

    render(<PdfTemplateCatalog />);

    expect(await screen.findByRole('option', { name: 'Collection trang 2' })).toBeInTheDocument();
    expect(catalog).toHaveBeenCalledWith(expect.objectContaining({ configured: 'false', page: 2, pageSize: 100 }));
  });
});
