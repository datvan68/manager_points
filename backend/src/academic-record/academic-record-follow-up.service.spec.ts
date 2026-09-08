import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AcademicRecordFollowUpService } from './academic-record-follow-up.service';

describe('AcademicRecordFollowUpService', () => {
  const studentId = new Types.ObjectId().toString();
  const semesterId = new Types.ObjectId().toString();
  const recordId = new Types.ObjectId();
  const createdAt = new Date('2026-09-08T08:00:00.000Z');
  const latest = { _id: recordId, createdAt };
  const requester = { userId: new Types.ObjectId().toString(), roleCode: 'ADMIN', roleName: 'Admin' };
  const academicRecordModel: any = {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([latest]),
    }),
    countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(2) }),
  };
  const checkpoint = { student_id: studentId, semester_id: semesterId, handled_through_record_id: recordId };
  const followUpModel: any = {
    findOneAndUpdate: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(checkpoint) }),
    deleteOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 1 }) }),
  };

  beforeEach(() => jest.clearAllMocks());

  it('selects the latest active record by createdAt/_id and atomically upserts the checkpoint', async () => {
    const service = new AcademicRecordFollowUpService(
      followUpModel,
      academicRecordModel,
      {},
      {},
    );
    const result = await service.markHandled(studentId, semesterId, {}, requester);
    expect(result).toEqual({ success: true, followUp: checkpoint });
    expect(academicRecordModel.find).toHaveBeenCalledWith(expect.objectContaining({
      student_id: expect.any(Types.ObjectId), semester_id: expect.any(Types.ObjectId), status: 'active',
    }));
    expect(academicRecordModel.find.mock.results[0].value.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(followUpModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ student_id: expect.any(Types.ObjectId), semester_id: expect.any(Types.ObjectId) }),
      expect.objectContaining({ $set: expect.objectContaining({ handled_through_record_id: recordId, handled_record_count: 2 }) }),
      expect.objectContaining({ upsert: true, new: true }),
    );
  });

  it('returns a domain not-found error when the semester has no active records', async () => {
    academicRecordModel.find.mockReturnValueOnce({
      sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([]),
    });
    const service = new AcademicRecordFollowUpService(followUpModel, academicRecordModel, {}, {});
    await expect(service.markHandled(studentId, semesterId, {}, requester)).rejects.toBeInstanceOf(NotFoundException);
    expect(followUpModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('resets only the exact student-semester checkpoint', async () => {
    const service = new AcademicRecordFollowUpService(followUpModel, academicRecordModel, {}, {});
    await expect(service.reset(studentId, semesterId, requester)).resolves.toEqual({ success: true, deleted: true });
    expect(followUpModel.deleteOne).toHaveBeenCalledWith({ student_id: expect.any(Types.ObjectId), semester_id: expect.any(Types.ObjectId) });
  });
});
