import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { User, UserStatus } from '../schemas/user.schema';
import { LoginLog } from '../schemas/login-log.schema';
import { Role } from '../schemas/role.schema';
import { Permission } from '../schemas/permission.schema';
import { PermissionGroup } from '../schemas/permission-group.schema';
import { RoutePermission } from '../schemas/route-permission.schema';
import { Student } from '../../students/schemas/student.schema';
import { Class } from '../../classes/schemas/class.schema';
import { TokenService } from '../services/token.service';
import { PasswordService } from '../services/password.service';
import { RbacService } from '../services/rbac.service';

jest.mock('uuid', () => ({
  v4: () => 'mocked-uuid',
}));

describe('AuthService', () => {
  let service: AuthService;
  let userModel: any;
  let passwordService: any;

  const mockUser = {
    _id: '507f1f77bcf86cd799439013',
    user_name: 'testuser',
    email: 'test@example.com',
    pw_hash: 'mock-hash',
    status: UserStatus.ACTIVE,
    failed_login_attempts: 0,
    locked_until: null,
    role: { _id: 'mock-role-id', name: 'User' },
    save: jest.fn().mockResolvedValue(true),
  };

  const mockUserModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  };

  const mockTokenService = {
    generateAccessToken: jest.fn().mockReturnValue('mock-access-token'),
    createRefreshToken: jest.fn().mockResolvedValue('mock-refresh-token'),
    refreshToken: jest.fn(),
    revokeToken: jest.fn(),
    revokeAllUserTokens: jest.fn(),
  };

  const mockPasswordService = {
    comparePassword: jest.fn(),
    hashPassword: jest.fn().mockResolvedValue('new-mock-hash'),
  };

  const mockRbacService = {
    getRoles: jest.fn(),
    getPermissions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(LoginLog.name),
          useValue: {
            create: jest.fn().mockImplementation((dto) => ({
              ...dto,
              populate: jest.fn().mockReturnThis(),
            })),
          },
        },
        {
          provide: getModelToken(Role.name),
          useValue: {
            findOne: jest.fn().mockReturnValue({
              exec: jest
                .fn()
                .mockResolvedValue({ _id: 'mock-role-id', name: 'User' }),
            }),
            findById: jest.fn().mockReturnValue({
              exec: jest
                .fn()
                .mockResolvedValue({ _id: 'mock-role-id', name: 'User' }),
            }),
          },
        },
        {
          provide: getModelToken(Permission.name),
          useValue: {},
        },
        {
          provide: getModelToken(PermissionGroup.name),
          useValue: {},
        },
        {
          provide: getModelToken(RoutePermission.name),
          useValue: {},
        },
        {
          provide: getModelToken(Student.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
            findOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            }),
          },
        },
        {
          provide: getModelToken(Class.name),
          useValue: {},
        },
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
        {
          provide: PasswordService,
          useValue: mockPasswordService,
        },
        {
          provide: RbacService,
          useValue: mockRbacService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userModel = module.get(getModelToken(User.name));
    passwordService = module.get(PasswordService);

    // Bypass onModuleInit initialization logic to keep unit tests isolated
    jest.spyOn(service, 'onModuleInit').mockImplementation(async () => {});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login status transitions', () => {
    it('should reject login for inactive user with ForbiddenException', async () => {
      const inactiveUser = {
        ...mockUser,
        status: UserStatus.INACTIVE,
        save: jest.fn().mockResolvedValue(true),
      };

      userModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(inactiveUser),
      });

      await expect(
        service.login(
          { email: 'test@example.com', password: 'password' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(
        new ForbiddenException(
          'Tài khoản chưa được kích hoạt bởi quản trị viên.',
        ),
      );
    });

    it('should login successfully after account status is set to active (admin activation)', async () => {
      const activeUser = {
        ...mockUser,
        status: UserStatus.ACTIVE,
        save: jest.fn().mockResolvedValue(true),
      };

      userModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(activeUser),
      });

      passwordService.comparePassword.mockResolvedValue(true);

      const result = await service.login(
        { email: 'test@example.com', password: 'password' },
        '127.0.0.1',
      );

      expect(result).toBeDefined();
      expect(result.access_token).toBeDefined();
      expect(activeUser.status).toEqual(UserStatus.ACTIVE);
    });

    it('should increment failed attempts and lock account after threshold', async () => {
      const userToLock = {
        ...mockUser,
        status: UserStatus.ACTIVE,
        failed_login_attempts: 4,
        save: jest.fn().mockResolvedValue(true),
      };

      userModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(userToLock),
      });

      passwordService.comparePassword.mockResolvedValue(false);

      await expect(
        service.login(
          { email: 'test@example.com', password: 'wrongpassword' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(userToLock.status).toEqual(UserStatus.LOCKED);
      expect(userToLock.locked_until).toBeDefined();
      expect(userToLock.save).toHaveBeenCalled();
    });

    it('should allow login and reactivate locked user if locked_until has expired', async () => {
      const expiredLockedUser = {
        ...mockUser,
        status: UserStatus.LOCKED,
        locked_until: new Date(Date.now() - 10000), // expired 10s ago
        save: jest.fn().mockResolvedValue(true),
      };

      userModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(expiredLockedUser),
      });

      passwordService.comparePassword.mockResolvedValue(true);

      const result = await service.login(
        { email: 'test@example.com', password: 'password' },
        '127.0.0.1',
      );

      expect(result).toBeDefined();
      expect(expiredLockedUser.status).toEqual(UserStatus.ACTIVE);
      expect(expiredLockedUser.failed_login_attempts).toEqual(0);
      expect(expiredLockedUser.locked_until).toBeNull();
    });
  });

  describe('updateUser status modification', () => {
    it('should allow status update to ACTIVE, INACTIVE, or LOCKED', async () => {
      const user = {
        ...mockUser,
        save: jest.fn().mockResolvedValue(true),
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(user),
        then: jest
          .fn()
          .mockImplementation((callback) =>
            Promise.resolve(user).then(callback),
          ),
      };
      userModel.findById.mockReturnValue(mockQuery);

      // We need to mock getMe wrapper
      jest.spyOn(service, 'getMe').mockResolvedValue(user as any);

      // Active
      let result = await service.updateUser(
        '507f1f77bcf86cd799439013',
        { status: 'active' },
        '127.0.0.1',
      );
      expect(result).toBeDefined();
      expect(user.status).toEqual(UserStatus.ACTIVE);

      // Inactive
      result = await service.updateUser(
        '507f1f77bcf86cd799439013',
        { status: 'inactive' },
        '127.0.0.1',
      );
      expect(result).toBeDefined();
      expect(user.status).toEqual(UserStatus.INACTIVE);
      expect(user.failed_login_attempts).toEqual(0);
      expect(user.locked_until).toBeNull();

      // Locked
      result = await service.updateUser(
        '507f1f77bcf86cd799439013',
        { status: 'locked' },
        '127.0.0.1',
      );
      expect(result).toBeDefined();
      expect(user.status).toEqual(UserStatus.LOCKED);
    });

    it('should reject invalid status', async () => {
      const user = {
        ...mockUser,
      };
      userModel.findById.mockResolvedValue(user);

      await expect(
        service.updateUser(
          '507f1f77bcf86cd799439013',
          { status: 'invalid_status' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createUser', () => {
    it('should successfully create a single user', async () => {
      userModel.findOne.mockResolvedValue(null);
      jest
        .spyOn((service as any).roleModel, 'findById')
        .mockResolvedValue({ _id: 'mock-role-id' });

      const createdUser = { ...mockUser, toObject: () => ({ ...mockUser }) };
      userModel.create.mockResolvedValue(createdUser);

      const dto = {
        user_name: 'newuser',
        email: 'new@example.com',
        role_id: 'role-id',
        password: 'password123',
      };

      const result = await service.createUser(dto, '127.0.0.1');

      expect(result).toBeDefined();
      expect(result.message).toEqual('Người dùng đã được tạo thành công');
      expect(result.user).toBeDefined();
      expect(userModel.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if username already exists', async () => {
      userModel.findOne.mockResolvedValueOnce({ _id: 'existing' }); // username found

      await expect(
        service.createUser({
          user_name: 'exist',
          email: 'e@mail.com',
          password: '1',
          role_id: '1',
        }),
      ).rejects.toThrow('Username đã tồn tại');
    });
  });

  describe('createUsersBulk', () => {
    it('should throw BadRequestException if users array is empty', async () => {
      await expect(
        service.createUsersBulk({ users: [] }, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create multiple users and return stats', async () => {
      userModel.findOne.mockResolvedValue(null);
      jest
        .spyOn((service as any).roleModel, 'findById')
        .mockResolvedValue({ _id: '507f1f77bcf86cd799439013' });

      const createdUser1 = { _id: '1', user_name: 'u1', email: 'u1@e.com' };
      const createdUser2 = { _id: '2', user_name: 'u2', email: 'u2@e.com' };

      userModel.create
        .mockResolvedValueOnce(createdUser1)
        .mockResolvedValueOnce(createdUser2);

      const dto = {
        users: [
          {
            user_name: 'u1',
            email: 'u1@e.com',
            password: 'p1',
            role_id: '507f1f77bcf86cd799439013',
          },
          {
            user_name: 'u2',
            email: 'u2@e.com',
            password: 'p2',
            role_id: '507f1f77bcf86cd799439013',
          },
        ],
      };

      const result = await service.createUsersBulk(dto, '127.0.0.1');

      expect(result.total).toEqual(2);
      expect(result.successCount).toEqual(2);
      expect(result.failedCount).toEqual(0);
      expect(result.successes.length).toEqual(2);
    });

    it('should handle errors for individual users in bulk create', async () => {
      // First user valid, second user duplicate email
      userModel.findOne
        .mockResolvedValueOnce(null) // u1 username check
        .mockResolvedValueOnce(null) // u1 email check
        .mockResolvedValueOnce(null) // u2 username check
        .mockResolvedValueOnce({ _id: 'existing' }); // u2 email check returns existing

      jest
        .spyOn((service as any).roleModel, 'findById')
        .mockResolvedValue({ _id: '507f1f77bcf86cd799439013' });

      const createdUser1 = { _id: '1', user_name: 'u1', email: 'u1@e.com' };
      userModel.create.mockResolvedValueOnce(createdUser1);

      const dto = {
        users: [
          {
            user_name: 'u1',
            email: 'u1@e.com',
            password: 'p1',
            role_id: '507f1f77bcf86cd799439013',
          },
          {
            user_name: 'u2',
            email: 'u2@e.com',
            password: 'p2',
            role_id: '507f1f77bcf86cd799439013',
          },
        ],
      };

      const result = await service.createUsersBulk(dto, '127.0.0.1');

      expect(result.total).toEqual(2);
      expect(result.successCount).toEqual(1);
      expect(result.failedCount).toEqual(1);
      expect(result.errors[0].reason).toContain('Email đã được sử dụng');
    });
  });

  describe('seedRbac (RBAC Seeding regression)', () => {
    it('should seed RBAC groups correctly and not overwrite custom role permissions', async () => {
      const roleModel = (service as any).roleModel;
      const permissionModel = (service as any).permissionModel;
      const permissionGroupModel = (service as any).permissionGroupModel;
      const routePermissionModel = (service as any).routePermissionModel;

      permissionModel.deleteMany = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(true) });
      permissionModel.find = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { _id: 'id-admin', code: 'admin' },
          { _id: 'id-view_users', code: 'view_users' },
          { _id: 'id-reset_pwd', code: 'reset_pwd' },
          { _id: 'id-ADMIN_FULL', code: 'ADMIN_FULL' },
          { _id: 'id-USER_CREATE', code: 'USER_CREATE' },
          { _id: 'id-USER_UPDATE', code: 'USER_UPDATE' },
          { _id: 'id-USER_DELETE', code: 'USER_DELETE' },
          { _id: 'id-ROLE_CREATE', code: 'ROLE_CREATE' },
          { _id: 'id-ROLE_UPDATE', code: 'ROLE_UPDATE' },
          { _id: 'id-ROLE_DELETE', code: 'ROLE_DELETE' },
          { _id: 'id-PERMISSION_CREATE', code: 'PERMISSION_CREATE' },
          { _id: 'id-PERMISSION_UPDATE', code: 'PERMISSION_UPDATE' },
          { _id: 'id-PERMISSION_DELETE', code: 'PERMISSION_DELETE' },
          {
            _id: 'id-PERMISSION_GROUP_CREATE',
            code: 'PERMISSION_GROUP_CREATE',
          },
          {
            _id: 'id-PERMISSION_GROUP_UPDATE',
            code: 'PERMISSION_GROUP_UPDATE',
          },
          {
            _id: 'id-PERMISSION_GROUP_DELETE',
            code: 'PERMISSION_GROUP_DELETE',
          },
          {
            _id: 'id-ROUTE_PERMISSION_CREATE',
            code: 'ROUTE_PERMISSION_CREATE',
          },
          {
            _id: 'id-ROUTE_PERMISSION_UPDATE',
            code: 'ROUTE_PERMISSION_UPDATE',
          },
          {
            _id: 'id-ROUTE_PERMISSION_DELETE',
            code: 'ROUTE_PERMISSION_DELETE',
          },
          { _id: 'id-SYSTEM_ADMIN', code: 'SYSTEM_ADMIN' },
          { _id: 'id-PDF_TEMPLATE_READ', code: 'PDF_TEMPLATE_READ' },
          { _id: 'id-PDF_TEMPLATE_MANAGE', code: 'PDF_TEMPLATE_MANAGE' },
          { _id: 'id-PDF_TEMPLATE_DELETE', code: 'PDF_TEMPLATE_DELETE' },
        ]),
      });
      permissionModel.findOneAndUpdate = jest
        .fn()
        .mockImplementation((query) => ({
          exec: jest.fn().mockResolvedValue({ _id: `id-${query.code}` }),
        }));

      permissionGroupModel.deleteOne = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(true) });
      permissionGroupModel.deleteMany = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(true) });
      permissionGroupModel.findOneAndUpdate = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(true) });
      permissionGroupModel.find = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
      permissionGroupModel.updateOne = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(true) });

      routePermissionModel.deleteOne = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(true) });
      routePermissionModel.findOneAndUpdate = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(true) });

      roleModel.findOneAndUpdate = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(true) });

      await (service as any).seedRbac();

      // 1. Verify role permissions are never written with $set
      expect(roleModel.findOneAndUpdate).toHaveBeenCalled();
      const roleCalls = roleModel.findOneAndUpdate.mock.calls;
      roleCalls.forEach((call) => {
        const updateQuery = call[1];
        expect(updateQuery.$setOnInsert).toBeDefined();
        expect(updateQuery.$setOnInsert.permissions).toBeDefined();
        if (updateQuery.$set) {
          expect(updateQuery.$set.permissions).toBeUndefined();
        }
      });

      // 2. Verify G_ADMIN_RBAC group is upserted
      const groupCalls = permissionGroupModel.findOneAndUpdate.mock.calls;
      expect(groupCalls.length).toBeGreaterThan(0);
      const adminRbacCall = groupCalls.find(
        (c) => c[0].code === 'G_ADMIN_RBAC',
      );
      expect(adminRbacCall).toBeDefined();
      expect(adminRbacCall[1].$set.code).toBe('G_ADMIN_RBAC');

      // 3. Verify G_ADMIN_RBAC receives admin console permissions
      const adminRbacPerms = adminRbacCall[1].$addToSet.permissions.$each;
      expect(adminRbacPerms).toContain('id-admin');
      expect(adminRbacPerms).toContain('id-view_users');
      expect(adminRbacPerms).toContain('id-reset_pwd');
      expect(adminRbacPerms).toContain('id-ADMIN_FULL');
      expect(adminRbacPerms).toContain('id-USER_CREATE');
      expect(adminRbacPerms).toContain('id-ROLE_CREATE');
      expect(adminRbacPerms).toContain('id-PERMISSION_GROUP_DELETE');

      // 4. Verify G_SYSTEM_OPERATIONS does not receive USER_CREATE, ROLE_CREATE, PERMISSION_CREATE, or ADMIN_FULL
      const systemOpsCall = groupCalls.find(
        (c) => c[0].code === 'G_SYSTEM_OPERATIONS',
      );
      expect(systemOpsCall).toBeDefined();
      const systemOpsPerms = systemOpsCall[1].$addToSet.permissions.$each;
      expect(systemOpsPerms).not.toContain('id-USER_CREATE');
      expect(systemOpsPerms).not.toContain('id-ROLE_CREATE');
      expect(systemOpsPerms).not.toContain('id-PERMISSION_CREATE');
      expect(systemOpsPerms).not.toContain('id-ADMIN_FULL');

      // 5. Verify PDF template permissions are all available to the dormitory group
      const dormitoryCall = groupCalls.find(
        (c) => c[0].code === 'G_DORMITORY',
      );
      expect(dormitoryCall).toBeDefined();
      const dormitoryPerms = dormitoryCall[1].$addToSet.permissions.$each;
      expect(dormitoryPerms).toEqual(expect.arrayContaining([
        'id-PDF_TEMPLATE_READ',
        'id-PDF_TEMPLATE_MANAGE',
        'id-PDF_TEMPLATE_DELETE',
      ]));
    });
  });

  describe('startup initialization', () => {
    const startupSteps = [
      'migrateLegacyRoleCodes',
      'seedDeclaredPermissions',
      'seedRbac',
      'seedSystemAdmin',
      'migrateLegacyRoles',
      'migrateLegacyUserFields',
      'deduplicateRbacReferences',
    ] as const;

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('keeps required dependencies ordered while allowing independent user migrations to overlap', async () => {
      jest.restoreAllMocks();
      const calls: string[] = [];

      for (const step of startupSteps) {
        jest.spyOn(service as any, step).mockImplementation(async () => {
          calls.push(step);
        });
      }

      await service.onModuleInit();

      expect(calls.slice(0, 4)).toEqual([
        'migrateLegacyRoleCodes',
        'seedDeclaredPermissions',
        'seedRbac',
        'seedSystemAdmin',
      ]);
      expect(calls.slice(4, 6).sort()).toEqual([
        'migrateLegacyRoles',
        'migrateLegacyUserFields',
      ]);
      expect(calls[6]).toBe('deduplicateRbacReferences');
    });

    it('propagates a failed required startup step', async () => {
      jest.restoreAllMocks();
      const failure = new Error('seed failed');
      jest
        .spyOn(service as any, 'migrateLegacyRoleCodes')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'seedDeclaredPermissions')
        .mockResolvedValue(undefined);
      jest.spyOn(service as any, 'seedRbac').mockRejectedValue(failure);

      await expect(service.onModuleInit()).rejects.toBe(failure);
    });
  });
});
