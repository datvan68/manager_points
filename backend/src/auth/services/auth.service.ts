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
import { Student } from '../../students/schemas/student.schema';
import { LoginLog, LoginLogDocument } from '../schemas/login-log.schema';
import { Role, RoleDocument } from '../schemas/role.schema';
import { Permission, PermissionDocument } from '../schemas/permission.schema';
import {
  PermissionGroup,
  PermissionGroupDocument,
} from '../schemas/permission-group.schema';
import {
  RoutePermission,
  RoutePermissionDocument,
} from '../schemas/route-permission.schema';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  AssignRoleDto,
  UpdateUserDto,
  UpdateMeDto,
} from '../dto/auth.dto';
import { TokenService } from './token.service';
import { PasswordService } from './password.service';
import { RbacService } from './rbac.service';
import {
  DECLARED_PERMISSION_SEEDS,
  UNGROUPED_PERMISSION_GROUP,
} from '../permissions.registry';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
const INVALID_LOGIN_MESSAGE = 'Tài khoản hoặc mật khẩu không chính xác.';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(LoginLog.name) private loginLogModel: Model<LoginLogDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(Permission.name)
    private permissionModel: Model<PermissionDocument>,
    @InjectModel(PermissionGroup.name)
    private permissionGroupModel: Model<PermissionGroupDocument>,
    @InjectModel(RoutePermission.name)
    private routePermissionModel: Model<RoutePermissionDocument>,
    @InjectModel(Student.name) private studentModel: Model<any>,
    private tokenService: TokenService,
    private passwordService: PasswordService,
    private rbacService: RbacService,
  ) {}

  async onModuleInit() {
    await this.migrateLegacyRoleCodes();
    await this.seedDeclaredPermissions();
    await this.seedRbac();
    await this.seedSystemAdmin();
    await this.migrateLegacyRoles();
    await this.migrateLegacyUserFields();
  }

  // ─── AUTHENTICATION ─────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existingUsername = await this.userModel.findOne({
      user_name: dto.user_name,
    });
    if (existingUsername) throw new ConflictException('Username đã tồn tại');

    const existingEmail = await this.userModel.findOne({
      email: dto.email.toLowerCase(),
    });
    if (existingEmail) throw new ConflictException('Email đã được sử dụng');

    const pw_hash = await this.passwordService.hashPassword(dto.password);
    const defaultRole = await this.roleModel.findOne({ name: 'User' }) || await this.roleModel.findOne({ name: 'Student' });

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
    const loginKey = dto.email.trim();
    const isStudentCode = /^\d+$/.test(loginKey);
    const studentEmail = isStudentCode ? `${loginKey}@school.edu.vn` : loginKey;

    const user = await this.userModel
      .findOne({
        $or: [{ email: studentEmail.toLowerCase() }, { user_name: loginKey }],
      })
      .populate('role')
      .exec();

    if (!user) {
      await this.logAction(
        null,
        ip,
        'login_failure',
        `User not found: ${dto.email}`,
      );
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }

    if (user.status === UserStatus.INACTIVE) {
      await this.logAction(
        user._id,
        ip,
        'login_failure',
        `Inactive user login attempt: ${dto.email}`,
      );
      throw new ForbiddenException('Tài khoản chưa được kích hoạt bởi quản trị viên.');
    }

    // Check account lock
    if (user.status === UserStatus.LOCKED) {
      if (user.locked_until) {
        if (new Date() < new Date(user.locked_until)) {
          const minutesLeft = Math.ceil(
            (new Date(user.locked_until).getTime() - Date.now()) / 60000,
          );
          throw new ForbiddenException(
            `Tài khoản bị khóa. Vui lòng thử lại sau ${minutesLeft} phút.`,
          );
        }
        user.status = UserStatus.ACTIVE;
        user.failed_login_attempts = 0;
        user.locked_until = null;
        await user.save();
      } else {
        throw new ForbiddenException('Tài khoản đã bị khóa bởi quản trị viên.');
      }
    }

    const passwordHash = user.pw_hash || (user as any).password_hash;
    const isPasswordValid = await this.passwordService.comparePassword(
      dto.password,
      passwordHash || '',
    );
    if (!isPasswordValid) {
      user.failed_login_attempts += 1;
      if (user.failed_login_attempts >= MAX_LOGIN_ATTEMPTS) {
        user.status = UserStatus.LOCKED;
        user.locked_until = new Date(
          Date.now() + LOCK_DURATION_MINUTES * 60 * 1000,
        );
        await user.save();
        await this.logAction(user._id, ip, 'login_failure', 'Account locked');
        throw new ForbiddenException(
          `Tài khoản đã bị khóa. Thử lại sau ${LOCK_DURATION_MINUTES} phút.`,
        );
      }
      await user.save();
      await this.logAction(user._id, ip, 'login_failure', 'Wrong password');
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }

    // Success
    user.failed_login_attempts = 0;
    user.locked_until = null;
    await user.save();

    const role = user.role as any;
    const isAdmin = role?.name === 'Admin';

    const rtExpirationDays = isAdmin ? 1 / 6 : dto.remember ? 30 : 1;

    const payload = { user_id: user._id.toString() };
    const access_token = this.tokenService.generateAccessToken(payload);
    const refresh_token = await this.tokenService.createRefreshToken(
      user._id,
      rtExpirationDays,
    );

    await this.logAction(
      user._id,
      ip,
      'login_success',
      `Remember: ${!!dto.remember}`,
    );

    const student = await this.studentModel.findOne({ user_id: user._id }).exec();
    const displayName = student ? student.full_name : user.user_name;

    return {
      access_token,
      refresh_token,
      user: {
        id: user._id.toString(),
        username: user.user_name,
        display_name: displayName,
        role: role?.name || 'User',
      },
    };
  }

  // ─── PASSWORD WRAPPERS ──────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto, ip: string) {
    const result = await this.passwordService.forgotPassword(dto, ip);
    if (result.userId) {
      await this.logAction(
        result.userId,
        ip,
        'password_reset',
        'Reset token generated',
      );
    }
    return { message: result.message };
  }

  async resetPassword(dto: ResetPasswordDto, ip: string) {
    const result = await this.passwordService.resetPassword(dto);
    await this.logAction(result.userId, ip, 'password_reset', 'Completed');
    return { message: 'Đặt lại mật khẩu thành công' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto, ip: string) {
    const result = await this.passwordService.changePassword(userId, dto);
    await this.logAction(
      result.userId,
      ip,
      'password_change',
      'Updated by user',
    );
    return { message: 'Đổi mật khẩu thành công' };
  }

  // ─── TOKEN WRAPPERS ─────────────────────────────────────────

  async refreshToken(token: string) {
    return this.tokenService.refreshToken(token);
  }

  async revokeToken(token: string, ip?: string) {
    if (ip) {
      const storedToken = await this.tokenService.findToken(token);
      if (storedToken) {
        await this.logAction(storedToken.user_id, ip, 'logout', 'Logged out by user');
      }
    }
    return this.tokenService.revokeToken(token);
  }

  // ─── RBAC WRAPPERS ──────────────────────────────────────────

  async getRoles() {
    return this.rbacService.getRoles();
  }
  async getPermissions() {
    return this.rbacService.getPermissions();
  }
  async createPermission(dto: any) {
    return this.rbacService.createPermission(dto);
  }
  async updatePermission(id: string, dto: any) {
    return this.rbacService.updatePermission(id, dto);
  }
  async deletePermission(id: string) {
    return this.rbacService.deletePermission(id);
  }
  async getPermissionGroups() {
    return this.rbacService.getPermissionGroups();
  }
  async createPermissionGroup(dto: any) {
    return this.rbacService.createPermissionGroup(dto);
  }
  async updatePermissionGroup(id: string, dto: any) {
    return this.rbacService.updatePermissionGroup(id, dto);
  }
  async deletePermissionGroup(id: string) {
    return this.rbacService.deletePermissionGroup(id);
  }
  async createRole(dto: any) {
    return this.rbacService.createRole(dto);
  }
  async updateRole(id: string, dto: any) {
    return this.rbacService.updateRole(id, dto);
  }
  async deleteRole(id: string) {
    return this.rbacService.deleteRole(id);
  }
  async assignRole(userId: string, dto: AssignRoleDto) {
    return this.rbacService.assignRole(userId, dto);
  }

  // ─── ROUTE PERMISSION WRAPPERS ──────────────────
  async getRoutePermissions() {
    return this.rbacService.getRoutePermissions();
  }
  async getRoutePermissionByRoute(routePath: string) {
    return this.rbacService.getRoutePermissionByRoute(routePath);
  }
  async getPagePermissionScopes() {
    return [
      {
        route_path: '/system',
        access_permissions: [
          'SYSTEM_ADMIN',
          'SYSTEM_PERFORMANCE_READ',
          'LOGIN_LOG_READ',
          'SYSTEM_REQUEST_READ',
          'SYSTEM_REQUEST_MANAGE',
          'DATABASE_BACKUP_READ',
          'DATABASE_BACKUP_CREATE',
          'DATABASE_BACKUP_DOWNLOAD',
          'DATABASE_BACKUP_DELETE'
        ],
        action_permissions: [
          'SYSTEM_PERFORMANCE_READ',
          'LOGIN_LOG_READ',
          'SYSTEM_REQUEST_READ',
          'SYSTEM_REQUEST_MANAGE',
          'DATABASE_BACKUP_READ',
          'DATABASE_BACKUP_CREATE',
          'DATABASE_BACKUP_DOWNLOAD',
          'DATABASE_BACKUP_DELETE'
        ]
      },
      {
        route_path: '/permissions',
        access_permissions: ['admin'],
        action_permissions: [
          'view_users',
          'reset_pwd',
          'ADMIN_FULL',
          'USER_CREATE',
          'USER_UPDATE',
          'USER_DELETE',
          'ROLE_CREATE',
          'ROLE_UPDATE',
          'ROLE_DELETE',
          'PERMISSION_CREATE',
          'PERMISSION_UPDATE',
          'PERMISSION_DELETE',
          'PERMISSION_GROUP_CREATE',
          'PERMISSION_GROUP_UPDATE',
          'PERMISSION_GROUP_DELETE',
          'ROUTE_PERMISSION_CREATE',
          'ROUTE_PERMISSION_UPDATE',
          'ROUTE_PERMISSION_DELETE'
        ],
        notes: ['Chưa tách CRUD permission riêng']
      },
      {
        route_path: '/students',
        access_permissions: ['STUDENT_PAGE'],
        action_permissions: [
          'STUDENT_READ',
          'STUDENT_CREATE',
          'STUDENT_UPDATE',
          'STUDENT_DELETE',
          'STUDENT_IMPORT',
          'STUDENT_EXPORT',
          'STUDENT_ACCOUNT_ACTIVATE',
          'STUDENT_ACCOUNT_RESET_PASSWORD',
          'STUDENT_TRANSFER',
          'DEPT_CREATE',
          'DEPT_UPDATE',
          'DEPT_DELETE',
          'CLASS_CREATE',
          'CLASS_UPDATE',
          'CLASS_DELETE'
        ]
      },
      {
        route_path: '/grading',
        access_permissions: ['GRADING_PAGE'],
        action_permissions: [
          'GRADING_SEMESTER_MANAGE',
          'READ_STUDENT_RECORD',
          'CREATE_STUDENT_RECORD',
          'UPDATE_STUDENT_RECORD',
          'DELETE_STUDENT_RECORD',
          'READ_CLASS_RECORD',
          'CREATE_CLASS_RECORD',
          'UPDATE_CLASS_RECORD',
          'DELETE_CLASS_RECORD',
          'CONFIG_RECORD',
          'READ_STUDENT_TASK',
          'CREATE_STUDENT_TASK',
          'UPDATE_STUDENT_TASK',
          'DELETE_STUDENT_TASK'
        ]
      },
      {
        route_path: '/reports',
        access_permissions: ['REPORTS_PAGE'],
        action_permissions: [
          'REPORTS_READ'
        ]
      }
    ];
  }
  async createRoutePermission(dto: any) {
    return this.rbacService.createRoutePermission(dto);
  }
  async updateRoutePermission(id: string, dto: any) {
    return this.rbacService.updateRoutePermission(id, dto);
  }
  async deleteRoutePermission(id: string) {
    return this.rbacService.deleteRoutePermission(id);
  }

  // ─── USER MANAGEMENT ──────────────────────────

  async getMe(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .populate({
        path: 'role',
        populate: { path: 'permissions' },
      })
      .select('-pw_hash');

    if (!user) throw new BadRequestException('Người dùng không tồn tại');

    const role = user.role as any;
    const permissions = role?.permissions?.map((p: any) => p.code) || [];

    const student = await this.studentModel.findOne({ user_id: user._id }).exec();
    const displayName = student ? student.full_name : user.user_name;

    return {
      id: user._id.toString(),
      user_name: user.user_name,
      display_name: displayName,
      email: user.email,
      phone_number: user.phone_number || '',
      department: user.department || '',
      date_birth: user.date_birth || null,
      status: user.status,
      roleName: role?.name || 'User',
      roleCode: role?.role_code || 'USER',
      role: role ? {
        _id: role._id.toString(),
        name: role.name,
        role_code: role.role_code,
        permissions: role.permissions || [],
      } : null,
      permissions,
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('ID người dùng không hợp lệ');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    // Check duplicate username if provided
    if (dto.user_name && dto.user_name !== user.user_name) {
      const existingUsername = await this.userModel.findOne({
        user_name: dto.user_name,
      });
      if (existingUsername) throw new ConflictException('Username đã tồn tại');
      user.user_name = dto.user_name;
    }

    if (dto.phone_number !== undefined) user.phone_number = dto.phone_number;
    if (dto.department !== undefined) user.department = dto.department;
    if (dto.date_birth !== undefined) user.date_birth = dto.date_birth;

    await user.save();
    return this.getMe(userId);
  }

  async getUsers() {
    const users = await this.userModel.find().populate('role').select('-pw_hash').exec();
    
    const userIds = users.map(u => u._id);
    const students = await this.studentModel.find({ user_id: { $in: userIds } }).exec();
    
    const studentMap = new Map();
    for (const student of students) {
      if (student.user_id) {
        studentMap.set(student.user_id.toString(), student);
      }
    }
    
    return users.map(user => {
      const userObj = user.toObject() as any;
      const student = studentMap.get(user._id.toString());
      if (student) {
        userObj.display_name = student.full_name;
        userObj.student_profile = {
          id: student._id,
          student_code: student.student_code,
          full_name: student.full_name,
          class_id: student.class_id,
        };
      } else {
        userObj.display_name = user.user_name;
      }
      return userObj;
    });
  }

  async updateUser(userId: string, dto: UpdateUserDto, ip: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('ID người dùng không hợp lệ');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    // Check duplicate username if provided
    if (dto.user_name && dto.user_name !== user.user_name) {
      const existingUsername = await this.userModel.findOne({
        user_name: dto.user_name,
      });
      if (existingUsername) throw new ConflictException('Username đã tồn tại');
      user.user_name = dto.user_name;
    }

    // Check duplicate email if provided
    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const existingEmail = await this.userModel.findOne({
        email: dto.email.toLowerCase(),
      });
      if (existingEmail) throw new ConflictException('Email đã được sử dụng');
      user.email = dto.email.toLowerCase();
    }

    let shouldRevokeTokens = false;

    // Check role existence if role_id is provided
    if (dto.role_id) {
      if (!Types.ObjectId.isValid(dto.role_id)) {
        throw new BadRequestException('ID vai trò không hợp lệ');
      }
      const role = await this.roleModel.findById(dto.role_id);
      if (!role) {
        throw new BadRequestException('Vai trò không tồn tại');
      }
      if (user.role && user.role.toString() !== role._id.toString()) {
        user.role = role._id;
        shouldRevokeTokens = true;
      }
    }

    // Update other fields
    if (dto.status) {
      if (
        dto.status !== UserStatus.ACTIVE &&
        dto.status !== UserStatus.LOCKED &&
        dto.status !== UserStatus.INACTIVE
      ) {
        throw new BadRequestException('Trạng thái không hợp lệ');
      }
      if (user.status !== dto.status) {
        user.status = dto.status as UserStatus;
        if (dto.status === UserStatus.LOCKED || dto.status === UserStatus.INACTIVE) {
          shouldRevokeTokens = true;
        }
      }
      // If status changes to Active or Inactive, clear locking properties
      if (dto.status === UserStatus.ACTIVE || dto.status === UserStatus.INACTIVE) {
        user.failed_login_attempts = 0;
        user.locked_until = null;
      }
    }

    if (dto.phone_number !== undefined) user.phone_number = dto.phone_number;
    if (dto.department !== undefined) user.department = dto.department;
    if (dto.date_birth !== undefined) user.date_birth = dto.date_birth;

    if (dto.password) {
      user.pw_hash = await this.passwordService.hashPassword(dto.password);
      user.failed_login_attempts = 0;
      user.locked_until = null;
      user.status = UserStatus.ACTIVE;
      shouldRevokeTokens = true;
      await this.logAction(
        user._id,
        ip,
        'admin_reset_password',
        'Password reset by administrator',
      );
    }

    await user.save();

    if (shouldRevokeTokens) {
      await this.tokenService.revokeAllUserTokens(user._id.toString());
    }

    // Populate role and return updated user (without pw_hash)
    const updatedUser = await this.userModel
      .findById(userId)
      .populate('role')
      .select('-pw_hash');
    return {
      message: 'Cập nhật người dùng thành công',
      user: updatedUser,
    };
  }

  async deleteUser(userId: string) {
    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('ID người dùng không hợp lệ');
    const result = await this.userModel.deleteOne({ _id: userId });
    if (result.deletedCount === 0)
      throw new BadRequestException('Người dùng không tồn tại');
    return { message: 'Xóa người dùng thành công' };
  }

  async deleteUsersBulk(userIds: string[]) {
    const invalidIds = userIds.filter((id) => !Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Có ID người dùng không hợp lệ: ${invalidIds.join(', ')}`,
      );
    }

    const result = await this.userModel.deleteMany({ _id: { $in: userIds } });
    return {
      message: `Đã xóa thành công ${result.deletedCount}/${userIds.length} người dùng.`,
      deletedCount: result.deletedCount,
    };
  }

  // ─── INTERNAL LOGGING ───────────────────────────────────────

  private async logAction(
    userId: Types.ObjectId | null,
    ip: string,
    action: string,
    details: string | null,
  ) {
    const log = await this.loginLogModel.create({
      user_id: userId,
      ip_address: ip,
      action,
      login_time: new Date(),
      details: details || undefined,
    });

    try {
      const populatedLog = await log.populate({
        path: 'user_id',
        select: 'user_name email role',
        populate: { path: 'role', select: 'name role_code' },
      });
      // Dynamically load to prevent circular imports
      const { systemEventEmitter } = require('../../system/system-event-emitter');
      systemEventEmitter.emit('login_log', populatedLog);
    } catch (err) {
      console.error('Failed to emit login_log event:', err);
    }
  }

  // ─── SEEDING & MIGRATION ────────────────────────────────────

  private async migrateLegacyRoleCodes() {
    // 1. Rename 'Giảng viên chính' / LECTURER to 'Teacher' / TEACHER
    await this.roleModel.updateOne(
      { $or: [{ name: 'Giảng viên chính' }, { role_code: 'LECTURER' }] },
      { $set: { name: 'Teacher', role_code: 'TEACHER', description: 'Giảng viên cố vấn học tập' } }
    ).exec();

    // 2. Assign default role_code for roles that don't have one
    const roles = await this.roleModel.find({ role_code: { $exists: false } }).exec();
    if (roles.length > 0) {
      for (const role of roles) {
        let code = '';
        if (role.name === 'Admin') code = 'ADMIN';
        else if (role.name === 'Teacher') code = 'TEACHER';
        else if (role.name === 'Supervisor') code = 'SUPERVISOR';
        else if (role.name === 'Student') code = 'STUDENT';
        else if (role.name === 'User') code = 'USER';
        else {
          code = role.name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/\s+/g, '_');
        }

        let suffix = '';
        let count = 0;
        while (true) {
          const checkCode = `${code}${suffix}`;
          const existing = await this.roleModel.findOne({
            role_code: checkCode,
            _id: { $ne: role._id },
          }).exec();
          if (!existing) {
            code = checkCode;
            break;
          }
          count++;
          suffix = `_${count}`;
        }

        (role as any).role_code = code;
        await role.save();
      }
      console.log(`✅ Successfully migrated role_code for ${roles.length} roles.`);
    }
  }

  private async seedRbac() {
    // Clean up G_ACADEMIC group and deleted permissions from DB
    await this.permissionModel.deleteMany({
      code: { $in: ['view_course', 'create_course', 'edit_content', 'delete_course'] }
    }).exec();
    await this.permissionGroupModel.deleteOne({ code: 'G_ACADEMIC' }).exec();

    // Load all existing permissions from database first (including declared permissions from registry)
    const allDbPerms = await this.permissionModel.find({}).exec();
    const createdPerms: Record<string, Types.ObjectId> = {};
    for (const p of allDbPerms) {
      createdPerms[p.code] = p._id;
    }

    const permissions = [
      {
        code: 'view_users',
        name: 'Xem danh sách người dùng',
        module: 'Quản lý Người dùng (Users)',
        description: 'Cho phép xem danh sách người dùng trong hệ thống.',
      },
      {
        code: 'reset_pwd',
        name: 'Reset mật khẩu',
        module: 'Quản lý Người dùng (Users)',
        description: 'Cho phép đổi/mới mật khẩu cho người dùng.',
      },
      {
        code: 'ADMIN_FULL',
        name: 'Toàn quyền Admin',
        module: 'Hệ thống',
        description: '⚠️ QUYỀN HẠN TỐI CAO: Toàn quyền quản trị và bypass tất cả các cơ chế bảo mật hệ thống.',
      },
      {
        code: 'view_revenue',
        name: 'Xem báo cáo doanh thu',
        module: 'Tài chính & Kế toán (Finance)',
        description: 'Cho phép xem báo cáo thống kê doanh thu tài chính.',
      },
      {
        code: 'GRADING_SEMESTER_MANAGE',
        name: 'Quản lý học kỳ rèn luyện',
        module: 'Rèn luyện',
        description: 'Cho phép khởi tạo, đóng học kỳ đánh giá rèn luyện.',
      },
    ];

    for (const p of permissions) {
      const perm = await this.permissionModel.findOneAndUpdate(
        { code: p.code },
        { $set: p },
        { upsert: true, returnDocument: 'after' },
      ).exec();
      createdPerms[p.code] = perm._id;
    }

    const roles = [
      {
        name: 'Admin',
        role_code: 'ADMIN',
        description: 'Toàn quyền quản trị hệ thống',
        permissions: Object.values(createdPerms),
      },
      {
        name: 'Teacher',
        role_code: 'TEACHER',
        description: 'Giảng viên cố vấn học tập',
        permissions: [
          createdPerms['STUDENT_READ'],
          createdPerms['GRADING_PAGE'],
          createdPerms['STUDENT_PAGE'],
        ].filter(Boolean),
      },
      {
        name: 'Supervisor',
        role_code: 'SUPERVISOR',
        description: 'Quản sinh và giám sát rèn luyện',
        permissions: [
          createdPerms['GRADING_SEMESTER_MANAGE'],
          createdPerms['GRADING_PAGE'],
          createdPerms['READ_STUDENT_TASK'],
          createdPerms['CREATE_STUDENT_TASK'],
          createdPerms['UPDATE_STUDENT_TASK'],
          createdPerms['DELETE_STUDENT_TASK'],
        ],
      },
      {
        name: 'Student',
        role_code: 'STUDENT',
        description: 'Sinh viên học sinh',
        permissions: [
          createdPerms['GRADING_PAGE'],
          createdPerms['READ_STUDENT_TASK'],
        ],
      },
      {
        name: 'Security Admin',
        role_code: 'SECURITY_ADMIN',
        description: 'Quản trị viên an ninh và phân quyền hệ thống',
        permissions: [
          createdPerms['admin'],
          createdPerms['view_users'],
          createdPerms['reset_pwd'],
        ].filter(Boolean),
      },
      {
        name: 'System Operator',
        role_code: 'SYSTEM_OPERATOR',
        description: 'Vận hành hệ thống (không có quyền xóa/tải backup)',
        permissions: [
          createdPerms['SYSTEM_ADMIN'],
          createdPerms['SYSTEM_PERFORMANCE_READ'],
          createdPerms['LOGIN_LOG_READ'],
          createdPerms['SYSTEM_REQUEST_READ'],
          createdPerms['SYSTEM_REQUEST_MANAGE'],
          createdPerms['DATABASE_BACKUP_READ'],
        ].filter(Boolean),
      },
      {
        name: 'Audit Viewer',
        role_code: 'AUDIT_VIEWER',
        description: 'Chỉ xem nhật ký hệ thống',
        permissions: [
          createdPerms['LOGIN_LOG_READ'],
        ].filter(Boolean),
      },
      {
        name: 'Backup Operator',
        role_code: 'BACKUP_OPERATOR',
        description: 'Vận hành sao lưu hệ thống (không có quyền xóa/tải backup)',
        permissions: [
          createdPerms['DATABASE_BACKUP_READ'],
          createdPerms['DATABASE_BACKUP_CREATE'],
        ].filter(Boolean),
      },
    ];

    for (const r of roles) {
      await this.roleModel.findOneAndUpdate(
        { role_code: r.role_code },
        { $set: r },
        { upsert: true },
      ).exec();
    }

    const groups = [
      {
        code: 'G_SYSTEM',
        name: 'Hệ thống',
        description: 'Các quyền quản trị hệ thống cốt lõi',
        permissions: [createdPerms['ADMIN_FULL']],
      },
      {
        code: 'G_USER',
        name: 'Quản lý Người dùng',
        description: 'Các quyền liên quan đến tài khoản và phân quyền',
        permissions: [createdPerms['view_users'], createdPerms['reset_pwd']],
      },
      {
        code: 'G_SYSTEM_OPERATIONS',
        name: 'Quản trị vận hành hệ thống',
        description: 'Các quyền quản trị vận hành hệ thống, xem log đăng nhập, quản lý yêu cầu và sao lưu cơ sở dữ liệu.',
        permissions: [
          createdPerms['SYSTEM_ADMIN'],
          createdPerms['LOGIN_LOG_READ'],
          createdPerms['SYSTEM_REQUEST_READ'],
          createdPerms['SYSTEM_REQUEST_MANAGE'],
          createdPerms['DATABASE_BACKUP_READ'],
          createdPerms['DATABASE_BACKUP_CREATE'],
          createdPerms['DATABASE_BACKUP_DOWNLOAD'],
          createdPerms['DATABASE_BACKUP_DELETE'],
        ],
      },
      {
        code: 'G_PROPOSED',
        name: 'Đề xuất bổ sung',
        description: 'Nhóm các quyền được đề xuất để bổ sung cho chức năng tương lai (chưa có guard thực tế).',
        permissions: [
          createdPerms['USER_CREATE'],
          createdPerms['USER_UPDATE'],
          createdPerms['USER_DELETE'],
          createdPerms['ROLE_CREATE'],
          createdPerms['ROLE_UPDATE'],
          createdPerms['ROLE_DELETE'],
          createdPerms['PERMISSION_CREATE'],
          createdPerms['PERMISSION_UPDATE'],
          createdPerms['PERMISSION_DELETE'],
          createdPerms['PERMISSION_GROUP_CREATE'],
          createdPerms['PERMISSION_GROUP_UPDATE'],
          createdPerms['PERMISSION_GROUP_DELETE'],
          createdPerms['ROUTE_PERMISSION_CREATE'],
          createdPerms['ROUTE_PERMISSION_UPDATE'],
          createdPerms['ROUTE_PERMISSION_DELETE'],
        ].filter(Boolean),
      },
    ];

    for (const g of groups) {
      const validPerms = g.permissions.filter((p) => !!p);
      await this.permissionGroupModel.findOneAndUpdate(
        { code: g.code },
        { $set: { ...g, permissions: validPerms } },
        { upsert: true },
      ).exec();
    }

    // Seed default route permissions
    const permMap = createdPerms;

    const routeMappings = [
      {
        route_path: '/system',
        route_name: 'Quản trị vận hành hệ thống',
        description: 'Lịch sử đăng nhập, request vận hành và backup database',
        permissions: [
          permMap['SYSTEM_ADMIN'],
          permMap['LOGIN_LOG_READ'],
          permMap['SYSTEM_REQUEST_READ'],
          permMap['SYSTEM_REQUEST_MANAGE'],
          permMap['DATABASE_BACKUP_READ'],
          permMap['DATABASE_BACKUP_CREATE'],
          permMap['DATABASE_BACKUP_DOWNLOAD'],
          permMap['DATABASE_BACKUP_DELETE'],
        ],
        check_type: 'any',
        is_active: true,
        type: 'page',
      },
      {
        route_path: '/permissions',
        route_name: 'Quản lý phân quyền (RBAC)',
        description: 'Quản lý vai trò, quyền, nhóm quyền và route mapping',
        permissions: [permMap['admin']],
        check_type: 'any',
        is_active: true,
        type: 'page',
      },
      {
        route_path: '/students',
        route_name: 'Quản lý sinh viên',
        description: 'Xem, thêm, sửa, xóa và quản lý hồ sơ sinh viên',
        permissions: [permMap['STUDENT_PAGE']],
        check_type: 'any',
        is_active: true,
        type: 'page',
      },
      {
        route_path: '/grading',
        route_name: 'Đánh giá điểm rèn luyện',
        description: 'Chấm điểm, duyệt điểm rèn luyện của sinh viên',
        permissions: [permMap['GRADING_PAGE']],
        check_type: 'any',
        is_active: true,
        type: 'page',
      },
      {
        route_path: '/reports',
        route_name: 'Báo cáo thống kê',
        description: 'Xem các biểu đồ báo cáo và thống kê dữ liệu',
        permissions: [permMap['REPORTS_PAGE']],
        check_type: 'any',
        is_active: true,
        type: 'page',
      },
    ];


    for (const mapping of routeMappings) {
      const validPerms = mapping.permissions.filter((p) => !!p);
      if (validPerms.length > 0) {
        await this.routePermissionModel.findOneAndUpdate(
          { route_path: mapping.route_path },
          { $set: { ...mapping, permissions: validPerms } },
          { upsert: true },
        ).exec();
      }
    }

    // Dọn dẹp nhóm G_UNGROUPED: loại bỏ các quyền đã được phân vào nhóm nghiệp vụ khác
    try {
      const otherGroups = await this.permissionGroupModel.find({ code: { $ne: 'G_UNGROUPED' } }).exec();
      const groupedPermissionIds = otherGroups.reduce((acc, g) => {
        return acc.concat(g.permissions.map(p => p.toString()));
      }, [] as string[]);
      
      if (groupedPermissionIds.length > 0) {
        await this.permissionGroupModel.updateOne(
          { code: 'G_UNGROUPED' },
          { $pull: { permissions: { $in: groupedPermissionIds.map(id => new Types.ObjectId(id)) } } }
        ).exec();
        console.log('🧹 Cleaned up G_UNGROUPED permissions successfully');
      }
    } catch (err) {
      console.error('Failed to cleanup G_UNGROUPED:', err);
    }

    // Clean up old /settings route mapping if any
    await this.routePermissionModel.deleteOne({ route_path: '/settings' }).exec();

    console.log('✅ RBAC Data Seeded Successfully');
  }

  private async seedDeclaredPermissions() {
    const group = await this.permissionGroupModel.findOneAndUpdate(
      {
        $or: [
          { code: UNGROUPED_PERMISSION_GROUP.code },
          { name: UNGROUPED_PERMISSION_GROUP.name },
        ],
      },
      {
        $set: UNGROUPED_PERMISSION_GROUP,
        $setOnInsert: { permissions: [] },
      },
      { upsert: true, returnDocument: 'after' },
    ).exec();

    const permissionIds: Types.ObjectId[] = [];

    for (const permissionSeed of DECLARED_PERMISSION_SEEDS) {
      const permission = await this.permissionModel.findOneAndUpdate(
        { code: permissionSeed.code },
        { $set: permissionSeed },
        { upsert: true, returnDocument: 'after' },
      ).exec();

      permissionIds.push(permission._id);
    }

    if (permissionIds.length > 0) {
      await this.permissionGroupModel.updateOne(
        { _id: group._id },
        { $addToSet: { permissions: { $each: permissionIds } } },
      ).exec();
    }

    console.log(
      `✅ Declared permissions synced to "${UNGROUPED_PERMISSION_GROUP.name}" group`,
    );
  }

  private async seedSystemAdmin() {
    const adminEmail = process.env.SYSTEM_ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.SYSTEM_ADMIN_PASSWORD;
    const adminUsername =
      process.env.SYSTEM_ADMIN_USERNAME?.trim() ||
      adminEmail?.split('@')[0] ||
      'system-admin';

    if (!adminEmail && !adminPassword) {
      return;
    }

    if (!adminEmail || !adminPassword) {
      throw new Error(
        'SYSTEM_ADMIN_EMAIL and SYSTEM_ADMIN_PASSWORD must be configured together',
      );
    }

    if (adminPassword.length < 8) {
      throw new Error('SYSTEM_ADMIN_PASSWORD must be at least 8 characters');
    }

    const adminRole =
      (await this.roleModel.findOne({ role_code: 'ADMIN' }).exec()) ||
      (await this.roleModel.findOne({ name: 'Admin' }).exec());

    if (!adminRole) {
      throw new Error('Admin role was not seeded before system admin creation');
    }

    const existingAdmin = await this.userModel
      .findOne({ email: adminEmail })
      .exec();

    if (existingAdmin) {
      let changed = false;

      if (
        !existingAdmin.role ||
        existingAdmin.role.toString() !== adminRole._id.toString()
      ) {
        existingAdmin.role = adminRole._id;
        changed = true;
      }

      if (existingAdmin.status !== UserStatus.ACTIVE) {
        existingAdmin.status = UserStatus.ACTIVE;
        existingAdmin.failed_login_attempts = 0;
        existingAdmin.locked_until = null;
        changed = true;
      }

      if (changed) {
        await existingAdmin.save();
      }

      console.log('✅ System admin account verified');
      return;
    }

    const pw_hash = await this.passwordService.hashPassword(adminPassword);

    await this.userModel.create({
      user_name: adminUsername,
      email: adminEmail,
      pw_hash,
      status: UserStatus.ACTIVE,
      role: adminRole._id,
    });

    console.log('✅ System admin account seeded');
  }

  private async migrateLegacyRoles() {
    const adminRole = await this.roleModel.findOne({ name: 'Admin' });
    const userRole = await this.roleModel.findOne({ name: 'User' });

    const usersToFix = await (this.userModel as any).find({
      role: { $not: { $type: 'objectId' } },
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
    const usersToFix = await this.userModel
      .find({
        $or: [
          { pw_hash: { $exists: false } },
          { user_name: { $exists: false } },
        ],
      } as any)
      .lean();

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
              $unset: { username: '', password_hash: '' },
            },
          );
          migratedCount++;
        }
      }
      if (migratedCount > 0) {
        console.log(
          `✅ Successfully migrated fields (pw_hash/user_name) for ${migratedCount} legacy users.`,
        );
      }
    }

    const cleanupResult = await this.userModel.updateMany(
      {
        $or: [
          { username: { $exists: true } },
          { password_hash: { $exists: true } },
        ],
      } as any,
      {
        $unset: { username: '', password_hash: '' },
      },
    );
    if (cleanupResult.modifiedCount > 0) {
      console.log(
        `🧹 Cleaned up legacy fields (username/password_hash) for ${cleanupResult.modifiedCount} users.`,
      );
    }
  }
}
