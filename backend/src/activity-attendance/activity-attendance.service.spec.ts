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
  it('rejects attendance writes when the schedule belongs to another activity', async () => {
    const activityModel: any = {
      findById: jest.fn(() => chain({ advisor_id: 'advisor-1', president_id: null })),
    };
    const scheduleModel: any = {
      findById: jest.fn(() => chain({
        activity_id: 'other-activity',
        semester_id: 'semester-1',
      })),
    };
    const service = new ActivityAttendanceService(
      {} as any,
      activityModel,
      scheduleModel,
      { findById: jest.fn(() => chain({ _id: 'student-1' })) } as any,
      {} as any,
      {} as any,
    );

    await expect(service.create(
      {
        activity_id: 'activity-1',
        schedule_id: 'schedule-1',
        student_id: 'student-1',
        semester_id: 'semester-1',
        status: 'present',
      } as any,
      'teacher-1',
      'teacher',
      { roleCode: 'ADMIN', userId: 'admin-1' },
    )).rejects.toThrow('không thuộc hoạt động');
  });

  it('rejects updates that attempt to move a record to another student or activity', async () => {
    const service = new ActivityAttendanceService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.update('attendance-1', { student_id: 'student-2' }, { roleCode: 'ADMIN' }))
      .rejects.toThrow('Không được thay đổi định danh');
  });

  it('rejects a permissioned teacher outside the activity ownership scope', async () => {
    const activityModel: any = {
      findById: jest.fn(() => chain({
        _id: 'activity-1',
        advisor_id: 'advisor-1',
        president_id: null,
      })),
    };
    const service = new ActivityAttendanceService(
      {} as any,
      activityModel,
      {} as any,
      { findOne: jest.fn(() => chain(null)) } as any,
      {} as any,
      {} as any,
    );

    await expect(service.findAll(
      { activity_id: '507f1f77bcf86cd799439011' } as any,
      { userId: '507f1f77bcf86cd799439012', permissions: ['ACTIVITY_ATTENDANCE_READ'] },
    )).rejects.toThrow('không có quyền truy cập điểm danh');
  });

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
