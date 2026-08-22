import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  IMPERSONATION_CHAINING_DENIAL_REASON,
  ImpersonationService,
} from '../services/impersonation.service';

@Injectable()
export class StrictAdminGuard implements CanActivate {
  constructor(private readonly impersonationService: ImpersonationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawIp =
      request.ip || request.headers?.['x-forwarded-for'] || '0.0.0.0';
    const ip = Array.isArray(rawIp) ? rawIp[0] : rawIp;

    if (request.user?.impersonationSessionId) {
      await this.impersonationService.recordGuardDenied(
        request.user?.userId,
        request.body?.target_user_id,
        ip,
        IMPERSONATION_CHAINING_DENIAL_REASON,
      );
      return false;
    }

    if (request.user?.roleCode === 'ADMIN') return true;

    await this.impersonationService.recordGuardDenied(
      request.user?.userId,
      request.body?.target_user_id,
      ip,
    );
    return false;
  }
}
