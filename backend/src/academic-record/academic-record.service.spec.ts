import { Test, TestingModule } from '@nestjs/testing';
import { AcademicRecordService } from './academic-record.service';
import { getModelToken } from '@nestjs/mongoose';
import { AcademicRecord } from './schemas/academic-record.schema';
import { SummaryPoint } from '../summaries-point/schemas/summary-point.schema';
import { Criterion } from '../criteria/schemas/criterion.schema';
import { Student } from '../students/schemas/student.schema';
import { Class } from '../classes/schemas/class.schema';
import { EvaluationPeriod } from '../evaluation-periods/schemas/evaluation-period.schema';
import { SummariesPointService } from '../summaries-point/summaries-point.service';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { normalizeObjectId } from './academic-record.utils';
import { ScoreEngineService } from './score-engine.service';
import { CountResolutionService } from './count-resolution.service';
import { DeletePreviewAcademicRecordDto } from './dto/delete-preview-academic-record.dto';

describe('AcademicRecordService - Import Flow', () => {
  let service: AcademicRecordService;

  const mockAcademicRecordModel: any = {
    db: { model: jest.fn() },
    bulkWrite: jest.fn(),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    findOne: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    }),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
    insertMany: jest.fn(),
    deleteOne: jest.fn(),
    create: jest.fn(),
  };

  const mockSummaryPointModel: any = {
    find: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    }),
    findOne: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    }),
  };

  const mockCriterionModel: any = {
    find: jest.fn(),
    findById: jest.fn(),
  };
  const mockStudentModel: any = {
    find: jest.fn(),
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        class_id: new Types.ObjectId(),
        status: 'Studying',
      }),
    }),
  };
  const mockClassModel: any = {
    find: jest.fn(),
  };
  const mockEvaluationPeriodModel: any = {
    find: jest.fn().mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([]) }),
  };
  const mockSummariesPointService: any = {
    recomputeTotalScore: jest.fn(),
    assertStudentEvaluationWindow: jest.fn().mockResolvedValue(undefined),
  };

  const mockSemesterModel: any = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicRecordService,
        {
          provide: getModelToken(AcademicRecord.name),
          useValue: mockAcademicRecordModel,
        },
        {
          provide: getModelToken(SummaryPoint.name),
          useValue: mockSummaryPointModel,
        },
        {
          provide: getModelToken(Criterion.name),
          useValue: mockCriterionModel,
        },
        {
          provide: getModelToken(Student.name),
          useValue: mockStudentModel,
        },
        {
          provide: getModelToken(Class.name),
          useValue: mockClassModel,
        },
        {
          provide: getModelToken(EvaluationPeriod.name),
          useValue: mockEvaluationPeriodModel,
        },
        {
          provide: SummariesPointService,
          useValue: mockSummariesPointService,
        },
        ScoreEngineService,
        CountResolutionService,
      ],
    }).compile();

    service = module.get<AcademicRecordService>(AcademicRecordService);
    mockAcademicRecordModel.db.model.mockReturnValue(mockSemesterModel);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('previewBulkRemove', () => {
    it('applies date/student filters and excludes daily-report records without mutating data', async () => {
      const studentId = new Types.ObjectId();
      const deletableId = new Types.ObjectId();
      const dailyReportId = new Types.ObjectId();
      const records = [
        { _id: deletableId, student_id: { _id: studentId }, recorded_at: new Date('2026-08-10T00:00:00.000Z') },
        { _id: new Types.ObjectId(), student_id: { _id: studentId }, daily_report_id: dailyReportId },
      ];
      const query = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(records),
      };
      mockAcademicRecordModel.find.mockReturnValueOnce(query);

      const dto: DeletePreviewAcademicRecordDto = {
        studentIds: [studentId.toString()],
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      };
      const result = await service.previewBulkRemove(dto, { roleCode: 'ADMIN', roleName: 'Admin' });

      expect(mockAcademicRecordModel.find).toHaveBeenCalledWith(expect.objectContaining({
        student_id: { $in: [expect.any(Types.ObjectId)] },
        status: 'active',
        is_deleted: { $ne: true },
        $and: [{ $or: [{ recorded_at: expect.any(Object) }, { date_record: expect.any(Object) }] }],
      }));
      expect(result.recordIds).toEqual([deletableId.toString()]);
      expect(result.preservedDailyReportCount).toBe(1);
      expect(result.groups[0].recordIds).toEqual([deletableId.toString()]);
      expect(mockAcademicRecordModel.bulkWrite).not.toHaveBeenCalled();
      expect(mockAcademicRecordModel.deleteOne).not.toHaveBeenCalled();
    });

    it('reports same-level records created by another user as deletion failures', async () => {
      const studentId = new Types.ObjectId();
      const ownId = new Types.ObjectId();
      const otherId = new Types.ObjectId();
      const records = [
        {
          _id: new Types.ObjectId(),
          student_id: { _id: studentId },
          recorded_by: { _id: ownId, role: { name: 'Supervisor' } },
        },
        {
          _id: new Types.ObjectId(),
          student_id: { _id: studentId },
          recorded_by: { _id: otherId, role: { name: 'Supervisor' } },
        },
      ];
      mockAcademicRecordModel.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(records),
      });

      const result = await service.previewBulkRemove(
        { studentIds: [studentId.toString()] },
        { roleName: 'Supervisor', userId: ownId.toString() },
      );

      expect(result.recordIds).toEqual([records[0]._id.toString()]);
      expect(result.failedStudentCount).toBe(1);
      expect(result.groups[0].failures).toEqual([
        expect.objectContaining({ id: records[1]._id.toString() }),
      ]);
    });
  });

  describe('importPreview', () => {
    it('should filter rows and handle teacher permissions correctly', async () => {
      // Setup Teacher context
      const requester = {
        userId: new Types.ObjectId().toString(),
        roleName: 'Teacher',
      };
      const classId = new Types.ObjectId();
      mockClassModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: classId }]),
      });

      const studentInClass = {
        _id: new Types.ObjectId(),
        student_code: 'SV_IN',
        class_id: classId,
      };
      const studentOutClass = {
        _id: new Types.ObjectId(),
        student_code: 'SV_OUT',
        class_id: new Types.ObjectId(),
      };

      mockStudentModel.find.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: studentInClass._id }]), // only SV_IN is in teacher's class
      });
      mockStudentModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([studentInClass, studentOutClass]),
      });

      mockCriterionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            criterion_name: 'Criteria 1',
            criterion_code: 'C1',
          },
        ]),
      });

      mockSemesterModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            semester_name: 'HK1',
            status: 'active',
          },
        ]),
      });

      const rows = [
        {
          'Ma SV': 'SV_IN',
          'Tieu chi': 'Criteria 1',
          'Ngay ghi nhan': '2023-01-01',
        },
        {
          'Ma SV': 'SV_OUT',
          'Tieu chi': 'Criteria 1',
          'Ngay ghi nhan': '2023-01-01',
        }, // Expected error: Không có quyền ghi nhận
      ];

      const result = await service.importPreview(rows, requester);

      expect(result.totalRows).toBe(2);
      expect(result.validCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].reason).toContain('Không có quyền ghi nhận');
    });

    it('should detect duplicate idempotency keys within the same file', async () => {
      const studentId = new Types.ObjectId();
      mockStudentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([{ _id: studentId, student_code: 'SV1' }]),
      });
      mockCriterionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            criterion_name: 'Criteria 1',
            criterion_code: 'C1',
          },
        ]),
      });
      mockSemesterModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            semester_name: 'HK1',
            status: 'active',
          },
        ]),
      });

      const rows = [
        {
          'Ma SV': 'SV1',
          'Tieu chi': 'Criteria 1',
          'Ngay ghi nhan': '2023-01-01',
        },
        {
          'Ma SV': 'SV1',
          'Tieu chi': 'Criteria 1',
          'Ngay ghi nhan': '2023-01-01',
        }, // Duplicate
      ];

      const result = await service.importPreview(rows, null);

      expect(result.validCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].reason).toContain('Bản ghi trùng lặp trong file');
    });

    it('should validate correctly for valid new row', async () => {
      const studentId = new Types.ObjectId();
      mockStudentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([{ _id: studentId, student_code: 'SV1' }]),
      });
      mockCriterionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            criterion_name: 'Criteria 1',
            criterion_code: 'C1',
          },
        ]),
      });
      mockSemesterModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            semester_name: 'HK1',
            status: 'active',
          },
        ]),
      });

      const rows = [
        {
          'Ma SV': 'SV1',
          'Tieu chi': 'Criteria 1',
          'Ngay ghi nhan': '2023-01-01',
          'Trang thai': 'active',
        },
      ];

      const result = await service.importPreview(rows, null);

      expect(result.validCount).toBe(1);
      expect(result.errorCount).toBe(0);
    });

    it('should report error for missing required fields', async () => {
      const rows = [
        { 'Ma SV': '', 'Tieu chi': '', 'Ngay ghi nhan': '' }, // Missing all
        { 'Ma SV': 'SV1', 'Tieu chi': '', 'Ngay ghi nhan': '2023-01-01' }, // Missing criteria
      ];

      const result = await service.importPreview(rows, null);

      expect(result.validCount).toBe(0);
      expect(result.errorCount).toBe(2);
      expect(result.errors[0].reason).toMatch(
        /Thiếu Mã SV|Thiếu Tiêu chí|Thiếu Mã tiêu chí/i,
      );
    });

    it('should resolve correctly using criterion_code (Ma tieu chi)', async () => {
      const studentId = new Types.ObjectId();
      mockStudentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([
            { _id: studentId, student_code: 'SV1', full_name: 'Nguyen Van A' },
          ]),
      });
      mockCriterionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            criterion_name: 'Test Name',
            criterion_code: 'I.A',
          },
        ]),
      });
      mockSemesterModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            semester_name: 'HK1',
            status: 'active',
          },
        ]),
      });

      const rows = [
        {
          'Ma SV': 'SV1',
          'Ma tieu chi': 'I.A',
          'Ngay ghi nhan': '2023-01-01',
          'Trang thai': 'active',
        },
      ];

      const result = await service.importPreview(rows, null);
      expect(result.validCount).toBe(1);
      expect(result.errorCount).toBe(0);
    });

    it('should resolve using criterion_code even if criterion_name is not provided or different', async () => {
      const studentId = new Types.ObjectId();
      mockStudentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([
            { _id: studentId, student_code: 'SV1', full_name: 'Nguyen Van A' },
          ]),
      });
      mockCriterionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            criterion_name: 'Criteria Actual',
            criterion_code: 'C.1',
          },
        ]),
      });
      mockSemesterModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            semester_name: 'HK1',
            status: 'active',
          },
        ]),
      });

      const rows = [
        {
          'Ma SV': 'SV1',
          'Ma tieu chi': '  c.1  ',
          'Tieu chi': 'Criteria Wrong',
          'Ngay ghi nhan': '2023-01-01',
          'Trang thai': 'active',
        },
      ];

      const result = await service.importPreview(rows, null);
      expect(result.validCount).toBe(1);
      expect(result.errorCount).toBe(0);
    });

    it('should report error when criterion_code is not found', async () => {
      const studentId = new Types.ObjectId();
      mockStudentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([
            { _id: studentId, student_code: 'SV1', full_name: 'Nguyen Van A' },
          ]),
      });
      mockCriterionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            criterion_name: 'Test Name',
            criterion_code: 'I.A',
          },
        ]),
      });
      mockSemesterModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            semester_name: 'HK1',
            status: 'active',
          },
        ]),
      });

      const rows = [
        {
          'Ma SV': 'SV1',
          'Ma tieu chi': 'INVALID',
          'Ngay ghi nhan': '2023-01-01',
          'Trang thai': 'active',
        },
      ];

      const result = await service.importPreview(rows, null);
      expect(result.validCount).toBe(0);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].reason).toContain(
        'Không tìm thấy tiêu chí theo mã: INVALID',
      );
    });

    it('should fallback to criterion_name (Tieu chi) if Ma tieu chi is not provided', async () => {
      const studentId = new Types.ObjectId();
      mockStudentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([
            { _id: studentId, student_code: 'SV1', full_name: 'Nguyen Van A' },
          ]),
      });
      mockCriterionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            criterion_name: 'Test Name',
            criterion_code: 'I.A',
          },
        ]),
      });
      mockSemesterModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            semester_name: 'HK1',
            status: 'active',
          },
        ]),
      });

      const rows = [
        {
          'Ma SV': 'SV1',
          'Tieu chi': 'Test Name',
          'Ngay ghi nhan': '2023-01-01',
          'Trang thai': 'active',
        },
      ];

      const result = await service.importPreview(rows, null);
      expect(result.validCount).toBe(1);
      expect(result.errorCount).toBe(0);
    });
  });

  describe('importCommit', () => {
    it('should throw BadRequestException if session is invalid', async () => {
      await expect(
        service.importCommit('invalid_session', null),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark session as committing and start process', async () => {
      // We need to inject a session into the private map
      const sessionId = 'test_session';
      (service as any).importSessions.set(sessionId, {
        id: sessionId,
        status: 'ready_to_commit',
        validItems: [],
        errors: [],
        totalRows: 0,
        progress: 0,
        processedCount: 0,
        insertedCount: 0,
        duplicatedCount: 0,
        commitErrors: [],
      });

      const processSpy = jest
        .spyOn(service as any, 'processImportBatch')
        .mockResolvedValue(undefined);

      const result = await service.importCommit(sessionId, null);

      expect(result.success).toBe(true);
      expect((service as any).importSessions.get(sessionId).status).toBe(
        'committing',
      );
      expect(processSpy).toHaveBeenCalledWith(sessionId, null);
    });
  });

  describe('processImportBatch (batch execution)', () => {
    it('should handle duplicate key errors properly without failing the whole batch', async () => {
      const sessionId = 'test_session_batch';
      const validItems = [
        {
          student_id: new Types.ObjectId(),
          criterion_id: new Types.ObjectId(),
        },
        {
          student_id: new Types.ObjectId(),
          criterion_id: new Types.ObjectId(),
        },
      ];

      (service as any).importSessions.set(sessionId, {
        id: sessionId,
        status: 'committing',
        validItems,
        errors: [],
        totalRows: 2,
        progress: 0,
        processedCount: 0,
        insertedCount: 0,
        duplicatedCount: 0,
        commitErrors: [],
      });

      // Mock bulkWrite to simulate partial failure (duplicate)
      mockAcademicRecordModel.bulkWrite.mockRejectedValue({
        code: 11000,
        writeErrors: [{ index: 1 }],
        result: { nInserted: 1, insertedCount: 1 },
      });

      // Mock sync
      jest
        .spyOn(service, 'syncMultipleStudentCriterionScores')
        .mockResolvedValue(undefined);

      await (service as any).processImportBatch(sessionId, null);

      const session = (service as any).importSessions.get(sessionId);
      expect(session.status).toBe('completed');
      expect(session.insertedCount).toBe(1);
      expect(session.duplicatedCount).toBe(1);
      expect(session.processedCount).toBe(2);
    });

    it('should commit successfully with insertedCount matching validCount', async () => {
      const sessionId = 'test_session_batch_success';
      const validItems = [
        {
          student_id: new Types.ObjectId(),
          criterion_id: new Types.ObjectId(),
        },
      ];

      (service as any).importSessions.set(sessionId, {
        id: sessionId,
        status: 'committing',
        validItems,
        errors: [],
        totalRows: 1,
        progress: 0,
        processedCount: 0,
        insertedCount: 0,
        duplicatedCount: 0,
        commitErrors: [],
      });

      mockAcademicRecordModel.bulkWrite.mockResolvedValue({
        insertedCount: 1,
      });

      jest
        .spyOn(service, 'syncMultipleStudentCriterionScores')
        .mockResolvedValue(undefined);

      await (service as any).processImportBatch(sessionId, null);

      const session = (service as any).importSessions.get(sessionId);
      expect(session.status).toBe('completed');
      expect(session.insertedCount).toBe(1);
      expect(session.duplicatedCount).toBe(0);
      expect(session.commitErrors.length).toBe(0);
    });

    it('should handle all rows duplicated with insertedCount = 0', async () => {
      const sessionId = 'test_session_batch_all_dup';
      const validItems = [
        {
          student_id: new Types.ObjectId(),
          criterion_id: new Types.ObjectId(),
        },
      ];

      (service as any).importSessions.set(sessionId, {
        id: sessionId,
        status: 'committing',
        validItems,
        errors: [],
        totalRows: 1,
        progress: 0,
        processedCount: 0,
        insertedCount: 0,
        duplicatedCount: 0,
        commitErrors: [],
      });

      mockAcademicRecordModel.bulkWrite.mockRejectedValue({
        code: 11000,
        writeErrors: [{ index: 0 }],
        result: { nInserted: 0, insertedCount: 0 },
      });

      jest
        .spyOn(service, 'syncMultipleStudentCriterionScores')
        .mockResolvedValue(undefined);

      await (service as any).processImportBatch(sessionId, null);

      const session = (service as any).importSessions.get(sessionId);
      expect(session.status).toBe('completed');
      expect(session.insertedCount).toBe(0);
      expect(session.duplicatedCount).toBe(1);
    });
  });

  describe('getImportProgress', () => {
    it('should return NotFoundException if session not found', () => {
      expect(() => service.getImportProgress('missing')).toThrow(
        NotFoundException,
      );
    });

    it('should return session progress', () => {
      const sessionId = 'progress_session';
      (service as any).importSessions.set(sessionId, {
        status: 'completed',
        progress: 100,
        processedCount: 10,
        insertedCount: 9,
        duplicatedCount: 1,
        totalRows: 12,
        commitErrors: [],
      });

      const result = service.getImportProgress(sessionId);
      expect(result).toMatchObject({
        status: 'completed',
        progress: 100,
        insertedCount: 9,
        duplicatedCount: 1,
      });
    });
  });
  describe('findAll date filters', () => {
    it('should apply startDate and endDate filters with correct time boundaries', async () => {
      const mockExec = jest.fn().mockResolvedValue([]);
      const mockQueryObj = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: mockExec,
      };
      mockAcademicRecordModel.find.mockReturnValue(mockQueryObj);
      mockAcademicRecordModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({
        startDate: '2023-10-01',
        endDate: '2023-10-31',
      });

      expect(mockAcademicRecordModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $and: expect.arrayContaining([
            {
              $or: [
                {
                  recorded_at: {
                    $gte: new Date('2023-10-01T00:00:00.000Z'),
                    $lte: new Date('2023-10-31T23:59:59.999Z'),
                  },
                },
                {
                  date_record: {
                    $gte: new Date('2023-10-01T00:00:00.000Z'),
                    $lte: new Date('2023-10-31T23:59:59.999Z'),
                  },
                },
              ],
            },
          ]),
        }),
      );
    });
  });

  describe('findAll grouped by student', () => {
    it('keeps the default paginated endpoint record-level and does not aggregate', async () => {
      const record = { _id: new Types.ObjectId() };
      mockAcademicRecordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([record]),
      });
      mockAcademicRecordModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toEqual({
        data: [{ ...record, effectivePoints: 0 }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });
      expect(mockAcademicRecordModel.aggregate).not.toHaveBeenCalled();
    });

    it('groups after filters, paginates distinct students, and populates the latest record', async () => {
      const studentId = new Types.ObjectId();
      const latestRecordId = new Types.ObjectId();
      const latestRecord = {
        _id: latestRecordId,
        student_id: { _id: studentId, student_code: 'SV001' },
      };
      mockAcademicRecordModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            data: [
              {
                _id: studentId,
                latestRecordId,
                recordCount: 3,
                recordTypeCounts: {
                  khen_thuong: 1,
                  cong_diem: 2,
                  ky_luat: 0,
                },
                recordTypes: ['khen_thuong', 'cong_diem'],
                totalPoints: 12,
              },
            ],
            meta: [{ total: 6 }],
          },
        ]),
      });
      mockAcademicRecordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([latestRecord]),
      });

      const semesterId = new Types.ObjectId().toString();
      const result = await service.findAll(
        { groupBy: 'student', page: 2, limit: 5, semesterId },
        { roleCode: 'ADMIN', roleName: 'Admin' },
      );

      expect(result).toEqual({
        data: [
          {
            studentId: studentId.toString(),
            latestRecord,
            recordCount: 3,
            recordTypeCounts: {
              khen_thuong: 1,
              cong_diem: 2,
              ky_luat: 0,
            },
            recordTypes: ['khen_thuong', 'cong_diem'],
            totalPoints: 12,
          },
        ],
        meta: { total: 6, page: 2, limit: 5, totalPages: 2, has_more: false },
      });
      const pipeline = mockAcademicRecordModel.aggregate.mock.calls[0][0];
      expect(pipeline[0]).toEqual({
        $match: expect.objectContaining({
          status: 'active',
          is_deleted: { $ne: true },
          semester_id: new Types.ObjectId(semesterId),
        }),
      });
      expect(pipeline.find((stage: any) => stage.$group)?.$group).toEqual(
        expect.objectContaining({
          _id: '$student_id',
          latestRecordId: { $first: '$_id' },
          recordCount: { $sum: 1 },
          khenThuongCount: expect.objectContaining({ $sum: expect.any(Object) }),
          congDiemCount: expect.objectContaining({ $sum: expect.any(Object) }),
          kyLuatCount: expect.objectContaining({ $sum: expect.any(Object) }),
          recordTypes: { $addToSet: '$criterion.criterion_type' },
          scoreRecords: expect.objectContaining({ $push: expect.any(Object) }),
        }),
      );
      expect(pipeline.find((stage: any) => stage.$lookup)?.$lookup).toEqual(
        expect.objectContaining({
          localField: 'criterion_id',
          foreignField: '_id',
        }),
      );
      expect(pipeline.find((stage: any) => stage.$facet)?.$facet.data).toEqual([
        { $skip: 5 },
        { $limit: 5 },
      ]);
      expect(mockAcademicRecordModel.find).toHaveBeenCalledWith({
        _id: { $in: [latestRecordId] },
      });
    });

    it('returns a reconciled total and per-type counts for a grouped student', async () => {
      const studentId = new Types.ObjectId();
      const latestRecordId = new Types.ObjectId();
      const latestRecord = { _id: latestRecordId, student_id: studentId };
      mockAcademicRecordModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            data: [{
              _id: studentId,
              latestRecordId,
              recordCount: 12,
              recordTypeCounts: { khen_thuong: 5, cong_diem: 5, ky_luat: 2 },
              recordTypes: ['khen_thuong', 'cong_diem', 'ky_luat'],
              scoreRecords: [],
            }],
            meta: [{ total: 1 }],
          },
        ]),
      });
      mockAcademicRecordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([latestRecord]),
      });

      const result = await service.findAll({ groupBy: 'student' });

      expect(result.data[0]).toEqual(expect.objectContaining({
        recordCount: 12,
        recordTypeCounts: { khen_thuong: 5, cong_diem: 5, ky_luat: 2 },
      }));
      expect(Object.values(result.data[0].recordTypeCounts).reduce(
        (total: number, count: number) => total + count,
        0,
      )).toBe(result.data[0].recordCount);
    });

    it('sums count, selected-option, and manual scores with signed discipline contribution', async () => {
      const studentId = new Types.ObjectId();
      const latestRecordId = new Types.ObjectId();
      const latestRecord = { _id: latestRecordId, student_id: studentId };
      mockAcademicRecordModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            data: [
              {
                _id: studentId,
                latestRecordId,
          recordCount: 4,
          recordTypeCounts: {
            khen_thuong: 1,
            cong_diem: 2,
            ky_luat: 1,
          },
          recordTypes: ['khen_thuong', 'cong_diem', 'ky_luat'],
                scoreRecords: [
                  {
                    criterion: {
                      criterion_type: 'cong_diem',
                      scoring_mode: 'count',
                      score_per_unit: 2,
                      min_score: 0,
                      max_score: 10,
                    },
                    action_type: 'count',
                    quantity: 2,
                  },
                  {
                    criterion: {
                      criterion_type: 'khen_thuong',
                      scoring_mode: 'single_option',
                      score_per_unit: 1,
                      options: [{ id: 'opt-1', label: 'Tốt', score: 8 }],
                    },
                    action_type: 'select_option',
                    selected_option_id: 'opt-1',
                    quantity: 1,
                  },
                  {
                    criterion: {
                      criterion_type: 'ky_luat',
                      scoring_mode: 'count',
                      score_per_unit: -5,
                      min_score: 0,
                      max_score: 10,
                      is_score_counted: false,
                    },
                    action_type: 'count',
                    quantity: 1,
                  },
                  {
                    criterion: {
                      criterion_type: 'cong_diem',
                      scoring_mode: 'count',
                      score_per_unit: 1,
                      min_score: 0,
                      max_score: 10,
                    },
                    action_type: 'manual_score',
                    payload: { manual_score: 3 },
                    quantity: 1,
                  },
                ],
              },
            ],
            meta: [{ total: 1 }],
          },
        ]),
      });
      mockAcademicRecordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([latestRecord]),
      });

      const result = await service.findAll({ groupBy: 'student' });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          recordTypes: ['khen_thuong', 'cong_diem', 'ky_luat'],
          totalPoints: 10,
        }),
      );
    });

    it('algebraically sums two negative discipline and three positive contributions', async () => {
      const studentId = new Types.ObjectId();
      const latestRecordId = new Types.ObjectId();
      const latestRecord = { _id: latestRecordId, student_id: studentId };
      const positiveCriterion = (scorePerUnit: number, criterionType = 'cong_diem') => ({
        criterion_type: criterionType,
        scoring_mode: 'count',
        score_per_unit: scorePerUnit,
        min_score: 0,
        max_score: 10,
      });
      const disciplineCriterion = {
        criterion_type: 'ky_luat',
        scoring_mode: 'count',
        score_per_unit: -1.5,
        min_score: 0,
        max_score: 10,
        is_score_counted: false,
      };

      mockAcademicRecordModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            data: [
              {
                _id: studentId,
                latestRecordId,
                recordCount: 5,
                recordTypeCounts: {
                  khen_thuong: 1,
                  cong_diem: 2,
                  ky_luat: 2,
                },
                recordTypes: ['khen_thuong', 'cong_diem', 'ky_luat'],
                scoreRecords: [
                  { criterion: disciplineCriterion, action_type: 'count', quantity: 1 },
                  { criterion: disciplineCriterion, action_type: 'count', quantity: 1 },
                  { criterion: positiveCriterion(2), action_type: 'count', quantity: 1 },
                  { criterion: positiveCriterion(2, 'khen_thuong'), action_type: 'count', quantity: 1 },
                  { criterion: positiveCriterion(1), action_type: 'count', quantity: 1 },
                ],
              },
            ],
            meta: [{ total: 1 }],
          },
        ]),
      });
      mockAcademicRecordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([latestRecord]),
      });

      const result = await service.findAll({ groupBy: 'student' });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          recordCount: 5,
          recordTypeCounts: {
            khen_thuong: 1,
            cong_diem: 2,
            ky_luat: 2,
          },
          recordTypes: ['khen_thuong', 'cong_diem', 'ky_luat'],
          totalPoints: 2,
        }),
      );
    });

    it('keeps the grouped total negative when discipline deductions exceed bonuses', async () => {
      const studentId = new Types.ObjectId();
      const latestRecordId = new Types.ObjectId();
      const latestRecord = { _id: latestRecordId, student_id: studentId };
      const disciplineCriterion = {
        criterion_type: 'ky_luat',
        scoring_mode: 'count',
        score_per_unit: -4,
        min_score: 0,
        max_score: 10,
        is_score_counted: false,
      };

      mockAcademicRecordModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            data: [
              {
                _id: studentId,
                latestRecordId,
                recordCount: 3,
                recordTypeCounts: {
                  khen_thuong: 0,
                  cong_diem: 1,
                  ky_luat: 2,
                },
                recordTypes: ['cong_diem', 'ky_luat'],
                scoreRecords: [
                  { criterion: disciplineCriterion, action_type: 'count', quantity: 1 },
                  { criterion: disciplineCriterion, action_type: 'count', quantity: 1 },
                  {
                    criterion: {
                      criterion_type: 'cong_diem',
                      scoring_mode: 'count',
                      score_per_unit: 1,
                      min_score: 0,
                      max_score: 10,
                    },
                    action_type: 'count',
                    quantity: 1,
                  },
                ],
              },
            ],
            meta: [{ total: 1 }],
          },
        ]),
      });
      mockAcademicRecordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([latestRecord]),
      });

      const result = await service.findAll({ groupBy: 'student' });

      expect(result.data[0].totalPoints).toBe(-7);
    });

    it('treats records without a resolved criterion as zero without using stored points', async () => {
      const studentId = new Types.ObjectId();
      const latestRecordId = new Types.ObjectId();
      const latestRecord = { _id: latestRecordId, student_id: studentId };
      mockAcademicRecordModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            data: [
              {
                _id: studentId,
                latestRecordId,
          recordCount: 2,
          recordTypeCounts: {
            khen_thuong: 0,
            cong_diem: 0,
            ky_luat: 2,
          },
          recordTypes: ['ky_luat'],
                scoreRecords: [
                  { points_effect: -99 },
                  { criterion: null, points_effect: 5 },
                ],
              },
            ],
            meta: [{ total: 1 }],
          },
        ]),
      });
      mockAcademicRecordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([latestRecord]),
      });

      const result = await service.findAll({ groupBy: 'student' });

      expect(result.data[0].totalPoints).toBe(0);
    });

    it('applies teacher RBAC before grouping', async () => {
      const classId = new Types.ObjectId();
      const studentId = new Types.ObjectId();
      const latestRecordId = new Types.ObjectId();
      mockClassModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: classId }]),
      });
      mockStudentModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: studentId }]),
      });
      mockAcademicRecordModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            data: [{ _id: studentId, latestRecordId, recordCount: 1 }],
            meta: [{ total: 1 }],
          },
        ]),
      });
      mockAcademicRecordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: latestRecordId }]),
      });

      await service.findAll(
        { groupBy: 'student', page: 1, limit: 10 },
        { roleName: 'Teacher', userId: new Types.ObjectId().toString() },
      );

      const match = mockAcademicRecordModel.aggregate.mock.calls[0][0][0].$match;
      expect(match.student_id).toEqual({ $in: [studentId] });
    });
  });

  describe('handleScoreIntent', () => {
    let studentId: string;
    let semesterId: string;
    let criterionId: string;

    beforeEach(() => {
      studentId = new Types.ObjectId().toString();
      semesterId = new Types.ObjectId().toString();
      criterionId = new Types.ObjectId().toString();

      mockSummaryPointModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          total_score: 100,
          grading: 'A',
          status: 'draft',
          details: [
            {
              criterion_id: criterionId,
              current_count: 2,
            },
          ],
        }),
      });

      mockClassModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId() }]),
      });

      mockStudentModel.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          class_id: mockClassModel.find().exec()[0]?._id,
        }), // Just needs to not throw and match class_id roughly, actually wait we need to match the class_id
      });
      // A better way is to use a consistent class_id
      const classId = new Types.ObjectId();
      mockClassModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: classId }]),
      });
      mockStudentModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          class_id: classId,
          user_id: studentId,
        }),
      });

      mockCriterionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          scoring_mode: 'single_option',
          options: [{ id: 'opt1', label: 'Option 1', score: 10 }],
        }),
      });

      jest
        .spyOn(service, 'syncStudentCriterionScore')
        .mockResolvedValue(undefined);
    });

    it('should throw ForbiddenException if student tries to evaluate another student', async () => {
      const requester = {
        userId: new Types.ObjectId().toString(),
        roleName: 'Student',
      };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'increase',
      };

      await expect(
        service.handleScoreIntent(intentDto, requester),
      ).rejects.toThrow(ForbiddenException);
    });

    it('does not mutate records when the student evaluation window is denied', async () => {
      mockSummariesPointService.assertStudentEvaluationWindow.mockRejectedValueOnce(
        new ForbiddenException('evaluation window closed'),
      );
      const requester = { userId: studentId, roleName: 'Student' };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'increase',
      };

      await expect(service.handleScoreIntent(intentDto, requester)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockAcademicRecordModel.insertMany).not.toHaveBeenCalled();
      expect(mockAcademicRecordModel.deleteOne).not.toHaveBeenCalled();
      expect(service.syncStudentCriterionScore).not.toHaveBeenCalled();
    });

    it('should handle increase intent and create 1 record when current count = 0', async () => {
      const requester = { userId: studentId, roleName: 'Student' };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'increase',
      };

      mockAcademicRecordModel.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]), // current count = 0
      });
      mockAcademicRecordModel.insertMany = jest
        .fn()
        .mockResolvedValue([{ _id: new Types.ObjectId() }]);

      const result = await service.handleScoreIntent(intentDto, requester);
      expect(mockAcademicRecordModel.insertMany).toHaveBeenCalledTimes(1);
      expect(mockAcademicRecordModel.insertMany.mock.calls[0][0].length).toBe(
        1,
      );
      expect(result.success).toBe(true);
    });

    it('should handle increase intent and create additional record when current count > 0', async () => {
      const requester = { userId: studentId, roleName: 'Student' };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'increase',
      };

      mockCriterionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          scoring_mode: 'count',
          score_per_unit: 2,
          max_score: 10,
        }),
      });

      const currentRecords = [{ _id: new Types.ObjectId() }];
      mockAcademicRecordModel.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(currentRecords), // current count > 0
      });
      mockAcademicRecordModel.insertMany = jest
        .fn()
        .mockResolvedValue([{ _id: new Types.ObjectId() }]);

      const result = await service.handleScoreIntent(intentDto, requester);
      expect(mockAcademicRecordModel.insertMany).toHaveBeenCalledTimes(1);
      expect(mockAcademicRecordModel.insertMany.mock.calls[0][0].length).toBe(
        1,
      );
      expect(result.success).toBe(true);
    });

    it('should handle decrease intent and delete existing record if permitted, and write audit log', async () => {
      const { Logger } = require('@nestjs/common');
      const loggerSpy = jest.spyOn(Logger, 'log');

      const requester = { userId: studentId, roleCode: 'ADMIN', roleName: 'Admin' };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'decrease',
      };

      const currentRecords = [
        {
          _id: new Types.ObjectId(),
          record_title: 'Added by Teacher',
          recorded_by: {
            _id: new Types.ObjectId(),
            role: { role_name: 'Teacher' },
          },
        },
      ];
      mockAcademicRecordModel.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(currentRecords),
      });
      mockAcademicRecordModel.deleteOne = jest
        .fn()
        .mockResolvedValue({ deletedCount: 1 });

      const result = await service.handleScoreIntent(intentDto, requester);
      expect(mockAcademicRecordModel.deleteOne).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT_LOG] Hard-delete academic_record'),
      );
      expect(result.success).toBe(true);
    });

    it('should NOT delete record if requester has lower role level despite spoofed title', async () => {
      const requester = {
        userId: new Types.ObjectId().toString(),
        roleName: 'Teacher',
      };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'decrease',
      };

      const currentRecords = [
        {
          _id: new Types.ObjectId(),
          record_title: 'Added by Teacher', // Title says Teacher, but actual role is Admin
          recorded_by: {
            _id: new Types.ObjectId(),
            role: { role_name: 'Admin' },
          },
        },
      ];
      mockAcademicRecordModel.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(currentRecords),
      });
      mockAcademicRecordModel.deleteOne = jest
        .fn()
        .mockResolvedValue({ deletedCount: 1 });

      await service.handleScoreIntent(intentDto, requester);

      // Teacher cannot delete Admin's record
      expect(mockAcademicRecordModel.deleteOne).not.toHaveBeenCalled();
    });

    it('should allow student to only delete their own records on decrease', async () => {
      const requester = { userId: studentId, roleName: 'Student' };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'decrease',
      };

      const otherStudentId = new Types.ObjectId().toString();
      const currentRecords = [
        {
          _id: new Types.ObjectId(),
          recorded_by: otherStudentId, // Not the requester
        },
      ];
      mockAcademicRecordModel.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(currentRecords),
      });
      mockAcademicRecordModel.deleteOne = jest.fn();

      await service.handleScoreIntent(intentDto, requester);

      // Student cannot delete another user's record
      expect(mockAcademicRecordModel.deleteOne).not.toHaveBeenCalled();
    });

    it('should handle set_target_count intent correctly', async () => {
      const requester = { userId: studentId, roleName: 'Student' };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'set_target_count',
        target_count: 3,
      };

      mockCriterionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          scoring_mode: 'count',
          score_per_unit: 2,
          max_score: 10,
        }),
      });

      const currentRecords = [{ _id: new Types.ObjectId() }];
      mockAcademicRecordModel.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(currentRecords),
      });
      mockAcademicRecordModel.insertMany = jest
        .fn()
        .mockResolvedValue([
          { _id: new Types.ObjectId() },
          { _id: new Types.ObjectId() },
        ]);

      await service.handleScoreIntent(intentDto, requester);
      expect(mockAcademicRecordModel.insertMany).toHaveBeenCalledTimes(1);
      expect(mockAcademicRecordModel.insertMany.mock.calls[0][0].length).toBe(
        2,
      );
    });

    it('should handle select_option intent', async () => {
      const requester = { userId: studentId, roleName: 'Student' };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'select_option',
        selected_option_id: 'opt1',
      };

      mockAcademicRecordModel.findOne = jest.fn().mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockAcademicRecordModel.create = jest
        .fn()
        .mockResolvedValue({ _id: new Types.ObjectId() });

      await service.handleScoreIntent(intentDto, requester);
      expect(mockAcademicRecordModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          record_title: 'Option 1',
          selected_option_label: 'Option 1',
        }),
      );
    });

    it('should handle clear_score intent and only delete permitted records', async () => {
      const { Logger } = require('@nestjs/common');
      const loggerSpy = jest.spyOn(Logger, 'log');

      const requester = {
        userId: new Types.ObjectId().toString(),
        roleName: 'Teacher',
      };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'clear_score',
      };

      const adminRecordId = new Types.ObjectId();
      const studentRecordId = new Types.ObjectId();

      const currentRecords = [
        {
          _id: adminRecordId,
          recorded_by: {
            _id: new Types.ObjectId(),
            role: { role_name: 'Admin' },
          },
        },
        {
          _id: studentRecordId,
          recorded_by: {
            _id: new Types.ObjectId(),
            role: { role_name: 'Student' },
          },
        },
      ];

      mockAcademicRecordModel.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(currentRecords),
      });
      mockAcademicRecordModel.deleteOne = jest
        .fn()
        .mockResolvedValue({ deletedCount: 1 });

      await service.handleScoreIntent(intentDto, requester);

      // Teacher can delete Student's record but not Admin's record
      expect(mockAcademicRecordModel.deleteOne).toHaveBeenCalledTimes(1);
      expect(mockAcademicRecordModel.deleteOne).toHaveBeenCalledWith({
        _id: studentRecordId,
      });
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('clear_score'),
      );
    });

    it('should throw BadRequestException if desiredCount > maxCount', async () => {
      const requester = { userId: studentId, roleName: 'Student' };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'increase',
      };

      mockCriterionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          scoring_mode: 'count',
          score_per_unit: 5,
          max_score: 10, // maxCount = 2
        }),
      });

      const currentRecords = [
        { _id: new Types.ObjectId() },
        { _id: new Types.ObjectId() },
      ]; // currentCount = 2
      mockAcademicRecordModel.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(currentRecords),
      });

      await expect(
        service.handleScoreIntent(intentDto, requester),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if score_per_unit is 0 in count mode', async () => {
      const requester = { userId: studentId, roleName: 'Student' };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'increase',
      };

      mockCriterionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          scoring_mode: 'count',
          score_per_unit: 0,
          max_score: 10,
        }),
      });

      await expect(
        service.handleScoreIntent(intentDto, requester),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if baseline_count mismatch when decreasing count', async () => {
      const requester = { userId: studentId, roleCode: 'ADMIN', roleName: 'Admin' };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'set_target_count',
        target_count: 1,
        baseline_count: 5, // Lệch với count thực tế là 2
      };

      mockCriterionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          scoring_mode: 'count',
          score_per_unit: 2,
          max_score: 10,
        }),
      });

      const currentRecords = [
        { _id: new Types.ObjectId() },
        { _id: new Types.ObjectId() },
      ]; // count = 2
      mockAcademicRecordModel.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(currentRecords),
      });

      await expect(
        service.handleScoreIntent(intentDto, requester),
      ).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            'Dữ liệu chấm điểm trên màn hình không đồng bộ',
          ),
        }),
      );
    });

    it('should allow decrease if baseline_count matches currentCount', async () => {
      const requester = { userId: studentId, roleCode: 'ADMIN', roleName: 'Admin' };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'set_target_count',
        target_count: 1,
        baseline_count: 2, // Khớp với count thực tế là 2
      };

      mockCriterionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          scoring_mode: 'count',
          score_per_unit: 2,
          max_score: 10,
        }),
      });

      const currentRecords = [
        { _id: new Types.ObjectId() },
        { _id: new Types.ObjectId() },
      ]; // count = 2
      mockAcademicRecordModel.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(currentRecords),
      });
      mockAcademicRecordModel.deleteOne = jest
        .fn()
        .mockResolvedValue({ deletedCount: 1 });

      const result = await service.handleScoreIntent(intentDto, requester);
      expect(result.success).toBe(true);
      expect(mockAcademicRecordModel.deleteOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('auditMismatches', () => {
    it('should scan summaries and trigger syncStudentCriterionScore for mismatched counts', async () => {
      const semesterId = new Types.ObjectId().toString();
      const student1 = new Types.ObjectId();
      const cri1 = new Types.ObjectId();

      mockSummaryPointModel.find = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            student_id: student1,
            semester_id: semesterId,
            details: [
              {
                criterion_id: cri1,
                current_count: 5, // detail count là 5
              },
            ],
          },
        ]),
      });

      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { criterion_id: cri1 }, // actual count chỉ là 1
        ]),
      });

      mockCriterionModel.find = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ _id: cri1 }]),
      });

      const syncSpy = jest
        .spyOn(service, 'syncStudentCriterionScore')
        .mockResolvedValue(undefined);

      const result = await service.auditMismatches(semesterId);

      expect(syncSpy).toHaveBeenCalledWith(
        student1.toString(),
        semesterId,
        cri1.toString(),
      );
      expect(result.totalScanned).toBe(1);
      expect(result.totalFixed).toBe(1);
    });
  });

  describe('syncStudentCriterionScore (evaluation_detail sync)', () => {
    const studentId = new Types.ObjectId().toString();
    const semesterId = new Types.ObjectId().toString();
    const criterionId = new Types.ObjectId().toString();
    const summaryId = new Types.ObjectId();
    let mockSummary: any;

    beforeEach(() => {
      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ selected_option_id: 'opt1' }]),
      });
      mockAcademicRecordModel.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      mockSummary = {
        _id: summaryId,
        student_id: studentId,
        semester_id: semesterId,
        details: [
          {
            criterion_id: criterionId,
            current_count: 0,
            system_score: 0,
            status: 'draft',
          },
        ],
        save: jest.fn().mockResolvedValue(true),
        markModified: jest.fn(),
        status: 'draft',
      };
      mockSummaryPointModel.find = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockSummary]),
      });
      mockSummaryPointModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSummary),
      });
      mockCriterionModel.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          score_per_unit: 2,
          max_score: 10,
          min_score: 0,
        }),
      });
      mockSummariesPointService.recomputeTotalScore = jest
        .fn()
        .mockResolvedValue(true);
    });

    it('should set evaluation_detail.current_count to number of active academic_records', async () => {
      await service.syncStudentCriterionScore(
        studentId,
        semesterId,
        criterionId,
      );

      expect(mockAcademicRecordModel.find).toHaveBeenCalled();
      expect(mockSummary.details[0].current_count).toBe(1); // 1 active record
      expect(mockSummary.details[0].system_score).toBe(2); // 1 * 2 score
      expect(mockSummary.save).toHaveBeenCalled();
    });

    it('should clear orphan evaluation_detail points when no active records exist', async () => {
      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]), // No active records
      });

      mockSummary.details[0].current_count = 5;
      mockSummary.details[0].system_score = 10;

      await service.syncStudentCriterionScore(
        studentId,
        semesterId,
        criterionId,
      );

      expect(mockSummary.details[0].current_count).toBe(0);
      expect(mockSummary.details[0].system_score).toBe(0); // cleared
      expect(mockSummary.save).toHaveBeenCalled();
      expect(mockSummariesPointService.recomputeTotalScore).toHaveBeenCalled();
    });

    it('should overwrite sv_score and gv_score with systemScore for draft unreviewed details', async () => {
      mockSummary.details[0].sv_score = 5;
      mockSummary.details[0].gv_score = 6;
      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{}, {}]), // 2 active records
      });

      await service.syncStudentCriterionScore(
        studentId,
        semesterId,
        criterionId,
      );

      expect(mockSummary.details[0].current_count).toBe(2);
      expect(mockSummary.details[0].system_score).toBe(4); // 2 * 2 score
      expect(mockSummary.details[0].sv_score).toBe(4); // Overwritten because it's draft unreviewed
      expect(mockSummary.details[0].gv_score).toBe(4); // Overwritten because it's draft unreviewed
      expect(mockSummary.save).toHaveBeenCalled();
    });

    it('should NOT overwrite sv_score and gv_score with systemScore when detail is reviewed', async () => {
      mockSummary.details[0].status = 'gv_reviewed';
      mockSummary.details[0].gv_reviewed_by = 'teacher-1';
      mockSummary.details[0].sv_score = 5;
      mockSummary.details[0].gv_score = 6;
      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{}, {}]), // 2 active records
      });

      await service.syncStudentCriterionScore(
        studentId,
        semesterId,
        criterionId,
      );

      expect(mockSummary.details[0].current_count).toBe(2);
      expect(mockSummary.details[0].system_score).toBe(4);
      expect(mockSummary.details[0].sv_score).toBe(5); // Preserved
      expect(mockSummary.details[0].gv_score).toBe(6); // Preserved
    });

    it('should clear selected option fields for editable draft option criteria when no active records exist', async () => {
      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]), // No active records
      });

      mockCriterionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          scoring_mode: 'single_option',
          options: [{ id: 'opt-1', label: 'Opt 1', score: 5 }],
        }),
      });

      mockSummary.details[0].selected_option_id = 'opt-1';
      mockSummary.details[0].selected_option_label = 'Opt 1';
      mockSummary.details[0].selected_option_score = 5;
      mockSummary.details[0].status = 'draft';

      await service.syncStudentCriterionScore(
        studentId,
        semesterId,
        criterionId,
      );

      expect(mockSummary.details[0].selected_option_id).toBeNull();
      expect(mockSummary.details[0].selected_option_label).toBeNull();
      expect(mockSummary.details[0].selected_option_score).toBeNull();
      expect(mockSummary.details[0].current_count).toBe(0);
      expect(mockSummary.details[0].system_score).toBe(0);
      expect(mockSummary.save).toHaveBeenCalled();
    });

    it('should NOT clear selected option fields or manual scores when detail is reviewed/locked', async () => {
      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]), // No active records
      });

      mockCriterionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          scoring_mode: 'single_option',
          options: [{ id: 'opt-1', label: 'Opt 1', score: 5 }],
        }),
      });

      mockSummary.details[0].selected_option_id = 'opt-1';
      mockSummary.details[0].selected_option_label = 'Opt 1';
      mockSummary.details[0].selected_option_score = 5;
      mockSummary.details[0].status = 'gv_reviewed';
      mockSummary.details[0].gv_reviewed_by = 'teacher-1';

      await service.syncStudentCriterionScore(
        studentId,
        semesterId,
        criterionId,
      );

      expect(mockSummary.details[0].selected_option_id).toBe('opt-1');
      expect(mockSummary.details[0].selected_option_label).toBe('Opt 1');
      expect(mockSummary.details[0].selected_option_score).toBe(5);
      expect(mockSummary.details[0].current_count).toBe(0);
    });

    it('should only update sv_score when student grades', async () => {
      mockSummary.details[0].sv_score = null;
      mockSummary.details[0].gv_score = null;
      mockSummary.details[0].final_score = null;

      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{}]), // 1 record
      });

      const studentRequester = { userId: studentId, roleName: 'Student' };
      await service.syncStudentCriterionScore(
        studentId,
        semesterId,
        criterionId,
        studentRequester,
      );

      expect(mockSummary.details[0].sv_score).toBe(2); // Updated
      expect(mockSummary.details[0].gv_score).toBeNull(); // Untouched
      expect(mockSummary.details[0].final_score).toBeNull(); // Untouched
    });

    it('should only update gv_score when teacher grades', async () => {
      mockSummary.details[0].sv_score = 3;
      mockSummary.details[0].gv_score = null;
      mockSummary.details[0].final_score = null;

      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{}]), // 1 record
      });

      const teacherRequester = { userId: 'teacher-1', roleName: 'Teacher' };
      await service.syncStudentCriterionScore(
        studentId,
        semesterId,
        criterionId,
        teacherRequester,
      );

      expect(mockSummary.details[0].gv_score).toBe(2); // Updated
      expect(mockSummary.details[0].sv_score).toBe(3); // Preserved
      expect(mockSummary.details[0].final_score).toBeNull(); // Untouched
    });

    it('should only update final_score when admin or supervisor grades', async () => {
      mockSummary.details[0].sv_score = 3;
      mockSummary.details[0].gv_score = 4;
      mockSummary.details[0].final_score = null;

      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{}]), // 1 record
      });

      const adminRequester = { userId: 'admin-1', roleCode: 'ADMIN', roleName: 'Admin' };
      await service.syncStudentCriterionScore(
        studentId,
        semesterId,
        criterionId,
        adminRequester,
      );

      expect(mockSummary.details[0].final_score).toBe(2); // Updated
      expect(mockSummary.details[0].sv_score).toBe(3); // Preserved
      expect(mockSummary.details[0].gv_score).toBe(4); // Preserved
    });
  });

  describe('select_option intent validation and sync', () => {
    let studentId: string;
    let semesterId: string;
    let criterionId: string;

    beforeEach(() => {
      studentId = new Types.ObjectId().toString();
      semesterId = new Types.ObjectId().toString();
      criterionId = new Types.ObjectId().toString();

      mockStudentModel.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ user_id: studentId }),
      });

      mockCriterionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          scoring_mode: 'single_option',
          options: [
            { id: 'opt_1', label: 'Option 1', score: 10 },
            { id: 'opt_2', label: 'Option 2', score: 20 },
          ],
        }),
      });

      mockAcademicRecordModel.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      mockSummaryPointModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          details: [
            {
              criterion_id: criterionId,
              current_count: 1,
              selected_option_id: 'opt_1',
            },
          ],
        }),
      });
    });

    it('should throw BadRequestException if option is invalid', async () => {
      const requester = { userId: studentId, roleName: 'Student' };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'select_option',
        selected_option_id: 'opt_invalid',
      };

      await expect(
        service.handleScoreIntent(intentDto, requester),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create new academic_record if none exists', async () => {
      const requester = { userId: studentId, roleName: 'Student' };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'select_option',
        selected_option_id: 'opt_1',
      };

      mockAcademicRecordModel.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      mockAcademicRecordModel.create = jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        selected_option_id: 'opt_1',
        save: jest.fn(),
      });

      const result = await service.handleScoreIntent(intentDto, requester);
      expect(mockAcademicRecordModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          selected_option_id: 'opt_1',
        }),
      );
      expect(result.success).toBe(true);
    });

    it('should update existing academic_record if it exists and user has permission', async () => {
      const requester = { userId: studentId, roleName: 'Student' };
      const intentDto: any = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'select_option',
        selected_option_id: 'opt_2',
      };

      const existingRecord = {
        _id: new Types.ObjectId(),
        recorded_by: studentId,
        selected_option_id: 'opt_1',
        save: jest.fn().mockResolvedValue(true),
      };
      mockAcademicRecordModel.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingRecord),
      });

      const result = await service.handleScoreIntent(intentDto, requester);
      expect(existingRecord.selected_option_id).toBe('opt_2');
      expect(existingRecord.save).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('Repair and Migration Scripts (as per taskscope.md)', () => {
    it.todo(
      'repair-from-records reset/xoa detail mo coi va recompute total score',
    );
    it.todo(
      'backfill-records tao bu record tu detail cu khi duoc chon mode nay',
    );
  });

  describe('normalizeObjectId utility', () => {
    it('should normalize different types of ObjectId representations to string', () => {
      const idStr = '507f1f77bcf86cd799439011';
      const objId = new Types.ObjectId(idStr);

      expect(normalizeObjectId(null)).toBe('');
      expect(normalizeObjectId(undefined)).toBe('');
      expect(normalizeObjectId(idStr)).toBe(idStr);
      expect(normalizeObjectId(objId)).toBe(idStr);
      expect(normalizeObjectId({ _id: objId })).toBe(idStr);
      expect(normalizeObjectId({ id: objId })).toBe(idStr);
      expect(normalizeObjectId({ _id: idStr })).toBe(idStr);
      expect(normalizeObjectId({ id: idStr })).toBe(idStr);
    });
  });

  describe('Locked Summary Preflight', () => {
    let studentId: string;
    let semesterId: string;
    let criterionId: string;

    beforeEach(() => {
      studentId = new Types.ObjectId().toString();
      semesterId = new Types.ObjectId().toString();
      criterionId = new Types.ObjectId().toString();

      // Mock findOne to return a locked summary
      mockSummaryPointModel.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          status: 'locked',
        }),
      });
    });

    it('should block create when summary is locked', async () => {
      const dto = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        record_title: 'test',
      };
      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should block bulkCreate when summary is locked', async () => {
      const dto = {
        records: [
          {
            student_id: studentId,
            semester_id: semesterId,
            criterion_id: criterionId,
            record_title: 'test',
          },
        ],
      };
      await expect(service.bulkCreate(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should block update when summary is locked', async () => {
      const existingRecord = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
      };
      mockAcademicRecordModel.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingRecord),
      });
      await expect(
        service.update('507f1f77bcf86cd799439011', {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should remove when summary is locked without mutating the locked summary', async () => {
      const existingRecord = {
        _id: new Types.ObjectId(),
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        status: 'active',
        is_deleted: false,
      };
      mockAcademicRecordModel.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingRecord),
      });
      const deletedRecord = { ...existingRecord, status: 'inactive', is_deleted: true };
      mockAcademicRecordModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(deletedRecord),
      });
      const syncSpy = jest
        .spyOn(service, 'syncStudentCriterionScore')
        .mockResolvedValue(undefined as any);
      const lockSpy = jest.spyOn(service as any, 'checkSummaryLocked');

      await expect(
        service.remove('507f1f77bcf86cd799439011', { roleCode: 'ADMIN', roleName: 'Admin' } as any),
      ).resolves.toBe(deletedRecord);
      expect(mockAcademicRecordModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(lockSpy).not.toHaveBeenCalled();
      expect(syncSpy).toHaveBeenCalledWith(studentId, semesterId, criterionId);
    });

    it('should block restore when summary is locked', async () => {
      const existingRecord = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
      };
      mockAcademicRecordModel.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingRecord),
      });
      await expect(
        service.restore('507f1f77bcf86cd799439011', {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should permanently remove an eligible trashed record when summary is locked', async () => {
      const existingRecord = {
        _id: new Types.ObjectId(),
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        status: 'inactive',
        is_deleted: true,
      };
      mockAcademicRecordModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingRecord),
      });
      mockAcademicRecordModel.findByIdAndDelete = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingRecord),
      });
      const syncSpy = jest
        .spyOn(service, 'syncStudentCriterionScore')
        .mockResolvedValue(undefined as any);
      const lockSpy = jest.spyOn(service as any, 'checkSummaryLocked');

      await expect(
        service.forceRemove('507f1f77bcf86cd799439011', { roleCode: 'ADMIN', roleName: 'Admin' } as any),
      ).resolves.toBe(existingRecord);
      expect(mockAcademicRecordModel.findByIdAndDelete).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
      );
      expect(lockSpy).not.toHaveBeenCalled();
      expect(syncSpy).toHaveBeenCalledWith(studentId, semesterId, criterionId);
    });

    it('should block handleScoreIntent when summary is locked', async () => {
      const intentDto = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'increase',
      };
      await expect(service.handleScoreIntent(intentDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject public permanent deletion of an active record', async () => {
      const existingRecord = {
        _id: new Types.ObjectId(),
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        status: 'active',
        is_deleted: false,
      };
      mockAcademicRecordModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingRecord),
      });

      await expect(
        service.forceRemove(existingRecord._id.toString(), { roleCode: 'ADMIN', roleName: 'Admin' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ reasonCode: 'ACADEMIC_RECORD_NOT_TRASHED' }),
      });
      expect(mockAcademicRecordModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('should reject public permanent deletion of a report-owned record', async () => {
      const existingRecord = {
        _id: new Types.ObjectId(),
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        daily_report_id: new Types.ObjectId(),
        status: 'inactive',
        is_deleted: true,
      };
      mockAcademicRecordModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingRecord),
      });

      await expect(
        service.forceRemove(existingRecord._id.toString(), { roleCode: 'ADMIN', roleName: 'Admin' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ reasonCode: 'ACADEMIC_RECORD_DAILY_REPORT_OWNED' }),
      });
      expect(mockAcademicRecordModel.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });

  describe('Realtime Count Sync And Decrement Score Safety', () => {
    let studentId: string;
    let semesterId: string;
    let criterionId: string;
    let mockSummary: any;

    beforeEach(() => {
      studentId = new Types.ObjectId().toString();
      semesterId = new Types.ObjectId().toString();
      criterionId = new Types.ObjectId().toString();

      mockSummary = {
        _id: new Types.ObjectId(),
        student_id: studentId,
        semester_id: semesterId,
        details: [
          {
            criterion_id: criterionId,
            current_count: 2,
            system_score: 10,
            sv_score: 10,
            gv_score: 10,
            status: 'draft',
          },
        ],
        save: jest.fn().mockResolvedValue(true),
        markModified: jest.fn(),
        status: 'draft',
      };

      mockSummaryPointModel.find = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockSummary]),
      });
      mockSummaryPointModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSummary),
      });
      mockSummaryPointModel.db = {
        model: jest.fn().mockReturnValue({
          find: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnThis(),
            exec: jest
              .fn()
              .mockResolvedValue([
                { _id: new Types.ObjectId(), max_score: 100 },
              ]),
          }),
        }),
      };
      mockStudentModel.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue({
            _id: studentId,
            user_id: studentId,
            status: 'Studying',
          }),
      });
      mockCriterionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          scoring_mode: 'count',
          score_per_unit: 5,
          max_score: 10,
          criterion_type: 'reward',
        }),
      });
      mockCriterionModel.find = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: criterionId,
            scoring_mode: 'count',
            score_per_unit: 5,
            max_score: 10,
            criterion_type: 'reward',
          },
        ]),
      });
      mockAcademicRecordModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      });
      mockSummariesPointService.recomputeTotalScore = jest
        .fn()
        .mockResolvedValue(mockSummary);
    });

    it('Deleting the last active reward record sets editable draft current_count = 0, system_score = 0, sv_score = 0, and gv_score = 0', async () => {
      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]), // No active records
      });

      await service.syncStudentCriterionScore(
        studentId,
        semesterId,
        criterionId,
      );

      expect(mockSummary.details[0].current_count).toBe(0);
      expect(mockSummary.details[0].system_score).toBe(0);
      expect(mockSummary.details[0].sv_score).toBe(0);
      expect(mockSummary.details[0].gv_score).toBe(0);
      expect(mockSummary.details[0].final_score).toBeNull();
    });

    it('Reducing active reward records from 2 to 1 lowers current_count and system_score', async () => {
      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{}]), // 1 active record
      });

      await service.syncStudentCriterionScore(
        studentId,
        semesterId,
        criterionId,
      );

      expect(mockSummary.details[0].current_count).toBe(1);
      expect(mockSummary.details[0].system_score).toBe(5);
      expect(mockSummary.details[0].sv_score).toBe(5);
      expect(mockSummary.details[0].gv_score).toBe(5);
    });

    it('Clearing the last active option record clears selected option fields for editable draft details', async () => {
      mockCriterionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          scoring_mode: 'single_option',
          options: [{ id: 'opt-1', label: 'Option 1', score: 10 }],
        }),
      });

      mockSummary.details[0] = {
        criterion_id: criterionId,
        current_count: 1,
        selected_option_id: 'opt-1',
        selected_option_label: 'Option 1',
        selected_option_score: 10,
        status: 'draft',
      };

      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]), // No active records
      });

      await service.syncStudentCriterionScore(
        studentId,
        semesterId,
        criterionId,
      );

      expect(mockSummary.details[0].current_count).toBe(0);
      expect(mockSummary.details[0].selected_option_id).toBeNull();
      expect(mockSummary.details[0].selected_option_label).toBeNull();
      expect(mockSummary.details[0].selected_option_score).toBeNull();
    });

    it('syncMultipleStudentCriterionScores() matches syncStudentCriterionScore() for no-record draft repair', async () => {
      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]), // No active records
      });

      await service.syncMultipleStudentCriterionScores([
        {
          student_id: studentId,
          semester_id: semesterId,
          criterion_id: criterionId,
        },
      ]);

      expect(mockSummary.details[0].current_count).toBe(0);
      expect(mockSummary.details[0].system_score).toBe(0);
      expect(mockSummary.details[0].sv_score).toBe(0);
      expect(mockSummary.details[0].gv_score).toBe(0);
    });

    it('Reviewed, locked, approved, and finalized details are not auto-cleared and are reported as skipped mismatches', async () => {
      mockSummary.details[0] = {
        criterion_id: criterionId,
        current_count: 1,
        system_score: 5,
        sv_score: 5,
        gv_score: 5,
        status: 'gv_reviewed',
        gv_reviewed_at: new Date(),
        gv_reviewed_by: 'teacher-1',
      };

      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]), // No active records
      });

      const res = await service.syncMultipleStudentCriterionScores([
        {
          student_id: studentId,
          semester_id: semesterId,
          criterion_id: criterionId,
        },
      ]);

      // Count changes but score lanes must be kept
      expect(mockSummary.details[0].current_count).toBe(0);
      expect(mockSummary.details[0].system_score).toBe(0);
      expect(mockSummary.details[0].sv_score).toBe(5); // Preserved
      expect(mockSummary.details[0].gv_score).toBe(5); // Preserved

      expect(res.mismatches.length).toBe(1);
      expect(res.mismatches[0].status).toBe('skipped');
      expect(res.mismatches[0].skip_reason).toBe('reviewed');
    });

    it('Decrease/clear operations return the synchronized actual count and detail', async () => {
      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([
            { _id: new Types.ObjectId(), recorded_by: studentId },
          ]), // 1 record
      });

      mockAcademicRecordModel.deleteOne = jest
        .fn()
        .mockResolvedValue({ deletedCount: 1 });

      const intentDto = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'decrease' as const,
        baseline_count: 1,
      };

      const requester = { userId: studentId, roleName: 'Student' };
      const result = await service.handleScoreIntent(intentDto, requester);

      expect(result.success).toBe(true);
      expect(result.actual_count).toBeDefined();
      expect(result.evaluation_detail).toBeDefined();
    });

    it('Incomplete deletion due to permissions reports actual remaining count', async () => {
      // 2 records, one by Admin, one by Student
      const adminRecord = {
        _id: new Types.ObjectId(),
        recorded_by: {
          _id: new Types.ObjectId(),
          role: { role_name: 'Admin' },
        },
      };
      const studentRecord = {
        _id: new Types.ObjectId(),
        recorded_by: { _id: studentId, role: { role_name: 'Student' } },
      };

      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([adminRecord, studentRecord]),
      });

      mockAcademicRecordModel.deleteOne = jest
        .fn()
        .mockResolvedValue({ deletedCount: 1 });

      const intentDto = {
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        intent_type: 'decrease' as const,
        baseline_count: 2,
      };

      const requester = { userId: studentId, roleName: 'Student' };
      let findCallCount = 0;
      mockAcademicRecordModel.find = jest.fn().mockImplementation(() => {
        findCallCount++;
        const chain: any = {
          sort: jest.fn().mockImplementation(() => chain),
          populate: jest.fn().mockImplementation(() => chain),
          exec: jest.fn().mockImplementation(() => {
            if (findCallCount === 1) {
              return Promise.resolve([adminRecord, studentRecord]);
            } else {
              return Promise.resolve([adminRecord]);
            }
          }),
        };
        return chain;
      });

      const result = await service.handleScoreIntent(intentDto, requester);
      expect(result.success).toBe(true);
      expect(result.actual_count).toBe(1);
    });
  });

  describe('findByStudentId', () => {
    const studentId = new Types.ObjectId().toString();
    const mockRecords = [
      { _id: new Types.ObjectId(), student_id: studentId, record_title: 'Record 1' },
      { _id: new Types.ObjectId(), student_id: studentId, record_title: 'Record 2' },
    ];

    it('returns an array for unpaginated calls (backward compatibility)', async () => {
      const queryChain: any = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockRecords),
      };
      mockAcademicRecordModel.find = jest.fn().mockReturnValue(queryChain);

      const result = await service.findByStudentId(studentId);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockRecords.map((record) => ({ ...record, effectivePoints: 0 })));
      expect(queryChain.sort).toHaveBeenCalledWith({ recorded_at: -1, createdAt: -1 });
    });

    it('serializes effectivePoints from canonical criterion inputs', async () => {
      const record = {
        _id: new Types.ObjectId(),
        student_id: studentId,
        criterion_id: {
          criterion_type: 'cong_diem',
          scoring_mode: 'count',
          score_per_unit: 1.5,
          min_score: 0,
          max_score: 10,
        },
        action_type: 'count',
        quantity: 2,
        points_effect: -99,
      };
      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([record]),
      });

      const result = await service.findByStudentId(studentId);

      expect(result).toEqual([{ ...record, effectivePoints: 3 }]);
    });

    it('serializes a non-counted discipline from its criterion-defined raw score', async () => {
      const record = {
        _id: new Types.ObjectId(),
        student_id: studentId,
        criterion_id: {
          criterion_type: 'ky_luat',
          scoring_mode: 'count',
          score_per_unit: 7.5,
          min_score: 0,
          max_score: 10,
          is_score_counted: false,
        },
        action_type: 'count',
        quantity: 1,
        points_effect: 7.5,
      };
      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([record]),
      });

      const result = await service.findByStudentId(studentId);

      expect(result).toEqual([{ ...record, effectivePoints: -2.5 }]);
    });

    it('serializes counted discipline actions as signed per-record impacts', async () => {
      const records = [1, 2, 0].map((quantity, index) => ({
        _id: new Types.ObjectId(),
        student_id: studentId,
        criterion_id: {
          criterion_type: 'ky_luat',
          scoring_mode: 'count',
          score_per_unit: -1,
          min_score: 0,
          max_score: 10,
        },
        action_type: 'count',
        quantity,
        record_title: `Discipline ${index}`,
      }));
      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(records),
      });

      const result = await service.findByStudentId(studentId);

      expect(result.map((record) => record.effectivePoints)).toEqual([-1, -2, 0]);
    });

    it('serializes selected-option and manual scores without using stored points', async () => {
      const optionRecord = {
        _id: new Types.ObjectId(),
        student_id: studentId,
        criterion_id: {
          criterion_type: 'khen_thuong',
          scoring_mode: 'single_option',
          score_per_unit: 1,
          min_score: 0,
          max_score: 10,
          options: [{ id: 'excellent', label: 'Xuất sắc', score: 8.5 }],
        },
        action_type: 'select_option',
        selected_option_id: 'excellent',
        selected_option_score: 8.5,
        quantity: 1,
        points_effect: -99,
      };
      const manualRecord = {
        _id: new Types.ObjectId(),
        student_id: studentId,
        criterion_id: {
          criterion_type: 'cong_diem',
          scoring_mode: 'count',
          score_per_unit: 2,
          min_score: 0,
          max_score: 10,
        },
        action_type: 'manual_score',
        payload: { manual_score: 4.25 },
        quantity: 1,
        points_effect: -99,
      };
      mockAcademicRecordModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([optionRecord, manualRecord]),
      });

      const result = await service.findByStudentId(studentId);

      expect(result).toEqual([
        { ...optionRecord, effectivePoints: 8.5 },
        { ...manualRecord, effectivePoints: 4.25 },
      ]);
    });

    it('returns paginated response with metadata when pagination is requested', async () => {
      const queryChain: any = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockRecords[0]]),
      };
      mockAcademicRecordModel.find = jest.fn().mockReturnValue(queryChain);
      mockAcademicRecordModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(15),
      });

      const result = await service.findByStudentId(studentId, null, { page: 1, limit: 10 });
      expect(result).toEqual({
        data: [{ ...mockRecords[0], effectivePoints: 0 }],
        total: 15,
        page: 1,
        limit: 10,
        totalPages: 2,
        has_more: true,
      });
      expect(queryChain.skip).toHaveBeenCalledWith(0);
      expect(queryChain.limit).toHaveBeenCalledWith(10);
    });

    it('sets has_more to false on the last page', async () => {
      const queryChain: any = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockRecords[1]]),
      };
      mockAcademicRecordModel.find = jest.fn().mockReturnValue(queryChain);
      mockAcademicRecordModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(15),
      });

      const result = await service.findByStudentId(studentId, null, { page: 2, limit: 10 });
      expect(result).toEqual({
        data: [{ ...mockRecords[1], effectivePoints: 0 }],
        total: 15,
        page: 2,
        limit: 10,
        totalPages: 2,
        has_more: false,
      });
    });

    it('returns empty array or empty paginated object for invalid student ID', async () => {
      const unpaginated = await service.findByStudentId('invalid-id');
      expect(unpaginated).toEqual([]);

      const paginated = await service.findByStudentId('invalid-id', null, { page: 1, limit: 10 });
      expect(paginated).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        has_more: false,
      });
    });

    it('throws ForbiddenException if student requester accesses another student', async () => {
      const otherStudentId = new Types.ObjectId().toString();
      const studentUser = { userId: new Types.ObjectId().toString(), roleName: 'Student' };
      mockStudentModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(otherStudentId) }),
      });

      await expect(service.findByStudentId(studentId, studentUser)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if teacher requester accesses student outside advised class', async () => {
      const teacherUser = { userId: new Types.ObjectId().toString(), roleName: 'Teacher' };
      const advisedClassId = new Types.ObjectId().toString();
      const otherClassId = new Types.ObjectId().toString();

      mockClassModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId(advisedClassId) }]),
      });

      mockStudentModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(studentId),
          class_id: new Types.ObjectId(otherClassId),
        }),
      });

      await expect(service.findByStudentId(studentId, teacherUser)).rejects.toThrow(ForbiddenException);
    });

    it('scopes daily-report reads to the requesting Student', async () => {
      const dailyReportId = new Types.ObjectId();
      const ownStudentId = new Types.ObjectId();
      mockStudentModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: ownStudentId }),
      });
      mockAcademicRecordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.findByDailyReportId(
        dailyReportId.toString(),
        false,
        { userId: new Types.ObjectId().toString(), roleName: 'Student' },
      );

      expect(mockAcademicRecordModel.find).toHaveBeenCalledWith({
        daily_report_id: dailyReportId,
        status: 'active',
        is_deleted: { $ne: true },
        student_id: ownStudentId,
      });
    });

    it('deduplicates bulk IDs and returns partial failures without touching snapshots', async () => {
      const removeSpy = jest.spyOn(service, 'remove')
        .mockResolvedValueOnce({ _id: 'ok' } as any)
        .mockRejectedValueOnce(new BadRequestException('locked'));

      const result = await service.bulkRemove(['ok', 'ok', 'blocked'], { roleCode: 'ADMIN', roleName: 'Admin' });

      expect(removeSpy).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        requested: 2,
        succeeded: ['ok'],
        failed: [{ id: 'blocked', message: 'locked' }],
        succeededCount: 1,
        failedCount: 1,
      });
      expect(mockStudentModel.updateOne).toBeUndefined();
    });
  });

  describe('findAll class search', () => {
    it('resolves partial class names into the existing student search filter', async () => {
      const classId = new Types.ObjectId();
      const studentId = new Types.ObjectId();
      const chain = (value: any[]) => ({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(value),
      });

      mockClassModel.find.mockReturnValueOnce(chain([{ _id: classId }]));
      mockCriterionModel.find.mockReturnValueOnce(chain([]));
      mockStudentModel.find.mockReturnValueOnce(chain([{ _id: studentId }]));
      mockAcademicRecordModel.find.mockReturnValueOnce(chain([]));

      await service.findAll({ search: 'k45' });

      expect(mockClassModel.find).toHaveBeenCalledWith({
        class_name: { $regex: 'k45', $options: 'i' },
      });
      expect(mockStudentModel.find).toHaveBeenCalledWith({
        $or: [
          { full_name: { $regex: 'k45', $options: 'i' } },
          { student_code: { $regex: 'k45', $options: 'i' } },
          { class_id: { $in: [classId] } },
        ],
      });
      expect(mockAcademicRecordModel.find).toHaveBeenCalledWith(expect.objectContaining({
        $and: [{ $or: expect.arrayContaining([{ student_id: { $in: [studentId] } }]) }],
      }));
    });
  });
});
