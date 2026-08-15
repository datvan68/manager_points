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
  it('passes the optional source discriminator to detail reads', async () => {
    const registrationsService: any = { findOne: jest.fn().mockResolvedValue({ _id: 'registration-1', source: 'PUBLIC' }) };
    const controller = new RegistrationsController(registrationsService, {} as any, {} as any);

    await expect(controller.findOne('registration-1', 'PUBLIC')).resolves.toEqual({ _id: 'registration-1', source: 'PUBLIC' });
    expect(registrationsService.findOne).toHaveBeenCalledWith('registration-1', 'PUBLIC');
  });

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

describe('RegistrationsController application PDF', () => {
  it('passes the source discriminator to the PDF service', async () => {
    const registrationsService: any = {
      generateApplicationPdf: jest.fn().mockResolvedValue({ buffer: Buffer.from('pdf'), filename: 'application.pdf' }),
    };
    const response: any = { set: jest.fn(), end: jest.fn() };
    const controller = new RegistrationsController(registrationsService, {} as any, {} as any);

    await controller.applicationPdf('507f1f77bcf86cd799439011', 'ADMIN_TEMPORARY', 'attachment', response);

    expect(registrationsService.generateApplicationPdf).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'ADMIN_TEMPORARY');
    expect(response.set).toHaveBeenCalledWith(expect.objectContaining({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="application.pdf"',
    }));
    expect(response.end).toHaveBeenCalledWith(Buffer.from('pdf'));
  });
});

describe('RegistrationsController student dormitory registration', () => {
  it('delegates findByStudentId to the service passing studentId and user', async () => {
    const registrationsService: any = {
      findByStudentId: jest.fn().mockResolvedValue({ has_dormitory_registration: true, registration: { _id: 'reg-1' } }),
    };
    const controller = new RegistrationsController(registrationsService, {} as any, {} as any);
    const req = { user: { userId: 'user-1', roleCode: 'ADMIN' } };

    const result = await controller.findByStudentId('student-123', req as any);
    expect(result).toEqual({ has_dormitory_registration: true, registration: { _id: 'reg-1' } });
    expect(registrationsService.findByStudentId).toHaveBeenCalledWith('student-123', req.user);
  });
});
