import { DormitoryReportsService } from './dormitory-reports.service';

function modelFor<T>(value: T) {
  const query: any = {
    populate: () => query,
    lean: () => query,
    exec: async () => value,
  };
  return { find: jest.fn(() => query), countDocuments: jest.fn().mockResolvedValue(0) };
}

describe('DormitoryReportsService canonical roster summary', () => {
  it('counts linked, unlinked, assigned, and unassigned roster entries from one model', async () => {
    const service = new DormitoryReportsService(
      modelFor([]) as any,
      modelFor([{ _id: 'room-1', room_code: 'A101', room_type: 'Thường', bed_count: 1, status: 'Trống' }]) as any,
      modelFor([{ _id: 'bed-1', room_id: 'room-1', status: 'Đang sử dụng' }]) as any,
      modelFor([{ _id: 'contract-1', roster_entry_id: 'roster-1', room_id: 'room-1', status: 'Hiệu lực' }]) as any,
      modelFor([]) as any,
      {} as any,
      { countDocuments: jest.fn().mockResolvedValue(0) } as any,
      modelFor([
        { _id: 'roster-1', student_id: { _id: 'student-1', full_name: 'Nguyen Van A', class_id: { class_name: '10A1' } }, gender: 'Male', room_type: 'Thường', identity_state: 'LINKED', room_id: 'room-1', createdAt: new Date() },
        { _id: 'roster-2', gender: 'Female', room_type: 'Máy lạnh', identity_state: 'UNLINKED', createdAt: new Date() },
      ]) as any,
    );

    const report = await service.getDashboardStats();

    expect(report.registration_summary).toEqual(expect.objectContaining({
      total: 2,
      assigned: 1,
      male: 1,
      female: 1,
      unlinked: 1,
      unassigned: 1,
    }));
    expect(report.students.registered).toBe(1);
  });

  it('maps room members with student populated info, handles fallbacks, deduplication and empty rooms', async () => {
    const service = new DormitoryReportsService(
      modelFor([]) as any,
      modelFor([
        { _id: 'room-1', room_code: 'A101', room_name: 'Phòng A101', room_type: 'Thường', bed_count: 2, status: 'Còn chỗ' },
        { _id: 'room-2', room_code: 'A102', room_name: 'Phòng A102', room_type: 'Máy lạnh', bed_count: 2, status: 'Còn chỗ' },
        { _id: 'room-empty', room_code: 'A103', room_name: 'Phòng A103', room_type: 'Thường', bed_count: 2, status: 'Trống' },
      ]) as any,
      modelFor([]) as any,
      modelFor([
        // contract for roster-1 in room-1 (same as direct room_id, to test deduplication)
        { _id: 'c-1', roster_entry_id: 'roster-1', room_id: 'room-1', status: 'Hiệu lực' },
        // contract for roster-3 in room-2 (roster-3 has no direct room_id, mapped via contract)
        { _id: 'c-2', roster_entry_id: 'roster-3', room_id: 'room-2', status: 'Hiệu lực' },
        // inactive contract should not map roster-4 to room-2
        { _id: 'c-3', roster_entry_id: 'roster-4', room_id: 'room-2', status: 'Hết hạn' },
      ]) as any,
      modelFor([]) as any,
      {} as any,
      { countDocuments: jest.fn().mockResolvedValue(0) } as any,
      modelFor([
        // Roster 1: populated student with object class_id, mapped to room-1 directly and via contract
        {
          _id: 'roster-1',
          student_id: { _id: 's-1', full_name: 'Trần Văn A', class_id: { _id: 'cl-1', class_name: '12A1' } },
          room_id: 'room-1',
          createdAt: new Date(),
        },
        // Roster 2: unlinked student with only roster.full_name and no class, mapped directly to room-1
        {
          _id: 'roster-2',
          full_name: 'Lê Thị B',
          room_id: 'room-1',
          createdAt: new Date(),
        },
        // Roster 3: student with string class_id, mapped to room-2 via active contract
        {
          _id: 'roster-3',
          student_id: { _id: 's-3', full_name: 'Phạm Văn C', class_id: '11B2' },
          createdAt: new Date(),
        },
        // Roster 4: inactive contract, should not appear in room-2
        {
          _id: 'roster-4',
          student_id: { _id: 's-4', full_name: 'Hoàng Thị D', class_id: null },
          createdAt: new Date(),
        },
      ]) as any,
    );

    const report = await service.getDashboardStats();
    const room1 = report.room_rows.find((r) => r.room_id === 'room-1');
    const room2 = report.room_rows.find((r) => r.room_id === 'room-2');
    const roomEmpty = report.room_rows.find((r) => r.room_id === 'room-empty');

    expect(room1).toBeDefined();
    // Check deduplication and exact member shape (no extra fields)
    expect(room1?.members).toEqual([
      { full_name: 'Trần Văn A', class_name: '12A1' },
      { full_name: 'Lê Thị B', class_name: 'Chưa cập nhật' },
    ]);
    expect(Object.keys(room1!.members[0])).toEqual(['full_name', 'class_name']);

    expect(room2).toBeDefined();
    expect(room2?.members).toEqual([
      { full_name: 'Phạm Văn C', class_name: '11B2' },
    ]);

    expect(roomEmpty).toBeDefined();
    expect(roomEmpty?.members).toEqual([]);
  });
});
