import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserStatus } from '../src/auth/schemas/user.schema';
import { Role } from '../src/auth/schemas/role.schema';
import { Student } from '../src/students/schemas/student.schema';
import { RefreshToken } from '../src/auth/schemas/refresh-token.schema';
import bcrypt from 'bcrypt';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let userModel: Model<User>;
  let roleModel: Model<Role>;
  let studentModel: Model<Student>;
  let refreshTokenModel: Model<RefreshToken>;

  let activeStudentUserId: Types.ObjectId;
  let inactiveStudentUserId: Types.ObjectId;
  let adminUserId: Types.ObjectId;
  let regularUserId: Types.ObjectId;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api', {
      exclude: ['health'],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    userModel = moduleFixture.get<Model<User>>(getModelToken(User.name));
    roleModel = moduleFixture.get<Model<Role>>(getModelToken(Role.name));
    studentModel = moduleFixture.get<Model<Student>>(getModelToken(Student.name));
    refreshTokenModel = moduleFixture.get<Model<RefreshToken>>(getModelToken(RefreshToken.name));

    await app.init();

    // 1. Clean up existing test data
    await studentModel.deleteMany({ student_code: { $in: ['20230005', '20230006'] } });
    await userModel.deleteMany({
      email: {
        $in: [
          '20230005@school.edu.vn',
          '20230006@school.edu.vn',
          'e2e_admin@school.edu.vn',
          'e2e_user@school.edu.vn',
        ],
      },
    });

    // 2. Ensure roles exist
    let adminRole = await roleModel.findOne({ role_code: 'ADMIN' });
    if (!adminRole) {
      adminRole = await roleModel.create({
        name: 'Admin',
        role_code: 'ADMIN',
        description: 'Administrator role',
      });
    }

    let studentRole = await roleModel.findOne({ role_code: 'STUDENT' });
    if (!studentRole) {
      studentRole = await roleModel.create({
        name: 'Student',
        role_code: 'STUDENT',
        description: 'Student role',
      });
    }

    let userRole = await roleModel.findOne({ role_code: 'USER' });
    if (!userRole) {
      userRole = await roleModel.create({
        name: 'User',
        role_code: 'USER',
        description: 'Regular user role',
      });
    }

    // 3. Create test users with hashed passwords
    // Note: BCRYPT_ROUNDS = 12 is used by PasswordService, we hash with 12 rounds here
    const hashedStudentPassword = await bcrypt.hash('15082003', 12);
    const hashedAdminPassword = await bcrypt.hash('AdminPass123', 12);
    const hashedUserPassword = await bcrypt.hash('UserPass123', 12);

    const activeUser = await userModel.create({
      user_name: '20230005',
      email: '20230005@school.edu.vn',
      pw_hash: hashedStudentPassword,
      status: UserStatus.ACTIVE,
      role: studentRole._id,
    });
    activeStudentUserId = activeUser._id as Types.ObjectId;

    await studentModel.create({
      student_code: '20230005',
      full_name: 'E2E Student Active',
      email: '20230005@school.edu.vn',
      date_bir: new Date('2003-08-15'),
      sex: 'Male',
      status: 'Studying',
      user_id: activeUser._id,
    });

    const inactiveUser = await userModel.create({
      user_name: '20230006',
      email: '20230006@school.edu.vn',
      pw_hash: hashedStudentPassword,
      status: UserStatus.INACTIVE,
      role: studentRole._id,
    });
    inactiveStudentUserId = inactiveUser._id as Types.ObjectId;

    await studentModel.create({
      student_code: '20230006',
      full_name: 'E2E Student Inactive',
      email: '20230006@school.edu.vn',
      date_bir: new Date('2003-08-15'),
      sex: 'Male',
      status: 'Studying',
      user_id: inactiveUser._id,
    });

    const adminUser = await userModel.create({
      user_name: 'e2e_admin',
      email: 'e2e_admin@school.edu.vn',
      pw_hash: hashedAdminPassword,
      status: UserStatus.ACTIVE,
      role: adminRole._id,
    });
    adminUserId = adminUser._id as Types.ObjectId;

    const regularUser = await userModel.create({
      user_name: 'e2e_user',
      email: 'e2e_user@school.edu.vn',
      pw_hash: hashedUserPassword,
      status: UserStatus.ACTIVE,
      role: userRole._id,
    });
    regularUserId = regularUser._id as Types.ObjectId;
  });

  afterAll(async () => {
    // Clean up created mock data
    await studentModel.deleteMany({ student_code: { $in: ['20230005', '20230006'] } });
    await userModel.deleteMany({
      _id: { $in: [activeStudentUserId, inactiveStudentUserId, adminUserId, regularUserId] },
    });
    await refreshTokenModel.deleteMany({
      user_id: { $in: [activeStudentUserId, inactiveStudentUserId, adminUserId, regularUserId] },
    });
    await app.close();
  });

  describe('Đăng nhập sinh viên (MSSV + ngày sinh)', () => {
    it('Gửi request POST /api/auth/login với { email: "20230005", password: "15082005" } (sai mật khẩu) -> mong đợi 401', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: '20230005',
          password: '15082005',
        })
        .expect(401);
    });

    it('Gửi request POST /api/auth/login với { email: "20230005", password: "15082003" } (đúng mật khẩu) -> mong đợi 200 và cookie refresh_token tồn tại', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: '20230005',
          password: '15082003',
        })
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.access_token).toBeDefined();

          const cookies = res.headers['set-cookie'] || [];
          const refreshTokenCookie = cookies.find((cookie: string) => cookie.includes('refresh_token='));
          expect(refreshTokenCookie).toBeDefined();
          expect(refreshTokenCookie).toContain('HttpOnly');
          expect(refreshTokenCookie).toContain('Path=/api/auth');
        });
    });

    it('Đăng nhập sinh viên inactive -> mong đợi 403', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: '20230006',
          password: '15082003',
        })
        .expect(403);
    });
  });

  describe('Kiểm tra cookie maxAge cho Admin vs User (remember=true)', () => {
    it('Gửi request POST /api/auth/login cho Admin với { email: <admin_email>, password: <password>, remember: true } -> Max-Age=14400', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'e2e_admin@school.edu.vn',
          password: 'AdminPass123',
          remember: true,
        })
        .expect(200)
        .then((res) => {
          const cookies = res.headers['set-cookie'] || [];
          const refreshTokenCookie = cookies.find((cookie: string) => cookie.startsWith('refresh_token='));
          expect(refreshTokenCookie).toBeDefined();
          expect(refreshTokenCookie).toContain('Max-Age=14400');
          expect(refreshTokenCookie).toContain('HttpOnly');
          expect(refreshTokenCookie).toContain('Path=/api/auth');
        });
    });

    it('Gửi request POST /api/auth/login cho User với { email: <user_email>, password: <password>, remember: true } -> Max-Age=2592000', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'e2e_user@school.edu.vn',
          password: 'UserPass123',
          remember: true,
        })
        .expect(200)
        .then((res) => {
          const cookies = res.headers['set-cookie'] || [];
          const refreshTokenCookie = cookies.find((cookie: string) => cookie.startsWith('refresh_token='));
          expect(refreshTokenCookie).toBeDefined();
          expect(refreshTokenCookie).toContain('Max-Age=2592000');
          expect(refreshTokenCookie).toContain('HttpOnly');
          expect(refreshTokenCookie).toContain('Path=/api/auth');
        });
    });
  });

  describe('Xoay vòng token (Refresh Token Rotation)', () => {
    it('Đăng nhập thông thường -> lấy cookie refresh_token -> gọi POST /api/auth/refresh -> nhận access_token mới và cookie refresh_token mới', async () => {
      // 1. Đăng nhập
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: '20230005',
          password: '15082003',
        })
        .expect(200);

      const cookies = loginRes.headers['set-cookie'] || [];
      const refreshTokenCookie = cookies.find((cookie: string) => cookie.startsWith('refresh_token='));
      expect(refreshTokenCookie).toBeDefined();

      // Trích xuất phần cookie thô refresh_token=value
      const rawCookie = refreshTokenCookie?.split(';')[0];
      expect(rawCookie).toBeDefined();

      // 2. Gọi refresh token
      const refreshRes = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [rawCookie!])
        .expect(200);

      expect(refreshRes.body).toBeDefined();
      expect(refreshRes.body.access_token).toBeDefined();

      const newCookies = refreshRes.headers['set-cookie'] || [];
      const newRefreshTokenCookie = newCookies.find((cookie: string) => cookie.startsWith('refresh_token='));
      expect(newRefreshTokenCookie).toBeDefined();
      expect(newRefreshTokenCookie).not.toBe(refreshTokenCookie);
      expect(newRefreshTokenCookie).toContain('HttpOnly');
      expect(newRefreshTokenCookie).toContain('Path=/api/auth');
    });

    it('Gửi request POST /api/auth/refresh không có cookie -> mong đợi 401 Phiên làm việc đã kết thúc', async () => {
      const refreshRes = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .expect(401);

      expect(refreshRes.body.message).toBe('Phiên làm việc đã kết thúc');
    });

    it('Refresh token đã rotate trong grace period -> vẫn trả token mới hợp lệ', async () => {
      // 1. Đăng nhập
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: '20230005',
          password: '15082003',
        })
        .expect(200);

      const rawCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('refresh_token='))?.split(';')[0];

      // 2. Refresh lần 1
      const refresh1Res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [rawCookie!])
        .expect(200);

      const rawCookie2 = refresh1Res.headers['set-cookie']?.find((c: string) => c.startsWith('refresh_token='))?.split(';')[0];
      
      // 3. Refresh lần 2 với cookie cũ (grace period)
      const refresh2Res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [rawCookie!])
        .expect(200);

      expect(refresh2Res.body.access_token).toBeDefined();
      const rawCookie3 = refresh2Res.headers['set-cookie']?.find((c: string) => c.startsWith('refresh_token='))?.split(';')[0];
      expect(rawCookie3).toBeDefined();
      expect(rawCookie3).not.toBe(rawCookie2);
    });

    it('Gửi request POST /api/auth/refresh với cookie còn hạn nhưng DB không có (do restore) -> mong đợi 401 và xoá cookie', async () => {
      // 1. Đăng nhập
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: '20230005',
          password: '15082003',
        })
        .expect(200);

      const rawCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('refresh_token='))?.split(';')[0];

      // 2. Xóa refresh token khỏi DB
      await refreshTokenModel.deleteMany({});

      // 3. Gọi refresh
      const refreshRes = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [rawCookie!])
        .expect(401);

      // Phải có header clear cookie (thường set lại cookie rỗng hoặc Max-Age/Expires về 0/quá khứ)
      const cookies = refreshRes.headers['set-cookie'] || [];
      const refreshTokenCookie = cookies.find((cookie: string) => cookie.startsWith('refresh_token='));
      expect(refreshTokenCookie).toBeDefined();
      // Express clearCookie thường set path=/api/auth; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly
      expect(refreshTokenCookie).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT|Max-Age=0/i);
    });
  });
});
