import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { ActivityAttendanceController } from './activity-attendance.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const guardsFor = (method: string) =>
  (Reflect.getMetadata('__guards__', ActivityAttendanceController.prototype[method]) ||
    Reflect.getMetadata('__guards__', ActivityAttendanceController.prototype, method) || []) as any[];

describe('ActivityAttendanceController permission boundaries', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires schedule registration permission for personal attendance history', async () => {
    const Guard = guardsFor('findMyAttendance')[0];
    const jwtSpy = jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);

    const readOnlyContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { permissions: ['ACTIVITY_ATTENDANCE_READ'] } }),
      }),
    } as any;
    await expect(new Guard().canActivate(readOnlyContext)).rejects.toBeInstanceOf(ForbiddenException);

    const selfServiceContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { permissions: ['ACTIVITY_SCHEDULE_REGISTER'] } }),
      }),
    } as any;
    await expect(new Guard().canActivate(selfServiceContext)).resolves.toBe(true);
    expect(jwtSpy).toHaveBeenCalledTimes(2);
  });
});
