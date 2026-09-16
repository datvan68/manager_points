import { Test } from '@nestjs/testing';
import { TimetableController } from './timetable.controller';
import { TimetableAccessGuard, TimetableAdminGuard } from './timetable.controller';
import { TimetableService } from './timetable.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BadRequestException } from '@nestjs/common';
import { TimetableSourceError } from './timetable.types';
import { TimetableSyncService } from './timetable-sync.service';

describe('TimetableController', () => {
  afterEach(() => jest.restoreAllMocks());
  it('forwards bulk lookup through the read permission route', async () => {
    const service = { getBulkTimetable: jest.fn().mockResolvedValue({ results: [], missing: [] }) };
    const controller = new TimetableController(service as any);
    const req = { user: { userId: 'viewer-1' } };
    const body = { selections: [{ year: 'y', semester: 's', week: 'w', className: 'A' }] } as any;
    await expect(controller.getBulkTimetable(req, body)).resolves.toEqual({ results: [], missing: [] });
    expect(service.getBulkTimetable).toHaveBeenCalledWith(req.user, body);
  });
  it('delegates only the authenticated requester context', async () => {
    const service = { getOptions: jest.fn().mockResolvedValue({ years: [] }), getLegacyTimetable: jest.fn() };
    const module = await Test.createTestingModule({ controllers: [TimetableController], providers: [{ provide: TimetableService, useValue: service }] }).compile();
    const controller = module.get(TimetableController);
    await controller.getOptions({ user: { userId: 'viewer-1' } });
    expect(service.getOptions).toHaveBeenCalledWith({ userId: 'viewer-1' }, undefined);
    expect(controller).toBeDefined();
  });

  it('delegates the read-only today route with the authenticated requester', async () => {
    const service = { getTodayForClass: jest.fn().mockResolvedValue({ status: 'empty', lessons: [] }) };
    const module = await Test.createTestingModule({ controllers: [TimetableController], providers: [{ provide: TimetableService, useValue: service }] }).compile();
    const controller = module.get(TimetableController);
    const req = { user: { userId: 'viewer-1' } };
    await expect(controller.getToday(req, '507f1f77bcf86cd799439012')).resolves.toEqual({ status: 'empty', lessons: [] });
    expect(service.getTodayForClass).toHaveBeenCalledWith(req.user, '507f1f77bcf86cd799439012');
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

  it.each([{ roleCode: 'STUDENT' }, { roleCode: 'TEACHER' }, { roleCode: 'USER' }, {}])('blocks snapshot access for non-admin user %j', async (user) => {
    const context = { switchToHttp: () => ({ getRequest: () => ({ user }) }) } as any;
    expect(() => new TimetableAdminGuard().canActivate(context)).toThrow(expect.objectContaining({ response: expect.objectContaining({ statusCode: 403 }) }));
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

  it('delegates admin week status and action routes', async () => {
    const service = { getSavedClassWeekStatus: jest.fn().mockResolvedValue({ status: 'missing' }), startSavedClassWeek: jest.fn().mockResolvedValue({ status: 'pending' }) };
    const module = await Test.createTestingModule({ controllers: [TimetableController], providers: [{ provide: TimetableService, useValue: {} }, { provide: TimetableSyncService, useValue: service }] }).compile();
    const controller = module.get(TimetableController); const req = { user: { roleCode: 'ADMIN' } }; const query = { year: 'y', semester: 's', week: 'w', className: 'a' } as any;
    await expect(controller.getSavedClassWeekStatus(req, query)).resolves.toEqual({ status: 'missing' });
    await expect(controller.startSavedClassWeek(req, { ...query, intent: 'sync' })).resolves.toEqual({ status: 'pending' });
    expect(service.getSavedClassWeekStatus).toHaveBeenCalledWith(req.user, query); expect(service.startSavedClassWeek).toHaveBeenCalledWith(req.user, { ...query, intent: 'sync' });
  });

  it('delegates the validated admin bulk week route', async () => {
    const service = { startSavedClassWeeks: jest.fn().mockResolvedValue({ status: 'running', total: 2 }) };
    const module = await Test.createTestingModule({ controllers: [TimetableController], providers: [{ provide: TimetableService, useValue: {} }, { provide: TimetableSyncService, useValue: service }] }).compile();
    const controller = module.get(TimetableController); const req = { user: { roleCode: 'ADMIN' } }; const body = { selections: [{ systemClassId: 'one', className: 'A', year: '2026', semester: '1', week: 'w1' }] } as any;
    await expect(controller.startSavedClassWeeks(req, body)).resolves.toEqual({ status: 'running', total: 2 });
    expect(service.startSavedClassWeeks).toHaveBeenCalledWith(req.user, body);
  });

  it('delegates the bounded bulk pair status route', async () => {
    const service = { getSavedClassWeeksStatus: jest.fn().mockResolvedValue({ snapshotAt: 'now', items: [] }) };
    const controller = new TimetableController({} as any, service as any);
    const body = { selections: [] };
    await expect(controller.getSavedClassWeeksStatus({ user: { roleCode: 'ADMIN' } }, body as any)).resolves.toEqual({ snapshotAt: 'now', items: [] });
    expect(service.getSavedClassWeeksStatus).toHaveBeenCalledWith({ roleCode: 'ADMIN' }, body);
  });

  it('delegates snapshot listing through the admin route', async () => {
    const service = { listSnapshots: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }) };
    const module = await Test.createTestingModule({ controllers: [TimetableController], providers: [{ provide: TimetableService, useValue: service }] }).compile();
    const controller = module.get(TimetableController); const req = { user: { roleCode: 'ADMIN' } }; const query = { page: 1, limit: 20, year: 'y' } as any;
    await expect(controller.listSnapshots(req, query)).resolves.toMatchObject({ total: 0 });
    expect(service.listSnapshots).toHaveBeenCalledWith(req.user, query);
  });
});
