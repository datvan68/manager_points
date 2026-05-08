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
import type { Response, Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
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
  RefreshTokenDto,
  CreateRoleDto,
  UpdateRoleDto,
  AssignRoleDto,
  CreatePermissionDto,
  UpdatePermissionDto,
  CreatePermissionGroupDto,
  UpdatePermissionGroupDto,
} from '../dto/auth.dto';

@ApiTags('Authentication & RBAC')
@Controller('api/auth')
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
  async login(@Body() dto: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip || req.headers?.['x-forwarded-for'] || '0.0.0.0';
    const result = await this.authService.login(dto, ip);
    
    // Determine cookie expiration based on token expiration
    // Note: Admin gets 4h, User with Remember gets 30d (Handled in Service)
    // We can just set a long-lived cookie or session cookie
    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth', // Restricted to auth paths
      maxAge: dto.remember ? 30 * 24 * 60 * 60 * 1000 : undefined, // session cookie if not remember
    });

    // Don't send RT back in body for security
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
  async refreshToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.['refresh_token'];
    if (!token) throw new UnauthorizedException('Phiên làm việc đã kết thúc');

    const result = await this.authService.refreshToken(token);

    // Rotate Cookie
    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
    });

    return { access_token: result.access_token };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and clear session' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.['refresh_token'];
    if (token) {
      await this.authService.revokeToken(token);
    }
    res.clearCookie('refresh_token', { path: '/api/auth' });
    return { message: 'Logged out successfully' };
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
  async updatePermission(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
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
  async updatePermissionGroup(@Param('id') id: string, @Body() dto: UpdatePermissionGroupDto) {
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

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOperation({ summary: 'Delete a user (Admin only)' })
  async deleteUser(@Param('id') id: string) {
    return this.authService.deleteUser(id);
  }
}
