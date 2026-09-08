import { SystemController } from './system.controller';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';

describe('SystemController student highlights', () => {
  it('passes the authenticated requester and validated query to the service', async () => {
    const service = { getStudentHighlights: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, hasMore: false, semesterId: null }) } as any;
    const controller = new SystemController(service);
    const query = { category: 'discipline', page: 1, limit: 20 } as any;
    const requester = { userId: 'user-1', roleName: 'Teacher' } as any;
    await expect(controller.getStudentHighlights(query, { user: requester } as any)).resolves.toEqual(expect.objectContaining({ total: 0, hasMore: false }));
    expect(service.getStudentHighlights).toHaveBeenCalledWith(requester, query);
  });

  it('requires READ_STUDENT_RECORD before the handler can reach the service', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, SystemController.prototype.getStudentHighlights)).toEqual(['READ_STUDENT_RECORD']);
    const guard = new PermissionsGuard(new Reflector());
    const context = {
      getHandler: () => SystemController.prototype.getStudentHighlights,
      getClass: () => SystemController,
      switchToHttp: () => ({ getRequest: () => ({ user: { roleName: 'Supervisor', permissions: [] } }) }),
    } as any;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
