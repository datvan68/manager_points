import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Department } from './../src/departments/schemas/department.schema';
import { Model } from 'mongoose';

describe('Departments (e2e)', () => {
  let app: INestApplication<App>;
  let departmentModel: Model<any>;
  let createdId: string;

  const testDepartment = {
    name: 'E2E Testing Department',
    code: 'E2E-TEST-DEP',
    description: 'Created during E2E testing',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    departmentModel = moduleFixture.get<Model<any>>(getModelToken(Department.name));
    
    // Clean up any old test data
    await departmentModel.deleteMany({ code: testDepartment.code });
    
    await app.init();
  });

  afterAll(async () => {
    // Clean up test data
    if (departmentModel) {
      await departmentModel.deleteMany({ code: testDepartment.code });
    }
    await app.close();
  });

  it('POST /departments - should create a new department', () => {
    return request(app.getHttpServer())
      .post('/departments')
      .send(testDepartment)
      .expect(201)
      .then((res) => {
        expect(res.body).toBeDefined();
        expect(res.body.name).toBe(testDepartment.name);
        expect(res.body.code).toBe(testDepartment.code);
        expect(res.body._id).toBeDefined();
        createdId = res.body._id;
      });
  });

  it('GET /departments - should retrieve all departments', () => {
    return request(app.getHttpServer())
      .get('/departments')
      .expect(200)
      .then((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        const found = res.body.find((dep: any) => dep.code === testDepartment.code);
        expect(found).toBeDefined();
      });
  });

  it('GET /departments/:id - should retrieve a single department by ID', () => {
    return request(app.getHttpServer())
      .get(`/departments/${createdId}`)
      .expect(200)
      .then((res) => {
        expect(res.body).toBeDefined();
        expect(res.body.code).toBe(testDepartment.code);
      });
  });

  it('PATCH /departments/:id - should update a department', () => {
    const updateData = { name: 'E2E Testing Department Updated' };
    return request(app.getHttpServer())
      .patch(`/departments/${createdId}`)
      .send(updateData)
      .expect(200)
      .then((res) => {
        expect(res.body).toBeDefined();
        expect(res.body.name).toBe(updateData.name);
      });
  });

  it('DELETE /departments/:id - should delete a department', () => {
    return request(app.getHttpServer())
      .delete(`/departments/${createdId}`)
      .expect(200)
      .then((res) => {
        expect(res.body).toBeDefined();
      });
  });
});
