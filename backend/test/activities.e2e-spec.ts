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
import { ClubMember } from '../src/clubs/schemas/club-member.schema';
import { ActivityCompletionRule } from '../src/club-attendance/schemas/activity-completion-rule.schema';
import { ActivityCompletionAward } from '../src/club-attendance/schemas/activity-completion-award.schema';
import { AcademicRecord } from '../src/academic-record/schemas/academic-record.schema';
import { ClubSchedule } from '../src/club-schedules/schemas/club-schedule.schema';
import { ClubAttendance } from '../src/club-attendance/schemas/club-attendance.schema';
import { Criterion } from '../src/criteria/schemas/criterion.schema';
import { Category } from '../src/categories/schemas/category.schema';
import { ActivityCompletionService } from '../src/club-attendance/activity-completion.service';
import bcrypt from 'bcrypt';

describe('Activities & Completion Rules (e2e)', () => {
  let app: INestApplication;
  let userModel: Model<User>;
  let roleModel: Model<Role>;
  let studentModel: Model<Student>;
  let clubModel: Model<Club>;
  let semesterModel: Model<Semester>;
  let memberModel: Model<ClubMember>;
  let ruleModel: Model<ActivityCompletionRule>;
  let awardModel: Model<ActivityCompletionAward>;
  let academicRecordModel: Model<AcademicRecord>;
  let scheduleModel: Model<ClubSchedule>;
  let attendanceModel: Model<ClubAttendance>;
  let criterionModel: Model<Criterion>;
  let categoryModel: Model<Category>;
  let activityCompletionService: ActivityCompletionService;

  let testStudentUserId: Types.ObjectId;
  let testAdvisorUserId: Types.ObjectId;
  let testStudentId: Types.ObjectId;
  let testSemesterId: Types.ObjectId;
  let testCriterionId: Types.ObjectId;
  let activityId: string;
  let studentAccessToken: string;
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
    studentModel = moduleFixture.get<Model<Student>>(getModelToken(Student.name));
    clubModel = moduleFixture.get<Model<Club>>(getModelToken(Club.name));
    semesterModel = moduleFixture.get<Model<Semester>>(getModelToken(Semester.name));
    memberModel = moduleFixture.get<Model<ClubMember>>(getModelToken(ClubMember.name));
    ruleModel = moduleFixture.get<Model<ActivityCompletionRule>>(getModelToken(ActivityCompletionRule.name));
    awardModel = moduleFixture.get<Model<ActivityCompletionAward>>(getModelToken(ActivityCompletionAward.name));
    academicRecordModel = moduleFixture.get<Model<AcademicRecord>>(getModelToken(AcademicRecord.name));
    scheduleModel = moduleFixture.get<Model<ClubSchedule>>(getModelToken(ClubSchedule.name));
    attendanceModel = moduleFixture.get<Model<ClubAttendance>>(getModelToken(ClubAttendance.name));
    criterionModel = moduleFixture.get<Model<Criterion>>(getModelToken(Criterion.name));
    categoryModel = moduleFixture.get<Model<Category>>(getModelToken(Category.name));
    activityCompletionService = moduleFixture.get<ActivityCompletionService>(ActivityCompletionService);

    await app.init();

    // 1. Clean up old test data to ensure clean state
    await clubModel.deleteMany({ code: 'E2E-EVENT-ACT' });
    await studentModel.deleteMany({ student_code: '20268888' });
    await userModel.deleteMany({
      email: {
        $in: [
          'e2e_act_student@school.edu.vn',
          'e2e_act_advisor@school.edu.vn',
          'e2e_act_admin@school.edu.vn',
        ],
      },
    });
    await semesterModel.deleteMany({ semester_name: 'E2E Activities Semester' });
    await criterionModel.deleteMany({ criterion_code: 'E2E-ACT-CRIT' });
    await categoryModel.deleteMany({ category_code: 'E2E-ACT-CAT' });

    // 2. Ensure Roles exist
    let studentRole = await roleModel.findOne({ role_code: 'STUDENT' });
    if (!studentRole) {
      studentRole = await roleModel.create({
        name: 'Student',
        role_code: 'STUDENT',
        description: 'Student role',
      });
    }

    let teacherRole = await roleModel.findOne({ role_code: 'TEACHER' });
    if (!teacherRole) {
      teacherRole = await roleModel.create({
        name: 'Teacher',
        role_code: 'TEACHER',
        description: 'Teacher role',
      });
    }

    let adminRole = await roleModel.findOne({ role_code: 'ADMIN' });
    if (!adminRole) {
      adminRole = await roleModel.create({
        name: 'Admin',
        role_code: 'ADMIN',
        description: 'Admin role',
      });
    }

    // 3. Create active student user and profile
    const hashedPassword = await bcrypt.hash('12345678', 12);
    const studentUser = await userModel.create({
      user_name: '20268888',
      email: 'e2e_act_student@school.edu.vn',
      pw_hash: hashedPassword,
      status: UserStatus.ACTIVE,
      role: studentRole._id,
    });
    testStudentUserId = studentUser._id;

    const student = await studentModel.create({
      student_code: '20268888',
      full_name: 'E2E Activity Student',
      email: 'e2e_act_student@school.edu.vn',
      date_bir: new Date('2003-08-15'),
      sex: 'Male',
      status: 'Studying',
      user_id: studentUser._id,
    });
    testStudentId = student._id;

    // 4. Create advisor user (must be TEACHER role)
    const advisorUser = await userModel.create({
      user_name: 'e2e_act_advisor',
      email: 'e2e_act_advisor@school.edu.vn',
      pw_hash: hashedPassword,
      status: UserStatus.ACTIVE,
      role: teacherRole._id,
    });
    testAdvisorUserId = advisorUser._id;

    // 4.5 Create admin user (ADMIN role)
    const adminUser = await userModel.create({
      user_name: 'e2e_act_admin',
      email: 'e2e_act_admin@school.edu.vn',
      pw_hash: hashedPassword,
      status: UserStatus.ACTIVE,
      role: adminRole._id,
    });

    // 5. Create semester
    const semester = await semesterModel.create({
      semester_name: 'E2E Activities Semester',
      start_date: new Date('2026-01-01'),
      end_date: new Date('2026-12-31'),
      status: 'active',
    });
    testSemesterId = semester._id;

    // 5.5 Create Category first
    const category = await categoryModel.create({
      category_code: 'E2E-ACT-CAT',
      category_name: 'E2E Activity Category',
      max_score: 20,
      sort_order: 1,
    });

    // 6. Create criterion
    const criterion = await criterionModel.create({
      category_id: category._id,
      criterion_code: 'E2E-ACT-CRIT',
      criterion_name: 'E2E Activity Criterion',
      max_score: 10,
    });
    testCriterionId = criterion._id;

    // 7. Login and get tokens
    const studentLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: '20268888', password: '12345678' });
    studentAccessToken = studentLogin.body.access_token;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'e2e_act_admin', password: '12345678' });
    adminAccessToken = adminLogin.body.access_token;
  });

  afterAll(async () => {
    // Clean up test data
    if (activityId) {
      await ruleModel.deleteMany({ club_id: new Types.ObjectId(activityId) });
      await awardModel.deleteMany({ club_id: new Types.ObjectId(activityId) });
      await scheduleModel.deleteMany({ club_id: new Types.ObjectId(activityId) });
      await attendanceModel.deleteMany({ club_id: new Types.ObjectId(activityId) });
      await memberModel.deleteMany({ club_id: new Types.ObjectId(activityId) });
      await clubModel.deleteMany({ _id: new Types.ObjectId(activityId) });
    }
    await academicRecordModel.deleteMany({ student_id: testStudentId });
    await studentModel.deleteMany({ _id: testStudentId });
    await userModel.deleteMany({
      email: {
        $in: [
          'e2e_act_student@school.edu.vn',
          'e2e_act_advisor@school.edu.vn',
          'e2e_act_admin@school.edu.vn',
        ],
      },
    });
    await semesterModel.deleteMany({ _id: testSemesterId });
    await criterionModel.deleteMany({ _id: testCriterionId });
    await categoryModel.deleteMany({ category_code: 'E2E-ACT-CAT' });
    await app.close();
  });

  describe('Unified Activity Flow', () => {
    it('1. POST /api/activities - should create a new Activity with event type and published status', () => {
      const activityData = {
        name: 'E2E Event Activity',
        code: 'E2E-EVENT-ACT',
        activity_type: 'event',
        participation_status: 'published',
        classroom: 'Auditorium',
        category: 'technology',
        advisor_id: testAdvisorUserId.toString(),
        semester_id: testSemesterId.toString(),
        settings: {
          allow_self_registration: true,
          require_approval: false,
          attendance_point_enabled: true,
        },
      };

      return request(app.getHttpServer())
        .post('/api/activities')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(activityData)
        .expect(201)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body._id).toBeDefined();
          expect(res.body.name).toBe(activityData.name);
          expect(res.body.activity_type).toBe('event');
          expect(res.body.participation_status).toBe('published');
          activityId = res.body._id;
        });
    });

    it('2. GET /api/activities - should list activities filtered by activityType=event', () => {
      return request(app.getHttpServer())
        .get('/api/activities?activityType=event')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200)
        .then((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const found = res.body.find((act: any) => act._id === activityId);
          expect(found).toBeDefined();
          expect(found.activity_type).toBe('event');
        });
    });

    it('3. POST /api/activities/:id/join - should register and verify occupies_slot is false', () => {
      return request(app.getHttpServer())
        .post(`/api/activities/${activityId}/join`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ semester_id: testSemesterId.toString() })
        .expect(201)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.membership).toBeDefined();
          expect(res.body.membership.occupies_slot).toBe(false);
          expect(res.body.membership.status).toBe('active');
        });
    });

    it('4. POST /api/activity-completion-rules - should create a completion rule with min attendance = 2 and 1 criterion', () => {
      const ruleData = {
        club_id: activityId,
        semester_id: testSemesterId.toString(),
        minimum_attendance: 2,
        criterion_ids: [testCriterionId.toString()],
      };

      return request(app.getHttpServer())
        .post('/api/activity-completion-rules')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(ruleData)
        .expect(201)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body._id).toBeDefined();
          expect(res.body.minimum_attendance).toBe(2);
          expect(res.body.criterion_ids).toContain(testCriterionId.toString());
        });
    });

    it('5. Check-in 2 times - should automatically award training points and completion status', async () => {
      // 5.1 Create schedule 1
      const sched1 = await request(app.getHttpServer())
        .post('/api/club-schedules')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          club_id: activityId,
          title: 'Session 1',
          start_time: new Date('2026-07-10T15:00:00Z'),
          end_time: new Date('2026-07-10T16:00:00Z'),
          semester_id: testSemesterId.toString(),
        })
        .expect(201);
      const scheduleId1 = sched1.body._id;

      // 5.2 Create schedule 2
      const sched2 = await request(app.getHttpServer())
        .post('/api/club-schedules')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          club_id: activityId,
          title: 'Session 2',
          start_time: new Date('2026-07-11T15:00:00Z'),
          end_time: new Date('2026-07-11T16:00:00Z'),
          semester_id: testSemesterId.toString(),
        })
        .expect(201);
      const scheduleId2 = sched2.body._id;

      // 5.3 Attendance check-in 1
      const att1 = await request(app.getHttpServer())
        .post('/api/club-attendance')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          club_id: activityId,
          schedule_id: scheduleId1,
          student_id: testStudentId.toString(),
          semester_id: testSemesterId.toString(),
          status: 'present',
        })
        .expect(201);

      // 5.4 Approve attendance 1
      await request(app.getHttpServer())
        .post(`/api/club-attendance/${att1.body._id}/approve`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ status: 'approved' })
        .expect(201);

      // Verify that after 1 check-in, NO award is created yet
      const awardAfterOne = await awardModel.findOne({
        club_id: new Types.ObjectId(activityId),
        student_id: testStudentId,
      });
      expect(awardAfterOne).toBeNull();

      // 5.5 Attendance check-in 2
      const att2 = await request(app.getHttpServer())
        .post('/api/club-attendance')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          club_id: activityId,
          schedule_id: scheduleId2,
          student_id: testStudentId.toString(),
          semester_id: testSemesterId.toString(),
          status: 'present',
        })
        .expect(201);

      // 5.6 Approve attendance 2 (this should trigger the rule and generate AcademicRecord and Award)
      await request(app.getHttpServer())
        .post(`/api/club-attendance/${att2.body._id}/approve`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ status: 'approved' })
        .expect(201);

      // 5.7 Verify AcademicRecord and ActivityCompletionAward creation
      const award = await awardModel.findOne({
        club_id: new Types.ObjectId(activityId),
        student_id: testStudentId,
        criterion_id: testCriterionId,
      });
      expect(award).not.toBeNull();
      expect(award.academic_record_id).toBeDefined();

      const record = await academicRecordModel.findOne({
        student_id: testStudentId,
        criterion_id: testCriterionId,
        semester_id: testSemesterId,
        source_type: 'activity_completion',
      });
      expect(record).not.toBeNull();
      expect(record.status).toBe('active');
    });

    it('6. Idempotency test - calling checkAndAwardCompletion again should not duplicate AcademicRecord or Award', async () => {
      // Trigger evaluation directly using the service
      await activityCompletionService.checkAndAwardCompletion(
        testStudentId.toString(),
        activityId,
        testSemesterId.toString(),
      );

      // Verify count in database is still exactly 1
      const awardCount = await awardModel.countDocuments({
        club_id: new Types.ObjectId(activityId),
        student_id: testStudentId,
        criterion_id: testCriterionId,
      });
      expect(awardCount).toBe(1);

      const recordCount = await academicRecordModel.countDocuments({
        student_id: testStudentId,
        criterion_id: testCriterionId,
        semester_id: testSemesterId,
        source_type: 'activity_completion',
      });
      expect(recordCount).toBe(1);
    });
  });
});
