import { ExecutionContext } from '@nestjs/common';
import { StrictAdminGuard } from './strict-admin.guard';
import {
  IMPERSONATION_CHAINING_DENIAL_REASON,
} from '../services/impersonation.service';

function contextFor(request: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('StrictAdminGuard', () => {
  it('rejects an impersonated request even when the subject is currently ADMIN', async () => {
    const recordGuardDenied = jest.fn().mockResolvedValue(undefined);
    const guard = new StrictAdminGuard({ recordGuardDenied } as any);

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            userId: 'subject-id',
            roleCode: 'ADMIN',
            impersonationSessionId: 'session-id',
          },
          body: { target_user_id: 'target-id' },
          ip: '127.0.0.1',
        }),
      ),
    ).resolves.toBe(false);

    expect(recordGuardDenied).toHaveBeenCalledWith(
      'subject-id',
      'target-id',
      '127.0.0.1',
      IMPERSONATION_CHAINING_DENIAL_REASON,
    );
  });

  it('allows an ordinary persisted ADMIN and still denies ADMIN_FULL-only users', async () => {
    const recordGuardDenied = jest.fn().mockResolvedValue(undefined);
    const guard = new StrictAdminGuard({ recordGuardDenied } as any);

    await expect(
      guard.canActivate(
        contextFor({ user: { userId: 'admin-id', roleCode: 'ADMIN' } }),
      ),
    ).resolves.toBe(true);
    expect(recordGuardDenied).not.toHaveBeenCalled();

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            userId: 'manager-id',
            roleCode: 'USER',
            permissions: ['ADMIN_FULL'],
          },
          ip: '127.0.0.1',
        }),
      ),
    ).resolves.toBe(false);
    expect(recordGuardDenied).toHaveBeenCalledWith(
      'manager-id',
      undefined,
      '127.0.0.1',
    );
  });
});
