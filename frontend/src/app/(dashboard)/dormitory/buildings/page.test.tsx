import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dormitoryApi, Room } from '@/api/dormitory-api';
import { roomBedCountLabel, roomFormFromRoom, toRoomMutationPayload, validateBuildingForm, validateRoomForm } from './page';

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const room = {
  _id: 'room-1', room_code: ' a101 ', room_name: '', building_id: { _id: 'building-1', building_code: 'A', name: 'Tòa A', status: 'Trống' },
  room_type: 'Thường', bed_count: 4, max_students: 4, current_students: 1, available_bed_count: 3, room_price: 100000,
  status: 'Trống', amenities: ['Quạt'], qr_code: '', public_url: '', description: '  Gần cầu thang  ',
} as any;

describe('KTX room capacity display', () => {
  it('uses the persisted-bed-derived maximum under the Giường column', () => {
    expect(roomBedCountLabel({ max_students: 1 })).toBe('1');
    expect(roomBedCountLabel({ max_students: 5 })).toBe('5');
    expect(roomBedCountLabel({ max_students: undefined as any })).toBe('0');
  });
});

describe('KTX form validation', () => {
  it('rejects incomplete room values and invalid numeric constraints', () => {
    expect(validateRoomForm({ room_code: ' ', room_name: '', building_id: '', room_type: '', bed_count: 1.5, room_price: -1 })).toEqual(expect.objectContaining({
      room_code: expect.any(String), room_name: expect.any(String), building_id: expect.any(String), room_type: expect.any(String), bed_count: expect.any(String), room_price: expect.any(String),
    }));
  });

  it('accepts normalized valid room and building values', () => {
    expect(validateRoomForm({ room_code: 'A101', room_name: 'Phòng A101', building_id: 'building-1', room_type: 'Thường', bed_count: 4, room_price: 100000 })).toEqual({});
    expect(validateBuildingForm({ building_code: 'A', name: 'Tòa A' })).toEqual({});
    expect(validateBuildingForm({ building_code: ' ', name: '' })).toEqual(expect.objectContaining({ building_code: expect.any(String), name: expect.any(String) }));
  });
});

describe('KTX room edit payload', () => {
  it('prefills the selected room with a scalar building id and fallback name', () => {
    expect(roomFormFromRoom(room)).toMatchObject({
      room_code: ' a101 ', room_name: ' a101 ', building_id: 'building-1', room_type: 'Thường', bed_count: 4,
    });
  });

  it('normalizes the room mutation payload and omits non-mutation fields', () => {
    expect(toRoomMutationPayload(roomFormFromRoom(room))).toEqual({
      room_code: 'A101', room_name: 'a101', building_id: 'building-1', room_type: 'Thường', bed_count: 4, room_price: 100000,
      status: 'Trống', amenities: ['Quạt'], description: 'Gần cầu thang',
    });
    expect(toRoomMutationPayload({ ...room, _id: 'ignored', current_students: 99, available_bed_count: 0 } as any)).not.toHaveProperty('_id');
  });
});

describe('KTX room edit interaction', () => {
  const pageRoom: Room = {
    _id: 'room-1', room_code: 'A101', room_name: 'Phòng A101', building_id: 'building-1', room_type: 'Thường',
    bed_count: 4, max_students: 4, physical_capacity: 4, assignable_capacity: 4, occupied_count: 1, maintenance_count: 0,
    current_students: 1, available_bed_count: 3, room_price: 100000, status: 'Trống', amenities: ['Quạt'], qr_code: '', public_url: '', description: 'Gần cầu thang',
  };
  const building = { _id: 'building-1', building_code: 'A', name: 'Tòa A', status: 'Trống' as const };

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
    vi.spyOn(dormitoryApi.rooms, 'getAll').mockResolvedValue({ data: [pageRoom], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } });
    vi.spyOn(dormitoryApi.buildings, 'getAll').mockResolvedValue({ data: [building], meta: { total: 1, page: 1, limit: 100, totalPages: 1 } });
  });

  afterEach(() => vi.restoreAllMocks());

  const openEditor = async () => {
    const { default: BuildingsPage } = await import('./page');
    render(<BuildingsPage />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Sửa phòng A101' }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: 'Sửa phòng A101' })[0]);
  };

  it('prefills the selected room and submits one normalized PATCH, then closes and refreshes', async () => {
    const update = vi.spyOn(dormitoryApi.rooms, 'update').mockResolvedValue(pageRoom);
    const getRooms = dormitoryApi.rooms.getAll as ReturnType<typeof vi.fn>;
    await openEditor();

    expect(screen.getByDisplayValue('A101')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Phòng A101')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phòng' }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith('room-1', expect.objectContaining({ room_code: 'A101', building_id: 'building-1', bed_count: 4, room_price: 100000 }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(getRooms).toHaveBeenCalledTimes(2));
  });

  it('keeps the dialog open, shows the backend error, and prevents duplicate saves', async () => {
    let resolveUpdate: (room: Room) => void = () => undefined;
    const update = vi.spyOn(dormitoryApi.rooms, 'update').mockReturnValue(new Promise(resolve => { resolveUpdate = resolve; }));
    await openEditor();
    const save = screen.getByRole('button', { name: 'Lưu phòng' });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(update).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled();
    resolveUpdate(pageRoom);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    update.mockRejectedValueOnce(new Error('Mã phòng đã tồn tại'));
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phòng' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Mã phòng đã tồn tại');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(update).toHaveBeenCalledTimes(2);
  });
});
