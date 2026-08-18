import { describe, expect, it } from 'vitest';
import { applyRoomAssignment, getPublicRegistrationUrl, isUnassignedRoom, selectedPdfRosterEntry, studentName } from './page';

const entry = { _id: 'entry-1', roster_entry_code: 'DK-1', full_name: 'Nguyễn A', semester: 'HK1', academic_year: '2026-2027', identity_state: 'UNLINKED' as const };

describe('Danh sách KTX canonical page capabilities', () => {
  it('keeps public QR route and roster row helpers canonical', () => {
    expect(getPublicRegistrationUrl('https://example.test/')).toBe('https://example.test/public/dormitory/register');
    expect(studentName(entry)).toBe('Nguyễn A');
    expect(isUnassignedRoom(entry)).toBe(true);
    expect(selectedPdfRosterEntry([entry], ['entry-1'])).toBe(entry);
  });

  it('updates a row with canonical room assignment data', () => {
    const updated = applyRoomAssignment(entry, { room: { _id: 'room-1', room_code: 'A101', building_id: 'building-1', room_type: 'Thường', bed_count: 1, max_students: 1, current_students: 0, available_bed_count: 1, room_price: 0, status: 'Trống', amenities: [], qr_code: '', public_url: '' }, bed: { _id: 'bed-1', bed_code: 'A101-G1', room_id: 'room-1', status: 'Đang sử dụng' } });
    expect(updated.room_id).toEqual(expect.objectContaining({ _id: 'room-1' }));
    expect(updated.bed_id).toEqual(expect.objectContaining({ _id: 'bed-1' }));
  });
});
