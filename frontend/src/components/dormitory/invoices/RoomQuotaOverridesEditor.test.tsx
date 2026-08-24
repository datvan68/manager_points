import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RoomQuotaOverridesEditor from './RoomQuotaOverridesEditor';
import { Room } from '@/api/dormitory-api';

describe('RoomQuotaOverridesEditor Component', () => {
  const mockRooms: Room[] = [
    { _id: 'room-1', room_code: 'P101', room_name: 'Phòng 101', building_id: { _id: 'b-1', name: 'Tòa A' } as any } as Room,
    { _id: 'room-2', room_code: 'P102', room_name: 'Phòng 102', building_id: { _id: 'b-1', name: 'Tòa A' } as any } as Room,
    { _id: 'room-3', room_code: 'P103', room_name: 'Phòng 103' } as Room,
  ];

  it('renders correctly with default values and empty overrides', () => {
    const handleChange = vi.fn();
    render(
      <RoomQuotaOverridesEditor
        label="Định mức riêng theo phòng (Điện)"
        unit="kWh"
        defaultQuota={15}
        overrides={[]}
        onChange={handleChange}
        rooms={mockRooms}
      />
    );

    expect(screen.getByText('Định mức riêng theo phòng (Điện)')).toBeInTheDocument();
    expect(screen.getByText('Chưa có phòng nào')).toBeInTheDocument();
    expect(screen.getByText(/15 kWh\/người/i)).toBeInTheDocument();

    const combobox = screen.getByRole('combobox', { name: 'Chọn phòng để thêm định mức riêng' });
    expect(combobox).toBeInTheDocument();
    expect(combobox).not.toBeDisabled();
  });

  it('allows adding a room override via custom Select and keyboard selection', () => {
    const handleChange = vi.fn();
    render(
      <RoomQuotaOverridesEditor
        label="Định mức riêng theo phòng (Điện)"
        unit="kWh"
        defaultQuota={15}
        overrides={[]}
        onChange={handleChange}
        rooms={mockRooms}
      />
    );

    const combobox = screen.getByRole('combobox', { name: 'Chọn phòng để thêm định mức riêng' });
    // Open dropdown and select first room
    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    fireEvent.keyDown(combobox, { key: 'Enter' });

    const addButton = screen.getByRole('button', { name: /Thêm phòng/i });
    expect(addButton).not.toBeDisabled();
    fireEvent.click(addButton);

    expect(handleChange).toHaveBeenCalledWith([
      { room_id: 'room-1', quota_per_person: 15 },
    ]);
  });

  it('allows modifying and removing existing room overrides', () => {
    const handleChange = vi.fn();
    const overrides = [
      { room_id: { _id: 'room-1', room_name: 'Phòng 101' }, quota_per_person: 25 },
    ];

    render(
      <RoomQuotaOverridesEditor
        label="Định mức riêng theo phòng (Điện)"
        unit="kWh"
        defaultQuota={15}
        overrides={overrides as any}
        onChange={handleChange}
        rooms={mockRooms}
      />
    );

    expect(screen.getByText('1 phòng áp dụng')).toBeInTheDocument();

    const quotaInput = screen.getByLabelText('Định mức phòng Phòng 101');
    fireEvent.change(quotaInput, { target: { value: '30' } });
    expect(handleChange).toHaveBeenCalledWith([
      { room_id: { _id: 'room-1', room_name: 'Phòng 101' }, quota_per_person: 30 },
    ]);

    const deleteBtn = screen.getByLabelText('Xóa định mức riêng của Phòng 101');
    fireEvent.click(deleteBtn);
    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it('disables combobox when all available rooms are already overridden', () => {
    const handleChange = vi.fn();
    const allOverrides = [
      { room_id: 'room-1', quota_per_person: 20 },
      { room_id: 'room-2', quota_per_person: 25 },
      { room_id: 'room-3', quota_per_person: 30 },
    ];

    render(
      <RoomQuotaOverridesEditor
        label="Định mức riêng theo phòng (Điện)"
        unit="kWh"
        defaultQuota={15}
        overrides={allOverrides}
        onChange={handleChange}
        rooms={mockRooms}
      />
    );

    const combobox = screen.getByRole('combobox', { name: 'Chọn phòng để thêm định mức riêng' });
    expect(combobox).toBeDisabled();
  });
});
