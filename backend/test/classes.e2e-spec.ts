import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Class } from './../src/classes/schemas/class.schema';
import { Department } from './../src/departments/schemas/department.schema';
import { Model } from 'mongoose';
import { User, UserStatus } from '../src/auth/schemas/user.schema';
import { Role } from '../src/auth/schemas/role.schema';
import { Student } from '../src/students/schemas/student.schema';
import { JwtService } from '@nestjs/jwt';

describe('Classes (e2e)', () => {
  let app: INestApplication<App>;
  let classModel: Model<any>;
  let departmentModel: Model<any>;
  let userModel: Model<any>;
  let roleModel: Model<any>;
  let studentModel: Model<any>;
  let jwtService: JwtService;
  let adminToken: string;
  let deniedToken: string;
  let testStudentUserId: string;
  let testStudentId: string;
  let createdClassId: string;
  let testDeptId: string;

  const testDept = {
    name: 'E2E Class Department',
    code: 'E2E-CLASS-DEP',
    description: 'Department for Class E2E tests',
  };

  const testClass = {
    class_name: 'E2E Class A',
    class_year: '2023-2027',
    class_type: 'Cao đẳng',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    classModel = moduleFixture.get<Model<any>>(getModelToken(Class.name));
    departmentModel = moduleFixture.get<Model<any>>(
      getModelToken(Department.name),
    );
    userModel = moduleFixture.get<Model<any>>(getModelToken(User.name));
    roleModel = moduleFixture.get<Model<any>>(getModelToken(Role.name));
    studentModel = moduleFixture.get<Model<any>>(getModelToken(Student.name));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Clean up any old test data
    await departmentModel.deleteMany({ code: testDept.code });
    await classModel.deleteMany({ class_name: testClass.class_name });
    await classModel.deleteMany({ class_name: 'E2E Class A Updated' });
    await studentModel.deleteMany({ student_code: 'E2E-CLASS-STUDENT' });
    await userModel.deleteMany({ email: 'e2e-class-admin@school.edu.vn' });
    await userModel.deleteMany({ email: 'e2e-class-student@school.edu.vn' });

    // Create a real department first
    const dept = new departmentModel(testDept);
    const savedDept = await dept.save();
    testDeptId = savedDept._id.toString();

    let adminRole = await roleModel.findOne({ role_code: 'ADMIN' });
    if (!adminRole) {
      adminRole = await roleModel.create({
        name: 'Admin',
        role_code: 'ADMIN',
        description: 'Class delete e2e admin',
      });
    }
    const adminUser = await userModel.create({
      user_name: 'e2e-class-admin',
      email: 'e2e-class-admin@school.edu.vn',
      pw_hash: 'not-used-in-jwt-test',
      status: UserStatus.ACTIVE,
      role: adminRole._id,
    });
    adminToken = jwtService.sign({ user_id: adminUser._id.toString() });
    let userRole = await roleModel.findOne({ role_code: 'USER' });
    if (!userRole) {
      userRole = await roleModel.create({
        name: 'User',
        role_code: 'USER',
        description: 'Class delete e2e user',
      });
    }
    const deniedUser = await userModel.create({
      user_name: 'e2e-class-denied',
      email: 'e2e-class-denied@school.edu.vn',
      pw_hash: 'not-used-in-jwt-test',
      status: UserStatus.ACTIVE,
      role: userRole._id,
    });
    deniedToken = jwtService.sign({ user_id: deniedUser._id.toString() });

    await app.init();
  });

  afterAll(async () => {
    // Clean up test data
    if (departmentModel) {
      await departmentModel.deleteMany({ code: testDept.code });
    }
    if (studentModel) await studentModel.deleteMany({ student_code: 'E2E-CLASS-STUDENT' });
    if (userModel) await userModel.deleteMany({ email: 'e2e-class-admin@school.edu.vn' });
    if (userModel) await userModel.deleteMany({ email: 'e2e-class-student@school.edu.vn' });
    if (userModel) await userModel.deleteMany({ email: 'e2e-class-denied@school.edu.vn' });
    if (classModel) {
      await classModel.deleteMany({ class_name: testClass.class_name });
      await classModel.deleteMany({ class_name: 'E2E Class A Updated' });
    }
    await app.close();
  });

  it('POST /classes - should create a new class', () => {
    return request(app.getHttpServer())
      .post('/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...testClass,
        dept_id: testDeptId,
      })
      .expect(201)
      .then((res) => {
        expect(res.body).toBeDefined();
        expect(res.body.class_name).toBe(testClass.class_name);
        expect(res.body.class_year).toBe(testClass.class_year);
        expect(res.body._id).toBeDefined();
        createdClassId = res.body._id;
      });
  });

  it('GET /classes - should retrieve all classes and populate department', () => {
    return request(app.getHttpServer())
      .get('/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .then((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        const found = res.body.find(
          (c: any) => c.class_name === testClass.class_name,
        );
        expect(found).toBeDefined();
        expect(found.dept_id).toBeDefined();
        expect(found.dept_id.code).toBe(testDept.code);
      });
  });

  it('GET /classes/:id - should retrieve a single class by ID and populate department', () => {
    return request(app.getHttpServer())
      .get(`/classes/${createdClassId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .then((res) => {
        expect(res.body).toBeDefined();
        expect(res.body.class_name).toBe(testClass.class_name);
        expect(res.body.dept_id.code).toBe(testDept.code);
      });
  });

  it('PATCH /classes/:id - should update a class', () => {
    const updateData = { class_name: 'E2E Class A Updated' };
    return request(app.getHttpServer())
      .patch(`/classes/${createdClassId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updateData)
      .expect(200)
      .then((res) => {
        expect(res.body).toBeDefined();
        expect(res.body.class_name).toBe(updateData.class_name);
      });
  });

  it('DELETE /classes/:id - should delete a class', () => {
    return userModel
      .create({
        user_name: 'e2e-class-student',
        email: 'e2e-class-student@school.edu.vn',
        pw_hash: 'not-used-in-test',
        status: UserStatus.ACTIVE,
      })
      .then(async (studentUser: any) => {
        testStudentUserId = studentUser._id.toString();
        const student = await studentModel.create({
          student_code: 'E2E-CLASS-STUDENT',
          full_name: 'E2E Class Student',
          email: 'e2e-class-student@school.edu.vn',
          date_bir: new Date('2000-01-01'),
          sex: 'Male',
          status: 'Studying',
          class_id: createdClassId,
          user_id: studentUser._id,
        });
        testStudentId = student._id.toString();
        return request(app.getHttpServer())
          .delete(`/classes/${createdClassId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      })
      .then(async (res) => {
        expect(res.body).toBeDefined();
        expect(await classModel.exists({ _id: createdClassId })).toBeNull();
        expect(await studentModel.exists({ _id: testStudentId })).toBeNull();
        expect(await userModel.exists({ _id: testStudentUserId })).toBeNull();
        return request(app.getHttpServer())
          .delete(`/classes/${createdClassId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });
  });

  it('DELETE /classes/:id - should reject a user without CLASS_DELETE', () => {
    return request(app.getHttpServer())
      .delete(`/classes/${createdClassId}`)
      .set('Authorization', `Bearer ${deniedToken}`)
      .expect(403);
  });
});
