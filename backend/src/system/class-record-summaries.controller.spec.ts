import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemController } from './system.controller';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';

describe('SystemController class record summaries', () => {
  it('passes the requester and query to the service', async () => {
    const service = {
      getClassRecordSummaries: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    } as any;
    const controller = new SystemController(service);
    const query = { semesterId: 'sem-1', page: 1, limit: 20 } as any;
    const requester = { userId: 'teacher-1', roleName: 'Teacher', permissions: ['READ_STUDENT_RECORD'] } as any;

    await expect(controller.getClassRecordSummaries(query, { user: requester } as any))
      .resolves.toEqual(expect.objectContaining({ total: 0 }));
    expect(service.getClassRecordSummaries).toHaveBeenCalledWith(requester, query);
  });

  it('requires READ_STUDENT_RECORD before the handler can reach the service', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, SystemController.prototype.getClassRecordSummaries))
      .toEqual(['READ_STUDENT_RECORD']);
    const guard = new PermissionsGuard(new Reflector());
    const context = {
      getHandler: () => SystemController.prototype.getClassRecordSummaries,
      getClass: () => SystemController,
      switchToHttp: () => ({ getRequest: () => ({ user: { roleName: 'Teacher', permissions: [] } }) }),
    } as any;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
