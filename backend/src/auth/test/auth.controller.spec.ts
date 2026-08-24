import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { ImpersonationService } from '../services/impersonation.service';

jest.mock('uuid', () => ({
  v4: () => 'mocked-uuid',
}));

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    createUser: jest.fn(),
    createUsersBulk: jest.fn(),
    createImpersonation: jest.fn(),
    cancelImpersonation: jest.fn(),
    terminateImpersonation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ImpersonationService,
          useValue: { recordGuardDenied: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createUser', () => {
    it('should call authService.createUser with dto and ip', async () => {
      const dto: any = {
        user_name: 'testuser',
        email: 'test@example.com',
        password: 'password',
        role_id: 'some-role-id',
      };
      const req: any = { ip: '127.0.0.1' };
      const expectedResult = { message: 'Success' };

      mockAuthService.createUser.mockResolvedValue(expectedResult);

      const result = await controller.createUser(dto, req);

      expect(authService.createUser).toHaveBeenCalledWith(dto, '127.0.0.1');
      expect(result).toEqual(expectedResult);
    });

    it('should fallback to 0.0.0.0 if ip is not present in request', async () => {
      const dto: any = {};
      const req: any = { headers: {} };

      await controller.createUser(dto, req);

      expect(authService.createUser).toHaveBeenCalledWith(dto, '0.0.0.0');
    });
  });

  describe('createUsersBulk', () => {
    it('should call authService.createUsersBulk with dto and ip', async () => {
      const dto: any = {
        users: [
          {
            user_name: 'testuser',
            email: 'test@example.com',
            password: 'password',
            role_id: 'some-role-id',
          },
        ],
      };
      const req: any = { ip: '192.168.1.1' };
      const expectedResult = {
        total: 1,
        successCount: 1,
        failedCount: 0,
        successes: [],
        errors: [],
      };

      mockAuthService.createUsersBulk.mockResolvedValue(expectedResult);

      const result = await controller.createUsersBulk(dto, req);

      expect(authService.createUsersBulk).toHaveBeenCalledWith(
        dto,
        '192.168.1.1',
      );
      expect(result).toEqual(expectedResult);
    });

    it('should use x-forwarded-for header if ip is not present', async () => {
      const dto: any = { users: [] };
      const req: any = { headers: { 'x-forwarded-for': '10.0.0.1' } };

      await controller.createUsersBulk(dto, req);

      expect(authService.createUsersBulk).toHaveBeenCalledWith(dto, '10.0.0.1');
    });
  });

  describe('createImpersonation', () => {
    it('uses the exact child session cookie contract and never returns the refresh token', async () => {
      const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
      mockAuthService.createImpersonation.mockResolvedValue({
        access_token: 'child-access',
        refresh_token: 'child-refresh',
        user: { id: 'target-id', username: 'target', role: 'User' },
        impersonation: { id: 'lease-id', expires_at: expiresAt },
      });
      const response = { cookie: jest.fn() } as any;
      const result = await controller.createImpersonation(
        {
          user: { userId: 'admin-id' },
          ip: '127.0.0.1',
          headers: {},
        },
        {
          target_user_id: '507f1f77bcf86cd799439011',
          session_id: 'browser_session_01',
        },
        response,
      );

      expect(mockAuthService.createImpersonation).toHaveBeenCalledWith(
        'admin-id',
        '507f1f77bcf86cd799439011',
        'browser_session_01',
        '127.0.0.1',
      );
      expect(response.cookie).toHaveBeenCalledWith(
        'refresh_token_browser_session_01',
        'child-refresh',
        expect.objectContaining({ httpOnly: true, path: '/api/auth' }),
      );
      expect(result).toEqual({
        access_token: 'child-access',
        user: { id: 'target-id', username: 'target', role: 'User' },
        impersonation: { id: 'lease-id', expires_at: expiresAt },
      });
    });

    it('cancels a timed-out handoff and clears its refresh cookie', async () => {
      mockAuthService.cancelImpersonation.mockResolvedValue({
        cancelled: true,
      });
      const response = { clearCookie: jest.fn() } as any;

      await expect(
        controller.cancelImpersonation(
          {
            user: { userId: 'admin-id' },
            ip: '127.0.0.1',
            headers: {},
          },
          { session_id: 'browser_session_01' },
          response,
        ),
      ).resolves.toEqual({ cancelled: true });

      expect(mockAuthService.cancelImpersonation).toHaveBeenCalledWith(
        'admin-id',
        'browser_session_01',
        '127.0.0.1',
      );
      expect(response.clearCookie).toHaveBeenCalledWith(
        'refresh_token_browser_session_01',
        expect.objectContaining({ httpOnly: true, path: '/api/auth' }),
      );
    });

    it('terminates a target session through the admin endpoint without cookies', async () => {
      mockAuthService.terminateImpersonation.mockResolvedValue({ terminated: true });

      await expect(
        controller.terminateImpersonation(
          { user: { userId: 'admin-id' }, ip: '127.0.0.1', headers: {} },
          { target_user_id: '507f1f77bcf86cd799439011' },
        ),
      ).resolves.toEqual({ terminated: true });

      expect(mockAuthService.terminateImpersonation).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        '127.0.0.1',
      );
    });

    it('cannot turn an impersonated access token into an ordinary forked session', async () => {
      await expect(
        controller.forkSession(
          {
            user: {
              userId: 'target-id',
              impersonationSessionId: 'lease-id',
            },
          },
          { session_id: 'browser_session_fork' },
          { cookie: jest.fn() } as any,
        ),
      ).rejects.toThrow('Không thể nhân bản một phiên truy cập quản trị');
    });
  });
});
