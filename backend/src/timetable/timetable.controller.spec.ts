import { Test } from '@nestjs/testing';
import { TimetableController } from './timetable.controller';
import { TimetableAccessGuard } from './timetable.controller';
import { TimetableService } from './timetable.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BadRequestException } from '@nestjs/common';
import { TimetableSourceError } from './timetable.types';

describe('TimetableController', () => {
  afterEach(() => jest.restoreAllMocks());
  it('delegates only the authenticated requester context', async () => {
    const service = { getOptions: jest.fn().mockResolvedValue({ years: [] }), getLegacyTimetable: jest.fn() };
    const module = await Test.createTestingModule({ controllers: [TimetableController], providers: [{ provide: TimetableService, useValue: service }] }).compile();
    const controller = module.get(TimetableController);
    await controller.getOptions({ user: { userId: 'viewer-1' } });
    expect(service.getOptions).toHaveBeenCalledWith({ userId: 'viewer-1' }, undefined);
    expect(controller).toBeDefined();
  });

  it.each([
    [{ roleCode: 'ADMIN' }, true],
    [{ roleCode: 'ADMIN', roleName: 'Student / HSSV' }, true],
    [{ roleCode: 'TEACHER' }, true],
    [{ roleCode: 'STUDENT' }, true],
    [{ roleName: 'Sinh viên' }, true],
    [{ roleName: 'Student / HSSV' }, true],
    [{ roleName: 'Giáo viên' }, true],
    [{ roleName: 'Admin' }, true],
    [{ roleCode: 'USER', roleName: 'Admin' }, false],
    [{ roleCode: 'SUPERVISOR' }, false],
    [{ roleName: 'Not an admin' }, false],
    [{}, false],
  ])('allows only student, admin and teacher roles with code precedence', async (user, allowed) => {
    jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
    const guard = new TimetableAccessGuard();
    const context = { switchToHttp: () => ({ getRequest: () => ({ user }) }) } as any;
    if (allowed) await expect(guard.canActivate(context)).resolves.toBe(true);
    else await expect(guard.canActivate(context)).rejects.toMatchObject({ response: expect.objectContaining({ statusCode: 403 }) });
  });

  it('does not grant access when JWT authentication fails', async () => {
    jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(false);
    const context = { switchToHttp: () => ({ getRequest: () => ({ user: { roleCode: 'ADMIN' } }) }) } as any;
    await expect(new TimetableAccessGuard().canActivate(context)).resolves.toBe(false);
  });

  it('maps source selection failures to a stable HTTP error', async () => {
    const service = { getOptions: jest.fn(), getLegacyTimetable: jest.fn().mockRejectedValue(new TimetableSourceError('SOURCE_INVALID_SELECTION', 'invalid')) };
    const module = await Test.createTestingModule({ controllers: [TimetableController], providers: [{ provide: TimetableService, useValue: service }] }).compile();
    const controller = module.get(TimetableController);
    await expect(controller.getTimetable({ user: { userId: 'viewer-1' } }, {} as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getTimetable({ user: { userId: 'viewer-1' } }, {} as any)).rejects.toMatchObject({ response: { reasonCode: 'SOURCE_INVALID_SELECTION' }, status: 400 });
  });

  it('exposes demand status and refresh as additive authenticated routes', async () => {
    const service = { getOptions: jest.fn(), getTimetable: jest.fn(), getDemandStatus: jest.fn().mockResolvedValue({ status: 'pending' }), refresh: jest.fn().mockResolvedValue({ status: 'pending' }) };
    const module = await Test.createTestingModule({ controllers: [TimetableController], providers: [{ provide: TimetableService, useValue: service }] }).compile();
    const controller = module.get(TimetableController); const req = { user: { userId: 'viewer-1' } }; const query = { year: 'y', semester: 's', week: 'w', className: 'a' } as any;
    await expect(controller.demandStatus(req, query)).resolves.toEqual({ status: 'pending' }); await expect(controller.refresh(req, query)).resolves.toEqual({ status: 'pending' });
    expect(service.getDemandStatus).toHaveBeenCalledWith(req.user, query); expect(service.refresh).toHaveBeenCalledWith(req.user, query);
  });
});
