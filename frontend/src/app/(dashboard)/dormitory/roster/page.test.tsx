import { describe, expect, it } from 'vitest';
import {
  applyRoomAssignment,
  getPublicRegistrationUrl,
  isUnassignedRoom,
  selectedPdfRosterEntries,
  selectedPdfRosterEntry,
  studentName,
} from './page';

const entry1 = { _id: 'entry-1', roster_entry_code: 'DK-1', full_name: 'Nguyễn A', semester: 'HK1', academic_year: '2026-2027', identity_state: 'UNLINKED' as const };
const entry2 = { _id: 'entry-2', roster_entry_code: 'DK-2', full_name: 'Trần B', semester: 'HK1', academic_year: '2026-2027', identity_state: 'LINKED' as const };
const entry3 = { _id: 'entry-3', roster_entry_code: 'DK-3', full_name: 'Lê C', semester: 'HK1', academic_year: '2026-2027', identity_state: 'LINKED' as const };

describe('Danh sách KTX canonical page capabilities', () => {
  it('keeps public QR route and roster row helpers canonical', () => {
    expect(getPublicRegistrationUrl('https://example.test/')).toBe('https://example.test/public/dormitory/register');
    expect(studentName(entry1)).toBe('Nguyễn A');
    expect(isUnassignedRoom(entry1)).toBe(true);
    expect(selectedPdfRosterEntry([entry1], ['entry-1'])).toBe(entry1);
    expect(selectedPdfRosterEntry([entry1, entry2], ['entry-1', 'entry-2'])).toBeUndefined();
    expect(selectedPdfRosterEntry([entry1], [])).toBeUndefined();
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
});
