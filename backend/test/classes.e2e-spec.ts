import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Class } from './../src/classes/schemas/class.schema';
import { Department } from './../src/departments/schemas/department.schema';
import { Model } from 'mongoose';

describe('Classes (e2e)', () => {
  let app: INestApplication<App>;
  let classModel: Model<any>;
  let departmentModel: Model<any>;
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

    // Clean up any old test data
    await departmentModel.deleteMany({ code: testDept.code });
    await classModel.deleteMany({ class_name: testClass.class_name });
    await classModel.deleteMany({ class_name: 'E2E Class A Updated' });

    // Create a real department first
    const dept = new departmentModel(testDept);
    const savedDept = await dept.save();
    testDeptId = savedDept._id.toString();

    await app.init();
  });

  afterAll(async () => {
    // Clean up test data
    if (departmentModel) {
      await departmentModel.deleteMany({ code: testDept.code });
    }
    if (classModel) {
      await classModel.deleteMany({ class_name: testClass.class_name });
      await classModel.deleteMany({ class_name: 'E2E Class A Updated' });
    }
    await app.close();
  });

  it('POST /classes - should create a new class', () => {
    return request(app.getHttpServer())
      .post('/classes')
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
      .send(updateData)
      .expect(200)
      .then((res) => {
        expect(res.body).toBeDefined();
        expect(res.body.class_name).toBe(updateData.class_name);
      });
  });

  it('DELETE /classes/:id - should delete a class', () => {
    return request(app.getHttpServer())
      .delete(`/classes/${createdClassId}`)
      .expect(200)
      .then((res) => {
        expect(res.body).toBeDefined();
      });
  });
});
