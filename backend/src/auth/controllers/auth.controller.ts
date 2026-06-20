import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Param,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { CookieOptions, Response, Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Permissions } from '../decorators/permissions.decorator';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  CreateRoleDto,
  UpdateRoleDto,
  AssignRoleDto,
  CreatePermissionDto,
  UpdatePermissionDto,
  CreatePermissionGroupDto,
  UpdatePermissionGroupDto,
  CreateRoutePermissionDto,
  UpdateRoutePermissionDto,
  UpdateUserDto,
  UpdateMeDto,
  CreateUserDto,
  BulkCreateUsersDto,
} from '../dto/auth.dto';

import { isAdminUser } from '../utils/role.util';

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth';

function getRefreshCookieOptions(maxAge?: number): CookieOptions {
  const secureEnv = process.env.AUTH_COOKIE_SECURE;
  const secure =
    secureEnv === 'true'
      ? true
      : secureEnv === 'false'
        ? false
        : process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: REFRESH_COOKIE_PATH,
    ...(typeof maxAge === 'number' ? { maxAge } : {}),
  };
}

@ApiTags('Authentication & RBAC')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── AUTHENTICATION ─────────────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new account' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.headers?.['x-forwarded-for'] || '0.0.0.0';
    const result = await this.authService.login(dto, ip);

    const isAdmin = result.user.role === 'Admin';
    const cookieMaxAge = isAdmin
      ? 4 * 60 * 60 * 1000 // 4 hours for admin
      : dto.remember
        ? 30 * 24 * 60 * 60 * 1000 // 30 days for user with remember
        : 24 * 60 * 60 * 1000; // 24 hours for user without remember

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refresh_token,
      getRefreshCookieOptions(cookieMaxAge),
    );

    // Don't send RT back in body for security
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { refresh_token, ...response } = result;
    return response;
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset link' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: any) {
    const ip = req.ip || req.headers?.['x-forwarded-for'] || '0.0.0.0';
    return this.authService.forgotPassword(dto, ip);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a token' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: any) {
    const ip = req.ip || req.headers?.['x-forwarded-for'] || '0.0.0.0';
    return this.authService.resetPassword(dto, ip);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password' })
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    const ip = req.ip || req.headers?.['x-forwarded-for'] || '0.0.0.0';
    const userId = req.user.userId;
    return this.authService.changePassword(userId, dto, ip);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    const origin = req.headers.origin || req.headers.referer || 'unknown';
    
    console.log(`[Auth/Refresh] Request from origin: ${origin}, route: ${req.path}`);
    if (!token) {
      console.warn(`[Auth/Refresh] Missing refresh_token cookie`);
      throw new UnauthorizedException('Phiên làm việc đã kết thúc');
    } else {
      console.log(`[Auth/Refresh] Received refresh_token cookie: ***REDACTED***`);
    }

    const result = await this.authService.refreshToken(token);

    const maxAge = Math.max(0, new Date(result.expires_at).getTime() - Date.now());

    // Rotate Cookie
    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refresh_token,
      getRefreshCookieOptions(maxAge),
    );

    return { access_token: result.access_token };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and clear session' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    const rawIp = req.ip || req.headers?.['x-forwarded-for'] || '0.0.0.0';
    const ip = Array.isArray(rawIp) ? rawIp[0] : rawIp;
    if (token) {
      await this.authService.revokeToken(token, ip);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
    return { message: 'Logged out successfully' };
  }

  // ─── CURRENT USER PROFILE ──────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile with permissions' })
  async getMe(@Req() req: any) {
    return this.authService.getMe(req.user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  async updateMe(@Req() req: any, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(req.user.userId, dto);
  }

  // ─── ROLE & PERMISSION MANAGEMENT (ADMIN ONLY) ──────────────

  @Get('roles')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all roles (Admin only)' })
  async getRoles() {
    return this.authService.getRoles();
  }

  @Get('permissions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all permissions (Admin only)' })
  async getPermissions() {
    return this.authService.getPermissions();
  }

  @Post('permissions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new permission (Admin only)' })
  async createPermission(@Body() dto: CreatePermissionDto) {
    return this.authService.createPermission(dto);
  }

  @Patch('permissions/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Permission ID' })
  @ApiOperation({ summary: 'Update a permission (Admin only)' })
  async updatePermission(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.authService.updatePermission(id, dto);
  }

  @Delete('permissions/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Permission ID' })
  @ApiOperation({ summary: 'Delete a permission (Admin only)' })
  async deletePermission(@Param('id') id: string) {
    return this.authService.deletePermission(id);
  }

  // ─── PERMISSION GROUP MANAGEMENT (ADMIN ONLY) ──────────────

  @Get('permission-groups')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all permission groups (Admin only)' })
  async getPermissionGroups() {
    return this.authService.getPermissionGroups();
  }

  @Post('permission-groups')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new permission group (Admin only)' })
  async createPermissionGroup(@Body() dto: CreatePermissionGroupDto) {
    return this.authService.createPermissionGroup(dto);
  }

  @Patch('permission-groups/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiOperation({ summary: 'Update a permission group (Admin only)' })
  async updatePermissionGroup(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionGroupDto,
  ) {
    return this.authService.updatePermissionGroup(id, dto);
  }

  @Delete('permission-groups/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiOperation({ summary: 'Delete a permission group (Admin only)' })
  async deletePermissionGroup(@Param('id') id: string) {
    return this.authService.deletePermissionGroup(id);
  }

  @Post('roles')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new role (Admin only)' })
  async createRole(@Body() dto: CreateRoleDto) {
    return this.authService.createRole(dto);
  }

  @Patch('roles/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiOperation({ summary: 'Update a role (Admin only)' })
  async updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.authService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiOperation({ summary: 'Delete a role (Admin only)' })
  async deleteRole(@Param('id') id: string) {
    return this.authService.deleteRole(id);
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOperation({ summary: 'Assign a role to a user (Admin only)' })
  async assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.authService.assignRole(id, dto);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  async getUsers() {
    return this.authService.getUsers();
  }

  @Post('users')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a single user (Admin only)' })
  async createUser(@Body() dto: CreateUserDto, @Req() req: any) {
    const ip = req.ip || req.headers?.['x-forwarded-for'] || '0.0.0.0';
    return this.authService.createUser(dto, ip);
  }

  @Post('users/bulk-create')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create multiple users (Admin only)' })
  async createUsersBulk(@Body() dto: BulkCreateUsersDto, @Req() req: any) {
    const ip = req.ip || req.headers?.['x-forwarded-for'] || '0.0.0.0';
    return this.authService.createUsersBulk(dto, ip);
  }

  @Patch('users/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOperation({ summary: 'Update a user (Admin only)' })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) {
    const ip = req.ip || req.headers?.['x-forwarded-for'] || '0.0.0.0';
    return this.authService.updateUser(id, dto, ip);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOperation({ summary: 'Delete a user (Admin only)' })
  async deleteUser(@Param('id') id: string) {
    return this.authService.deleteUser(id);
  }

  @Post('users/bulk-delete')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete multiple users (Admin only)' })
  async deleteUsersBulk(@Body('userIds') userIds: string[]) {
    return this.authService.deleteUsersBulk(userIds);
  }

  // ─── ROUTE PERMISSION MANAGEMENT (ADMIN ONLY) ─────────

  @Get('page-permission-scopes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all page-permission action scopes (requires login)' })
  async getPagePermissionScopes() {
    return this.authService.getPagePermissionScopes();
  }

  @Get('route-permissions/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all route-permission mappings (requires login for RouteGuard)',
  })
  async getRoutePermissionsPublic() {
    const list = await this.authService.getRoutePermissions();
    return list.map((item: any) => ({
      route_path: item.route_path,
      permissions: item.permissions?.map((p: any) => p.code) || [],
      check_type: item.check_type,
      type: item.type,
      is_active: item.is_active,
    }));
  }

  @Get('route-permissions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all route-permission mappings (Admin only)' })
  async getRoutePermissions() {
    return this.authService.getRoutePermissions();
  }

  @Get('route-permissions/check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check permission for a specific route' })
  async checkRoutePermission(@Req() req: any) {
    const routePath = req.query.route as string;
    if (!routePath) return { allowed: true };

    const mapping = await this.authService.getRoutePermissionByRoute(routePath);
    if (!mapping)
      return { allowed: true, message: 'Route không được cấu hình' };

    const user = req.user;
    if (isAdminUser(user)) return { allowed: true };

    const userPermissions: string[] = user.permissions || [];
    const requiredCodes = (mapping.permissions as any[]).map(
      (p: any) => p.code,
    );

    const allowed =
      mapping.check_type === 'any'
        ? requiredCodes.some((code) => userPermissions.includes(code))
        : requiredCodes.every((code) => userPermissions.includes(code));

    return {
      allowed,
      route: routePath,
      required: requiredCodes,
      check_type: mapping.check_type,
    };
  }

  @Post('route-permissions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a route-permission mapping (Admin only)' })
  async createRoutePermission(@Body() dto: CreateRoutePermissionDto) {
    return this.authService.createRoutePermission(dto);
  }

  @Patch('route-permissions/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Route Permission ID' })
  @ApiOperation({ summary: 'Update a route-permission mapping (Admin only)' })
  async updateRoutePermission(
    @Param('id') id: string,
    @Body() dto: UpdateRoutePermissionDto,
  ) {
    return this.authService.updateRoutePermission(id, dto);
  }

  @Delete('route-permissions/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Route Permission ID' })
  @ApiOperation({ summary: 'Delete a route-permission mapping (Admin only)' })
  async deleteRoutePermission(@Param('id') id: string) {
    return this.authService.deleteRoutePermission(id);
  }
}

