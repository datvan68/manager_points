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
      find: jest.fn().mockReturnValue(queryResult([{ _id: 'a', public_registration_code: 'QR-1', student_code: '', full_name: 'A' }])),
      countDocuments: jest.fn().mockResolvedValue(1),
    };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, {} as any);
    const result = await service.findUnclassified({ page: 1, limit: 20 });
    expect(publicModel.find).toHaveBeenCalledWith(expect.objectContaining({
      student_code: { $in: ['', null] },
      linked_student_id: { $exists: false },
      linked_registration_id: { $exists: false },
    }));
    expect(result.data[0]).toEqual(expect.objectContaining({ source: 'PUBLIC', classification_status: 'UNCLASSIFIED' }));
  });

  it('does not expose a public registration after auto-link references are persisted', async () => {
    const publicModel: any = { find: jest.fn().mockReturnValue(queryResult([{ _id: 'a', public_registration_code: 'QR-1', student_code: '', linked_student_id: 'student-1', linked_registration_id: 'registration-1' }])) };
    const registrationModel: any = { find: jest.fn().mockReturnValue(queryResult([])) };
    const service = new RegistrationsService(registrationModel, {} as any, {} as any, publicModel, {} as any);
    const result = await service.findAll({});
    expect(result.data).toHaveLength(0);
  });
});

describe('RegistrationsService room enrichment', () => {
  it('adds the active contract room name to formal rows and keeps public room references', async () => {
    const formal = { _id: 'registration-1', registration_code: 'DK-1', student_id: { student_code: '012', full_name: 'Nguyễn A' }, toObject: () => ({ _id: 'registration-1', registration_code: 'DK-1' }) };
    const registrationModel: any = { find: jest.fn().mockReturnValue(queryResult([formal])) };
    const contractModel: any = { find: jest.fn().mockReturnValue(queryResult([{ registration_id: 'registration-1', room_id: { room_name: 'A101' } }])) };
    const publicModel: any = { find: jest.fn().mockReturnValue(queryResult([{ _id: 'public-1', public_registration_code: 'QR-1', full_name: 'Trần B', room_code: 'B202', source: 'QR_SCAN' }])) };
    const service = new RegistrationsService(registrationModel, {} as any, contractModel, publicModel, {} as any);

    const result = await service.findAll({});

    expect(contractModel.find).toHaveBeenCalledWith({ registration_id: { $in: ['registration-1'] }, status: 'Hiệu lực' });
    expect(result.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ registration_code: 'DK-1', assigned_room_name: 'A101' }),
      expect.objectContaining({ registration_code: 'QR-1', assigned_room_name: 'B202' }),
    ]));
  });
});

describe('RegistrationsService create snapshots', () => {
  it('persists profile snapshots and the selected registration options', async () => {
    const registrationModel: any = jest.fn().mockImplementation((payload: any) => ({
      ...payload,
      save: jest.fn().mockResolvedValue({ ...payload, _id: 'registration-1' }),
    }));
    registrationModel.findOne = jest.fn().mockResolvedValue(null);
    const invoiceModel: any = { countDocuments: jest.fn().mockResolvedValue(0) };
    const contractModel: any = { findOne: jest.fn().mockResolvedValue(null) };
    const publicModel: any = {};
    const service = new RegistrationsService(registrationModel, invoiceModel, contractModel, publicModel, {} as any);

    await service.create({
      student_id: '507f1f77bcf86cd799439011',
      semester: 'HK2',
      academic_year: '2025-2026',
      date_of_birth: '2003-01-15',
      gender: 'Female',
      phone_number: '0912345678',
      priority_group: 'Khó khăn',
      preference: { room_type: 'Máy lạnh' },
    }, { _id: 'user-1' });

    expect(registrationModel).toHaveBeenCalledWith(expect.objectContaining({
      student_id: '507f1f77bcf86cd799439011',
      date_of_birth: '2003-01-15',
      gender: 'Female',
      phone_number: '0912345678',
      priority_group: 'Khó khăn',
      preference: { room_type: 'Máy lạnh' },
      status: 'Chờ duyệt',
    }));
  });
});

describe('RegistrationsService temporary entry', () => {
  it('derives the active semester and persists an unclassified admin entry', async () => {
    const publicModel: any = jest.fn().mockImplementation((payload: any) => ({ ...payload, save: jest.fn().mockResolvedValue({ ...payload, _id: 'temporary-1' }) }));
    publicModel.findOne = jest.fn().mockResolvedValue(null);
    const semesters = { findAll: jest.fn().mockResolvedValue([{ semester_name: 'HK2 - 2025 - 2026', status: 'active' }]) };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, semesters as any);

    await service.createTemporary({ full_name: 'Nguyễn Tạm', date_of_birth: '2004-02-03', gender: 'Female', phone_number: '0912345678', room_type: 'Máy lạnh' });

    expect(publicModel).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'Nguyễn Tạm', student_code: '', semester: 'HK2', academic_year: '2025-2026',
      room_type: 'Máy lạnh', source: 'ADMIN_ENTRY', status: 'Chờ xác nhận',
    }));
  });

  it('rejects a duplicate pending phone', async () => {
    const publicModel: any = jest.fn();
    publicModel.findOne = jest.fn().mockResolvedValue({ public_registration_code: 'PUB-OLD' });
    const semesters = { findAll: jest.fn().mockResolvedValue([{ semester_name: 'HK1 - 2025 - 2026', status: 'active' }]) };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, semesters as any);
    await expect(service.createTemporary({ full_name: 'Nguyễn Tạm', date_of_birth: '2004-02-03', gender: 'Other', phone_number: '0912345678' })).rejects.toThrow('đã có đơn đăng ký tạm');
  });
});

describe('RegistrationsService registration actions', () => {
  it('updates only formal registration-owned fields', async () => {
    const formal = {
      phone_number: '0912345678',
      save: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011' }),
    };
    const registrationModel: any = { findById: jest.fn().mockResolvedValue(formal) };
    const service = new RegistrationsService(registrationModel, {} as any, {} as any, {} as any, {} as any);

    await service.update('507f1f77bcf86cd799439011', 'FORMAL', {
      phone_number: '0987654321',
      preference: { room_type: 'Máy lạnh' },
    });

    expect(formal.phone_number).toBe('0987654321');
    expect(formal.preference).toEqual({ room_type: 'Máy lạnh' });
    expect(formal.save).toHaveBeenCalled();
    await expect(service.update('507f1f77bcf86cd799439011', 'FORMAL', { full_name: 'Không được sửa' } as any)).rejects.toThrow('Không thể cập nhật trường');
  });

  it('updates temporary public entries only when the source matches', async () => {
    const temporary = {
      source: 'ADMIN_ENTRY',
      full_name: 'Tên cũ',
      save: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011' }),
    };
    const publicModel: any = { findById: jest.fn().mockResolvedValue(temporary) };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, {} as any);

    await service.update('507f1f77bcf86cd799439011', 'ADMIN_TEMPORARY', { full_name: 'Tên mới' });
    expect(temporary.full_name).toBe('Tên mới');
    await expect(service.update('507f1f77bcf86cd799439011', 'PUBLIC', { full_name: 'Sai nguồn' })).rejects.toThrow('Nguồn đăng ký QR không hợp lệ');
  });

  it('blocks deletion of referenced records and deletes unlinked public records', async () => {
    const formal = { _id: '507f1f77bcf86cd799439011' };
    const registrationModel: any = {
      findById: jest.fn().mockResolvedValue(formal),
      findByIdAndDelete: jest.fn().mockResolvedValue(formal),
    };
    const contractModel: any = { findOne: jest.fn().mockResolvedValue({ _id: 'contract-1' }) };
    const service = new RegistrationsService(registrationModel, {} as any, contractModel, {} as any, {} as any);
    await expect(service.remove('507f1f77bcf86cd799439011', 'FORMAL')).rejects.toThrow('đã liên kết với hợp đồng');

    const publicRegistration = { source: 'QR_SCAN', linked_student_id: undefined, linked_registration_id: undefined };
    const publicModel: any = {
      findById: jest.fn().mockResolvedValue(publicRegistration),
      findByIdAndDelete: jest.fn().mockResolvedValue(publicRegistration),
    };
    const publicService = new RegistrationsService({} as any, {} as any, {} as any, publicModel, {} as any);
    await expect(publicService.remove('507f1f77bcf86cd799439011', 'PUBLIC')).resolves.toEqual({ success: true, id: '507f1f77bcf86cd799439011', source: 'PUBLIC' });
    expect(publicModel.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });
});
