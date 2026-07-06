import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';

jest.mock('uuid', () => ({
  v4: () => 'mocked-uuid',
}));

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    createUser: jest.fn(),
    createUsersBulk: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
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
});
