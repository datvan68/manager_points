import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/guards/RouteGuard', () => ({ RouteGuard: ({ children }: any) => <>{children}</> }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ hasPermission: (permission: string) => permission === 'ACTIVITY_EXPORT' }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('xlsx', () => ({ utils: { book_new: vi.fn(() => ({})), json_to_sheet: vi.fn(() => ({})), book_append_sheet: vi.fn() }, writeFile: vi.fn() }));
vi.mock('@/api/activity-api', () => ({ activityAttendanceApi: { getAll: vi.fn(), authorizeExport: vi.fn() } }));
vi.mock('@/components/ui/pagination', () => ({ CustomPagination: ({ pageSize, pageSizeOptions, onPageSizeChange }: any) => <div data-testid="pagination"><span data-testid="page-size">{pageSize}</span><span>{pageSizeOptions.join(',')}</span><button onClick={() => onPageSizeChange(50)}>size</button></div> }));

import ActivitiesAttendancePage from './page';
import { activityAttendanceApi } from '@/api/activity-api';
import * as XLSX from 'xlsx';

describe('ActivitiesAttendancePage', () => {
  beforeAll(() => {
    vi.stubGlobal('IntersectionObserver', class {
      observe() {}
      disconnect() {}
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(activityAttendanceApi.authorizeExport).mockResolvedValue({ authorized: true });
    vi.mocked(activityAttendanceApi.getAll).mockResolvedValue({ total: 1, items: [{ _id: 'a1', activity_id: { name: 'Activity' }, schedule_id: { title: 'Session' }, student_id: { full_name: 'Student' }, class_id: { class_name: 'DTH19' }, status: 'present', approval_status: 'pending', recorded_at: '2026-01-01T00:00:00Z' }] as any });
  });

  it('uses 40 rows by default and renders class/status labels', async () => {
    render(<ActivitiesAttendancePage />);
    expect((await screen.findAllByText('DTH19')).length).toBeGreaterThan(0);
    expect(screen.getByTestId('page-size')).toHaveTextContent('40');
    expect(screen.getAllByText('Có mặt').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bản nháp').length).toBeGreaterThan(0);
    expect(activityAttendanceApi.getAll).toHaveBeenCalledWith({ page: 1, limit: 40 });
  });

  it('opens floating actions and exports selected rows', async () => {
    render(<ActivitiesAttendancePage />);
    await waitFor(() => expect(screen.getAllByText('Student').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('checkbox').at(-1)!);
    const exportButton = screen.getByRole('button', { name: /Xuất Excel/i });
    fireEvent.click(exportButton);
    await waitFor(() => expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'danh-sach-diem-danh.xlsx'));
  });

  it('refreshes in the background without flashing rows or duplicating requests', async () => {
    let resolveRefresh!: (value: any) => void;
    vi.mocked(activityAttendanceApi.getAll)
      .mockResolvedValueOnce({ total: 1, items: [{ _id: 'a1', activity_id: { name: 'Activity' }, student_id: { full_name: 'Student' }, status: 'present', approval_status: 'pending' }] as any })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));

    render(<ActivitiesAttendancePage />);
    await waitFor(() => expect(screen.getAllByText('Student').length).toBeGreaterThan(0));
    const refresh = screen.getByRole('button', { name: 'Tải lại danh sách điểm danh' });
    fireEvent.click(refresh);
    fireEvent.click(refresh);

    expect(refresh).toBeDisabled();
    expect(screen.getAllByText('Student').length).toBeGreaterThan(0);
    expect(activityAttendanceApi.getAll).toHaveBeenCalledTimes(2);

    resolveRefresh({ total: 1, items: [{ _id: 'a1', activity_id: { name: 'Activity' }, student_id: { full_name: 'Student' }, status: 'present', approval_status: 'pending' }] });
    await waitFor(() => expect(refresh).not.toBeDisabled());
  });

  it('toggles mobile full width search input', async () => {
    render(<ActivitiesAttendancePage />);
    const openSearchBtn = screen.getByRole('button', { name: 'Mở tìm kiếm' });
    fireEvent.click(openSearchBtn);
    expect(screen.getByRole('button', { name: 'Đóng tìm kiếm' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng tìm kiếm' }));
    expect(screen.getByRole('button', { name: 'Mở tìm kiếm' })).toBeInTheDocument();
  });
});
