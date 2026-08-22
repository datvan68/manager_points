import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ImpersonationService } from '../services/impersonation.service';

@Injectable()
export class StrictAdminGuard implements CanActivate {
  constructor(private readonly impersonationService: ImpersonationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (request.user?.roleCode === 'ADMIN') return true;

    const rawIp =
      request.ip || request.headers?.['x-forwarded-for'] || '0.0.0.0';
    const ip = Array.isArray(rawIp) ? rawIp[0] : rawIp;
    await this.impersonationService.recordGuardDenied(
      request.user?.userId,
      request.body?.target_user_id,
      ip,
    );
    return false;
  }
}
