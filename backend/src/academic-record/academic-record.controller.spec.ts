import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AcademicRecordController } from './academic-record.controller';
import { AcademicRecordService } from './academic-record.service';
import { ImportAcademicRecordRequestDto, ImportAcademicRecordCommitDto } from './dto/import-academic-record.dto';
import { IntentScoreDto } from './dto/intent-score.dto';
import { Types } from 'mongoose';

describe('AcademicRecordController - Import Flow', () => {
  let controller: AcademicRecordController;
  let service: AcademicRecordService;

  const mockAcademicRecordService = {
    importPreview: jest.fn(),
    importCommit: jest.fn(),
    getImportProgress: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AcademicRecordController],
      providers: [
        {
          provide: AcademicRecordService,
          useValue: mockAcademicRecordService,
        },
      ],
    }).compile();

    controller = module.get<AcademicRecordController>(AcademicRecordController);
    service = module.get<AcademicRecordService>(AcademicRecordService);
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
        rows: [{ 'Ma SV': 'SV01', 'Tieu chi': 'TC1', 'Ngay ghi nhan': '2023-01-01' }],
      };
      const req = { user: { userId: 'teacher1', roleName: 'Teacher' } };
      
      const expectedResult = { sessionId: 'session_123', validCount: 1, errorCount: 0, errors: [], totalRows: 1 };
      mockAcademicRecordService.importPreview.mockResolvedValue(expectedResult);

      const result = await controller.importPreview(dto, req);

      expect(service.importPreview).toHaveBeenCalledWith(dto.rows, req.user);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('importCommit', () => {
    it('should call academicRecordService.importCommit with sessionId and requester', async () => {
      const dto: ImportAcademicRecordCommitDto = { sessionId: 'session_123' };
      const req = { user: { userId: 'teacher1', roleName: 'Teacher' } };

      const expectedResult = { success: true, message: 'Đã bắt đầu tiến trình import' };
      mockAcademicRecordService.importCommit.mockResolvedValue(expectedResult);

      const result = await controller.importCommit(dto, req);

      expect(service.importCommit).toHaveBeenCalledWith(dto.sessionId, req.user);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getImportProgress', () => {
    it('should call academicRecordService.getImportProgress with sessionId', () => {
      const sessionId = 'session_123';
      const expectedProgress = { status: 'completed', progress: 100, processedCount: 10, insertedCount: 10, duplicatedCount: 0, totalRows: 10, failedItems: [] };
      mockAcademicRecordService.getImportProgress.mockReturnValue(expectedProgress);

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
        expect(response.message).toContain('student_id phải là MongoDB ObjectId của sinh viên, không phải MSSV');
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
