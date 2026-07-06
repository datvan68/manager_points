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
import { Club } from '../src/clubs/schemas/club.schema';
import { Semester } from '../src/semesters/schemas/semester.schema';
import { ClubFavorite } from '../src/clubs/schemas/club-favorite.schema';
import { Permission } from '../src/auth/schemas/permission.schema';
import bcrypt from 'bcrypt';

describe('Clubs Favorite (e2e)', () => {
  let app: INestApplication;
  let userModel: Model<User>;
  let roleModel: Model<Role>;
  let studentModel: Model<Student>;
  let clubModel: Model<Club>;
  let semesterModel: Model<Semester>;
  let favoriteModel: Model<ClubFavorite>;

  let testStudentUserId: Types.ObjectId;
  let testAdvisorUserId: Types.ObjectId;
  let testStudentId: Types.ObjectId;
  let testSemesterId: Types.ObjectId;
  let testClubId: Types.ObjectId;
  let studentAccessToken: string;

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
      }),
    );

    userModel = moduleFixture.get<Model<User>>(getModelToken(User.name));
    roleModel = moduleFixture.get<Model<Role>>(getModelToken(Role.name));
    studentModel = moduleFixture.get<Model<Student>>(getModelToken(Student.name));
    clubModel = moduleFixture.get<Model<Club>>(getModelToken(Club.name));
    semesterModel = moduleFixture.get<Model<Semester>>(getModelToken(Semester.name));
    favoriteModel = moduleFixture.get<Model<ClubFavorite>>(getModelToken(ClubFavorite.name));

    await app.init();

    // 1. Clean up old test data
    await clubModel.deleteMany({ code: 'E2E-FAV-CLUB' });
    await studentModel.deleteMany({ student_code: '20239999' });
    await userModel.deleteMany({
      email: { $in: ['e2e_fav_student@school.edu.vn', 'e2e_fav_advisor@school.edu.vn'] },
    });
    await semesterModel.deleteMany({ semester_name: 'E2E Fav Semester' });

    // Ensure CLUB_READ permission exists
    const permissionModel = moduleFixture.get<Model<any>>(getModelToken(Permission.name));
    let clubReadPerm = await permissionModel.findOne({ code: 'CLUB_READ' });
    if (!clubReadPerm) {
      clubReadPerm = await permissionModel.create({
        code: 'CLUB_READ',
        name: 'Xem CLB',
        module: 'Quản lý Câu lạc bộ',
      });
    }

    // 2. Ensure Roles exist
    let studentRole = await roleModel.findOne({ role_code: 'STUDENT' });
    if (!studentRole) {
      studentRole = await roleModel.create({
        name: 'Student',
        role_code: 'STUDENT',
        description: 'Student role',
        permissions: [clubReadPerm._id],
      });
    } else {
      const currentPerms = studentRole.permissions || [];
      if (!currentPerms.some((p: any) => p.toString() === clubReadPerm._id.toString())) {
        studentRole.permissions = [...currentPerms, clubReadPerm._id];
        await studentRole.save();
      }
    }

    let adminRole = await roleModel.findOne({ role_code: 'ADMIN' });
    if (!adminRole) {
      adminRole = await roleModel.create({
        name: 'Admin',
        role_code: 'ADMIN',
        description: 'Admin role',
      });
    }

    // 3. Create active student user and student
    const hashedStudentPassword = await bcrypt.hash('15082003', 12);
    const studentUser = await userModel.create({
      user_name: '20239999',
      email: 'e2e_fav_student@school.edu.vn',
      pw_hash: hashedStudentPassword,
      status: UserStatus.ACTIVE,
      role: studentRole._id,
    });
    testStudentUserId = studentUser._id as Types.ObjectId;

    const student = await studentModel.create({
      student_code: '20239999',
      full_name: 'E2E Fav Student',
      email: 'e2e_fav_student@school.edu.vn',
      date_bir: new Date('2003-08-15'),
      sex: 'Male',
      status: 'Studying',
      user_id: studentUser._id,
    });
    testStudentId = student._id as Types.ObjectId;

    // 4. Create advisor user
    const advisorUser = await userModel.create({
      user_name: 'e2e_fav_advisor',
      email: 'e2e_fav_advisor@school.edu.vn',
      pw_hash: hashedStudentPassword,
      status: UserStatus.ACTIVE,
      role: adminRole._id,
    });
    testAdvisorUserId = advisorUser._id as Types.ObjectId;

    // 5. Create semester
    const semester = await semesterModel.create({
      semester_name: 'E2E Fav Semester',
      start_date: new Date('2026-01-01'),
      end_date: new Date('2026-06-30'),
      status: 'active',
    });
    testSemesterId = semester._id as Types.ObjectId;

    // 6. Create club
    const club = await clubModel.create({
      name: 'E2E Favorite Club',
      code: 'E2E-FAV-CLUB',
      description: 'Club for E2E Favorite testing',
      category: 'technology',
      advisor_id: testAdvisorUserId,
      status: 'active',
      semester_id: testSemesterId,
    });
    testClubId = club._id as Types.ObjectId;

    // 7. Login student to get Access Token
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: '20239999',
        password: '15082003',
      });
    studentAccessToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    // Clean up
    await favoriteModel.deleteMany({ club_id: testClubId });
    await clubModel.deleteMany({ _id: testClubId });
    await studentModel.deleteMany({ _id: testStudentId });
    await userModel.deleteMany({
      _id: { $in: [testStudentUserId, testAdvisorUserId] },
    });
    await semesterModel.deleteMany({ _id: testSemesterId });
    await app.close();
  });

  describe('Club Favorite Actions', () => {
    it('GET /api/clubs/favorites/me - nên trả về danh sách trống ban đầu', () => {
      return request(app.getHttpServer())
        .get('/api/clubs/favorites/me')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.club_ids).toBeDefined();
          expect(res.body.club_ids).toEqual([]);
        });
    });

    it('POST /api/clubs/:id/favorite - yêu thích câu lạc bộ', () => {
      return request(app.getHttpServer())
        .post(`/api/clubs/${testClubId}/favorite`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(201)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.club_id).toBe(testClubId.toString());
          expect(res.body.is_favorited).toBe(true);
          expect(res.body.favorite_count).toBe(1);
        });
    });

    it('GET /api/clubs/favorites/me - sau khi yêu thích, nên chứa club_id', () => {
      return request(app.getHttpServer())
        .get('/api/clubs/favorites/me')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.club_ids).toContain(testClubId.toString());
        });
    });

    it('GET /api/clubs/:id/stats - stats nên bao gồm favorite_count', () => {
      return request(app.getHttpServer())
        .get(`/api/clubs/${testClubId}/stats`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.favorite_count).toBe(1);
        });
    });

    it('DELETE /api/clubs/:id/favorite - hủy yêu thích câu lạc bộ', () => {
      return request(app.getHttpServer())
        .delete(`/api/clubs/${testClubId}/favorite`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.club_id).toBe(testClubId.toString());
          expect(res.body.is_favorited).toBe(false);
          expect(res.body.favorite_count).toBe(0);
        });
    });

    it('GET /api/clubs/favorites/me - sau khi hủy yêu thích, danh sách nên trống', () => {
      return request(app.getHttpServer())
        .get('/api/clubs/favorites/me')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.club_ids).not.toContain(testClubId.toString());
        });
    });
  });
});
