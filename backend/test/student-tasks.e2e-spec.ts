import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../src/auth/schemas/user.schema';
import { Role } from '../src/auth/schemas/role.schema';
import { Student } from '../src/students/schemas/student.schema';
import { Class } from '../src/classes/schemas/class.schema';
import { StudentTask } from '../src/student-tasks/schemas/student-task.schema';
import { JwtService } from '@nestjs/jwt';
import { StudentTaskProgressService } from '../src/student-task-progress/student-task-progress.service';
import { StudentTaskProgress } from '../src/student-task-progress/schemas/student-task-progress.schema';

describe('StudentTasks Status Route (e2e)', () => {
  let app: INestApplication<App>;
  let userModel: Model<any>;
  let roleModel: Model<any>;
  let studentModel: Model<any>;
  let classModel: Model<any>;
  let studentTaskModel: Model<any>;
  let jwtService: JwtService;

  // Mock data documents
  let studentRole: any;
  let teacherRole: any;

  let studentUser: any;
  let unassignedStudentUser: any;
  let teacherUser: any;
  let otherUser: any;

  let testClass: any;
  let studentProfile: any;
  let unassignedStudentProfile: any;

  let testTask: any;

  let studentToken: string;
  let unassignedStudentToken: string;
  let teacherToken: string;
  let otherToken: string;

  let progressModel: Model<any>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    userModel = moduleFixture.get<Model<any>>(getModelToken(User.name));
    roleModel = moduleFixture.get<Model<any>>(getModelToken(Role.name));
    studentModel = moduleFixture.get<Model<any>>(getModelToken(Student.name));
    classModel = moduleFixture.get<Model<any>>(getModelToken(Class.name));
    studentTaskModel = moduleFixture.get<Model<any>>(
      getModelToken(StudentTask.name),
    );
    progressModel = moduleFixture.get<Model<any>>(
      getModelToken(StudentTaskProgress.name),
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();

    // 1. Tạo hoặc lấy Roles
    studentRole = await roleModel.findOne({ role_code: 'STUDENT' });
    if (!studentRole) {
      studentRole = await roleModel.create({
        name: 'Student',
        role_code: 'STUDENT',
      });
    }
    teacherRole = await roleModel.findOne({ role_code: 'TEACHER' });
    if (!teacherRole) {
      teacherRole = await roleModel.create({
        name: 'Teacher',
        role_code: 'TEACHER',
      });
    }

    // 2. Tạo Users
    studentUser = await userModel.create({
      user_name: 'e2e_student_tasks',
      email: 'student_tasks@e2e.com',
      pw_hash: 'mock_hash',
      role: studentRole._id,
    });
    unassignedStudentUser = await userModel.create({
      user_name: 'e2e_student_unassigned_tasks',
      email: 'student_unassigned_tasks@e2e.com',
      pw_hash: 'mock_hash',
      role: studentRole._id,
    });
    teacherUser = await userModel.create({
      user_name: 'e2e_teacher_tasks',
      email: 'teacher_tasks@e2e.com',
      pw_hash: 'mock_hash',
      role: teacherRole._id,
    });
    otherUser = await userModel.create({
      user_name: 'e2e_guest_tasks',
      email: 'guest_tasks@e2e.com',
      pw_hash: 'mock_hash',
      role: new Types.ObjectId(), // Random role
    });

    // 3. Tạo Tokens
    studentToken = jwtService.sign({ user_id: studentUser._id.toString() });
    unassignedStudentToken = jwtService.sign({
      user_id: unassignedStudentUser._id.toString(),
    });
    teacherToken = jwtService.sign({ user_id: teacherUser._id.toString() });
    otherToken = jwtService.sign({ user_id: otherUser._id.toString() });

    // 4. Tạo Class & Student Profiles
    testClass = await classModel.create({
      class_name: 'E2E Task Class',
      class_year: '2023-2027',
      class_type: 'Cao đẳng',
      dept_id: new Types.ObjectId(),
    });

    studentProfile = await studentModel.create({
      student_code: 'E2ETASKS01',
      full_name: 'E2E Student Assigned',
      date_bir: new Date(),
      sex: 'Male',
      class_id: testClass._id,
      user_id: studentUser._id,
    });

    unassignedStudentProfile = await studentModel.create({
      student_code: 'E2ETASKS02',
      full_name: 'E2E Student Unassigned',
      date_bir: new Date(),
      sex: 'Male',
      class_id: new Types.ObjectId(), // Class khác
      user_id: unassignedStudentUser._id,
    });

    // 5. Tạo Task specific được giao cho class của studentProfile
    testTask = await studentTaskModel.create({
      title: 'E2E Specific Class Task',
      type: 'assignment',
      subject: 'E2E Math',
      deadline: new Date(Date.now() + 86400000),
      priority: 'medium',
      status: 'not_started',
      linkedPage: '/students',
      targetType: 'student',
      targetScope: 'specific',
      targetDetail: 'E2E Task Class',
      targetClassIds: [testClass._id],
      createdBy: teacherUser._id,
    });

    const progressService = app.get(StudentTaskProgressService);
    await progressService.syncProgressForTask(testTask._id.toString());
  });

  afterAll(async () => {
    // Clean up
    if (userModel) {
      await userModel.deleteMany({
        _id: {
          $in: [
            studentUser?._id,
            unassignedStudentUser?._id,
            teacherUser?._id,
            otherUser?._id,
          ],
        },
      });
    }
    if (studentModel) {
      await studentModel.deleteMany({
        _id: { $in: [studentProfile?._id, unassignedStudentProfile?._id] },
      });
    }
    if (classModel) {
      await classModel.deleteMany({ _id: testClass?._id });
    }
    if (studentTaskModel) {
      await studentTaskModel.deleteMany({ _id: testTask?._id });
    }
    if (progressModel) {
      await progressModel.deleteMany({ taskId: testTask?._id });
    }
    await app.close();
  });

  it('PATCH /student-tasks/:id/status - Student được giao đổi trạng thái thành công (200)', () => {
    return request(app.getHttpServer())
      .patch(`/student-tasks/${testTask._id}/status`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ status: 'in_progress' })
      .expect(200)
      .then((res) => {
        expect(res.body).toBeDefined();
        expect(res.body.status).toBe('in_progress');
      });
  });

  it('PATCH /student-tasks/:id/status - Student không được giao bị từ chối (403)', () => {
    return request(app.getHttpServer())
      .patch(`/student-tasks/${testTask._id}/status`)
      .set('Authorization', `Bearer ${unassignedStudentToken}`)
      .send({ status: 'completed' })
      .expect(403);
  });

  it('PATCH /student-tasks/:id/status - Teacher creator đổi trạng thái thành công (200)', () => {
    return request(app.getHttpServer())
      .patch(`/student-tasks/${testTask._id}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'completed' })
      .expect(200)
      .then((res) => {
        expect(res.body).toBeDefined();
        expect(res.body.status).toBe('completed');
      });
  });

  it('PATCH /student-tasks/:id/status - User khác không có quyền bị từ chối (403)', () => {
    return request(app.getHttpServer())
      .patch(`/student-tasks/${testTask._id}/status`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ status: 'not_started' })
      .expect(403);
  });
});
