import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const authState = vi.hoisted(() => ({ canCreate: true, canUpdate: true, canRoomRead: true, canDelete: true }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ hasPermission: (permission: string) => ({
  DORM_REG_CREATE: authState.canCreate,
  DORM_REG_UPDATE: authState.canUpdate,
  DORM_ROOM_READ: authState.canRoomRead,
  DORM_REG_DELETE: authState.canDelete,
}[permission] ?? true) }) }));
vi.mock('sonner', () => ({ toast: toastMock }));

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
    authState.canUpdate = true;
    authState.canRoomRead = true;
    authState.canDelete = true;
    toastMock.success.mockClear();
    toastMock.error.mockClear();
    toastMock.warning.mockClear();
    compactViewport = false;
    intersectionCallback = undefined;
    vi.spyOn(dormitoryApi.roster, 'getRoomOptions').mockResolvedValue([]);
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
    act(() => intersectionCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await waitFor(() => expect(getAll).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));

    expect(screen.getAllByText('Trần B').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Nhập danh sách KTX từ Excel' })).toBeInTheDocument();
  });

  it('keeps the selected room through responsive reloads and displays the leader badge', async () => {
    compactViewport = true;
    const room = { _id: 'room-1', room_code: 'A101', room_name: 'Phòng A101' };
    const leader = { ...entry1, room_id: room._id, bed_id: 'bed-1', is_room_leader: true };
    const getRoomOptions = vi.mocked(dormitoryApi.roster.getRoomOptions).mockResolvedValue([room]);
    const getAll = vi.spyOn(dormitoryApi.roster, 'getAll').mockImplementation(async (query: any) => ({
      data: query.room_id ? [leader] : [],
      meta: { total: query.room_id ? 1 : 0, page: query.page, limit: query.limit, totalPages: 1 },
    } as any));

    const { default: DormitoryRosterPage } = await import('./page');
    render(<DormitoryRosterPage />);
    await waitFor(() => expect(getRoomOptions).toHaveBeenCalled());
    const filter = await screen.findByRole('combobox', { name: 'Lọc theo phòng' });
    fireEvent.change(filter, { target: { value: room._id } });
    await waitFor(() => expect(getAll).toHaveBeenCalledWith(expect.objectContaining({ room_id: room._id, page: 1 })));
    expect(await screen.findByLabelText('Trưởng phòng')).toBeInTheDocument();

    fireEvent.change(filter, { target: { value: '' } });
    await waitFor(() => expect(getAll).toHaveBeenCalledWith(expect.objectContaining({ room_id: undefined, page: 1 })));
  });

  it('does not let a stale roster response replace the active room filter', async () => {
    const room = { _id: 'room-1', room_code: 'A101', room_name: 'Phòng A101' };
    const pending: Array<{ query: any; resolve: (value: any) => void }> = [];
    vi.mocked(dormitoryApi.roster.getRoomOptions).mockResolvedValue([room]);
    const getAll = vi.spyOn(dormitoryApi.roster, 'getAll').mockImplementation((query: any) => new Promise(resolve => pending.push({ query, resolve })) as any);
    const stale = { ...entry1, full_name: 'Dữ liệu cũ' };
    const fresh = { ...entry1, full_name: 'Dữ liệu phòng A101', room_id: room._id, bed_id: 'bed-1' };
    const { default: DormitoryRosterPage } = await import('./page');
    render(<DormitoryRosterPage />);
    await waitFor(() => expect(pending).toHaveLength(1));
    const filter = await screen.findByRole('combobox', { name: 'Lọc theo phòng' });
    fireEvent.change(filter, { target: { value: room._id } });
    await waitFor(() => expect(pending).toHaveLength(2));

    act(() => pending[0].resolve({ data: [stale], meta: { total: 1, page: 1, limit: 40, totalPages: 1 } }));
    expect(screen.queryByText('Dữ liệu cũ')).not.toBeInTheDocument();
    act(() => pending[1].resolve({ data: [fresh], meta: { total: 1, page: 1, limit: 40, totalPages: 1 } }));
    await waitFor(() => expect(screen.getByText('Dữ liệu phòng A101')).toBeInTheDocument());
    expect(getAll).toHaveBeenLastCalledWith(expect.objectContaining({ room_id: room._id, page: 1 }));
  });

  it('keeps leader actions permission-gated and refreshes the row after a successful change', async () => {
    const assigned = { ...entry1, room_id: 'room-1', bed_id: 'bed-1', is_room_leader: false };
    const leader = { ...assigned, is_room_leader: true };
    const getAll = vi.spyOn(dormitoryApi.roster, 'getAll').mockImplementation(async () => ({
      data: getAll.mock.calls.length > 1 ? [leader] : [assigned],
      meta: { total: 1, page: 1, limit: 40, totalPages: 1 },
    } as any));
    const setRoomLeader = vi.spyOn(dormitoryApi.roster, 'setRoomLeader').mockResolvedValue(leader as any);
    const { default: DormitoryRosterPage } = await import('./page');
    render(<DormitoryRosterPage />);
    await waitFor(() => expect(getAll).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Chọn trưởng phòng cho Nguyễn A' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(setRoomLeader).toHaveBeenCalledWith('entry-1', true));
    expect(await screen.findByLabelText('Trưởng phòng')).toBeInTheDocument();

  });

  it('hides leader and room assignment actions when their permissions are absent', async () => {
    authState.canUpdate = false;
    authState.canRoomRead = false;
    vi.spyOn(dormitoryApi.roster, 'getAll').mockResolvedValue({
      data: [{ ...entry1, room_id: 'room-1', bed_id: 'bed-1', is_room_leader: false }],
      meta: { total: 1, page: 1, limit: 40, totalPages: 1 },
    } as any);
    const { default: DormitoryRosterPage } = await import('./page');
    render(<DormitoryRosterPage />);
    await waitFor(() => expect(dormitoryApi.roster.getAll).toHaveBeenCalled());

    expect(screen.queryByRole('button', { name: /Gỡ trưởng phòng|Chọn trưởng phòng/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Đổi phòng|Thêm phòng/ })).not.toBeInTheDocument();
  });

  it('retains the prior leader state and reports a failed mutation', async () => {
    const assigned = { ...entry1, room_id: 'room-1', bed_id: 'bed-1', is_room_leader: false };
    vi.spyOn(dormitoryApi.roster, 'getAll').mockResolvedValue({ data: [assigned], meta: { total: 1, page: 1, limit: 40, totalPages: 1 } } as any);
    vi.spyOn(dormitoryApi.roster, 'setRoomLeader').mockRejectedValue(new Error('Không thể cập nhật trưởng phòng.'));
    const { default: DormitoryRosterPage } = await import('./page');
    render(<DormitoryRosterPage />);
    await waitFor(() => expect(dormitoryApi.roster.getAll).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Chọn trưởng phòng cho Nguyễn A' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Không thể cập nhật trưởng phòng.'));
    expect(screen.queryByLabelText('Trưởng phòng')).not.toBeInTheDocument();
  });
});
