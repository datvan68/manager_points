import { AttendanceDraftFinalizerService } from './attendance-draft-finalizer.service';

describe('AttendanceDraftFinalizerService', () => {
  const scheduleId = '507f1f77bcf86cd799439011';
  const recordId = '507f1f77bcf86cd799439012';

  function setup(records: any[] = []) {
    const update = jest.fn();
    const attendanceModel = { findOneAndUpdate: update } as any;
    const scheduleModel = {
      find: jest.fn().mockReturnValue({
        select: () => ({ limit: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue([{ _id: scheduleId }]) }) }) }),
      }),
    } as any;
    const syncService = { enqueueAttendanceSync: jest.fn() } as any;
    records.forEach((record) => update.mockReturnValueOnce({ lean: () => ({ exec: jest.fn().mockResolvedValue(record) }) }));
    update.mockReturnValue({ lean: () => ({ exec: jest.fn().mockResolvedValue(null) }) });
    return { service: new AttendanceDraftFinalizerService(attendanceModel, scheduleModel, syncService), update, syncService };
  }

  it('finalizes eligible records with an aggregation pipeline and enables pipeline updates', async () => {
    const record = { _id: recordId };
    const { service, update, syncService } = setup([record]);

    await expect(service.finalizeEndedDrafts()).resolves.toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ schedule_id: scheduleId, approval_status: 'pending' }),
      [{ $set: { approval_status: 'approved', approved_by: '$recorded_by', approved_at: '$$NOW' } }],
      expect.objectContaining({ updatePipeline: true }),
    );
    expect(syncService.enqueueAttendanceSync).toHaveBeenCalledWith(recordId);
  });

  it('returns zero for empty results and releases the running guard after failures', async () => {
    const { service, update } = setup();
    await expect(service.finalizeEndedDrafts()).resolves.toBe(0);
    update.mockReturnValueOnce({ lean: () => ({ exec: jest.fn().mockRejectedValue(new Error('boom')) }) });
    await expect(service.finalizeEndedDrafts()).resolves.toBe(0);
    await expect(service.finalizeEndedDrafts()).resolves.toBe(0);
  });
});
