import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SystemService } from './system.service';

function chain(value: any) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  };
}

describe('SystemService class record summaries', () => {
  it('rejects callers outside the staff record scope', async () => {
    const service = Object.create(SystemService.prototype) as SystemService;
    await expect(service.getClassRecordSummaries(
      { userId: new Types.ObjectId().toString(), roleName: 'Teacher', permissions: [] },
      {} as any,
    )).rejects.toThrow(ForbiddenException);
  });

  it('builds a scoped, quantity-normalized, newest-eight aggregation', async () => {
    const semesterId = new Types.ObjectId();
    const aggregate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([{
        items: [{ classId: 'class-1', className: '10A1', recordCount: 3, records: [] }],
        count: [{ total: 1 }],
      }]),
    });
    const connection = {
      model: jest.fn((name: string) => {
        if (name === 'Semester') return { find: () => chain([{ _id: semesterId, status: 'active' }]) };
        if (name === 'Class') return { collection: { name: 'classes' }, find: () => chain([{ _id: new Types.ObjectId() }]) };
        if (name === 'Student') return { collection: { name: 'students' } };
        if (name === 'Criterion') return { collection: { name: 'criteria' } };
        return { collection: { name: 'academicrecords' }, aggregate };
      }),
    } as any;
    const service = Object.create(SystemService.prototype) as SystemService;
    (service as any).connection = connection;

    const result = await service.getClassRecordSummaries(
      { userId: new Types.ObjectId().toString(), roleName: 'Supervisor', permissions: ['READ_STUDENT_RECORD'] },
      { page: 1, limit: 20 } as any,
    );

    expect(result).toEqual(expect.objectContaining({ total: 1, semesterId: semesterId.toString() }));
    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual(expect.objectContaining({ $match: expect.objectContaining({ status: 'active', is_deleted: { $ne: true } }) }));
    expect(pipeline.find((stage: any) => stage.$set)?.$set.normalizedQuantity.$convert).toEqual(expect.objectContaining({ onNull: 1, onError: 1 }));
    expect(pipeline.find((stage: any) => stage.$project)?.$project.records).toEqual({ $slice: ['$records', 8] });
  });
});
