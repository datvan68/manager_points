import { PublicRegistrationLinkService } from './public-registration-link.service';

jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

describe('PublicRegistrationLinkService', () => {
  it('links through one transaction and is idempotent on retry', async () => {
    const publicRegistration: any = {
      _id: 'public-1', public_registration_code: 'QR-1', status: 'Chờ xác nhận', student_code: 'SV001',
      semester: 'HK1', academic_year: '2025-2026', save: jest.fn().mockResolvedValue(undefined),
    };
    const formal: any = { _id: 'formal-1', save: jest.fn().mockResolvedValue(undefined) };
    const student: any = { _id: 'student-1', student_code: 'SV001', full_name: 'A' };
    const withTransaction = jest.fn(async (callback: () => Promise<void>) => callback());
    const session = { withTransaction, endSession: jest.fn().mockResolvedValue(undefined) };
    const registrationModel: any = jest.fn().mockImplementation(() => formal);
    registrationModel.db = { startSession: jest.fn().mockResolvedValue(session) };
    registrationModel.findOne = jest.fn().mockResolvedValueOnce(null);
    registrationModel.findById = jest.fn().mockResolvedValue(formal);
    const publicModel: any = {
      findOne: jest.fn().mockResolvedValue(publicRegistration),
    };
    const studentModel: any = { findById: jest.fn().mockResolvedValue(student) };
    const service = new PublicRegistrationLinkService(publicModel, registrationModel, studentModel);

    await expect(service.linkRegistrationToStudent('public-1', 'student-1')).resolves.toBe(formal);
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(formal.save).toHaveBeenCalledWith({ session });
    expect(publicRegistration.save).toHaveBeenCalledWith({ session });
    expect(publicRegistration.linked_canonical_owner).toBe('FORMAL_REGISTRATION');

    await expect(service.linkRegistrationToStudent('public-1', 'student-1')).resolves.toBe(formal);
    expect(registrationModel).toHaveBeenCalledTimes(1);
  });

  it('reports bounded batch outcomes without guessing ambiguous candidates', async () => {
    const pending = [
      { _id: '1', status: 'Chờ xác nhận', student_code: ' SV001 ' },
      { _id: '2', status: 'Chờ xác nhận', student_code: 'SV002' },
      { _id: '3', status: 'Chờ xác nhận', student_code: '' },
    ];
    const publicModel: any = { find: jest.fn().mockReturnValue({ sort: () => ({ limit: () => ({ exec: jest.fn().mockResolvedValue(pending) }) }) }), findOne: jest.fn() };
    const registrationModel: any = jest.fn();
    registrationModel.findOne = jest.fn().mockResolvedValue(null);
    registrationModel.db = {};
    const studentModel: any = {
      find: jest.fn().mockResolvedValue([
        { _id: 'student-1', student_code: 'SV001', class_id: 'class-1', status: 'Studying' },
        { _id: 'student-2', student_code: 'SV002', class_id: 'class-2', status: 'Studying' },
        { _id: 'student-3', student_code: 'SV002', class_id: 'class-3', status: 'Studying' },
      ]),
    };
    const service = new PublicRegistrationLinkService(publicModel, registrationModel, studentModel);
    jest.spyOn(service, 'linkRegistrationToStudent').mockResolvedValue({ _id: 'formal-1' } as any);

    const result = await service.autoLinkPendingRegistrations();
    expect(publicModel.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'Chờ xác nhận', linked_student_id: { $exists: false } }));
    expect(result.matched).toBe(1);
    expect(result.conflicts).toBe(1);
    expect(result.not_found).toBe(1);
    expect(result.details).toHaveLength(1);
  });
});
