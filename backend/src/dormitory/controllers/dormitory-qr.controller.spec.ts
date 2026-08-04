jest.mock('../services/rooms.service', () => ({ RoomsService: class {} }));
jest.mock('../services/beds.service', () => ({ BedsService: class {} }));
jest.mock('../../semesters/semesters.service', () => ({ SemestersService: class {} }));
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import { DormitoryQrController } from './dormitory-qr.controller';

describe('DormitoryQrController public registration', () => {
  const semester = { semester_name: 'HK1 - 2026 - 2027', status: 'active' } as any;

  function setup(existing: any = null) {
    const roomsService = { findByQrId: jest.fn() } as any;
    const bedsService = { findByRoom: jest.fn() } as any;
    const semestersService = { findAll: jest.fn().mockResolvedValue([semester]) } as any;
    const saved = jest.fn().mockImplementation(async function (this: any) { return { ...this }; });
    const publicRegModel: any = jest.fn().mockImplementation((value: any) => ({ ...value, save: saved }));
    publicRegModel.findOne = jest.fn().mockResolvedValue(existing);
    const controller = new DormitoryQrController(roomsService, bedsService, publicRegModel, semestersService);
    return { controller, roomsService, publicRegModel, saved };
  }

  it('returns the single active semester without authentication data', async () => {
    const { controller } = setup();
    await expect(controller.getActiveSemester()).resolves.toEqual({ semester_name: 'HK1 - 2026 - 2027', ky_hoc: 'HK1', nam_hoc: '2026-2027' });
  });

  it('persists a general QR registration without a room and forces the female room choice', async () => {
    const { controller, saved } = setup();
    await controller.publicRegister({ ho_ten: 'Nguyễn Văn A', so_dien_thoai: '0912345678', ngay_sinh: '2004-01-02', gioi_tinh: 'Female', loai_phong: 'Máy lạnh' } as any);
    expect(saved).toHaveBeenCalled();
    expect(saved.mock.instances[0]).toMatchObject({ nguon: 'QR_SCAN', trang_thai: 'Chờ xác nhận', room_id: undefined, loai_phong: 'Máy lạnh', ky_hoc: 'HK1', nam_hoc: '2026-2027' });
  });

  it('returns a structured duplicate-phone response', async () => {
    const { controller } = setup({ ma_dk_public: 'PUB-EXISTING' });
    await expect(controller.publicRegister({ ho_ten: 'A', so_dien_thoai: '0912345678', ngay_sinh: '2004-01-02', gioi_tinh: 'Male' } as any)).resolves.toMatchObject({ success: false, code: 'DUPLICATE_PHONE', ma_dk: 'PUB-EXISTING' });
  });

  it('keeps room-specific QR requests compatible when new fields are omitted', async () => {
    const { controller, roomsService, saved } = setup();
    roomsService.findByQrId.mockResolvedValue({ _id: 'room-1', ma_phong: 'A101', loai_phong: 'Thường', building_id: { ten: 'A' } });
    await controller.publicRegister({ ho_ten: 'A', so_dien_thoai: '0912345678', qr_room_id: 'room-qr' } as any);
    expect(saved).toHaveBeenCalled();
    expect(saved.mock.instances[0]).toMatchObject({ ma_phong: 'A101', gioi_tinh: 'Other', loai_phong: 'Thường' });
  });
});
