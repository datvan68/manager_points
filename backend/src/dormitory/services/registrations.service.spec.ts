jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
import { RegistrationsService } from './registrations.service';

function queryResult<T>(value: T) {
  const query: any = {
    populate: () => query,
    sort: () => query,
    skip: () => query,
    limit: () => query,
    lean: () => Promise.resolve(value),
    exec: () => Promise.resolve(value),
  };
  return query;
}

describe('RegistrationsService unclassified roster', () => {
  it('returns only blank-code public registrations without typed links', async () => {
    const publicModel: any = {
      find: jest.fn().mockReturnValue(queryResult([{ _id: 'a', ma_dk_public: 'QR-1', ma_sinh_vien: '', ho_ten: 'A' }])),
      countDocuments: jest.fn().mockResolvedValue(1),
    };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel);
    const result = await service.findUnclassified({ page: 1, limit: 20 });
    expect(publicModel.find).toHaveBeenCalledWith(expect.objectContaining({
      ma_sinh_vien: { $in: ['', null] },
      linked_student_id: { $exists: false },
      linked_registration_id: { $exists: false },
    }));
    expect(result.data[0]).toEqual(expect.objectContaining({ source: 'PUBLIC', classification_status: 'UNCLASSIFIED' }));
  });

  it('does not expose a public registration after auto-link references are persisted', async () => {
    const publicModel: any = { find: jest.fn().mockReturnValue(queryResult([{ _id: 'a', ma_dk_public: 'QR-1', ma_sinh_vien: '', linked_student_id: 'student-1', linked_registration_id: 'registration-1' }])) };
    const registrationModel: any = { find: jest.fn().mockReturnValue(queryResult([])) };
    const service = new RegistrationsService(registrationModel, {} as any, {} as any, publicModel);
    const result = await service.findAll({});
    expect(result.data).toHaveLength(0);
  });
});
