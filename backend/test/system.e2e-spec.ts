import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../src/auth/schemas/user.schema';
import { Role } from '../src/auth/schemas/role.schema';
import { Permission } from '../src/auth/schemas/permission.schema';
import { DatabaseBackupJob } from '../src/system/schemas/database-backup-job.schema';
import { JwtService } from '@nestjs/jwt';

describe('System Module (e2e)', () => {
  let app: INestApplication<App>;
  let userModel: Model<any>;
  let roleModel: Model<any>;
  let permissionModel: Model<any>;
  let backupJobModel: Model<any>;
  let jwtService: JwtService;

  // Mock roles
  let auditViewerRole: any;
  let backupOperatorRole: any;
  let guestRole: any;

  // Mock users
  let auditUser: any;
  let backupUser: any;
  let guestUser: any;

  // Mock tokens
  let auditToken: string;
  let backupToken: string;
  let guestToken: string;

  let testBackupJobId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    userModel = moduleFixture.get<Model<any>>(getModelToken(User.name));
    roleModel = moduleFixture.get<Model<any>>(getModelToken(Role.name));
    permissionModel = moduleFixture.get<Model<any>>(getModelToken(Permission.name));
    backupJobModel = moduleFixture.get<Model<any>>(getModelToken(DatabaseBackupJob.name));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();

    // 1. Tạo permissions
    let readLogsPerm = await permissionModel.findOne({ code: 'LOGIN_LOG_READ' });
    if (!readLogsPerm) {
      readLogsPerm = await permissionModel.create({ name: 'Read Login Logs', code: 'LOGIN_LOG_READ' });
    }

    let readBackupPerm = await permissionModel.findOne({ code: 'DATABASE_BACKUP_READ' });
    if (!readBackupPerm) {
      readBackupPerm = await permissionModel.create({ name: 'Read Database Backup', code: 'DATABASE_BACKUP_READ' });
    }

    let createBackupPerm = await permissionModel.findOne({ code: 'DATABASE_BACKUP_CREATE' });
    if (!createBackupPerm) {
      createBackupPerm = await permissionModel.create({ name: 'Create Database Backup', code: 'DATABASE_BACKUP_CREATE' });
    }

    // 2. Tạo Roles
    auditViewerRole = await roleModel.create({
      name: 'E2E Audit Viewer',
      role_code: 'E2E_AUDIT_VIEWER',
      permissions: [readLogsPerm._id],
    });

    backupOperatorRole = await roleModel.create({
      name: 'E2E Backup Operator',
      role_code: 'E2E_BACKUP_OPERATOR',
      permissions: [readBackupPerm._id, createBackupPerm._id],
    });

    guestRole = await roleModel.create({
      name: 'E2E Guest System',
      role_code: 'E2E_GUEST_SYSTEM',
      permissions: [],
    });

    // 3. Tạo Users
    auditUser = await userModel.create({
      user_name: 'e2e_audit_user',
      email: 'audit_e2e@system.com',
      pw_hash: 'mock_hash',
      role: auditViewerRole._id,
    });

    backupUser = await userModel.create({
      user_name: 'e2e_backup_user',
      email: 'backup_e2e@system.com',
      pw_hash: 'mock_hash',
      role: backupOperatorRole._id,
    });

    guestUser = await userModel.create({
      user_name: 'e2e_guest_user',
      email: 'guest_e2e@system.com',
      pw_hash: 'mock_hash',
      role: guestRole._id,
    });

    // 4. Tạo Tokens
    auditToken = jwtService.sign({ user_id: auditUser._id.toString() });
    backupToken = jwtService.sign({ user_id: backupUser._id.toString() });
    guestToken = jwtService.sign({ user_id: guestUser._id.toString() });

    // 5. Tạo một bản sao lưu giả để test delete/read
    const backupJob = await backupJobModel.create({
      status: 'success',
      file_name: 'e2e_test_backup.gz',
      file_path: './storage/backups/e2e_test_backup.gz',
      file_size: 1024,
      requested_by: backupUser._id,
    });
    testBackupJobId = backupJob._id.toString();
  });

  afterAll(async () => {
    // Dọn dẹp DB
    await userModel.deleteMany({ _id: { $in: [auditUser?._id, backupUser?._id, guestUser?._id] } });
    await roleModel.deleteMany({ _id: { $in: [auditViewerRole?._id, backupOperatorRole?._id, guestRole?._id] } });
    await backupJobModel.deleteOne({ _id: testBackupJobId });
    await app.close();
  });

  // ─── LOGIN LOGS API TESTS ─────────────────────────────────────────────
  
  describe('GET /api/system/login-logs', () => {
    it('Nên trả về 401 khi không gửi token', () => {
      return request(app.getHttpServer())
        .get('/api/system/login-logs')
        .expect(401);
    });

    it('Nên trả về 403 khi gửi token của user không có quyền LOGIN_LOG_READ', () => {
      return request(app.getHttpServer())
        .get('/api/system/login-logs')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(403);
    });

    it('Nên trả về 200 khi gửi token của user có quyền LOGIN_LOG_READ', () => {
      return request(app.getHttpServer())
        .get('/api/system/login-logs')
        .set('Authorization', `Bearer ${auditToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.items).toBeDefined();
        });
    });
  });

  // ─── BACKUPS API TESTS ────────────────────────────────────────────────

  describe('GET /api/system/backups', () => {
    it('Nên trả về 403 khi user thiếu quyền DATABASE_BACKUP_READ', () => {
      return request(app.getHttpServer())
        .get('/api/system/backups')
        .set('Authorization', `Bearer ${auditToken}`)
        .expect(403);
    });

    it('Nên trả về 200 khi user có quyền DATABASE_BACKUP_READ', () => {
      return request(app.getHttpServer())
        .get('/api/system/backups')
        .set('Authorization', `Bearer ${backupToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.items).toBeDefined();
        });
    });
  });

  describe('DELETE /api/system/backups/:id', () => {
    it('Nên trả về 403 khi user thiếu quyền DATABASE_BACKUP_DELETE', () => {
      return request(app.getHttpServer())
        .delete(`/api/system/backups/${testBackupJobId}`)
        .set('Authorization', `Bearer ${backupToken}`) // chỉ có read/create, không có delete
        .expect(403);
    });
  });
});
