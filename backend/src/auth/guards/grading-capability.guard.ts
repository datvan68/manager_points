import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  mixin,
  Type,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  getGradingRole,
  hasGradingCapability,
} from '../utils/grading-access.util';
import { isAdminUser } from '../utils/role.util';

export type GradingCapability = 'read' | 'grade' | 'approve';

export function checkGradingCapability(
  capability: GradingCapability,
): Type<CanActivate> {
  @Injectable()
  class GradingCapabilityGuard extends JwtAuthGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const authenticated = await super.canActivate(context);
      if (!authenticated) return false;

      const request = context.switchToHttp().getRequest();
      const user = request.user;
      if (!user) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Không thể xác thực người dùng',
        });
      }

      if (isAdminUser(user)) return true;

      const role = getGradingRole(user);
      if (
        capability === 'read' &&
        ['admin', 'supervisor', 'teacher', 'student'].includes(role)
      ) {
        return true;
      }
      const legacyAllowed =
        capability === 'grade'
          ? ['supervisor', 'teacher', 'student'].includes(role)
          : capability === 'approve'
            ? role === 'supervisor'
            : false;

      if (
        legacyAllowed ||
        (capability === 'read'
          ? hasGradingCapability(user, 'grade') ||
            hasGradingCapability(user, 'approve')
          : hasGradingCapability(user, capability))
      ) {
        return true;
      }

      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Bạn không có capability chấm điểm phù hợp.',
        requiredCapability: capability,
      });
    }
  }

  return mixin(GradingCapabilityGuard);
}
