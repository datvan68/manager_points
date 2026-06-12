import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Permissions } from './permissions.decorator';

/**
 * Decorator shorthand for checking JWT and permission codes in controllers.
 * 
 * Usage:
 *   @Get('data')
 *   @RequirePermissions('READ_DATA')
 *   getData() { ... }
 */
export function RequirePermissions(...permissions: string[]) {
  return applyDecorators(
    Permissions(...permissions),
    UseGuards(JwtAuthGuard, PermissionsGuard),
  );
}
