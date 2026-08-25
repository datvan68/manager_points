import { Test, TestingModule } from '@nestjs/testing';
import { DailyClassReportService } from './daily-class-report.service';
import { getModelToken } from '@nestjs/mongoose';
import { DailyClassReport } from './schemas/daily-class-report.schema';
import { AcademicRecordService } from '../academic-record/academic-record.service';
import { Types } from 'mongoose';

describe('DailyClassReportService', () => {
  let service: DailyClassReportService;

  const mockDailyClassReportModel: any = Object.assign(jest.fn(), {
    db: { model: jest.fn() },
    find: jest.fn(),
    countDocuments: jest.fn(),
  });

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
    const setupPaginatedQueries = (reports: any[] = [], total = reports.length) => {
      const mockQueryObj = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(reports),
      };
      mockDailyClassReportModel.find.mockReturnValue(mockQueryObj);
      mockDailyClassReportModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(total),
      });
      mockDailyClassReportModel.db.model.mockReturnValue({
        aggregate: jest.fn().mockResolvedValue([]),
      });
      return mockQueryObj;
    };

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

    it('filters both data and meta.total to the requesting owner for non-admin users', async () => {
      setupPaginatedQueries([], 2);
      const ownerId = new Types.ObjectId().toString();

      const result = await service.findAll(
        { page: 1, limit: 10, classId: new Types.ObjectId().toString() },
        { userId: ownerId, roleName: 'Teacher', permissions: ['READ_CLASS_RECORD'] },
      );

      const filter = mockDailyClassReportModel.find.mock.calls[0][0];
      expect(filter.reported_by).toEqual(new Types.ObjectId(ownerId));
      expect(mockDailyClassReportModel.countDocuments).toHaveBeenCalledWith(filter);
      expect(result.meta.total).toBe(2);
    });

    it.each([
      ['Admin', []],
      ['Teacher', ['READ_ALL_CLASS_RECORD']],
    ])('does not add ownership filtering for %s/full-view users', async (roleName, permissions) => {
      setupPaginatedQueries([], 0);

      await service.findAll(
        { page: 1, limit: 10 },
        { userId: new Types.ObjectId().toString(), roleName, permissions },
      );

      expect(mockDailyClassReportModel.find.mock.calls[0][0]).not.toHaveProperty('reported_by');
    });
  });

  it('creates a report with a blank lecturer name', async () => {
    const saved = { populate: jest.fn().mockResolvedValue({ teacher_name: '' }) };
    mockDailyClassReportModel.mockImplementation(() => ({ save: jest.fn().mockResolvedValue(saved) }));

    await expect(service.create({
      class_id: '60c72b2f9b1d8b2bad123456',
      reported_by: '60c72b2f9b1d8b2bad654321',
      report_date: '2026-06-01T00:00:00.000Z',
      total_present: 1,
      total_absent: 0,
      teacher_name: '',
    })).resolves.toEqual({ teacher_name: '' });
  });
});
