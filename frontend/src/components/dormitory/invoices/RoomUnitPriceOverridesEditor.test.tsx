import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RoomUnitPriceOverridesEditor from './RoomUnitPriceOverridesEditor';
import { Room } from '@/api/dormitory-api';

describe('RoomUnitPriceOverridesEditor Component', () => {
  const mockRooms: Room[] = [
    { _id: 'room-1', room_code: 'P101', room_name: 'Phòng 101', building_id: { _id: 'b-1', name: 'Tòa A' } as any } as Room,
    { _id: 'room-2', room_code: 'P102', room_name: 'Phòng 102', building_id: { _id: 'b-1', name: 'Tòa A' } as any } as Room,
    { _id: 'room-3', room_code: 'P103', room_name: 'Phòng 103' } as Room,
  ];

  it('renders correctly with default values and empty overrides', () => {
    const handleChange = vi.fn();
    render(
      <RoomUnitPriceOverridesEditor
        label="Đơn giá riêng theo phòng (Điện)"
        unit="đ/kWh"
        defaultPrice={2500}
        overrides={[]}
        onChange={handleChange}
        rooms={mockRooms}
      />
    );

    expect(screen.getByText('Đơn giá riêng theo phòng (Điện)')).toBeInTheDocument();
    expect(screen.getByText('Chưa có phòng nào')).toBeInTheDocument();
    expect(screen.getByText(/2.500 đ\/kWh/i)).toBeInTheDocument();

    const combobox = screen.getByRole('combobox', { name: 'Chọn phòng để thêm đơn giá riêng' });
    expect(combobox).toBeInTheDocument();
    expect(combobox).not.toBeDisabled();
  });

  it('allows adding a room price override via custom Select and keyboard selection', () => {
    const handleChange = vi.fn();
    render(
      <RoomUnitPriceOverridesEditor
        label="Đơn giá riêng theo phòng (Điện)"
        unit="đ/kWh"
        defaultPrice={2500}
        overrides={[]}
        onChange={handleChange}
        rooms={mockRooms}
      />
    );

    const combobox = screen.getByRole('combobox', { name: 'Chọn phòng để thêm đơn giá riêng' });
    // Open dropdown and select first room
    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    fireEvent.keyDown(combobox, { key: 'Enter' });

    const addButton = screen.getByRole('button', { name: /Thêm phòng/i });
    expect(addButton).not.toBeDisabled();
    fireEvent.click(addButton);

    expect(handleChange).toHaveBeenCalledWith([
      { room_id: 'room-1', unit_price: 2500 },
    ]);
  });

  it('allows modifying and removing existing room price overrides', () => {
    const handleChange = vi.fn();
    const overrides = [
      { room_id: { _id: 'room-1', room_name: 'Phòng 101' }, unit_price: 3200 },
    ];

    render(
      <RoomUnitPriceOverridesEditor
        label="Đơn giá riêng theo phòng (Điện)"
        unit="đ/kWh"
        defaultPrice={2500}
        overrides={overrides as any}
        onChange={handleChange}
        rooms={mockRooms}
      />
    );

    expect(screen.getByText('1 phòng áp dụng')).toBeInTheDocument();

    const priceInput = screen.getByLabelText('Đơn giá phòng Phòng 101');
    fireEvent.change(priceInput, { target: { value: '3500' } });
    expect(handleChange).toHaveBeenCalledWith([
      { room_id: { _id: 'room-1', room_name: 'Phòng 101' }, unit_price: 3500 },
    ]);

    const deleteBtn = screen.getByLabelText('Xóa đơn giá riêng của Phòng 101');
    fireEvent.click(deleteBtn);
    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it('disables combobox when all available rooms are already overridden', () => {
    const handleChange = vi.fn();
    const allOverrides = [
      { room_id: 'room-1', unit_price: 2000 },
      { room_id: 'room-2', unit_price: 2500 },
      { room_id: 'room-3', unit_price: 3000 },
    ];

    render(
      <RoomUnitPriceOverridesEditor
        label="Đơn giá riêng theo phòng (Điện)"
        unit="đ/kWh"
        defaultPrice={2500}
        overrides={allOverrides}
        onChange={handleChange}
        rooms={mockRooms}
      />
    );

    const combobox = screen.getByRole('combobox', { name: 'Chọn phòng để thêm đơn giá riêng' });
    expect(combobox).toBeDisabled();
  });
});
