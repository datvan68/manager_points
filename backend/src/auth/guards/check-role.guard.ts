import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  mixin,
  Type,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Factory function: checkRole(...allowedRoles)
 *
 * Creates a Guard that checks whether the current user has one of the allowed role names.
 *
 * Usage in Controller:
 *   @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
 */
export function checkRole(
  ...allowedRoles: string[]
): Type<CanActivate> {
  @Injectable()
  class CheckRoleGuard extends JwtAuthGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
      // First, run JWT authentication
      const isAuthenticated = await super.canActivate(context);
      if (!isAuthenticated) return false;

      const request = context.switchToHttp().getRequest();
      const user = request.user;

      if (!user) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Không thể xác thực người dùng',
        });
      }

      // Admin bypass: allow all
      if (user.roleName === 'Admin') return true;

      const userRole = user.roleName || 'Student';

      const isAllowed = allowedRoles.includes(userRole);

      if (!isAllowed) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          message: `Bạn không có vai trò phù hợp để thực hiện hành động này. Yêu cầu một trong các vai trò: ${allowedRoles.join(', ')}`,
          userRole,
          allowedRoles,
        });
      }

      return true;
    }
  }

  return mixin(CheckRoleGuard);
}
