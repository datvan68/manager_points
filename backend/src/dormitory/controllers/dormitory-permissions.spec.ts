import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';

jest.mock('uuid', () => ({ v4: jest.fn(() => 'test-uuid') }));

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { checkPermission } from '../../auth/guards/check-permission.guard';
import { BedsController } from './beds.controller';
import { BuildingsController } from './buildings.controller';
import { ContractsController } from './contracts.controller';
import { DormitoryRosterController } from './dormitory-roster.controller';
import { DormitoryQrController } from './dormitory-qr.controller';
import { MaintenanceController } from './maintenance.controller';
import { RoomsController } from './rooms.controller';
import { ViolationsController } from './violations.controller';

const guardsFor = (controller: any, method: string) =>
  (Reflect.getMetadata('__guards__', controller.prototype[method]) ||
    Reflect.getMetadata('__guards__', controller.prototype, method) || []) as any[];

describe('Dormitory permission boundaries', () => {
  it.each([
    [BuildingsController, 'findAll'],
    [BuildingsController, 'findOne'],
    [RoomsController, 'findAll'],
    [RoomsController, 'findOne'],
    [BedsController, 'findByRoom'],
    [BedsController, 'findOne'],
    [ContractsController, 'findAll'],
    [ContractsController, 'findOne'],
    [DormitoryRosterController, 'findAll'],
    [DormitoryRosterController, 'findOne'],
    [DormitoryRosterController, 'suggestRooms'],
    [MaintenanceController, 'findAll'],
    [MaintenanceController, 'findOne'],
    [ViolationsController, 'findAll'],
    [ViolationsController, 'getStudentSummary'],
    [ViolationsController, 'findOne'],
  ])('%s.%s uses a permission guard', (controller, method) => {
    const guards = guardsFor(controller, method);
    expect(guards.length).toBeGreaterThan(0);
    expect(guards.some((guard) => guard !== JwtAuthGuard)).toBe(true);
  });

  it('leaves QR endpoints public and self-service roster endpoints authenticated', () => {
    expect(guardsFor(DormitoryQrController, 'getRoomByQr')).toHaveLength(0);
    expect(guardsFor(DormitoryQrController, 'publicRegister')).toHaveLength(0);
    expect(guardsFor(DormitoryRosterController, 'findMine').length).toBeGreaterThan(0);
    expect(guardsFor(DormitoryRosterController, 'updateMine').length).toBeGreaterThan(0);
  });

  it('returns 403 before the protected service is invoked, while allowing union and ADMIN users', async () => {
    const original = JwtAuthGuard.prototype.canActivate;
    jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
    const Guard = checkPermission('DORM_BUILDING_READ');
    const guard = new Guard();
    const request = { user: { permissions: [] } };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    request.user.permissions = ['DORM_BUILDING_READ'];
    await expect(guard.canActivate(context)).resolves.toBe(true);
    request.user = { roleCode: 'ADMIN', permissions: [] };
    await expect(guard.canActivate(context)).resolves.toBe(true);
    JwtAuthGuard.prototype.canActivate = original;
  });
});
