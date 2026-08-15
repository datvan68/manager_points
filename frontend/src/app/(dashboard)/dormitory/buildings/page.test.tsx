import { describe, expect, it } from 'vitest';
import { roomBedCountLabel, validateBuildingForm, validateRoomForm } from './page';

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
