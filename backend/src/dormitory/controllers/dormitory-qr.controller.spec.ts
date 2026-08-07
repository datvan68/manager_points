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
    await expect(controller.getActiveSemester()).resolves.toEqual({ semester_name: 'HK1 - 2026 - 2027', semester: 'HK1', academic_year: '2026-2027' });
  });

  it('persists a general QR registration without a room and forces the female room choice', async () => {
    const { controller, saved } = setup();
    await controller.publicRegister({ full_name: 'Nguyễn Văn A', phone_number: '0912345678', date_of_birth: '2004-01-02', gender: 'Female', room_type: 'Máy lạnh' } as any);
    expect(saved).toHaveBeenCalled();
    expect(saved.mock.instances[0]).toMatchObject({ source: 'QR_SCAN', status: 'Chờ xác nhận', room_id: undefined, room_type: 'Máy lạnh', semester: 'HK1', academic_year: '2026-2027' });
  });

  it('returns a structured duplicate-phone response', async () => {
    const { controller } = setup({ public_registration_code: 'PUB-EXISTING' });
    await expect(controller.publicRegister({ full_name: 'A', phone_number: '0912345678', date_of_birth: '2004-01-02', gender: 'Male' } as any)).resolves.toMatchObject({ success: false, code: 'DUPLICATE_PHONE', registration_code: 'PUB-EXISTING' });
  });

  it('keeps room-specific QR requests compatible when new fields are omitted', async () => {
    const { controller, roomsService, saved } = setup();
    roomsService.findByQrId.mockResolvedValue({ _id: 'room-1', room_code: 'A101', room_type: 'Thường', building_id: { name: 'A' } });
    await controller.publicRegister({ full_name: 'A', phone_number: '0912345678', qr_room_id: 'room-qr' } as any);
    expect(saved).toHaveBeenCalled();
    expect(saved.mock.instances[0]).toMatchObject({ room_code: 'A101', gender: 'Other', room_type: 'Thường' });
  });
});
