import { DormitoryReportsService } from './dormitory-reports.service';

function modelFor<T>(value: T) {
  const query: any = {
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
        { _id: 'roster-1', student_id: 'student-1', gender: 'Male', room_type: 'Thường', identity_state: 'LINKED', room_id: 'room-1', createdAt: new Date() },
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
});
