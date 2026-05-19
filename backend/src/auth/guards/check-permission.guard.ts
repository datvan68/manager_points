import { CanActivate, ExecutionContext, ForbiddenException, Injectable, mixin, Type } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Factory function: checkPermission(requiredPermission)
 * 
 * Creates a Guard that checks whether the current user has a specific permission code.
 * The user's permissions are resolved from JWT → JwtStrategy → populate role.permissions.
 * 
 * Usage in Controller:
 *   @UseGuards(checkPermission('STUDENT_READ'))
 *   @Get('students')
 *   findAll() { ... }
 * 
 * Can also accept multiple permissions (ALL required):
 *   @UseGuards(checkPermission('STUDENT_READ', 'STUDENT_CREATE'))
 */
export function checkPermission(...requiredPermissions: string[]): Type<CanActivate> {
  @Injectable()
  class CheckPermissionGuard extends JwtAuthGuard implements CanActivate {
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
          requiredPermissions,
        });
      }

      // Admin bypass: allow all
      if (user.roleName === 'Admin') return true;

      const userPermissions: string[] = user.permissions || [];

      const hasAll = requiredPermissions.every((perm) =>
        userPermissions.includes(perm),
      );

      if (!hasAll) {
        const missing = requiredPermissions.filter(
          (perm) => !userPermissions.includes(perm),
        );
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          message: `Bạn không có quyền thực hiện hành động này. Thiếu quyền: ${missing.join(', ')}`,
          requiredPermissions,
          missingPermissions: missing,
        });
      }

      return true;
    }
  }

  return mixin(CheckPermissionGuard);
}
