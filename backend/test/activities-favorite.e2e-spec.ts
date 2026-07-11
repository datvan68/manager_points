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
import { Activity } from '../src/activities/schemas/activity.schema';
import { Semester } from '../src/semesters/schemas/semester.schema';
import { ActivityFavorite } from '../src/activities/schemas/activity-favorite.schema';
import { Permission } from '../src/auth/schemas/permission.schema';
import bcrypt from 'bcrypt';

describe('Activitys Favorite (e2e)', () => {
  let app: INestApplication;
  let userModel: Model<User>;
  let roleModel: Model<Role>;
  let studentModel: Model<Student>;
  let clubModel: Model<Activity>;
  let semesterModel: Model<Semester>;
  let favoriteModel: Model<ActivityFavorite>;

  let testStudentUserId: Types.ObjectId;
  let testAdvisorUserId: Types.ObjectId;
  let testTeacherUserId: Types.ObjectId;
  let testStudentId: Types.ObjectId;
  let testSemesterId: Types.ObjectId;
  let testActivityId: Types.ObjectId;
  let studentAccessToken: string;
  let teacherAccessToken: string;
  let adminAccessToken: string;

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
    studentModel = moduleFixture.get<Model<Student>>(
      getModelToken(Student.name),
    );
    clubModel = moduleFixture.get<Model<Activity>>(getModelToken(Activity.name));
    semesterModel = moduleFixture.get<Model<Semester>>(
      getModelToken(Semester.name),
    );
    favoriteModel = moduleFixture.get<Model<ActivityFavorite>>(
      getModelToken(ActivityFavorite.name),
    );

    await app.init();

    // 1. Clean up old test data
    await clubModel.deleteMany({ code: 'E2E-FAV-CLUB' });
    await studentModel.deleteMany({ student_code: '20239999' });
    await userModel.deleteMany({
      email: {
        $in: [
          'e2e_fav_student@school.edu.vn',
          'e2e_fav_advisor@school.edu.vn',
          'e2e_fav_teacher@school.edu.vn',
        ],
      },
    });
    await semesterModel.deleteMany({ semester_name: 'E2E Fav Semester' });

    // Ensure ACTIVITY_READ permission exists
    const permissionModel = moduleFixture.get<Model<any>>(
      getModelToken(Permission.name),
    );
    let clubReadPerm = await permissionModel.findOne({ code: 'ACTIVITY_READ' });
    if (!clubReadPerm) {
      clubReadPerm = await permissionModel.create({
        code: 'ACTIVITY_READ',
        name: 'Xem Hoạt động',
        module: 'Quản lý Hoạt động',
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
      if (
        !currentPerms.some(
          (p: any) => p.toString() === clubReadPerm._id.toString(),
        )
      ) {
        studentRole.permissions = [...currentPerms, clubReadPerm._id];
        await studentRole.save();
      }
    }

    let teacherRole = await roleModel.findOne({ role_code: 'TEACHER' });
    if (!teacherRole) {
      teacherRole = await roleModel.create({
        name: 'Teacher',
        role_code: 'TEACHER',
        description: 'Teacher role',
        permissions: [clubReadPerm._id],
      });
    } else {
      const currentPerms = teacherRole.permissions || [];
      if (
        !currentPerms.some(
          (p: any) => p.toString() === clubReadPerm._id.toString(),
        )
      ) {
        teacherRole.permissions = [...currentPerms, clubReadPerm._id];
        await teacherRole.save();
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
    const hashedPassword = await bcrypt.hash('15082003', 12);
    const studentUser = await userModel.create({
      user_name: '20239999',
      email: 'e2e_fav_student@school.edu.vn',
      pw_hash: hashedPassword,
      status: UserStatus.ACTIVE,
      role: studentRole._id,
    });
    testStudentUserId = studentUser._id;

    const student = await studentModel.create({
      student_code: '20239999',
      full_name: 'E2E Fav Student',
      email: 'e2e_fav_student@school.edu.vn',
      date_bir: new Date('2003-08-15'),
      sex: 'Male',
      status: 'Studying',
      user_id: studentUser._id,
    });
    testStudentId = student._id;

    // 4. Create teacher user
    const teacherUser = await userModel.create({
      user_name: 'e2e_fav_teacher',
      email: 'e2e_fav_teacher@school.edu.vn',
      pw_hash: hashedPassword,
      status: UserStatus.ACTIVE,
      role: teacherRole._id,
    });
    testTeacherUserId = teacherUser._id;

    // 5. Create advisor/admin user
    const advisorUser = await userModel.create({
      user_name: 'e2e_fav_advisor',
      email: 'e2e_fav_advisor@school.edu.vn',
      pw_hash: hashedPassword,
      status: UserStatus.ACTIVE,
      role: adminRole._id,
    });
    testAdvisorUserId = advisorUser._id;

    // 6. Create semester
    const semester = await semesterModel.create({
      semester_name: 'E2E Fav Semester',
      start_date: new Date('2026-01-01'),
      end_date: new Date('2026-06-30'),
      status: 'active',
    });
    testSemesterId = semester._id;

    // 7. Create club
    const club = await clubModel.create({
      name: 'E2E Favorite Activity',
      code: 'E2E-FAV-CLUB',
      description: 'Activity for E2E Favorite testing',
      category: 'technology',
      classroom: 'Room 101',
      advisor_id: testAdvisorUserId,
      status: 'active',
      semester_id: testSemesterId,
    });
    testActivityId = club._id;

    // 8. Login all three roles
    const studentLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: '20239999', password: '15082003' });
    studentAccessToken = studentLogin.body.access_token;

    const teacherLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'e2e_fav_teacher', password: '15082003' });
    teacherAccessToken = teacherLogin.body.access_token;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'e2e_fav_advisor', password: '15082003' });
    adminAccessToken = adminLogin.body.access_token;
  });

  afterAll(async () => {
    // Clean up
    await favoriteModel.deleteMany({ activity_id: testActivityId });
    await clubModel.deleteMany({ _id: testActivityId });
    await studentModel.deleteMany({ _id: testStudentId });
    await userModel.deleteMany({
      _id: { $in: [testStudentUserId, testAdvisorUserId, testTeacherUserId] },
    });
    await semesterModel.deleteMany({ _id: testSemesterId });
    await app.close();
  });

  describe('Activity Favorite Actions', () => {
    it('GET /api/activities/favorites/me - nên trả về danh sách trống ban đầu', () => {
      return request(app.getHttpServer())
        .get('/api/activities/favorites/me')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.activity_ids).toBeDefined();
          expect(res.body.activity_ids).toEqual([]);
        });
    });

    it('POST /api/activities/:id/favorite - yêu thích câu lạc bộ', () => {
      return request(app.getHttpServer())
        .post(`/api/activities/${testActivityId}/favorite`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(201)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.activity_id).toBe(testActivityId.toString());
          expect(res.body.is_favorited).toBe(true);
          expect(res.body.favorite_count).toBe(1);
        });
    });

    it('GET /api/activities/favorites/me - sau khi yêu thích, nên chứa activity_id', () => {
      return request(app.getHttpServer())
        .get('/api/activities/favorites/me')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.activity_ids).toContain(testActivityId.toString());
        });
    });

    it('GET /api/activities/:id/stats - stats nên bao gồm favorite_count', () => {
      return request(app.getHttpServer())
        .get(`/api/activities/${testActivityId}/stats`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.favorite_count).toBe(1);
        });
    });

    it('DELETE /api/activities/:id/favorite - hủy yêu thích câu lạc bộ', () => {
      return request(app.getHttpServer())
        .delete(`/api/activities/${testActivityId}/favorite`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.activity_id).toBe(testActivityId.toString());
          expect(res.body.is_favorited).toBe(false);
          expect(res.body.favorite_count).toBe(0);
        });
    });

    it('GET /api/activities/favorites/me - sau khi hủy yêu thích, danh sách nên trống', () => {
      return request(app.getHttpServer())
        .get('/api/activities/favorites/me')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.activity_ids).not.toContain(testActivityId.toString());
        });
    });
  });

  describe('Multi-role Favorite Coverage', () => {
    afterEach(async () => {
      // Clean up favorites between tests
      await favoriteModel.deleteMany({ activity_id: testActivityId });
    });

    it('TEACHER can favorite and unfavorite a club', async () => {
      // Favorite
      const favRes = await request(app.getHttpServer())
        .post(`/api/activities/${testActivityId}/favorite`)
        .set('Authorization', `Bearer ${teacherAccessToken}`)
        .expect(201);

      expect(favRes.body.is_favorited).toBe(true);
      expect(favRes.body.favorite_count).toBe(1);

      // Unfavorite
      const unfavRes = await request(app.getHttpServer())
        .delete(`/api/activities/${testActivityId}/favorite`)
        .set('Authorization', `Bearer ${teacherAccessToken}`)
        .expect(200);

      expect(unfavRes.body.is_favorited).toBe(false);
      expect(unfavRes.body.favorite_count).toBe(0);
    });

    it('ADMIN can favorite and unfavorite a club', async () => {
      // Favorite
      const favRes = await request(app.getHttpServer())
        .post(`/api/activities/${testActivityId}/favorite`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(201);

      expect(favRes.body.is_favorited).toBe(true);
      expect(favRes.body.favorite_count).toBe(1);

      // Unfavorite
      const unfavRes = await request(app.getHttpServer())
        .delete(`/api/activities/${testActivityId}/favorite`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(unfavRes.body.is_favorited).toBe(false);
      expect(unfavRes.body.favorite_count).toBe(0);
    });

    it('one user favoriting does not affect another user\'s favorite', async () => {
      // Student favorites
      await request(app.getHttpServer())
        .post(`/api/activities/${testActivityId}/favorite`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(201);

      // Teacher favorites
      const teacherFav = await request(app.getHttpServer())
        .post(`/api/activities/${testActivityId}/favorite`)
        .set('Authorization', `Bearer ${teacherAccessToken}`)
        .expect(201);

      expect(teacherFav.body.favorite_count).toBe(2);

      // Student unfavorites — should not affect teacher's favorite
      const studentUnfav = await request(app.getHttpServer())
        .delete(`/api/activities/${testActivityId}/favorite`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200);

      expect(studentUnfav.body.favorite_count).toBe(1);

      // Verify teacher's favorite still exists
      const teacherFavs = await request(app.getHttpServer())
        .get('/api/activities/favorites/me')
        .set('Authorization', `Bearer ${teacherAccessToken}`)
        .expect(200);

      expect(teacherFavs.body.activity_ids).toContain(testActivityId.toString());
    });
  });

  describe('Duplicate POST Idempotency', () => {
    afterEach(async () => {
      await favoriteModel.deleteMany({ activity_id: testActivityId });
    });

    it('repeated sequential POST creates one favorite record and returns count 1', async () => {
      // First POST
      const res1 = await request(app.getHttpServer())
        .post(`/api/activities/${testActivityId}/favorite`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(201);

      expect(res1.body.is_favorited).toBe(true);
      expect(res1.body.favorite_count).toBe(1);

      // Second POST (duplicate) — should be idempotent
      const res2 = await request(app.getHttpServer())
        .post(`/api/activities/${testActivityId}/favorite`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(201);

      expect(res2.body.is_favorited).toBe(true);
      expect(res2.body.favorite_count).toBe(1);

      // Verify only one persisted record
      const count = await favoriteModel.countDocuments({
        activity_id: testActivityId,
        user_id: testStudentUserId,
      });
      expect(count).toBe(1);
    });

    it('stats favorite_count equals persisted records after multi-user favorite', async () => {
      // Student favorites
      await request(app.getHttpServer())
        .post(`/api/activities/${testActivityId}/favorite`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(201);

      // Admin favorites
      await request(app.getHttpServer())
        .post(`/api/activities/${testActivityId}/favorite`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(201);

      // Verify persisted count
      const persistedCount = await favoriteModel.countDocuments({
        activity_id: testActivityId,
      });
      expect(persistedCount).toBe(2);

      // Verify stats API matches
      const statsRes = await request(app.getHttpServer())
        .get(`/api/activities/${testActivityId}/stats`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200);

      expect(statsRes.body.favorite_count).toBe(persistedCount);
    });
  });

  describe('Unauthenticated requests', () => {
    it('POST /api/activities/:id/favorite without token should return 401', () => {
      return request(app.getHttpServer())
        .post(`/api/activities/${testActivityId}/favorite`)
        .expect(401);
    });

    it('DELETE /api/activities/:id/favorite without token should return 401', () => {
      return request(app.getHttpServer())
        .delete(`/api/activities/${testActivityId}/favorite`)
        .expect(401);
    });
  });
});
