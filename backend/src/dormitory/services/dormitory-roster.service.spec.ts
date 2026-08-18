jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
import { ConflictException } from '@nestjs/common';
import { DormitoryRosterService } from './dormitory-roster.service';

function query<T>(value: T) {
  const result: any = { exec: jest.fn().mockResolvedValue(value), lean: jest.fn(() => result), populate: jest.fn(() => result), sort: jest.fn(() => result), skip: jest.fn(() => result), limit: jest.fn(() => result) };
  return result;
}

describe('DormitoryRosterService', () => {
  const semester = { _id: 'semester-1', semester_name: 'HK1 - 2026 - 2027', status: 'active' } as any;
  const student = { _id: '507f1f77bcf86cd799439012', student_code: 'SV001', full_name: 'Nguyễn Văn A', date_bir: new Date('2004-01-02'), sex: 'Male', status: 'Studying' } as any;

  function setup() {
    const saved = jest.fn().mockImplementation(async function (this: any) { return { ...this, _id: this._id || 'roster-1', toObject() { return { ...this }; } }; });
    const rosterModel: any = jest.fn().mockImplementation((value: any) => ({ ...value, save: saved, toObject() { return { ...this }; } }));
    rosterModel.find = jest.fn(() => query([]));
    rosterModel.findOne = jest.fn(() => query(null));
    rosterModel.findById = jest.fn(() => query(null));
    rosterModel.findByIdAndDelete = jest.fn(() => query({ _id: 'roster-1' }));
    rosterModel.countDocuments = jest.fn(() => query(0));
    const studentModel: any = { findById: jest.fn(() => query(student)), find: jest.fn(() => query([])) };
    const semesterModel: any = { find: jest.fn(() => query([semester])) };
    const contractModel: any = { findOne: jest.fn(() => query(null)), find: jest.fn(() => query([])) };
    const invoiceModel: any = { countDocuments: jest.fn(() => query(0)) };
    return { service: new DormitoryRosterService(rosterModel, studentModel, semesterModel, contractModel, invoiceModel), saved, rosterModel, studentModel };
  }

  it('links by stable student_id and ignores client identity values', async () => {
    const { service, saved } = setup();
    const result = await service.create({ student_id: '507f1f77bcf86cd799439012', full_name: 'Giả mạo', date_of_birth: '2000-01-01', gender: 'Female', phone_number: '0912345678', room_type: 'Thường' } as any);
    expect(saved).toHaveBeenCalled();
    expect(result.student_id).toBe('507f1f77bcf86cd799439012');
    expect(result.full_name).toBe('Nguyễn Văn A');
    expect(result.identity_state).toBe('LINKED');
  });

  it('rejects a second linked entry in the same semester', async () => {
    const { service, rosterModel } = setup();
    rosterModel.findOne.mockReturnValue(query({ _id: 'existing' }));
    await expect(service.create({ student_id: '507f1f77bcf86cd799439012', phone_number: '0912345678', room_type: 'Thường' } as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates manual identity and creates an immediately visible unlinked entry', async () => {
    const { service } = setup();
    const result = await service.createPublic({ full_name: 'Nguyễn B', date_of_birth: '2003-02-03', gender: 'Other', phone_number: '0912345678', room_type: 'Máy lạnh' } as any);
    expect(result.identity_state).toBe('UNLINKED');
    expect(result.roster_entry_code).toBeDefined();
    expect(result).not.toHaveProperty('status');
  });

  it('refuses deletion while a contract references the roster entry', async () => {
    const { service, rosterModel } = setup();
    const contractModel = (service as any).contractModel;
    contractModel.findOne.mockReturnValue(query({ _id: 'contract-1' }));

    await expect(service.remove('507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(ConflictException);
    expect(rosterModel.findByIdAndDelete).not.toHaveBeenCalled();
  });
});
