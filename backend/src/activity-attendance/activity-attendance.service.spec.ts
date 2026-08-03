import { ActivityAttendanceService } from './activity-attendance.service';

const chain = (value: any) => ({
  select: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

describe('ActivityAttendanceService.findAll', () => {
  it('combines search, inclusive dates, status filters, and pagination', async () => {
    const attendanceQuery = chain([{ _id: 'attendance-1', class_id: { class_name: 'DTH19' } }]);
    const attendanceModel: any = {
      find: jest.fn(() => attendanceQuery),
      countDocuments: jest.fn().mockResolvedValue(1),
    };
    const entityModel = (ids: string[]) => ({ find: jest.fn(() => ({
      select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(ids.map((_id) => ({ _id }))),
    })) });
    const service = new ActivityAttendanceService(
      attendanceModel,
      entityModel(['activity-1']) as any,
      entityModel([]) as any,
      entityModel([]) as any,
      entityModel([]) as any,
      {} as any,
    );

    const result = await service.findAll({
      search: 'activity', start_date: '2026-01-01', end_date: '2026-01-31',
      status: 'present', approval_status: 'approved', page: 2, limit: 40,
    });

    expect(result).toMatchObject({ items: [{ _id: 'attendance-1' }], total: 1, page: 2, limit: 40 });
    expect(attendanceModel.find).toHaveBeenCalledWith(expect.objectContaining({
      status: 'present', approval_status: 'approved',
      recorded_at: { $gte: new Date('2026-01-01T00:00:00.000Z'), $lte: new Date('2026-01-31T23:59:59.999Z') },
      $or: [{ activity_id: { $in: ['activity-1'] } }, { schedule_id: { $in: [] } }, { student_id: { $in: [] } }, { class_id: { $in: [] } }],
    }));
    expect(attendanceQuery.skip).toHaveBeenCalledWith(40);
    expect(attendanceQuery.limit).toHaveBeenCalledWith(40);
  });
});
