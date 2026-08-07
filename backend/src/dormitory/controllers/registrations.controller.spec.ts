jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
import { RegistrationsController } from './registrations.controller';

describe('RegistrationsController temporary entry', () => {
  it('delegates temporary creation to the service without accepting a user or student id', async () => {
    const registrationsService: any = { createTemporary: jest.fn().mockResolvedValue({ public_registration_code: 'PUB-1' }) };
    const controller = new RegistrationsController(registrationsService, {} as any, {} as any);
    const dto = { full_name: 'Nguyễn Tạm', date_of_birth: '2004-02-03', gender: 'Female', phone_number: '0912345678' };

    await expect(controller.createTemporary(dto as any)).resolves.toEqual({ public_registration_code: 'PUB-1' });
    expect(registrationsService.createTemporary).toHaveBeenCalledWith(dto);
  });
});

describe('RegistrationsController registration actions', () => {
  it('passes source and DTO to update and remove', async () => {
    const registrationsService: any = {
      update: jest.fn().mockResolvedValue({ _id: 'registration-1' }),
      remove: jest.fn().mockResolvedValue({ success: true }),
    };
    const controller = new RegistrationsController(registrationsService, {} as any, {} as any);
    const dto = { full_name: 'Nguyễn A' };

    await expect(controller.update('registration-1', 'ADMIN_TEMPORARY', dto as any)).resolves.toEqual({ _id: 'registration-1' });
    await expect(controller.remove('registration-1', 'ADMIN_TEMPORARY')).resolves.toEqual({ success: true });
    expect(registrationsService.update).toHaveBeenCalledWith('registration-1', 'ADMIN_TEMPORARY', dto);
    expect(registrationsService.remove).toHaveBeenCalledWith('registration-1', 'ADMIN_TEMPORARY');
  });
});
