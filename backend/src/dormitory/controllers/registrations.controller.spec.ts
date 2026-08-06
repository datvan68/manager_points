jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
import { RegistrationsController } from './registrations.controller';

describe('RegistrationsController temporary entry', () => {
  it('delegates temporary creation to the service without accepting a user or student id', async () => {
    const registrationsService: any = { createTemporary: jest.fn().mockResolvedValue({ ma_dk_public: 'PUB-1' }) };
    const controller = new RegistrationsController(registrationsService, {} as any, {} as any);
    const dto = { ho_ten: 'Nguyễn Tạm', ngay_sinh: '2004-02-03', gioi_tinh: 'Female', so_dien_thoai: '0912345678' };

    await expect(controller.createTemporary(dto as any)).resolves.toEqual({ ma_dk_public: 'PUB-1' });
    expect(registrationsService.createTemporary).toHaveBeenCalledWith(dto);
  });
});
