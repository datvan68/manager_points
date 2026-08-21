import React, { useState, useMemo } from 'react';
import { Plus, Trash2, DollarSign } from 'lucide-react';
import { Room, RoomUnitPriceOverride } from '@/api/dormitory-api';
import { Button } from '@/components/ui/button';

interface RoomUnitPriceOverridesEditorProps {
  label: string;
  unit: string;
  defaultPrice: number;
  overrides: RoomUnitPriceOverride[];
  onChange: (overrides: RoomUnitPriceOverride[]) => void;
  rooms: Room[];
  disabled?: boolean;
}

export default function RoomUnitPriceOverridesEditor({
  label,
  unit,
  defaultPrice,
  overrides = [],
  onChange,
  rooms = [],
  disabled = false,
}: RoomUnitPriceOverridesEditorProps) {
  const [selectedRoomIdToAdd, setSelectedRoomIdToAdd] = useState<string>('');

  // Map of room lookup for fast name/code resolution
  const roomMap = useMemo(() => {
    const map = new Map<string, Room>();
    for (const r of rooms) {
      map.set(String(r._id), r);
    }
    return map;
  }, [rooms]);

  // Set of already selected room IDs in this utility
  const selectedRoomIds = useMemo(() => {
    const set = new Set<string>();
    for (const o of overrides) {
      const id = typeof o.room_id === 'object' ? String(o.room_id?._id || '') : String(o.room_id || '');
      if (id) set.add(id);
    }
    return set;
  }, [overrides]);

  // Available rooms to add (excluding already added)
  const availableRooms = useMemo(() => {
    return rooms.filter((r) => !selectedRoomIds.has(String(r._id)));
  }, [rooms, selectedRoomIds]);

  const handleAddRoom = () => {
    if (!selectedRoomIdToAdd) return;
    const nextOverrides: RoomUnitPriceOverride[] = [
      ...overrides,
      {
        room_id: selectedRoomIdToAdd,
        unit_price: defaultPrice,
      },
    ];
    onChange(nextOverrides);
    setSelectedRoomIdToAdd('');
  };

  const handleRemoveRoom = (index: number) => {
    const nextOverrides = overrides.filter((_, idx) => idx !== index);
    onChange(nextOverrides);
  };

  const handlePriceChange = (index: number, val: number) => {
    const nextOverrides = overrides.map((item, idx) => {
      if (idx !== index) return item;
      return {
        ...item,
        unit_price: isNaN(val) ? 0 : Math.max(0, val),
      };
    });
    onChange(nextOverrides);
  };

  const getRoomDisplayName = (roomIdOrObj: string | Room) => {
    const id = typeof roomIdOrObj === 'object' ? String(roomIdOrObj?._id || '') : String(roomIdOrObj || '');
    const populated = typeof roomIdOrObj === 'object' ? roomIdOrObj : roomMap.get(id);
    if (!populated) return `Phòng (${id.substring(0, 6)}...)`;
    const roomName = populated.room_name || populated.room_code || 'Phòng';
    const buildingName =
      typeof populated.building_id === 'object' && populated.building_id
        ? populated.building_id.name || populated.building_id.building_code
        : '';
    return buildingName ? `${roomName} (${buildingName})` : roomName;
  };

  return (
    <div className="mt-3 space-y-2.5 rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-2xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
          <DollarSign size={14} className="text-[#1A73E8]" />
          {label}
        </span>
        <span className="text-[11px] font-medium text-[#64748B]">
          {overrides.length > 0 ? `${overrides.length} phòng áp dụng` : 'Chưa có phòng nào'}
        </span>
      </div>

      {/* List of current overrides */}
      {overrides.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {overrides.map((item, index) => {
            const id = typeof item.room_id === 'object' ? String(item.room_id?._id || '') : String(item.room_id || '');
            const displayName = getRoomDisplayName(item.room_id);

            return (
              <div
                key={id || index}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs"
              >
                <div className="min-w-0 flex-1 truncate font-semibold text-[#1E293B]" title={displayName}>
                  {displayName}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    disabled={disabled}
                    aria-label={`Đơn giá phòng ${displayName}`}
                    value={item.unit_price}
                    onChange={(e) => handlePriceChange(index, parseFloat(e.target.value))}
                    className="w-24 rounded-md border border-slate-200 px-2 py-1 text-right text-xs font-semibold text-[#1E293B] focus:border-[#1A73E8] focus:outline-none focus:ring-1 focus:ring-[#1A73E8]"
                  />
                  <span className="text-[11px] font-medium text-[#64748B]">{unit}</span>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleRemoveRoom(index)}
                    className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer disabled:opacity-50"
                    title="Xóa đơn giá riêng của phòng này"
                    aria-label={`Xóa đơn giá riêng của ${displayName}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new room override controls */}
      <div className="flex items-center gap-2 pt-1">
        <select
          value={selectedRoomIdToAdd}
          disabled={disabled || availableRooms.length === 0}
          onChange={(e) => setSelectedRoomIdToAdd(e.target.value)}
          aria-label="Chọn phòng để thêm đơn giá riêng"
          className="flex-1 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:border-[#1A73E8] focus:outline-none focus:ring-1 focus:ring-[#1A73E8] disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="">
            {availableRooms.length > 0 ? '-- Chọn phòng áp dụng đơn giá riêng --' : 'Đã cấu hình toàn bộ phòng'}
          </option>
          {availableRooms.map((room) => {
            const buildingName =
              typeof room.building_id === 'object' && room.building_id
                ? room.building_id.name || room.building_id.building_code
                : '';
            const roomLabel = room.room_name || room.room_code || 'Phòng';
            const labelWithBld = buildingName ? `${roomLabel} (${buildingName})` : roomLabel;
            return (
              <option key={room._id} value={room._id}>
                {labelWithBld}
              </option>
            );
          })}
        </select>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !selectedRoomIdToAdd}
          onClick={handleAddRoom}
          className="h-8 shrink-0 rounded-xl px-2.5 text-xs font-semibold hover:bg-slate-50 border-slate-200"
        >
          <Plus size={13} className="mr-1" />
          Thêm phòng
        </Button>
      </div>

      {/* Fallback note */}
      <p className="text-[11px] text-[#64748B] flex items-center gap-1 pt-0.5">
        <span>* Các phòng khác sẽ tự động áp dụng đơn giá chung:</span>
        <strong className="text-[#1E293B]">
          {Number(defaultPrice).toLocaleString('vi-VN')} {unit}
        </strong>
      </p>
    </div>
  );
}
