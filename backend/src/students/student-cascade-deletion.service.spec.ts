import { Types } from 'mongoose';
import { StudentCascadeDeletionService } from './student-cascade-deletion.service';

describe('StudentCascadeDeletionService', () => {
  const studentId = new Types.ObjectId('507f1f77bcf86cd799439011');
  let studentModel: any;
  let connection: any;
  let session: any;
  let service: StudentCascadeDeletionService;

  beforeEach(() => {
    session = {
      withTransaction: jest.fn(async (work) => work()),
      endSession: jest.fn(),
    };
    const collection = {
      countDocuments: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    };
    connection = {
      startSession: jest.fn().mockResolvedValue(session),
      collection: jest.fn().mockReturnValue(collection),
    };
    studentModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: studentId, user_id: new Types.ObjectId('507f1f77bcf86cd799439012') }),
      }),
      findOneAndDelete: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: studentId }),
      }),
    };
    service = new StudentCascadeDeletionService(connection, studentModel);
  });

  it('returns a redacted impact and does not mutate when not confirmed', async () => {
    const impact = await service.remove(studentId.toString(), false);

    expect(impact).toEqual(expect.objectContaining({ studentId: studentId.toString(), userLinked: true }));
    expect(connection.startSession).not.toHaveBeenCalled();
    expect(studentModel.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('cleans dependent collections and student/user references inside one transaction', async () => {
    await service.remove(studentId.toString(), true);

    expect(connection.startSession).toHaveBeenCalledTimes(1);
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(studentModel.findOneAndDelete).toHaveBeenCalledWith(
      { _id: studentId },
      { session },
    );
    expect(connection.collection('studenttasks').updateMany).toHaveBeenCalled();
    expect(connection.collection('notifications').updateMany).toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('does not delete the student when cleanup fails', async () => {
    const collections = new Map<string, any>();
    connection.collection.mockImplementation((name: string) => {
      const collection = collections.get(name) || {
        countDocuments: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      };
      collections.set(name, collection);
      return collection;
    });
    const failure = new Error('injected cleanup failure');
    collections.set('summarypoints', {
      countDocuments: jest.fn().mockResolvedValue(1),
      deleteMany: jest.fn().mockRejectedValue(failure),
      updateMany: jest.fn(),
    });

    await expect(service.remove(studentId.toString(), true)).rejects.toThrow(failure);
    expect(studentModel.findOneAndDelete).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
});
