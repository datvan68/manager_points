import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { ActivitySchedulesController } from './activity-schedules.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const guardsFor = (method: string) =>
  (Reflect.getMetadata('__guards__', ActivitySchedulesController.prototype[method]) || []) as any[];

describe('ActivitySchedulesController authorization', () => {
  it('requires schedule registration permission for register and cancel endpoints', async () => {
    const original = JwtAuthGuard.prototype.canActivate;
    jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { roleCode: 'STUDENT', permissions: ['ACTIVITY_SCHEDULE_READ'] } }),
      }),
    } as any;

    for (const method of ['register', 'cancelRegistration']) {
      const Guard = guardsFor(method)[0];
      await expect(new Guard().canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    }

    JwtAuthGuard.prototype.canActivate = original;
  });
});
