import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserStatus } from '../schemas/user.schema';
import { LoginLog, LoginLogDocument } from '../schemas/login-log.schema';
import { Role, RoleDocument } from '../schemas/role.schema';
import { Permission, PermissionDocument } from '../schemas/permission.schema';
import { PermissionGroup, PermissionGroupDocument } from '../schemas/permission-group.schema';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  AssignRoleDto,
} from '../dto/auth.dto';
import { TokenService } from './token.service';
import { PasswordService } from './password.service';
import { RbacService } from './rbac.service';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(LoginLog.name) private loginLogModel: Model<LoginLogDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(Permission.name) private permissionModel: Model<PermissionDocument>,
    @InjectModel(PermissionGroup.name) private permissionGroupModel: Model<PermissionGroupDocument>,
    private tokenService: TokenService,
    private passwordService: PasswordService,
    private rbacService: RbacService,
  ) {}

  async onModuleInit() {
    await this.seedRbac();
    await this.migrateLegacyRoles();
    await this.migrateLegacyUserFields();
  }

  // ─── AUTHENTICATION ─────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existingUsername = await this.userModel.findOne({ user_name: dto.user_name });
    if (existingUsername) throw new ConflictException('Username đã tồn tại');

    const existingEmail = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (existingEmail) throw new ConflictException('Email đã được sử dụng');

    const pw_hash = await this.passwordService.hashPassword(dto.password);
    const defaultRole = await this.roleModel.findOne({ name: 'User' });
    
    await this.userModel.create({
      user_name: dto.user_name,
      email: dto.email.toLowerCase(),
      pw_hash,
      status: UserStatus.ACTIVE,
      role: defaultRole?._id,
    });

    return { message: 'Account created successfully' };
  }

  async login(dto: LoginDto, ip: string) {
    const user = await this.userModel.findOne({ email: dto.email.toLowerCase() }).populate('role');

    if (!user) {
      await this.logAction(null, ip, 'login_failure', `User not found: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account lock
    if (user.status === UserStatus.LOCKED && user.locked_until) {
      if (new Date() < new Date(user.locked_until)) {
        const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
        throw new ForbiddenException(`Tài khoản bị khóa. Vui lòng thử lại sau ${minutesLeft} phút.`);
      }
      user.status = UserStatus.ACTIVE;
      user.failed_login_attempts = 0;
      user.locked_until = null;
      await user.save();
    }

    const passwordHash = user.pw_hash || (user as any).password_hash;
    const isPasswordValid = await this.passwordService.comparePassword(dto.password, passwordHash || '');
    if (!isPasswordValid) {
      user.failed_login_attempts += 1;
      if (user.failed_login_attempts >= MAX_LOGIN_ATTEMPTS) {
        user.status = UserStatus.LOCKED;
        user.locked_until = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
        await user.save();
        await this.logAction(user._id as Types.ObjectId, ip, 'login_failure', 'Account locked');
        throw new ForbiddenException(`Tài khoản đã bị khóa. Thử lại sau ${LOCK_DURATION_MINUTES} phút.`);
      }
      await user.save();
      await this.logAction(user._id as Types.ObjectId, ip, 'login_failure', 'Wrong password');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Success
    user.failed_login_attempts = 0;
    user.locked_until = null;
    await user.save();

    const role = user.role as any;
    const isAdmin = role?.name === 'Admin';
    
    let rtExpirationDays = isAdmin ? 1/6 : (dto.remember ? 30 : 1);

    const payload = { user_id: (user._id as Types.ObjectId).toString() };
    const access_token = this.tokenService.generateAccessToken(payload);
    const refresh_token = await this.tokenService.createRefreshToken(user._id as Types.ObjectId, rtExpirationDays);

    await this.logAction(user._id as Types.ObjectId, ip, 'login_success', `Remember: ${!!dto.remember}`);

    return {
      access_token,
      refresh_token,
      user: {
        id: (user._id as Types.ObjectId).toString(),
        username: user.user_name,
        role: role?.name || 'User'
      },
    };
  }

  // ─── PASSWORD WRAPPERS ──────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto, ip: string) {
    const result = await this.passwordService.forgotPassword(dto);
    if (result.userId) {
      await this.logAction(result.userId as Types.ObjectId, ip, 'password_reset', 'Reset token generated');
    }
    return { message: result.message };
  }

  async resetPassword(dto: ResetPasswordDto, ip: string) {
    const result = await this.passwordService.resetPassword(dto);
    await this.logAction(result.userId as Types.ObjectId, ip, 'password_reset', 'Completed');
    return { message: 'Password updated successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto, ip: string) {
    const result = await this.passwordService.changePassword(userId, dto);
    await this.logAction(result.userId as Types.ObjectId, ip, 'password_change', 'Updated by user');
    return { message: 'Password updated successfully' };
  }

  // ─── TOKEN WRAPPERS ─────────────────────────────────────────

  async refreshToken(token: string) {
    return this.tokenService.refreshToken(token);
  }

  async revokeToken(token: string) {
    return this.tokenService.revokeToken(token);
  }

  // ─── RBAC WRAPPERS ──────────────────────────────────────────

  async getRoles() { return this.rbacService.getRoles(); }
  async getPermissions() { return this.rbacService.getPermissions(); }
  async createPermission(dto: any) { return this.rbacService.createPermission(dto); }
  async updatePermission(id: string, dto: any) { return this.rbacService.updatePermission(id, dto); }
  async deletePermission(id: string) { return this.rbacService.deletePermission(id); }
  async getPermissionGroups() { return this.rbacService.getPermissionGroups(); }
  async createPermissionGroup(dto: any) { return this.rbacService.createPermissionGroup(dto); }
  async updatePermissionGroup(id: string, dto: any) { return this.rbacService.updatePermissionGroup(id, dto); }
  async deletePermissionGroup(id: string) { return this.rbacService.deletePermissionGroup(id); }
  async createRole(dto: any) { return this.rbacService.createRole(dto); }
  async updateRole(id: string, dto: any) { return this.rbacService.updateRole(id, dto); }
  async deleteRole(id: string) { return this.rbacService.deleteRole(id); }
  async assignRole(userId: string, dto: AssignRoleDto) { return this.rbacService.assignRole(userId, dto); }

  // ─── USER MANAGEMENT ──────────────────────────

  async getUsers() {
    return this.userModel.find().populate('role').select('-pw_hash');
  }

  async deleteUser(userId: string) {
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('ID người dùng không hợp lệ');
    const result = await this.userModel.deleteOne({ _id: userId });
    if (result.deletedCount === 0) throw new BadRequestException('Người dùng không tồn tại');
    return { message: 'Xóa người dùng thành công' };
  }

  // ─── INTERNAL LOGGING ───────────────────────────────────────

  private async logAction(userId: Types.ObjectId | null, ip: string, action: string, details: string | null) {
    await this.loginLogModel.create({
      user_id: userId,
      ip_address: ip,
      action,
      login_time: new Date(),
      details: details || undefined,
    });
  }

  // ─── SEEDING & MIGRATION ────────────────────────────────────

  private async seedRbac() {
    const permissionsCount = await this.permissionModel.countDocuments();
    const rolesCount = await this.roleModel.countDocuments();
    const groupsCount = await this.permissionGroupModel.countDocuments();
    
    if (permissionsCount > 0 && rolesCount > 0 && groupsCount > 0) return;

    const permissions = [
      { code: 'view_course', name: 'Xem danh sách khóa học', module: 'Quản lý Đào tạo (Academic)' },
      { code: 'create_course', name: 'Tạo mới khóa học', module: 'Quản lý Đào tạo (Academic)' },
      { code: 'edit_content', name: 'Chỉnh sửa nội dung', module: 'Quản lý Đào tạo (Academic)' },
      { code: 'delete_course', name: 'Xóa khóa học', module: 'Quản lý Đào tạo (Academic)' },
      { code: 'view_users', name: 'Xem danh sách người dùng', module: 'Quản lý Người dùng (Users)' },
      { code: 'reset_pwd', name: 'Reset mật khẩu', module: 'Quản lý Người dùng (Users)' },
      { code: 'STUDENT_READ', name: 'Xem sinh viên', module: 'Quản lý Đào tạo (Academic)' },
      { code: 'STUDENT_CREATE', name: 'Tạo sinh viên', module: 'Quản lý Đào tạo (Academic)' },
      { code: 'ADMIN_FULL', name: 'Toàn quyền Admin', module: 'Hệ thống' },
      { code: 'view_revenue', name: 'Xem báo cáo doanh thu', module: 'Tài chính & Kế toán (Finance)' },
    ];

    const createdPerms: Record<string, Types.ObjectId> = {};
    for (const p of permissions) {
      const perm = await this.permissionModel.findOneAndUpdate(
        { code: p.code },
        { $set: p },
        { upsert: true, new: true }
      );
      createdPerms[p.code] = perm._id as Types.ObjectId;
    }

    const roles = [
      { name: 'Admin', description: 'Toàn quyền truy cập hệ thống', permissions: Object.values(createdPerms) },
      { name: 'Giảng viên chính', description: 'Quản lý lớp học và điểm số', permissions: [createdPerms['view_course'], createdPerms['STUDENT_READ'], createdPerms['view_users']] },
      { name: 'User', description: 'Người dùng cơ bản', permissions: [createdPerms['view_course']] },
    ];

    for (const r of roles) {
      await this.roleModel.findOneAndUpdate({ name: r.name }, { $set: r }, { upsert: true });
    }

    const groups = [
      { code: 'G_SYSTEM', name: 'Hệ thống', description: 'Các quyền quản trị hệ thống cốt lõi', permissions: [createdPerms['ADMIN_FULL']] },
      { code: 'G_ACADEMIC', name: 'Quản lý Đào tạo', description: 'Các quyền liên quan đến khóa học và sinh viên', permissions: [createdPerms['view_course'], createdPerms['create_course'], createdPerms['edit_content'], createdPerms['delete_course'], createdPerms['STUDENT_READ'], createdPerms['STUDENT_CREATE']] },
      { code: 'G_USER', name: 'Quản lý Người dùng', description: 'Các quyền liên quan đến tài khoản và phân quyền', permissions: [createdPerms['view_users'], createdPerms['reset_pwd']] },
    ];

    for (const g of groups) {
      const validPerms = g.permissions.filter(p => !!p);
      await this.permissionGroupModel.findOneAndUpdate({ code: g.code }, { $set: { ...g, permissions: validPerms } }, { upsert: true });
    }

    console.log('✅ RBAC Data Seeded Successfully');
  }

  private async migrateLegacyRoles() {
    const adminRole = await this.roleModel.findOne({ name: 'Admin' });
    const userRole = await this.roleModel.findOne({ name: 'User' });

    const usersToFix = await (this.userModel as any).find({
      role: { $not: { $type: 'objectId' } }
    });

    if (usersToFix.length > 0) {
      for (const user of usersToFix) {
        const roleStr = String(user.role).toLowerCase();
        if (roleStr === 'admin' && adminRole) {
          user.role = adminRole._id;
        } else if (roleStr === 'user' && userRole) {
          user.role = userRole._id;
        } else if (userRole) {
          user.role = userRole._id;
        }
        await user.save();
      }
      console.log(`✅ Successfully migrated ${usersToFix.length} users.`);
    }
  }

  private async migrateLegacyUserFields() {
    const usersToFix = await this.userModel.find({
      $or: [
        { pw_hash: { $exists: false } },
        { user_name: { $exists: false } }
      ]
    } as any).lean();

    if (usersToFix.length > 0) {
      let migratedCount = 0;
      for (const rawUser of usersToFix) {
        const updateDoc: any = {};
        const legacyUser = rawUser as any;
        
        if (!legacyUser.pw_hash && legacyUser.password_hash) {
          updateDoc.pw_hash = legacyUser.password_hash;
        }
        if (!legacyUser.user_name && legacyUser.username) {
          updateDoc.user_name = legacyUser.username;
        }

        if (Object.keys(updateDoc).length > 0) {
          await this.userModel.updateOne(
            { _id: rawUser._id },
            { 
              $set: updateDoc,
              $unset: { username: "", password_hash: "" }
            }
          );
          migratedCount++;
        }
      }
      if (migratedCount > 0) {
        console.log(`✅ Successfully migrated fields (pw_hash/user_name) for ${migratedCount} legacy users.`);
      }
    }

    const cleanupResult = await this.userModel.updateMany(
      {
        $or: [
          { username: { $exists: true } },
          { password_hash: { $exists: true } }
        ]
      } as any,
      {
        $unset: { username: "", password_hash: "" }
      }
    );
    if (cleanupResult.modifiedCount > 0) {
      console.log(`🧹 Cleaned up legacy fields (username/password_hash) for ${cleanupResult.modifiedCount} users.`);
    }
  }
}
