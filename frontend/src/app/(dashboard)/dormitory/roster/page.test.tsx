import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dormitoryApi } from '@/api/dormitory-api';
import {
  applyRoomAssignment,
  getPublicRegistrationUrl,
  isUnassignedRoom,
  selectedPdfRosterEntries,
  selectedPdfRosterEntry,
  shouldShowRosterImport,
  studentName,
} from './page';

const authState = vi.hoisted(() => ({ canCreate: true }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ hasPermission: (permission: string) => permission === 'DORM_REG_CREATE' ? authState.canCreate : true }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

let compactViewport = false;
let intersectionCallback: IntersectionObserverCallback | undefined;
class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) { intersectionCallback = callback; }
  observe() {}
  disconnect() {}
  unobserve() {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

const entry1 = { _id: 'entry-1', roster_entry_code: 'DK-1', full_name: 'Nguyễn A', semester: 'HK1', academic_year: '2026-2027', identity_state: 'UNLINKED' as const };
const entry2 = { _id: 'entry-2', roster_entry_code: 'DK-2', full_name: 'Trần B', semester: 'HK1', academic_year: '2026-2027', identity_state: 'LINKED' as const };
const entry3 = { _id: 'entry-3', roster_entry_code: 'DK-3', full_name: 'Lê C', semester: 'HK1', academic_year: '2026-2027', identity_state: 'LINKED' as const };

describe('Danh sách KTX canonical page capabilities', () => {
  beforeEach(() => {
    authState.canCreate = true;
    compactViewport = false;
    intersectionCallback = undefined;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({ matches: compactViewport, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps public QR route and roster row helpers canonical', () => {
    expect(getPublicRegistrationUrl('https://example.test/')).toBe('https://example.test/public/dormitory/register');
    expect(studentName(entry1)).toBe('Nguyễn A');
    expect(isUnassignedRoom(entry1)).toBe(true);
    expect(selectedPdfRosterEntry([entry1], ['entry-1'])).toBe(entry1);
    expect(selectedPdfRosterEntry([entry1, entry2], ['entry-1', 'entry-2'])).toBeUndefined();
    expect(selectedPdfRosterEntry([entry1], [])).toBeUndefined();
  });

  it('exposes the Excel import entry point only for create-capable users', () => {
    expect(shouldShowRosterImport(true)).toBe(true);
    expect(shouldShowRosterImport(false)).toBe(false);
  });

  it('hides the Excel import button when create permission is absent', async () => {
    authState.canCreate = false;
    vi.spyOn(dormitoryApi.roster, 'getAll').mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 40, totalPages: 0 } } as any);
    const { default: DormitoryRosterPage } = await import('./page');
    render(<DormitoryRosterPage />);
    await waitFor(() => expect(dormitoryApi.roster.getAll).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Nhập danh sách KTX từ Excel' })).not.toBeInTheDocument();
  });

  it('uses one bulk-delete request and keeps contract-blocked rows selected', async () => {
    const getAll = vi.spyOn(dormitoryApi.roster, 'getAll').mockResolvedValue({ data: [entry1, entry2], meta: { total: 2, page: 1, limit: 40, totalPages: 1 } } as any);
    const bulkDelete = vi.spyOn(dormitoryApi.roster, 'bulkDelete').mockResolvedValue({
      requested: 2,
      deleted: ['entry-1'],
      blocked: [{ id: 'entry-2', reason: 'Đang được hợp đồng KTX tham chiếu' }],
      not_found: [],
      invalid: [],
    });
    const { default: DormitoryRosterPage } = await import('./page');
    render(<DormitoryRosterPage />);
    await waitFor(() => expect(getAll).toHaveBeenCalled());
    const rowCheckboxes = document.querySelectorAll('tbody input[type="checkbox"]');
    fireEvent.click(rowCheckboxes[0]);
    fireEvent.click(rowCheckboxes[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa đơn đã chọn' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa mục' }));

    await waitFor(() => expect(bulkDelete).toHaveBeenCalledWith(['entry-1', 'entry-2']));
    expect(document.querySelectorAll('tbody input[type="checkbox"]')[1]).toBeChecked();
  });

  it('filters selected PDF roster entries in deterministic table order', () => {
    const rows = [entry1, entry2, entry3];
    expect(selectedPdfRosterEntries(rows, [])).toEqual([]);
    expect(selectedPdfRosterEntries(rows, ['entry-2'])).toEqual([entry2]);
    // Selection order ['entry-3', 'entry-1'] returns [entry1, entry3] in deterministic table order
    expect(selectedPdfRosterEntries(rows, ['entry-3', 'entry-1'])).toEqual([entry1, entry3]);
  });

  it('updates a row with canonical room assignment data', () => {
    const updated = applyRoomAssignment(entry1, { room: { _id: 'room-1', room_code: 'A101', building_id: 'building-1', room_type: 'Thường', bed_count: 1, max_students: 1, current_students: 0, available_bed_count: 1, room_price: 0, status: 'Trống', amenities: [], qr_code: '', public_url: '' }, bed: { _id: 'bed-1', bed_code: 'A101-G1', room_id: 'room-1', status: 'Đang sử dụng' } });
    expect(updated.room_id).toEqual(expect.objectContaining({ _id: 'room-1' }));
    expect(updated.bed_id).toEqual(expect.objectContaining({ _id: 'bed-1' }));
  });

  it('uses compact page one and appends a unique next page after intersection', async () => {
    compactViewport = true;
    const first = { ...entry1, _id: 'entry-1', student_code: 'SV001' };
    const second = { ...entry2, _id: 'entry-2', student_code: 'SV002' };
    const getAll = vi.spyOn(dormitoryApi.roster, 'getAll').mockImplementation(async (query: any) => ({
      data: query.page === 2 ? [second, first] : [first],
      meta: { total: 2, page: query.page, limit: query.limit, totalPages: 2 },
    } as any));

    const { default: DormitoryRosterPage } = await import('./page');
    render(<DormitoryRosterPage />);
    await waitFor(() => expect(getAll).toHaveBeenCalledWith(expect.objectContaining({ page: 1 })));
    await waitFor(() => expect(intersectionCallback).toBeDefined());
    intersectionCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    await waitFor(() => expect(getAll).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));

    expect(screen.getAllByText('Trần B').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Nhập danh sách KTX từ Excel' })).toBeInTheDocument();
  });
});
