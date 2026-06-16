import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { User, UserStatus } from '../schemas/user.schema';
import { LoginLog } from '../schemas/login-log.schema';
import { Role } from '../schemas/role.schema';
import { Permission } from '../schemas/permission.schema';
import { PermissionGroup } from '../schemas/permission-group.schema';
import { RoutePermission } from '../schemas/route-permission.schema';
import { Student } from '../../students/schemas/student.schema';
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
              exec: jest.fn().mockResolvedValue({ _id: 'mock-role-id', name: 'User' }),
            }),
            findById: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ _id: 'mock-role-id', name: 'User' }),
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
          },
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
      ).rejects.toThrow(new ForbiddenException('Tài khoản chưa được kích hoạt bởi quản trị viên.'));
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
        then: jest.fn().mockImplementation((callback) => Promise.resolve(user).then(callback)),
      };
      userModel.findById.mockReturnValue(mockQuery);

      // We need to mock getMe wrapper
      jest.spyOn(service, 'getMe').mockResolvedValue(user as any);

      // Active
      let result = await service.updateUser('507f1f77bcf86cd799439013', { status: 'active' }, '127.0.0.1');
      expect(result).toBeDefined();
      expect(user.status).toEqual(UserStatus.ACTIVE);

      // Inactive
      result = await service.updateUser('507f1f77bcf86cd799439013', { status: 'inactive' }, '127.0.0.1');
      expect(result).toBeDefined();
      expect(user.status).toEqual(UserStatus.INACTIVE);
      expect(user.failed_login_attempts).toEqual(0);
      expect(user.locked_until).toBeNull();

      // Locked
      result = await service.updateUser('507f1f77bcf86cd799439013', { status: 'locked' }, '127.0.0.1');
      expect(result).toBeDefined();
      expect(user.status).toEqual(UserStatus.LOCKED);
    });

    it('should reject invalid status', async () => {
      const user = {
        ...mockUser,
      };
      userModel.findById.mockResolvedValue(user);

      await expect(
        service.updateUser('507f1f77bcf86cd799439013', { status: 'invalid_status' }, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
