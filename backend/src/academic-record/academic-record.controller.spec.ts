import { Test, TestingModule } from '@nestjs/testing';
import { AcademicRecordController } from './academic-record.controller';
import { AcademicRecordService } from './academic-record.service';
import { ImportAcademicRecordRequestDto, ImportAcademicRecordCommitDto } from './dto/import-academic-record.dto';
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
});
