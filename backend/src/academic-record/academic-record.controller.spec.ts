import { Test, TestingModule } from '@nestjs/testing';
import 'reflect-metadata';
import {
  ValidationPipe,
  BadRequestException,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import { AcademicRecordController } from './academic-record.controller';
import { AcademicRecordService } from './academic-record.service';
import {
  ImportAcademicRecordRequestDto,
  ImportAcademicRecordCommitDto,
} from './dto/import-academic-record.dto';
import { IntentScoreDto } from './dto/intent-score.dto';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const guardsFor = (method: string) =>
  (Reflect.getMetadata('__guards__', AcademicRecordController.prototype[method]) ||
    Reflect.getMetadata('__guards__', AcademicRecordController.prototype, method) || []) as any[];

describe('AcademicRecordController - Import Flow', () => {
  let controller: AcademicRecordController;
  let service: AcademicRecordService;
  let testingModule: TestingModule;

  const mockAcademicRecordService = {
    findAll: jest.fn(),
    findByStudentId: jest.fn(),
    importPreview: jest.fn(),
    importCommit: jest.fn(),
    getImportProgress: jest.fn(),
    bulkRemove: jest.fn(),
    bulkForceRemove: jest.fn(),
    forceRemove: jest.fn(),
    previewBulkRemove: jest.fn(),
  };

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      controllers: [AcademicRecordController],
      providers: [
        {
          provide: AcademicRecordService,
          useValue: mockAcademicRecordService,
        },
      ],
    }).compile();

    controller = testingModule.get<AcademicRecordController>(AcademicRecordController);
    service = testingModule.get<AcademicRecordService>(AcademicRecordService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('importPreview', () => {
    it('should call academicRecordService.importPreview with rows and requester', async () => {
      const dto: ImportAcademicRecordRequestDto = {
        rows: [
          { 'Ma SV': 'SV01', 'Tieu chi': 'TC1', 'Ngay ghi nhan': '2023-01-01' },
        ],
      };
      const req = { user: { userId: 'teacher1', roleName: 'Teacher' } };

      const expectedResult = {
        sessionId: 'session_123',
        validCount: 1,
        errorCount: 0,
        errors: [],
        totalRows: 1,
      };
      mockAcademicRecordService.importPreview.mockResolvedValue(expectedResult);

      const result = await controller.importPreview(dto, req);

      expect(service.importPreview).toHaveBeenCalledWith(dto.rows, req.user);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('permission boundaries', () => {
    it('allows a custom role with READ_STUDENT_RECORD to call the read endpoint', async () => {
      const original = JwtAuthGuard.prototype.canActivate;
      jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
      const Guard = guardsFor('findAll')[0];
      const request = { user: { roleName: 'Records Reviewer', permissions: ['READ_STUDENT_RECORD'] } };
      const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;

      await expect(new Guard().canActivate(context)).resolves.toBe(true);
      mockAcademicRecordService.findAll.mockResolvedValue({ data: [], meta: { total: 0 } });
      await controller.findAll(request);
      expect(service.findAll).toHaveBeenCalledWith(expect.anything(), request.user);
      JwtAuthGuard.prototype.canActivate = original;
    });

    it('denies a non-admin without READ_STUDENT_RECORD before the service is invoked', async () => {
      const original = JwtAuthGuard.prototype.canActivate;
      jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
      const Guard = guardsFor('findAll')[0];
      const request = { user: { roleName: 'Records Reviewer', permissions: [] } };
      const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;

      await expect(new Guard().canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.findAll).not.toHaveBeenCalled();
      JwtAuthGuard.prototype.canActivate = original;
    });

    it('denies student-id lookup without READ_STUDENT_RECORD before the service is invoked', async () => {
      const original = JwtAuthGuard.prototype.canActivate;
      jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
      const Guard = guardsFor('findByStudentId')[0];
      const request = { user: { roleName: 'Records Reviewer', permissions: [] } };
      const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;

      await expect(new Guard().canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.findByStudentId).not.toHaveBeenCalled();
      JwtAuthGuard.prototype.canActivate = original;
    });

    it('preserves authenticated Student self-service for student-id lookup', async () => {
      const original = JwtAuthGuard.prototype.canActivate;
      jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
      const Guard = guardsFor('findByStudentId')[0];
      const request = { user: { roleName: 'Student', permissions: [] } };
      const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;

      await expect(new Guard().canActivate(context)).resolves.toBe(true);
      JwtAuthGuard.prototype.canActivate = original;
    });

    it.each([
      ['create', 'CREATE_STUDENT_RECORD'],
      ['handleIntent', 'CREATE_STUDENT_RECORD'],
      ['bulkCreate', 'CREATE_STUDENT_RECORD'],
      ['importPreview', 'CREATE_STUDENT_RECORD'],
      ['importCommit', 'CREATE_STUDENT_RECORD'],
      ['getImportProgress', 'CREATE_STUDENT_RECORD'],
      ['update', 'UPDATE_STUDENT_RECORD'],
      ['restore', 'UPDATE_STUDENT_RECORD'],
      ['remove', 'DELETE_STUDENT_RECORD'],
      ['forceRemove', 'DELETE_STUDENT_RECORD'],
      ['bulkRemove', 'DELETE_STUDENT_RECORD'],
      ['bulkForceRemove', 'DELETE_STUDENT_RECORD'],
      ['previewBulkRemove', 'DELETE_STUDENT_RECORD'],
    ])('%s requires %s and rejects view-only access', async (method, permission) => {
      const Guard = guardsFor(method)[0];
      expect(Guard).not.toBe(JwtAuthGuard);

      const original = JwtAuthGuard.prototype.canActivate;
      jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ user: { roleName: 'Records Reviewer', permissions: ['READ_STUDENT_RECORD'] } }),
        }),
      } as any;

      await expect(new Guard().canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);

      const allowedContext = {
        switchToHttp: () => ({
          getRequest: () => ({ user: { roleName: 'Records Reviewer', permissions: [permission] } }),
        }),
      } as any;
      await expect(new Guard().canActivate(allowedContext)).resolves.toBe(true);
      JwtAuthGuard.prototype.canActivate = original;
    });

    it.each(['handleIntent', 'remove'])('preserves Student self-service access for %s', async (method) => {
      const Guard = guardsFor(method)[0];
      const original = JwtAuthGuard.prototype.canActivate;
      jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ user: { roleName: 'Student', permissions: [] } }),
        }),
      } as any;

      await expect(new Guard().canActivate(context)).resolves.toBe(true);
      JwtAuthGuard.prototype.canActivate = original;
    });
  });

  it('forwards the optional student grouping query and preserves all filters', async () => {
    const req = { user: { roleName: 'Admin' } };
    mockAcademicRecordService.findAll.mockResolvedValue({ data: [], meta: { total: 0 } });

    await controller.findAll(
      req,
      '2',
      '25',
      'Nguyen',
      'class-1',
      'semester-1',
      'student-1',
      '2026-08-01',
      '2026-08-31',
      'teacher',
      'student',
    );

    expect(service.findAll).toHaveBeenCalledWith(
      {
        page: 2,
        limit: 25,
        groupBy: 'student',
        search: 'Nguyen',
        classId: 'class-1',
        semesterId: 'semester-1',
        studentId: 'student-1',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        creator: 'teacher',
      },
      req.user,
    );
  });

  it('forwards deduplicated bulk delete requests to the matching service methods', async () => {
    const dto = { ids: ['record-1', 'record-2'] };
    const req = { user: { roleName: 'Admin' } };
    mockAcademicRecordService.bulkRemove.mockResolvedValue({ requested: 2 });
    mockAcademicRecordService.bulkForceRemove.mockResolvedValue({ requested: 2 });

    await controller.bulkRemove(dto, req);
    await controller.bulkForceRemove(dto, req);

    expect(service.bulkRemove).toHaveBeenCalledWith(dto.ids, req.user);
    expect(service.bulkForceRemove).toHaveBeenCalledWith(dto.ids, req.user);
  });

  it('forwards the bulk delete preview request with requester context', async () => {
    const dto = { studentIds: ['student-1'], startDate: '2026-08-01', endDate: '2026-08-31' };
    const req = { user: { roleName: 'Admin' } };
    const expected = { requestedStudentCount: 1, groups: [], recordIds: [], preservedDailyReportCount: 0, failedStudentCount: 0 };
    mockAcademicRecordService.previewBulkRemove.mockResolvedValue(expected);

    const result = await controller.previewBulkRemove(dto as any, req);

    expect(service.previewBulkRemove).toHaveBeenCalledWith(dto, req.user);
    expect(result).toEqual(expected);
  });

  it('resolves bulk and single permanent-delete URLs to their matching handlers', async () => {
    class AllowGuard {
      canActivate(_context: any) {
        return true;
      }
    }

    const guardedMethods = ['bulkForceRemove', 'forceRemove'];
    const originalGuards = new Map(
      guardedMethods.map((method) => [
        method,
        Reflect.getMetadata('__guards__', AcademicRecordController.prototype[method]),
      ]),
    );

    guardedMethods.forEach((method) => {
      Reflect.defineMetadata(
        '__guards__',
        [AllowGuard],
        AcademicRecordController.prototype[method],
      );
    });

    const app: INestApplication = testingModule.createNestApplication();
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { roleName: 'Admin' };
      next();
    });

    try {
      await app.init();
      mockAcademicRecordService.bulkForceRemove.mockResolvedValue({ requested: 2 });
      mockAcademicRecordService.forceRemove.mockResolvedValue({ id: 'record-1' });

      await request(app.getHttpServer())
        .delete('/academic-records/bulk/force')
        .send({ ids: ['record-1', 'record-2'] })
        .expect(200);
      await request(app.getHttpServer())
        .delete('/academic-records/record-1/force?bypassDailyReportCheck=true')
        .expect(200);

      expect(service.bulkForceRemove).toHaveBeenCalledWith(
        ['record-1', 'record-2'],
        { roleName: 'Admin' },
      );
      expect(service.forceRemove).toHaveBeenCalledWith(
        'record-1',
        { roleName: 'Admin' },
      );
      expect(service.forceRemove).not.toHaveBeenCalledWith(
        'bulk',
        expect.anything(),
        expect.anything(),
      );
    } finally {
      await app.close();
      guardedMethods.forEach((method) => {
        Reflect.defineMetadata(
          '__guards__',
          originalGuards.get(method),
          AcademicRecordController.prototype[method],
        );
      });
    }
  });

  describe('importCommit', () => {
    it('should call academicRecordService.importCommit with sessionId and requester', async () => {
      const dto: ImportAcademicRecordCommitDto = { sessionId: 'session_123' };
      const req = { user: { userId: 'teacher1', roleName: 'Teacher' } };

      const expectedResult = {
        success: true,
        message: 'Đã bắt đầu tiến trình import',
      };
      mockAcademicRecordService.importCommit.mockResolvedValue(expectedResult);

      const result = await controller.importCommit(dto, req);

      expect(service.importCommit).toHaveBeenCalledWith(
        dto.sessionId,
        req.user,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getImportProgress', () => {
    it('should call academicRecordService.getImportProgress with sessionId', () => {
      const sessionId = 'session_123';
      const expectedProgress = {
        status: 'completed',
        progress: 100,
        processedCount: 10,
        insertedCount: 10,
        duplicatedCount: 0,
        totalRows: 10,
        failedItems: [],
      };
      mockAcademicRecordService.getImportProgress.mockReturnValue(
        expectedProgress,
      );

      const result = controller.getImportProgress(sessionId);

      expect(service.getImportProgress).toHaveBeenCalledWith(sessionId);
      expect(result).toEqual(expectedProgress);
    });
  });

  describe('DTO Validation (ValidationPipe)', () => {
    let validationPipe: ValidationPipe;

    beforeEach(() => {
      validationPipe = new ValidationPipe({ transform: true, whitelist: true });
    });

    it('should throw BadRequestException when intentDto contains invalid student_id (e.g. "SV001" instead of ObjectId)', async () => {
      const invalidDto = {
        student_id: 'SV001', // Không phải MongoDB ObjectId
        criterion_id: new Types.ObjectId().toString(),
        semester_id: new Types.ObjectId().toString(),
        intent_type: 'increase',
      };

      await expect(
        validationPipe.transform(invalidDto, {
          type: 'body',
          metatype: IntentScoreDto,
        }),
      ).rejects.toThrow(BadRequestException);

      try {
        await validationPipe.transform(invalidDto, {
          type: 'body',
          metatype: IntentScoreDto,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = error.getResponse();
        expect(response.message).toContain(
          'student_id phải là MongoDB ObjectId của sinh viên, không phải MSSV',
        );
      }
    });

    it('should pass ValidationPipe when student_id is a valid MongoDB ObjectId', async () => {
      const validDto = {
        student_id: new Types.ObjectId().toString(), // Hợp lệ
        criterion_id: new Types.ObjectId().toString(),
        semester_id: new Types.ObjectId().toString(),
        intent_type: 'increase',
      };

      const result = await validationPipe.transform(validDto, {
        type: 'body',
        metatype: IntentScoreDto,
      });

      expect(result).toBeDefined();
      expect(result.student_id).toEqual(validDto.student_id);
    });
  });
});
