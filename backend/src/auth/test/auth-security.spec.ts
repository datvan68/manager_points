import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';

jest.mock('uuid', () => ({
  v4: () => 'mocked-uuid',
}));
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { TokenService } from '../services/token.service';
import { AuthService } from '../services/auth.service';
import { PasswordService } from '../services/password.service';
import { RbacService } from '../services/rbac.service';
import { User, UserStatus } from '../schemas/user.schema';
import { RefreshToken } from '../schemas/refresh-token.schema';
import { LoginLog } from '../schemas/login-log.schema';
import { Role } from '../schemas/role.schema';
import { Permission } from '../schemas/permission.schema';
import { Student } from '../../students/schemas/student.schema';
import { PermissionGroup } from '../schemas/permission-group.schema';
import { RoutePermission } from '../schemas/route-permission.schema';
import { AuthController } from '../controllers/auth.controller';

describe('Auth Security (Student Account Policies)', () => {
  // Test JwtStrategy
  describe('JwtStrategy', () => {
    let jwtStrategy: JwtStrategy;
    let userModel: any;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JwtStrategy,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue('mock-jwt-secret'),
            },
          },
          {
            provide: getModelToken(User.name),
            useValue: {
              findById: jest.fn(),
            },
          },
        ],
      }).compile();

      jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
      userModel = module.get(getModelToken(User.name));
    });

    it('should allow active user to validate successfully', async () => {
      const mockActiveUser = {
        _id: 'user-id',
        user_name: 'test_student',
        email: 'student@school.edu.vn',
        status: UserStatus.ACTIVE,
        role: {
          name: 'Student',
          role_code: 'STUDENT',
          permissions: [{ code: 'STUDENT_ACCOUNT_VIEW' }],
        },
      };

      userModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockImplementation(() => ({
          then: jest.fn().mockImplementation((cb) => Promise.resolve(mockActiveUser).then(cb)),
        })),
      });

      const result = await jwtStrategy.validate({ user_id: 'user-id' });
      expect(result).toBeDefined();
      expect(result.userId).toBe('user-id');
      expect(result.roleName).toBe('Student');
      expect(result.permissions).toContain('STUDENT_ACCOUNT_VIEW');
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const mockInactiveUser = {
        _id: 'user-id',
        status: UserStatus.INACTIVE,
      };

      userModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockImplementation(() => ({
          then: jest.fn().mockImplementation((cb) => Promise.resolve(mockInactiveUser).then(cb)),
        })),
      });

      await expect(jwtStrategy.validate({ user_id: 'user-id' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for locked user', async () => {
      const mockLockedUser = {
        _id: 'user-id',
        status: UserStatus.LOCKED,
      };

      userModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockImplementation(() => ({
          then: jest.fn().mockImplementation((cb) => Promise.resolve(mockLockedUser).then(cb)),
        })),
      });

      await expect(jwtStrategy.validate({ user_id: 'user-id' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // Test TokenService
  describe('TokenService', () => {
    let tokenService: TokenService;
    let refreshTokenModel: any;
    let userModel: any;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TokenService,
          {
            provide: getModelToken(RefreshToken.name),
            useValue: {
              findOne: jest.fn(),
              deleteOne: jest.fn(),
              create: jest.fn(),
              updateMany: jest.fn(),
            },
          },
          {
            provide: getModelToken(User.name),
            useValue: {
              findById: jest.fn(),
            },
          },
          {
            provide: JwtService,
            useValue: {
              sign: jest.fn().mockReturnValue('mock-new-access-token'),
            },
          },
        ],
      }).compile();

      tokenService = module.get<TokenService>(TokenService);
      refreshTokenModel = module.get(getModelToken(RefreshToken.name));
      userModel = module.get(getModelToken(User.name));
    });

    it('should successfully refresh token if user is active', async () => {
      const userId = new Types.ObjectId();
      const mockToken = {
        _id: 'token-id',
        user_id: userId,
        token: 'valid-refresh-token',
        expires_at: new Date(Date.now() + 10000),
        is_revoked: false,
        save: jest.fn().mockResolvedValue(true),
      };

      const mockActiveUser = {
        _id: userId,
        status: UserStatus.ACTIVE,
      };

      refreshTokenModel.findOne.mockResolvedValue(mockToken);
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockActiveUser),
      });

      const result = await tokenService.refreshToken('valid-refresh-token');
      expect(result).toBeDefined();
      expect(result.access_token).toBe('mock-new-access-token');
      expect(mockToken.is_revoked).toBe(true);
    });

    it('should throw UnauthorizedException when refreshing token of an inactive user', async () => {
      const userId = new Types.ObjectId();
      const mockToken = {
        user_id: userId,
        token: 'valid-refresh-token',
      };

      const mockInactiveUser = {
        _id: userId,
        status: UserStatus.INACTIVE,
      };

      refreshTokenModel.findOne.mockResolvedValue(mockToken);
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockInactiveUser),
      });

      await expect(tokenService.refreshToken('valid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when refreshing token of a locked user', async () => {
      const userId = new Types.ObjectId();
      const mockToken = {
        user_id: userId,
        token: 'valid-refresh-token',
      };

      const mockLockedUser = {
        _id: userId,
        status: UserStatus.LOCKED,
      };

      refreshTokenModel.findOne.mockResolvedValue(mockToken);
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockLockedUser),
      });

      await expect(tokenService.refreshToken('valid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should allow concurrent refresh within 10s grace period and return replaced token info', async () => {
      const userId = new Types.ObjectId();
      const now = new Date();
      const mockToken = {
        _id: 'token-id',
        user_id: userId,
        token: 'revoked-refresh-token',
        expires_at: new Date(now.getTime() + 10000),
        is_revoked: true,
        replaced_by: 'replaced-refresh-token',
        updatedAt: now,
        save: jest.fn().mockResolvedValue(true),
      };

      const mockReplacedToken = {
        _id: 'replaced-token-id',
        user_id: userId,
        token: 'replaced-refresh-token',
        expires_at: new Date(now.getTime() + 10000),
        is_revoked: false,
        remember: true,
      };

      const mockActiveUser = {
        _id: userId,
        status: UserStatus.ACTIVE,
      };

      refreshTokenModel.findOne
        .mockResolvedValueOnce(mockToken)
        .mockResolvedValueOnce(mockReplacedToken);

      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockActiveUser),
      });

      const result = await tokenService.refreshToken('revoked-refresh-token');
      expect(result).toBeDefined();
      expect(result.access_token).toBe('mock-new-access-token');
      expect(result.refresh_token).toBe('replaced-refresh-token');
    });
  });

  // Test AuthService Lock logic & updateUser token revocation
  describe('AuthService Security', () => {
    let authService: AuthService;
    let userModel: any;
    let tokenService: any;
    let passwordService: any;
    let roleModel: any;
    let studentModel: any;

    const mockRole = {
      _id: new Types.ObjectId(),
      name: 'Student',
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: getModelToken(User.name),
            useValue: {
              findOne: jest.fn(),
              findById: jest.fn(),
              create: jest.fn(),
              find: jest.fn(),
            },
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
                exec: jest.fn().mockResolvedValue(mockRole),
              }),
              findById: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockRole),
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
              find: jest.fn(),
              findOne: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
              }),
            },
          },
          {
            provide: TokenService,
            useValue: {
              generateAccessToken: jest.fn().mockReturnValue('access-token'),
              createRefreshToken: jest.fn().mockResolvedValue('refresh-token'),
              revokeAllUserTokens: jest.fn().mockResolvedValue(undefined),
            },
          },
          {
            provide: PasswordService,
            useValue: {
              comparePassword: jest.fn(),
              hashPassword: jest.fn().mockResolvedValue('hashed-password'),
            },
          },
          {
            provide: RbacService,
            useValue: {
              getRoles: jest.fn(),
              getPermissions: jest.fn(),
            },
          },
        ],
      }).compile();

      authService = module.get<AuthService>(AuthService);
      userModel = module.get(getModelToken(User.name));
      tokenService = module.get(TokenService);
      passwordService = module.get(PasswordService);
      roleModel = module.get(getModelToken(Role.name));
      studentModel = module.get(getModelToken(Student.name));
      jest.spyOn(authService, 'onModuleInit').mockImplementation(async () => {});
    });

    describe('Account Lock / Inactive / Auto-Unlock Logic', () => {
      it('should throw ForbiddenException for inactive user login attempt', async () => {
        const mockUser = {
          _id: new Types.ObjectId(),
          email: 'inactive@school.edu.vn',
          status: UserStatus.INACTIVE,
          role: mockRole,
        };

        userModel.findOne.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockUser),
        });

        await expect(
          authService.login({ email: 'inactive@school.edu.vn', password: 'password' }, '127.0.0.1'),
        ).rejects.toThrow(new ForbiddenException('Tài khoản chưa được kích hoạt bởi quản trị viên.'));
      });

      it('should throw ForbiddenException for manual lock (locked_until is null) indefinitely', async () => {
        const mockUser = {
          _id: new Types.ObjectId(),
          email: 'locked@school.edu.vn',
          status: UserStatus.LOCKED,
          locked_until: null,
          role: mockRole,
        };

        userModel.findOne.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockUser),
        });

        await expect(
          authService.login({ email: 'locked@school.edu.vn', password: 'password' }, '127.0.0.1'),
        ).rejects.toThrow(new ForbiddenException('Tài khoản đã bị khóa bởi quản trị viên.'));
      });

      it('should throw ForbiddenException if auto-lock locked_until is not expired', async () => {
        const futureDate = new Date(Date.now() + 15 * 60 * 1000); // 15 mins later
        const mockUser = {
          _id: new Types.ObjectId(),
          email: 'locked@school.edu.vn',
          status: UserStatus.LOCKED,
          locked_until: futureDate,
          role: mockRole,
        };

        userModel.findOne.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockUser),
        });

        await expect(
          authService.login({ email: 'locked@school.edu.vn', password: 'password' }, '127.0.0.1'),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should allow login and reset status if auto-lock locked_until has expired', async () => {
        const pastDate = new Date(Date.now() - 1000); // 1 sec ago
        const mockUser = {
          _id: new Types.ObjectId(),
          email: 'unlocked@school.edu.vn',
          pw_hash: 'hashed-password',
          status: UserStatus.LOCKED,
          locked_until: pastDate,
          failed_login_attempts: 5,
          role: mockRole,
          save: jest.fn().mockResolvedValue(true),
        };

        userModel.findOne.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockUser),
        });

        passwordService.comparePassword.mockResolvedValue(true);

        const result = await authService.login(
          { email: 'unlocked@school.edu.vn', password: 'password' },
          '127.0.0.1',
        );

        expect(result).toBeDefined();
        expect(mockUser.status).toBe(UserStatus.ACTIVE);
        expect(mockUser.failed_login_attempts).toBe(0);
        expect(mockUser.locked_until).toBeNull();
        expect(mockUser.save).toHaveBeenCalled();
      });
    });

    describe('Revoke Refresh Tokens on Security Events', () => {
      it('should revoke all refresh tokens when user status is changed to LOCKED or INACTIVE', async () => {
        const user = {
          _id: new Types.ObjectId(),
          status: UserStatus.ACTIVE,
          save: jest.fn().mockResolvedValue(true),
        };

        const mockQuery = {
          populate: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(user),
          then: jest.fn().mockImplementation((cb) => Promise.resolve(user).then(cb)),
        };
        userModel.findById.mockReturnValue(mockQuery);
        jest.spyOn(authService, 'getMe').mockResolvedValue(user as any);

        const revokeSpy = jest.spyOn(tokenService, 'revokeAllUserTokens');

        // Change status to LOCKED
        await authService.updateUser(user._id.toString(), { status: 'locked' }, '127.0.0.1');
        expect(user.status).toBe(UserStatus.LOCKED);
        expect(revokeSpy).toHaveBeenCalledWith(user._id.toString());

        revokeSpy.mockClear();

        // Change status to INACTIVE
        user.status = UserStatus.ACTIVE;
        await authService.updateUser(user._id.toString(), { status: 'inactive' }, '127.0.0.1');
        expect(user.status).toBe(UserStatus.INACTIVE);
        expect(revokeSpy).toHaveBeenCalledWith(user._id.toString());
      });

      it('should revoke all refresh tokens when user role is changed', async () => {
        const userRole = new Types.ObjectId();
        const newRole = {
          _id: new Types.ObjectId(),
          name: 'Teacher',
        };
        const user = {
          _id: new Types.ObjectId(),
          role: userRole,
          save: jest.fn().mockResolvedValue(true),
        };

        const mockQuery = {
          populate: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(user),
          then: jest.fn().mockImplementation((cb) => Promise.resolve(user).then(cb)),
        };
        userModel.findById.mockReturnValue(mockQuery);
        jest.spyOn(authService, 'getMe').mockResolvedValue(user as any);

        jest.spyOn(roleModel, 'findById').mockReturnValue({
          exec: jest.fn().mockResolvedValue(newRole),
          then: jest.fn().mockImplementation((cb) => Promise.resolve(newRole).then(cb)),
        } as any);

        const revokeSpy = jest.spyOn(tokenService, 'revokeAllUserTokens');

        await authService.updateUser(user._id.toString(), { role_id: newRole._id.toString() }, '127.0.0.1');
        expect(user.role.toString()).toBe(newRole._id.toString());
        expect(revokeSpy).toHaveBeenCalledWith(user._id.toString());
      });

      it('should revoke all refresh tokens when password is reset by administrator', async () => {
        const user = {
          _id: new Types.ObjectId(),
          status: UserStatus.ACTIVE,
          save: jest.fn().mockResolvedValue(true),
        };

        const mockQuery = {
          populate: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(user),
          then: jest.fn().mockImplementation((cb) => Promise.resolve(user).then(cb)),
        };
        userModel.findById.mockReturnValue(mockQuery);
        jest.spyOn(authService, 'getMe').mockResolvedValue(user as any);

        const revokeSpy = jest.spyOn(tokenService, 'revokeAllUserTokens');

        await authService.updateUser(user._id.toString(), { password: 'NewSecurePassword123!' }, '127.0.0.1');
        expect(revokeSpy).toHaveBeenCalledWith(user._id.toString());
      });
    });

    describe('getUsers() Display Name and Student Profile Sync', () => {
      it('should enrich users with student_profile and display_name for student accounts', async () => {
        const studentUserId = new Types.ObjectId();
        const regularUserId = new Types.ObjectId();

        const mockUsers = [
          {
            _id: studentUserId,
            user_name: 'SV001',
            email: 'sv001@school.edu.vn',
            role: mockRole,
            toObject: function() { return this; },
          },
          {
            _id: regularUserId,
            user_name: 'teacher1',
            email: 'teacher1@school.edu.vn',
            role: { _id: new Types.ObjectId(), name: 'Teacher' },
            toObject: function() { return this; },
          }
        ];

        userModel.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockUsers),
        });

        const mockStudents = [
          {
            _id: new Types.ObjectId(),
            student_code: 'SV001',
            full_name: 'Nguyen Van A',
            user_id: studentUserId,
            class_id: new Types.ObjectId(),
          }
        ];

        studentModel.find.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockStudents),
        });

        const result = await authService.getUsers();

        expect(result).toBeDefined();
        expect(result.length).toBe(2);

        const studentUser = result.find(u => u._id.toString() === studentUserId.toString());
        expect(studentUser).toBeDefined();
        expect(studentUser.display_name).toBe('Nguyen Van A');
        expect(studentUser.student_profile).toBeDefined();
        expect(studentUser.student_profile.student_code).toBe('SV001');
        expect(studentUser.student_profile.full_name).toBe('Nguyen Van A');
        expect(studentUser.user_name).toBe('SV001');

        const regularUser = result.find(u => u._id.toString() === regularUserId.toString());
        expect(regularUser).toBeDefined();
        expect(regularUser.display_name).toBe('teacher1');
        expect(regularUser.student_profile).toBeUndefined();
        expect(regularUser.user_name).toBe('teacher1');
      });
    });

    describe('Student Login and Activation Policies', () => {
      it('should allow active student to login using student code (numeric identifier) and correct password', async () => {
        const studentUserId = new Types.ObjectId();
        const mockStudentUser = {
          _id: studentUserId,
          user_name: '20230001',
          email: '20230001@school.edu.vn',
          pw_hash: 'hashed-dob-password',
          status: UserStatus.ACTIVE,
          failed_login_attempts: 0,
          locked_until: null,
          role: mockRole,
          save: jest.fn().mockResolvedValue(true),
        };

        userModel.findOne.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockStudentUser),
        });

        passwordService.comparePassword.mockResolvedValue(true);

        const result = await authService.login(
          { email: '20230001', password: 'password123' },
          '127.0.0.1',
        );

        expect(result).toBeDefined();
        expect(result.user.username).toBe('20230001');
        expect(result.user.role).toBe('Student');
        expect(mockStudentUser.save).toHaveBeenCalled();
      });

      it('should throw ForbiddenException for inactive student login even with correct password', async () => {
        const studentUserId = new Types.ObjectId();
        const mockStudentUser = {
          _id: studentUserId,
          user_name: '20230002',
          email: '20230002@school.edu.vn',
          pw_hash: 'hashed-dob-password',
          status: UserStatus.INACTIVE,
          failed_login_attempts: 0,
          locked_until: null,
          role: mockRole,
          save: jest.fn().mockResolvedValue(true),
        };

        userModel.findOne.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockStudentUser),
        });

        passwordService.comparePassword.mockResolvedValue(true);

        await expect(
          authService.login(
            { email: '20230002', password: 'password123' },
            '127.0.0.1',
          ),
        ).rejects.toThrow(new ForbiddenException('Tài khoản chưa được kích hoạt bởi quản trị viên.'));
      });

      it('should allow active student to login using student code (MSSV) and date of birth password in ddMMyyyy format', async () => {
        const studentUserId = new Types.ObjectId();
        const mockStudentUser = {
          _id: studentUserId,
          user_name: '20230123', // MSSV
          email: '20230123@school.edu.vn',
          pw_hash: 'hashed-dob-password',
          status: UserStatus.ACTIVE,
          failed_login_attempts: 0,
          locked_until: null,
          role: mockRole,
          save: jest.fn().mockResolvedValue(true),
        };

        userModel.findOne.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockStudentUser),
        });

        passwordService.comparePassword.mockResolvedValue(true);

        const result = await authService.login(
          { email: '20230123', password: '15082003' }, // Student code and ddMMyyyy password
          '127.0.0.1',
        );

        expect(result).toBeDefined();
        expect(result.user.username).toBe('20230123');
        expect(result.user.role).toBe('Student');
        expect(passwordService.comparePassword).toHaveBeenCalledWith('15082003', 'hashed-dob-password');
        expect(mockStudentUser.save).toHaveBeenCalled();
      });
    });
  });

  describe('AuthController - Cookie Settings', () => {
    let authController: AuthController;
    let authService: any;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [AuthController],
        providers: [
          {
            provide: AuthService,
            useValue: {
              login: jest.fn(),
            },
          },
        ],
      }).compile();

      authController = module.get<AuthController>(AuthController);
      authService = module.get(AuthService);
    });

    it('should set maxAge to 4 hours for Admin login with remember=true', async () => {
      const mockResult = {
        access_token: 'mock-access',
        refresh_token: 'mock-refresh',
        user: {
          id: 'admin-id',
          username: 'admin',
          role: 'Admin',
        },
      };

      authService.login.mockResolvedValue(mockResult);

      const mockRes = {
        cookie: jest.fn(),
      } as any;

      const mockReq = {
        ip: '127.0.0.1',
      };

      const result = await authController.login(
        { email: 'admin@school.edu.vn', password: 'password', remember: true },
        mockReq,
        mockRes,
      );

      expect(result).toBeDefined();
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'mock-refresh',
        expect.objectContaining({
          maxAge: 4 * 60 * 60 * 1000,
          sameSite: 'none',
          secure: true,
        }),
      );
    });

    it('should set maxAge to 30 days for regular User login with remember=true', async () => {
      const mockResult = {
        access_token: 'mock-access',
        refresh_token: 'mock-refresh',
        user: {
          id: 'user-id',
          username: 'user',
          role: 'User',
        },
      };

      authService.login.mockResolvedValue(mockResult);

      const mockRes = {
        cookie: jest.fn(),
      } as any;

      const mockReq = {
        ip: '127.0.0.1',
      };

      const result = await authController.login(
        { email: 'user@school.edu.vn', password: 'password', remember: true },
        mockReq,
        mockRes,
      );

      expect(result).toBeDefined();
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'mock-refresh',
        expect.objectContaining({
          maxAge: 30 * 24 * 60 * 60 * 1000,
          sameSite: 'none',
          secure: true,
        }),
      );
    });
  });
});
