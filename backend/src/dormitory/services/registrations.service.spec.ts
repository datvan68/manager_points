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
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, {} as any);
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
    const service = new RegistrationsService(registrationModel, {} as any, {} as any, publicModel, {} as any);
    const result = await service.findAll({});
    expect(result.data).toHaveLength(0);
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
      ky_hoc: 'HK2',
      nam_hoc: '2025-2026',
      ngay_sinh: '2003-01-15',
      gioi_tinh: 'Female',
      so_dien_thoai: '0912345678',
      doi_tuong_uu_tien: 'Khó khăn',
      nguyen_vong: { loai_phong: 'Máy lạnh' },
    }, { _id: 'user-1' });

    expect(registrationModel).toHaveBeenCalledWith(expect.objectContaining({
      student_id: '507f1f77bcf86cd799439011',
      ngay_sinh: '2003-01-15',
      gioi_tinh: 'Female',
      so_dien_thoai: '0912345678',
      doi_tuong_uu_tien: 'Khó khăn',
      nguyen_vong: { loai_phong: 'Máy lạnh' },
      trang_thai: 'Chờ duyệt',
    }));
  });
});

describe('RegistrationsService temporary entry', () => {
  it('derives the active semester and persists an unclassified admin entry', async () => {
    const publicModel: any = jest.fn().mockImplementation((payload: any) => ({ ...payload, save: jest.fn().mockResolvedValue({ ...payload, _id: 'temporary-1' }) }));
    publicModel.findOne = jest.fn().mockResolvedValue(null);
    const semesters = { findAll: jest.fn().mockResolvedValue([{ semester_name: 'HK2 - 2025 - 2026', status: 'active' }]) };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, semesters as any);

    await service.createTemporary({ ho_ten: 'Nguyễn Tạm', ngay_sinh: '2004-02-03', gioi_tinh: 'Female', so_dien_thoai: '0912345678', loai_phong: 'Máy lạnh' });

    expect(publicModel).toHaveBeenCalledWith(expect.objectContaining({
      ho_ten: 'Nguyễn Tạm', ma_sinh_vien: '', ky_hoc: 'HK2', nam_hoc: '2025-2026',
      loai_phong: 'Máy lạnh', nguon: 'ADMIN_ENTRY', trang_thai: 'Chờ xác nhận',
    }));
  });

  it('rejects a duplicate pending phone', async () => {
    const publicModel: any = jest.fn();
    publicModel.findOne = jest.fn().mockResolvedValue({ ma_dk_public: 'PUB-OLD' });
    const semesters = { findAll: jest.fn().mockResolvedValue([{ semester_name: 'HK1 - 2025 - 2026', status: 'active' }]) };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, semesters as any);
    await expect(service.createTemporary({ ho_ten: 'Nguyễn Tạm', ngay_sinh: '2004-02-03', gioi_tinh: 'Other', so_dien_thoai: '0912345678' })).rejects.toThrow('đã có đơn đăng ký tạm');
  });
});
