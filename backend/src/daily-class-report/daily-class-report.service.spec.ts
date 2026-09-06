import { Test, TestingModule } from '@nestjs/testing';
import { DailyClassReportService } from './daily-class-report.service';
import { getModelToken } from '@nestjs/mongoose';
import { DailyClassReport } from './schemas/daily-class-report.schema';
import { AcademicRecordService } from '../academic-record/academic-record.service';
import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';

describe('DailyClassReportService', () => {
  let service: DailyClassReportService;

  const mockDailyClassReportModel: any = Object.assign(jest.fn(), {
    db: { model: jest.fn(), startSession: jest.fn() },
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments: jest.fn(),
  });

  const mockAcademicRecordService = {
    classModel: { find: jest.fn() },
    studentModel: { findOne: jest.fn() },
    findByDailyReportId: jest.fn(),
    remove: jest.fn(),
    restore: jest.fn(),
    forceRemove: jest.fn(),
    syncMultipleStudentCriterionScores: jest.fn(),
  };

  const makeSession = () => {
    const session = {
      withTransaction: jest.fn(async (work: () => Promise<void>) => work()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    mockDailyClassReportModel.db.startSession.mockResolvedValue(session);
    return session;
  };

  const makeQuery = (value: any) => ({
    session: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  });

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
        {
          userId: new Types.ObjectId().toString(),
          roleName,
          roleCode: roleName === 'Admin' ? 'ADMIN' : undefined,
          permissions,
        },
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

  it('aborts the report soft-delete transaction when a child mutation fails', async () => {
    const session = makeSession();
    const reportId = new Types.ObjectId().toString();
    const childId = new Types.ObjectId().toString();
    const report = { _id: reportId, reported_by: 'owner-1' };
    const child = {
      _id: childId,
      student_id: new Types.ObjectId(),
      semester_id: new Types.ObjectId(),
      criterion_id: new Types.ObjectId(),
    };
    mockDailyClassReportModel.findOne.mockReturnValue(makeQuery(report));
    mockAcademicRecordService.findByDailyReportId.mockResolvedValue([child]);
    mockAcademicRecordService.remove.mockRejectedValue(
      new BadRequestException({ reasonCode: 'CHILD_FAILURE', message: 'child failed' }),
    );

    const error = await service
      .remove(reportId, { userId: 'owner-1', roleName: 'Teacher' })
      .catch((value) => value);

    expect(error.getResponse()).toEqual(expect.objectContaining({
      reasonCode: 'CHILD_FAILURE',
      operationPhase: 'child_remove',
      failedObjectId: childId,
    }));
    expect(mockDailyClassReportModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('restores only deleted children and reconciles once after commit', async () => {
    const session = makeSession();
    const reportId = new Types.ObjectId().toString();
    const activeChild = {
      _id: new Types.ObjectId(),
      status: 'active',
      is_deleted: false,
    };
    const deletedChild = {
      _id: new Types.ObjectId(),
      status: 'inactive',
      is_deleted: true,
      student_id: new Types.ObjectId(),
      semester_id: new Types.ObjectId(),
      criterion_id: new Types.ObjectId(),
    };
    const report = {
      _id: reportId,
      is_delete: true,
      reported_by: 'owner-1',
      save: jest.fn().mockResolvedValue({
        populate: jest.fn().mockResolvedValue({ _id: reportId, is_delete: false }),
      }),
    };
    mockDailyClassReportModel.findOne.mockReturnValue(makeQuery(report));
    mockAcademicRecordService.findByDailyReportId.mockResolvedValue([
      activeChild,
      deletedChild,
    ]);
    mockAcademicRecordService.restore.mockResolvedValue(deletedChild);

    await service.restore(reportId, { userId: 'owner-1', roleName: 'Teacher' });

    expect(mockAcademicRecordService.restore).toHaveBeenCalledTimes(1);
    expect(mockAcademicRecordService.restore).toHaveBeenCalledWith(
      deletedChild._id.toString(),
      { userId: 'owner-1', roleName: 'Teacher' },
      { session, deferSync: true },
    );
    expect(mockAcademicRecordService.syncMultipleStudentCriterionScores)
      .toHaveBeenCalledTimes(1);
    expect(report.save).toHaveBeenCalledWith({ session });
  });

  it('rejects permanent deletion of an active report before touching children', async () => {
    const session = makeSession();
    const reportId = new Types.ObjectId().toString();
    mockDailyClassReportModel.findById.mockReturnValue(
      makeQuery({ _id: reportId, is_delete: false, reported_by: 'owner-1' }),
    );

    await expect(
      service.forceRemove(reportId, { userId: 'owner-1', roleName: 'Teacher' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        reasonCode: 'DAILY_REPORT_NOT_TRASHED',
        operationPhase: 'precondition',
        failedObjectId: reportId,
      }),
    });
    expect(mockAcademicRecordService.findByDailyReportId).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
});
