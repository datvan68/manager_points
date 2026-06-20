import { Test, TestingModule } from '@nestjs/testing';
import { AcademicRecordService } from './academic-record.service';
import { getModelToken } from '@nestjs/mongoose';
import { AcademicRecord } from './schemas/academic-record.schema';
import { SummaryPoint } from '../summaries-point/schemas/summary-point.schema';
import { Criterion } from '../criteria/schemas/criterion.schema';
import { Student } from '../students/schemas/student.schema';
import { Class } from '../classes/schemas/class.schema';
import { SummariesPointService } from '../summaries-point/summaries-point.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('AcademicRecordService - Import Flow', () => {
  let service: AcademicRecordService;

  const mockAcademicRecordModel = {
    db: { model: jest.fn() },
    bulkWrite: jest.fn(),
  };

  const mockSummaryPointModel = {};
  const mockCriterionModel = {
    find: jest.fn(),
  };
  const mockStudentModel = {
    find: jest.fn(),
    findById: jest.fn(),
  };
  const mockClassModel = {
    find: jest.fn(),
  };
  const mockSummariesPointService = {};
  const mockSemesterModel = {
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
          provide: SummariesPointService,
          useValue: mockSummariesPointService,
        },
      ],
    }).compile();

    service = module.get<AcademicRecordService>(AcademicRecordService);
    mockAcademicRecordModel.db.model.mockReturnValue(mockSemesterModel);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('importPreview', () => {
    it('should filter rows and handle teacher permissions correctly', async () => {
      // Setup Teacher context
      const requester = { userId: new Types.ObjectId().toString(), roleName: 'Teacher' };
      const classId = new Types.ObjectId();
      mockClassModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: classId }]),
      });
      
      const studentInClass = { _id: new Types.ObjectId(), student_code: 'SV_IN', class_id: classId };
      const studentOutClass = { _id: new Types.ObjectId(), student_code: 'SV_OUT', class_id: new Types.ObjectId() };
      
      mockStudentModel.find.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: studentInClass._id }]) // only SV_IN is in teacher's class
      });
      mockStudentModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([studentInClass, studentOutClass])
      });

      mockCriterionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId(), criterion_name: 'Criteria 1', criterion_code: 'C1' }])
      });

      mockSemesterModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId(), semester_name: 'HK1', status: 'active' }])
      });

      const rows = [
        { 'Ma SV': 'SV_IN', 'Tieu chi': 'Criteria 1', 'Ngay ghi nhan': '2023-01-01' },
        { 'Ma SV': 'SV_OUT', 'Tieu chi': 'Criteria 1', 'Ngay ghi nhan': '2023-01-01' }, // Expected error: Không có quyền ghi nhận
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
            exec: jest.fn().mockResolvedValue([{ _id: studentId, student_code: 'SV1' }])
        });
        mockCriterionModel.find.mockReturnValue({
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId(), criterion_name: 'Criteria 1', criterion_code: 'C1' }])
        });
        mockSemesterModel.find.mockReturnValue({
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId(), semester_name: 'HK1', status: 'active' }])
        });

        const rows = [
            { 'Ma SV': 'SV1', 'Tieu chi': 'Criteria 1', 'Ngay ghi nhan': '2023-01-01' },
            { 'Ma SV': 'SV1', 'Tieu chi': 'Criteria 1', 'Ngay ghi nhan': '2023-01-01' }, // Duplicate
        ];

        const result = await service.importPreview(rows, null);

        expect(result.validCount).toBe(1);
        expect(result.errorCount).toBe(1);
        expect(result.errors[0].reason).toContain('Bản ghi trùng lặp trong file');
    });
  });

  describe('importCommit', () => {
    it('should throw BadRequestException if session is invalid', async () => {
      await expect(service.importCommit('invalid_session', null)).rejects.toThrow(BadRequestException);
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
        commitErrors: []
      });

      const processSpy = jest.spyOn(service as any, 'processImportBatch').mockResolvedValue(undefined);

      const result = await service.importCommit(sessionId, null);

      expect(result.success).toBe(true);
      expect((service as any).importSessions.get(sessionId).status).toBe('committing');
      expect(processSpy).toHaveBeenCalledWith(sessionId, null);
    });
  });

  describe('processImportBatch (batch execution)', () => {
      it('should handle duplicate key errors properly without failing the whole batch', async () => {
        const sessionId = 'test_session_batch';
        const validItems = [
            { student_id: new Types.ObjectId(), criterion_id: new Types.ObjectId() },
            { student_id: new Types.ObjectId(), criterion_id: new Types.ObjectId() }
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
            commitErrors: []
        });

        // Mock bulkWrite to simulate partial failure (duplicate)
        mockAcademicRecordModel.bulkWrite.mockRejectedValue({
            code: 11000,
            writeErrors: [{ index: 1 }],
            result: { nInserted: 1, insertedCount: 1 }
        });

        // Mock sync
        jest.spyOn(service, 'syncMultipleStudentCriterionScores').mockResolvedValue(undefined);

        await (service as any).processImportBatch(sessionId, null);

        const session = (service as any).importSessions.get(sessionId);
        expect(session.status).toBe('completed');
        expect(session.insertedCount).toBe(1);
        expect(session.duplicatedCount).toBe(1);
        expect(session.processedCount).toBe(2);
      });
  });

  describe('getImportProgress', () => {
      it('should return NotFoundException if session not found', () => {
          expect(() => service.getImportProgress('missing')).toThrow(NotFoundException);
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
              commitErrors: []
          });

          const result = service.getImportProgress(sessionId);
          expect(result).toMatchObject({
              status: 'completed',
              progress: 100,
              insertedCount: 9,
              duplicatedCount: 1
          });
      });
  });
});
