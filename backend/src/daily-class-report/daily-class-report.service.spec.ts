import { Test, TestingModule } from '@nestjs/testing';
import { DailyClassReportService } from './daily-class-report.service';
import { getModelToken } from '@nestjs/mongoose';
import { DailyClassReport } from './schemas/daily-class-report.schema';
import { AcademicRecordService } from '../academic-record/academic-record.service';

describe('DailyClassReportService', () => {
  let service: DailyClassReportService;

  const mockDailyClassReportModel = {
    db: { model: jest.fn() },
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  const mockAcademicRecordService = {
    classModel: { find: jest.fn() },
    studentModel: { findOne: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyClassReportService,
        {
          provide: getModelToken(DailyClassReport.name),
          useValue: mockDailyClassReportModel,
        },
        {
          provide: AcademicRecordService,
          useValue: mockAcademicRecordService,
        },
      ],
    }).compile();

    service = module.get<DailyClassReportService>(DailyClassReportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should apply startDate and endDate filters with correct time boundaries', async () => {
      const mockExec = jest.fn().mockResolvedValue([]);
      const mockQueryObj = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: mockExec,
      };
      mockDailyClassReportModel.find.mockReturnValue(mockQueryObj);
      mockDailyClassReportModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      const academicRecordModelMock = {
        aggregate: jest.fn().mockResolvedValue([]),
      };
      mockDailyClassReportModel.db.model.mockReturnValue(
        academicRecordModelMock,
      );

      await service.findAll({
        startDate: '2023-10-01',
        endDate: '2023-10-31',
      });

      expect(mockDailyClassReportModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          report_date: {
            $gte: new Date('2023-10-01T00:00:00.000Z'),
            $lte: new Date('2023-10-31T23:59:59.999Z'),
          },
        }),
      );
    });
  });
});
