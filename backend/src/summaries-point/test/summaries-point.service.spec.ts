import { Test, TestingModule } from '@nestjs/testing';
import {
  SummariesPointService,
  resolveRankTier,
} from '../summaries-point.service';
import { getModelToken } from '@nestjs/mongoose';
import { SummaryPoint } from '../schemas/summary-point.schema';
import { Student } from '../../students/schemas/student.schema';
import { Class } from '../../classes/schemas/class.schema';
import { Department } from '../../departments/schemas/department.schema';
import { Semester } from '../../semesters/schemas/semester.schema';
import { Types } from 'mongoose';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AcademicRecord } from '../../academic-record/schemas/academic-record.schema';
import { AcademicRecordService } from '../../academic-record/academic-record.service';

describe('resolveRankTier', () => {
  it('should return unranked if status is not locked', () => {
    expect(resolveRankTier(95, 'draft')).toEqual({
      rank_tier: 'unranked',
      rank_label: 'Chưa chốt',
    });
  });

  it('should return unranked if totalScore is null', () => {
    expect(resolveRankTier(null, 'locked')).toEqual({
      rank_tier: 'unranked',
      rank_label: 'Chưa chốt',
    });
  });

  it('should return diamond for score >= 90', () => {
    expect(resolveRankTier(90, 'locked')).toEqual({
      rank_tier: 'diamond',
      rank_label: 'Xuất sắc',
    });
    expect(resolveRankTier(95, 'locked')).toEqual({
      rank_tier: 'diamond',
      rank_label: 'Xuất sắc',
    });
  });

  it('should return gold for score >= 80 and < 90', () => {
    expect(resolveRankTier(80, 'locked')).toEqual({
      rank_tier: 'gold',
      rank_label: 'Tốt',
    });
    expect(resolveRankTier(89, 'locked')).toEqual({
      rank_tier: 'gold',
      rank_label: 'Tốt',
    });
  });

  it('should return silver for score >= 70 and < 80', () => {
    expect(resolveRankTier(70, 'locked')).toEqual({
      rank_tier: 'silver',
      rank_label: 'Khá',
    });
    expect(resolveRankTier(79, 'locked')).toEqual({
      rank_tier: 'silver',
      rank_label: 'Khá',
    });
  });

  it('should return bronze for score >= 50 and < 70', () => {
    expect(resolveRankTier(50, 'locked')).toEqual({
      rank_tier: 'bronze',
      rank_label: 'Trung Bình',
    });
    expect(resolveRankTier(69, 'locked')).toEqual({
      rank_tier: 'bronze',
      rank_label: 'Trung Bình',
    });
  });

  it('should return unranked (Yếu) for score < 50', () => {
    expect(resolveRankTier(49, 'locked')).toEqual({
      rank_tier: 'unranked',
      rank_label: 'Yếu',
    });
    expect(resolveRankTier(0, 'locked')).toEqual({
      rank_tier: 'unranked',
      rank_label: 'Yếu',
    });
  });
});

describe('SummariesPointService', () => {
  let service: SummariesPointService;

  const mockSave = jest.fn();
  const mockSummaryPointModel = Object.assign(
    jest.fn().mockImplementation((dto) => ({
      ...dto,
      save: mockSave,
    })),
    {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      aggregate: jest.fn(),
      insertMany: jest.fn(),
    },
  );

  const mockStudentModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
  };

  const mockClassModel = {
    find: jest.fn(),
    findById: jest.fn(),
  };

  const mockCategoryModel = {
    find: jest.fn(),
  };

  const mockCriterionModel = {
    find: jest.fn(),
  };

  const mockDepartmentModel = {
    findById: jest.fn(),
  };

  const mockSemesterModel = {
    findById: jest.fn(),
  };

  const mockAcademicRecordModel = {
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  const mockAcademicRecordService = {
    syncMultipleStudentCriterionScores: jest
      .fn()
      .mockResolvedValue({ mismatches: [] }),
  };

  jest.mock('../export/pl03-summary-excel.service', () => ({
    generatePl03Excel: jest
      .fn()
      .mockResolvedValue(Buffer.from('mock excel data')),
  }));

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummariesPointService,
        {
          provide: getModelToken(SummaryPoint.name),
          useValue: mockSummaryPointModel,
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
          provide: getModelToken('Category'),
          useValue: mockCategoryModel,
        },
        {
          provide: getModelToken('Criterion'),
          useValue: mockCriterionModel,
        },
        {
          provide: getModelToken(Department.name),
          useValue: mockDepartmentModel,
        },
        {
          provide: getModelToken(Semester.name),
          useValue: mockSemesterModel,
        },
        {
          provide: getModelToken(AcademicRecord.name),
          useValue: mockAcademicRecordModel,
        },
        {
          provide: AcademicRecordService,
          useValue: mockAcademicRecordService,
        },
      ],
    }).compile();

    service = module.get<SummariesPointService>(SummariesPointService);
    mockStudentModel.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        class_id: 'class-1',
        status: 'Studying',
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      student_id: '507f1f77bcf86cd799439011',
      semester_id: '507f1f77bcf86cd799439012',
      period_id: '507f1f77bcf86cd799439013',
    };

    it('should return existing summary if it already exists', async () => {
      jest
        .spyOn(service as any, 'assertCanAccessStudent')
        .mockResolvedValue(undefined);
      const mockExisting = { _id: 'existing-id', ...createDto };
      mockSummaryPointModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      const result = await service.create(createDto);

      expect(mockSummaryPointModel.findOne).toHaveBeenCalled();
      expect(result).toEqual(mockExisting);
    });

    it('should create and return new summary if it does not exist', async () => {
      jest
        .spyOn(service as any, 'assertCanAccessStudent')
        .mockResolvedValue(undefined);
      mockSummaryPointModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const mockSaved = { _id: 'new-id', ...createDto };
      mockSave.mockResolvedValue(mockSaved);

      mockSummaryPointModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSaved),
      });

      const result = await service.create(createDto);

      expect(mockSummaryPointModel.findOne).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(mockSaved);
    });

    it('should handle race condition E11000 duplicate key error and return existing data', async () => {
      jest
        .spyOn(service as any, 'assertCanAccessStudent')
        .mockResolvedValue(undefined);
      mockSummaryPointModel.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const mongoError = new Error('Duplicate key');
      (mongoError as any).code = 11000;
      mockSave.mockRejectedValueOnce(mongoError);

      const mockExisting = { _id: 'race-existing-id', ...createDto };
      mockSummaryPointModel.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      const result = await service.create(createDto);

      expect(result).toEqual(mockExisting);
    });

    it('should normalize missing period_id to null and return existing data', async () => {
      jest
        .spyOn(service as any, 'assertCanAccessStudent')
        .mockResolvedValue(undefined);
      const dtoWithoutPeriod = {
        student_id: '507f1f77bcf86cd799439011',
        semester_id: '507f1f77bcf86cd799439012',
      };
      const mockExisting = {
        _id: 'existing-id',
        ...dtoWithoutPeriod,
        period_id: null,
      };
      mockSummaryPointModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      const result = await service.create(dtoWithoutPeriod as any);

      expect(mockSummaryPointModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          student_id: new Types.ObjectId(dtoWithoutPeriod.student_id),
          semester_id: new Types.ObjectId(dtoWithoutPeriod.semester_id),
          period_id: null,
        }),
      );
      expect(result).toEqual(mockExisting);
    });

    it('should throw BadRequestException if period_id is an empty string', async () => {
      jest
        .spyOn(service as any, 'assertCanAccessStudent')
        .mockResolvedValue(undefined);
      const dtoWithEmptyPeriod = {
        student_id: '507f1f77bcf86cd799439011',
        semester_id: '507f1f77bcf86cd799439012',
        period_id: '',
      };

      await expect(service.create(dtoWithEmptyPeriod as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle race condition with period_id: null and return existing null-period summary', async () => {
      jest
        .spyOn(service as any, 'assertCanAccessStudent')
        .mockResolvedValue(undefined);
      const dtoWithNullPeriod = {
        student_id: '507f1f77bcf86cd799439011',
        semester_id: '507f1f77bcf86cd799439012',
        period_id: null,
      };

      mockSummaryPointModel.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const mongoError = new Error('Duplicate key');
      (mongoError as any).code = 11000;
      mockSave.mockRejectedValueOnce(mongoError);

      const mockExisting = { _id: 'race-existing-id', ...dtoWithNullPeriod };
      mockSummaryPointModel.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      const result = await service.create(dtoWithNullPeriod as any);

      expect(mockSummaryPointModel.findOne).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          student_id: new Types.ObjectId(dtoWithNullPeriod.student_id),
          semester_id: new Types.ObjectId(dtoWithNullPeriod.semester_id),
          period_id: null,
        }),
      );
      expect(result).toEqual(mockExisting);
    });

    it('should throw BadRequestException if target student is not Studying', async () => {
      jest
        .spyOn(service as any, 'assertCanAccessStudent')
        .mockResolvedValue(undefined);

      mockStudentModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          status: 'Reserved',
        }),
      });

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('initializeClass', () => {
    it('should throw BadRequestException if classId is invalid', async () => {
      await expect(
        service.initializeClass('invalid', '507f1f77bcf86cd799439012'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if class does not exist', async () => {
      mockClassModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.initializeClass(
          '507f1f77bcf86cd799439011',
          '507f1f77bcf86cd799439012',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should initialize summaries for students with default values', async () => {
      mockClassModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'class-1', advisor_id: 'user1' }),
      });
      mockStudentModel.find.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([{ _id: 'student-1' }, { _id: 'student-2' }]),
      });
      mockSummaryPointModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ student_id: 'student-1' }]),
      });
      mockSummaryPointModel.insertMany.mockResolvedValue([
        { _id: 'new-summary' },
      ]);

      const result = await service.initializeClass(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
        { userId: 'user1', roleName: 'teacher' },
      );

      expect(mockSummaryPointModel.insertMany).toHaveBeenCalledWith([
        {
          student_id: 'student-2',
          semester_id: new Types.ObjectId('507f1f77bcf86cd799439012'),
          period_id: null,
          total_score: 0,
          grading: 'CHUA XEP LOAI',
          status: 'draft',
        },
      ]);
      expect(result).toEqual({ success: true, createdCount: 1 });
    });
  });

  describe('approveGrading', () => {
    const setupApproveGradingMock = (
      details: any[],
      activeRecords: any[] = [],
      criteria: any[] = [],
    ) => {
      jest
        .spyOn(service as any, 'assertCanAccessSummary')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'recomputeTotalScore')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service, 'syncSummaryWithAcademicRecords')
        .mockResolvedValue(null);

      mockAcademicRecordModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(activeRecords),
      });

      mockCriterionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(criteria),
      });

      const mockSummary = {
        _id: 'some-id',
        student_id: 'student-1',
        semester_id: 'semester-1',
        total_score: 85,
        status: 'draft',
        details,
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      const mockPopulatedResult = {
        ...mockSummary,
        status: 'locked',
        rank_tier: 'gold',
      };

      mockSummaryPointModel.findById.mockImplementation((id: string) => {
        const queryBuilder = {
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockPopulatedResult),
          then: (resolve: any) => resolve(mockSummary),
        };
        return queryBuilder;
      });

      return { mockSummary, mockPopulatedResult };
    };

    it('should throw ForbiddenException if requester is not admin or supervisor', async () => {
      await expect(
        service.approveGrading('some-id', {
          userId: '507f1f77bcf86cd799439011',
          roleName: 'student',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if summary not found after recompute', async () => {
      jest
        .spyOn(service as any, 'assertCanAccessSummary')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'recomputeTotalScore')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service, 'syncSummaryWithAcademicRecords')
        .mockResolvedValue(null);
      mockSummaryPointModel.findById.mockResolvedValueOnce(null);

      await expect(
        service.approveGrading('some-id', {
          userId: '507f1f77bcf86cd799439011',
          roleName: 'admin',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should calculate rank_tier, update status to locked and save', async () => {
      jest
        .spyOn(service as any, 'assertCanAccessSummary')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'recomputeTotalScore')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service, 'syncSummaryWithAcademicRecords')
        .mockResolvedValue(null);

      mockAcademicRecordModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      mockCriterionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const mockSummary = {
        _id: 'some-id',
        total_score: 85,
        status: 'draft',
        rank_tier: '',
        rank_label: '',
        rank_locked_at: null,
        rank_updated_by: null,
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);

      const mockPopulatedResult = {
        ...mockSummary,
        status: 'locked',
        rank_tier: 'gold',
      };
      mockSummaryPointModel.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockPopulatedResult),
      });

      const result = await service.approveGrading('some-id', {
        userId: '507f1f77bcf86cd799439011',
        roleName: 'admin',
      });

      expect(mockSummary.status).toBe('locked');
      expect(mockSummary.rank_tier).toBe('gold');
      expect(mockSummary.rank_label).toBe('Tốt');
      expect(mockSummary.rank_updated_by).toBe('507f1f77bcf86cd799439011');
      expect(mockSummary.save).toHaveBeenCalled();
      expect(result).toEqual(mockPopulatedResult);
    });

    it('should write detail.final_score from gv_score when gv_score is present', async () => {
      const details = [
        {
          criterion_id: 'crit-1',
          gv_score: 9,
          sv_score: 8,
          system_score: 7,
          status: 'draft',
          final_score: null,
          log: [],
        },
      ];
      const { mockSummary } = setupApproveGradingMock(details);

      await service.approveGrading('some-id', {
        userId: '507f1f77bcf86cd799439011',
        roleName: 'admin',
      });

      expect(mockSummary.details[0].final_score).toBe(9);
      expect(mockSummary.details[0].status).toBe('locked');
    });

    it('should fallback to sv_score when gv_score is null/undefined', async () => {
      const details = [
        {
          criterion_id: 'crit-1',
          gv_score: null,
          sv_score: 8,
          system_score: 7,
          status: 'draft',
          final_score: null,
          log: [],
        },
        {
          criterion_id: 'crit-2',
          gv_score: undefined,
          sv_score: 6,
          system_score: 5,
          status: 'draft',
          final_score: null,
          log: [],
        },
      ];
      const { mockSummary } = setupApproveGradingMock(details);

      await service.approveGrading('some-id', {
        userId: '507f1f77bcf86cd799439011',
        roleName: 'admin',
      });

      expect(mockSummary.details[0].final_score).toBe(8);
      expect(mockSummary.details[1].final_score).toBe(6);
    });

    it('should fallback to system_score when both gv_score and sv_score are null/undefined', async () => {
      const details = [
        {
          criterion_id: 'crit-1',
          gv_score: null,
          sv_score: null,
          system_score: 7,
          status: 'draft',
          final_score: null,
          log: [],
        },
        {
          criterion_id: 'crit-2',
          gv_score: undefined,
          sv_score: undefined,
          system_score: 5,
          status: 'draft',
          final_score: null,
          log: [],
        },
      ];
      const { mockSummary } = setupApproveGradingMock(details);

      await service.approveGrading('some-id', {
        userId: '507f1f77bcf86cd799439011',
        roleName: 'admin',
      });

      expect(mockSummary.details[0].final_score).toBe(7);
      expect(mockSummary.details[1].final_score).toBe(5);
    });

    it('should preserve 0 as a valid score', async () => {
      const details = [
        {
          criterion_id: 'crit-1',
          gv_score: 0,
          sv_score: 8,
          system_score: 7,
          status: 'draft',
          final_score: null,
          log: [],
        },
        {
          criterion_id: 'crit-2',
          gv_score: null,
          sv_score: 0,
          system_score: 6,
          status: 'draft',
          final_score: null,
          log: [],
        },
        {
          criterion_id: 'crit-3',
          gv_score: null,
          sv_score: null,
          system_score: 0,
          status: 'draft',
          final_score: null,
          log: [],
        },
      ];
      const { mockSummary } = setupApproveGradingMock(details);

      await service.approveGrading('some-id', {
        userId: '507f1f77bcf86cd799439011',
        roleName: 'admin',
      });

      expect(mockSummary.details[0].final_score).toBe(0);
      expect(mockSummary.details[1].final_score).toBe(0);
      expect(mockSummary.details[2].final_score).toBe(0);
    });

    it('should be idempotent and approve an already locked summary successfully', async () => {
      const details = [
        {
          criterion_id: 'crit-1',
          gv_score: 9,
          sv_score: 8,
          system_score: 7,
          status: 'locked',
          final_score: 9,
          log: [{ from_status: 'draft', to_status: 'locked', score_after: 9 }],
        },
      ];
      const { mockSummary } = setupApproveGradingMock(details);
      mockSummary.status = 'locked';

      const result = await service.approveGrading('some-id', {
        userId: '507f1f77bcf86cd799439011',
        roleName: 'admin',
      });

      expect(result.status).toBe('locked');
      expect(mockSummary.details[0].final_score).toBe(9);
      expect(mockSummary.details[0].log.length).toBe(1);
    });

    it('should perform pre-approval sync, reload summary, and throw BadRequestException if active records exist but final_score is 0 (and not reviewed)', async () => {
      const details = [
        {
          criterion_id: 'crit-1',
          gv_score: null,
          sv_score: null,
          system_score: null,
          status: 'draft',
          final_score: null,
          log: [],
        },
      ];
      const activeRecords = [
        {
          criterion_id: 'crit-1',
          student_id: 'student-1',
          semester_id: 'semester-1',
          status: 'active',
          createdAt: new Date(),
        },
      ];
      const criteria = [
        {
          _id: 'crit-1',
          criterion_name: 'Crit 1',
          score_per_unit: 5,
          max_score: 10,
          min_score: 0,
          scoring_mode: 'count',
        },
      ];

      const { mockSummary } = setupApproveGradingMock(
        details,
        activeRecords,
        criteria,
      );

      await expect(
        service.approveGrading('some-id', {
          userId: '507f1f77bcf86cd799439011',
          roleName: 'admin',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should preserve intentionally reviewed 0 score even when active records exist', async () => {
      const details = [
        {
          criterion_id: 'crit-1',
          gv_score: 0,
          sv_score: null,
          system_score: 5,
          status: 'gv_reviewed',
          gv_reviewed_by: '507f1f77bcf86cd799439011',
          final_score: null,
          log: [],
        },
      ];
      const activeRecords = [
        {
          criterion_id: 'crit-1',
          student_id: 'student-1',
          semester_id: 'semester-1',
          status: 'active',
          createdAt: new Date(),
        },
      ];
      const criteria = [
        {
          _id: 'crit-1',
          criterion_name: 'Crit 1',
          score_per_unit: 5,
          max_score: 10,
          min_score: 0,
          scoring_mode: 'count',
        },
      ];

      const { mockSummary } = setupApproveGradingMock(
        details,
        activeRecords,
        criteria,
      );

      await service.approveGrading('some-id', {
        userId: '507f1f77bcf86cd799439011',
        roleName: 'admin',
      });

      expect(mockSummary.details[0].final_score).toBe(0);
      expect(mockSummary.details[0].status).toBe('locked');
    });

    it('should approve discipline criterion with activeCount = 8 (max_score = 8, score_per_unit = -1), setting final_score to 0', async () => {
      const details = [
        {
          criterion_id: 'crit-discipline',
          gv_score: null,
          sv_score: null,
          system_score: null,
          status: 'draft',
          final_score: null,
          log: [],
        },
      ];
      const activeRecords = Array.from({ length: 8 }).map(() => ({
        criterion_id: 'crit-discipline',
        student_id: 'student-1',
        semester_id: 'semester-1',
        status: 'active',
        createdAt: new Date(),
      }));
      const criteria = [
        {
          _id: 'crit-discipline',
          criterion_name: 'Ky luat di muon',
          score_per_unit: -1,
          max_score: 8,
          min_score: 0,
          scoring_mode: 'count',
        },
      ];

      const { mockSummary } = setupApproveGradingMock(
        details,
        activeRecords,
        criteria,
      );

      await service.approveGrading('some-id', {
        userId: '507f1f77bcf86cd799439011',
        roleName: 'admin',
      });

      expect(mockSummary.details[0].final_score).toBe(0);
      expect(mockSummary.details[0].status).toBe('locked');
    });

    it('should approve discipline criterion with activeCount = 9 (fully deducted past min_score), setting final_score to 0', async () => {
      const details = [
        {
          criterion_id: 'crit-discipline',
          gv_score: null,
          sv_score: null,
          system_score: null,
          status: 'draft',
          final_score: null,
          log: [],
        },
      ];
      const activeRecords = Array.from({ length: 9 }).map(() => ({
        criterion_id: 'crit-discipline',
        student_id: 'student-1',
        semester_id: 'semester-1',
        status: 'active',
        createdAt: new Date(),
      }));
      const criteria = [
        {
          _id: 'crit-discipline',
          criterion_name: 'Ky luat di muon',
          score_per_unit: -1,
          max_score: 8,
          min_score: 0,
          scoring_mode: 'count',
        },
      ];

      const { mockSummary } = setupApproveGradingMock(
        details,
        activeRecords,
        criteria,
      );

      await service.approveGrading('some-id', {
        userId: '507f1f77bcf86cd799439011',
        roleName: 'admin',
      });

      expect(mockSummary.details[0].final_score).toBe(0);
      expect(mockSummary.details[0].status).toBe('locked');
    });

    it('should throw BadRequestException for discipline criterion with activeCount = 1 (expected 7) and stale resolved score 0', async () => {
      const details = [
        {
          criterion_id: 'crit-discipline',
          gv_score: 0,
          sv_score: null,
          system_score: null,
          status: 'draft',
          final_score: null,
          log: [],
        },
      ];
      const activeRecords = [
        {
          criterion_id: 'crit-discipline',
          student_id: 'student-1',
          semester_id: 'semester-1',
          status: 'active',
          createdAt: new Date(),
        },
      ];
      const criteria = [
        {
          _id: 'crit-discipline',
          criterion_name: 'Ky luat di muon',
          score_per_unit: -1,
          max_score: 8,
          min_score: 0,
          scoring_mode: 'count',
        },
      ];

      const { mockSummary } = setupApproveGradingMock(
        details,
        activeRecords,
        criteria,
      );

      await expect(
        service.approveGrading('some-id', {
          userId: '507f1f77bcf86cd799439011',
          roleName: 'admin',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for reward criterion with active records and stale zero score', async () => {
      const details = [
        {
          criterion_id: 'crit-reward',
          gv_score: 0,
          sv_score: null,
          system_score: null,
          status: 'draft',
          final_score: null,
          log: [],
        },
      ];
      const activeRecords = [
        {
          criterion_id: 'crit-reward',
          student_id: 'student-1',
          semester_id: 'semester-1',
          status: 'active',
          createdAt: new Date(),
        },
      ];
      const criteria = [
        {
          _id: 'crit-reward',
          criterion_name: 'Crit Reward',
          score_per_unit: 5,
          max_score: 10,
          min_score: 0,
          scoring_mode: 'count',
        },
      ];

      const { mockSummary } = setupApproveGradingMock(
        details,
        activeRecords,
        criteria,
      );

      await expect(
        service.approveGrading('some-id', {
          userId: '507f1f77bcf86cd799439011',
          roleName: 'admin',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should preserve intentionally reviewed zero score for discipline criterion', async () => {
      const details = [
        {
          criterion_id: 'crit-discipline',
          gv_score: 0,
          sv_score: null,
          system_score: 7,
          status: 'gv_reviewed',
          gv_reviewed_by: '507f1f77bcf86cd799439011',
          final_score: null,
          log: [],
        },
      ];
      const activeRecords = [
        {
          criterion_id: 'crit-discipline',
          student_id: 'student-1',
          semester_id: 'semester-1',
          status: 'active',
          createdAt: new Date(),
        },
      ];
      const criteria = [
        {
          _id: 'crit-discipline',
          criterion_name: 'Ky luat di muon',
          score_per_unit: -1,
          max_score: 8,
          min_score: 0,
          scoring_mode: 'count',
        },
      ];

      const { mockSummary } = setupApproveGradingMock(
        details,
        activeRecords,
        criteria,
      );

      await service.approveGrading('some-id', {
        userId: '507f1f77bcf86cd799439011',
        roleName: 'admin',
      });

      expect(mockSummary.details[0].final_score).toBe(0);
      expect(mockSummary.details[0].status).toBe('locked');
    });
  });

  describe('cancelApproval', () => {
    it('should throw ForbiddenException if requester is not admin or supervisor', async () => {
      await expect(
        service.cancelApproval('some-id', {
          userId: '507f1f77bcf86cd799439011',
          roleName: 'student',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if summary not found', async () => {
      jest
        .spyOn(service as any, 'assertCanAccessSummary')
        .mockResolvedValue(undefined);
      mockSummaryPointModel.findById.mockResolvedValueOnce(null);

      await expect(
        service.cancelApproval('some-id', {
          userId: '507f1f77bcf86cd799439011',
          roleName: 'admin',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if status is not locked', async () => {
      jest
        .spyOn(service as any, 'assertCanAccessSummary')
        .mockResolvedValue(undefined);
      mockSummaryPointModel.findById.mockResolvedValueOnce({
        _id: 'some-id',
        status: 'draft',
      });

      await expect(
        service.cancelApproval('some-id', {
          userId: '507f1f77bcf86cd799439011',
          roleName: 'admin',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should clear detail.final_score, reset statuses to draft, reset rank fields to null, and log old final_score', async () => {
      jest
        .spyOn(service as any, 'assertCanAccessSummary')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'recomputeTotalScore')
        .mockResolvedValue(undefined);

      const mockSummary = {
        _id: 'some-id',
        status: 'locked',
        rank_tier: 'gold',
        rank_label: 'Tốt',
        rank_locked_at: new Date(),
        rank_updated_by: '507f1f77bcf86cd799439011',
        details: [
          {
            status: 'locked',
            final_score: 85,
            current_count: 1,
            log: [],
          },
        ],
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);

      const mockPopulatedResult = {
        ...mockSummary,
        status: 'draft',
        rank_tier: null,
        rank_label: null,
        grading: 'Chưa xếp loại',
      };
      mockSummaryPointModel.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockPopulatedResult),
      });

      const requester = {
        userId: '507f1f77bcf86cd799439011',
        roleName: 'admin',
      };
      const result = await service.cancelApproval('some-id', requester);

      expect(mockSummary.status).toBe('draft');
      expect(mockSummary.rank_tier).toBeNull();
      expect(mockSummary.rank_label).toBeNull();
      expect(mockSummary.rank_locked_at).toBeNull();
      expect(mockSummary.rank_updated_by).toBeNull();

      expect(mockSummary.details[0].status).toBe('draft');
      expect(mockSummary.details[0].final_score).toBeNull();
      expect(mockSummary.details[0].locked_at).toBeNull();
      expect(mockSummary.details[0].locked_by).toBeNull();

      expect(mockSummary.details[0].log).toHaveLength(1);
      expect(mockSummary.details[0].log[0]).toEqual(
        expect.objectContaining({
          from_status: 'locked',
          to_status: 'draft',
          score_before: 85,
          score_after: null,
          count: 1,
          reason: 'Hủy duyệt rèn luyện về Bản nháp',
        }),
      );

      expect(mockSummary.save).toHaveBeenCalled();
      expect(result.grading).toBe('Chưa xếp loại');
      expect(result).toEqual(mockPopulatedResult);
    });
  });

  describe('cancelApprovalBulk', () => {
    it('should throw BadRequestException if summaryIds is empty', async () => {
      await expect(
        service.cancelApprovalBulk([], { userId: 'admin1', roleName: 'admin' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return results with success and error details', async () => {
      const mockResult = { _id: 'id1', status: 'draft' };
      const cancelApprovalSpy = jest
        .spyOn(service, 'cancelApproval')
        .mockResolvedValueOnce(mockResult as any)
        .mockRejectedValueOnce(new Error('Some error'));

      const requester = { userId: 'admin1', roleName: 'admin' };
      const results = await service.cancelApprovalBulk(
        ['id1', 'id2'],
        requester,
      );

      expect(cancelApprovalSpy).toHaveBeenCalledTimes(2);
      expect(cancelApprovalSpy).toHaveBeenNthCalledWith(1, 'id1', requester);
      expect(cancelApprovalSpy).toHaveBeenNthCalledWith(2, 'id2', requester);

      expect(results).toEqual([
        { summaryId: 'id1', success: true, data: mockResult },
        { summaryId: 'id2', success: false, error: 'Some error' },
      ]);
    });
  });

  describe('findLatestForStudent', () => {
    it('should return null if student not found', async () => {
      mockStudentModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      const result = await service.findLatestForStudent('user123');
      expect(result).toBeNull();
      expect(mockStudentModel.findOne).toHaveBeenCalledWith({
        user_id: 'user123',
      });
    });

    it('should return null if no locked summary found', async () => {
      mockStudentModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: 'student123' }),
      });
      mockSummaryPointModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.findLatestForStudent('user123');
      expect(result).toBeNull();
    });

    it('should return formatted summary for student with raw class name', async () => {
      const mockStudent = {
        _id: 'student123',
        full_name: 'Nguyễn Văn A',
        student_code: 'SV001',
        class_id: {
          _id: 'class123',
          class_name: 'CNTT1',
        },
      };
      mockStudentModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockStudent),
      });

      const mockSummary = {
        _id: 'summary1',
        status: 'locked',
        total_score: 92,
        grading: 'Xuất sắc',
        rank_tier: 'diamond',
        rank_label: 'Xuất sắc',
        semester_id: { name: 'Học kỳ 1' },
        period_id: 'period1',
        rank_locked_at: new Date('2023-01-01T00:00:00Z'),
      };

      mockSummaryPointModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSummary),
      });

      const result = await service.findLatestForStudent('user123');

      expect(result).toEqual({
        _id: 'summary1',
        status: 'locked',
        total_score: 92,
        grading: 'Xuất sắc',
        rank_tier: 'diamond',
        rank_label: 'Xuất sắc',
        semester: 'Học kỳ 1',
        period: 'period1',
        locked_at: mockSummary.rank_locked_at,
        studentName: 'Nguyễn Văn A',
        className: 'CNTT1',
        student: {
          full_name: 'Nguyễn Văn A',
          student_code: 'SV001',
          class_id: {
            _id: 'class123',
            class_name: 'CNTT1',
          },
        },
      });
      expect(mockStudentModel.findOne).toHaveBeenCalledWith({
        user_id: 'user123',
      });
      expect(mockSummaryPointModel.findOne).toHaveBeenCalledWith({
        student_id: 'student123',
        status: 'locked',
      });
    });

    it('should default class name to "Chưa cập nhật" if missing', async () => {
      const mockStudent = {
        _id: 'student123',
        full_name: 'Nguyễn Văn A',
        student_code: 'SV001',
        class_id: null,
      };
      mockStudentModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockStudent),
      });

      const mockSummary = {
        _id: 'summary1',
        status: 'locked',
        total_score: 92,
        grading: 'Xuất sắc',
        rank_tier: 'diamond',
        rank_label: 'Xuất sắc',
        semester_id: { name: 'Học kỳ 1' },
        period_id: 'period1',
        rank_locked_at: new Date('2023-01-01T00:00:00Z'),
      };

      mockSummaryPointModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSummary),
      });

      const result = await service.findLatestForStudent('user123');

      expect(result.className).toBe('Chưa cập nhật');
      expect(result.student.class_id).toBeNull();
    });
  });

  describe('generateSummaryExcel', () => {
    const validSemId = '507f1f77bcf86cd799439011';
    const validClassId = '507f1f77bcf86cd799439012';
    const validStu1 = '507f1f77bcf86cd799439013';
    const validStu2 = '507f1f77bcf86cd799439014';

    it('should throw NotFoundException if class does not exist', async () => {
      mockClassModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      const dto = {
        semesterId: validSemId,
        classId: validClassId,
        mode: 'all_filtered' as const,
      };

      await expect(
        service.generateSummaryExcel(dto, { userId: 'u1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if requester is not admin/supervisor and not advisor', async () => {
      mockClassModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: validClassId, advisor_id: 'u2' }),
      });
      const dto = {
        semesterId: validSemId,
        classId: validClassId,
        mode: 'all_filtered' as const,
      };

      await expect(
        service.generateSummaryExcel(dto, {
          userId: 'u1',
          roleName: 'Teacher',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow if requester is admin/supervisor', async () => {
      mockClassModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validClassId,
          advisor_id: 'u2',
          class_name: 'Lop 1',
        }),
      });
      mockSemesterModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: validSemId, semester_name: 'HK1' }),
      });
      mockStudentModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: validStu1 }]),
      });
      mockSummaryPointModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: 'sum1', total_score: 90 }]),
      });

      const dto = {
        semesterId: validSemId,
        classId: validClassId,
        mode: 'all_filtered' as const,
      };
      const result = await service.generateSummaryExcel(dto, {
        userId: 'u1',
        roleName: 'Admin',
      });

      expect(result.filename).toContain('PL03-TONGHOPRL-LOP-1.xlsx');
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should generate excel for selected students', async () => {
      mockClassModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validClassId,
          advisor_id: 'u1',
          class_name: 'Lop 1',
        }),
      });
      mockSemesterModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: validSemId, semester_name: 'HK1' }),
      });
      mockStudentModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([{ _id: validStu1 }, { _id: validStu2 }]),
      });
      mockSummaryPointModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { _id: 'sum1', total_score: 90 },
          { _id: 'sum2', total_score: 80 },
        ]),
      });

      const dto = {
        semesterId: validSemId,
        classId: validClassId,
        studentIds: [validStu1, validStu2],
        mode: 'selected' as const,
      };
      const result = await service.generateSummaryExcel(dto, {
        userId: 'u1',
        roleName: 'Teacher',
      });

      expect(result.filename).toContain('PL03-TONGHOPRL-LOP-1.xlsx');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(mockStudentModel.find).toHaveBeenCalledWith({
        class_id: expect.any(Types.ObjectId),
        $or: expect.any(Array),
      });
    });
  });

  describe('update', () => {
    it('should throw BadRequestException if update attempts to set status to locked', async () => {
      jest
        .spyOn(service as any, 'assertCanAccessSummary')
        .mockResolvedValue(undefined);
      mockSummaryPointModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce({
          _id: 'some-id',
          status: 'draft',
        }),
      });

      await expect(
        service.update('some-id', { status: 'locked' }, { userId: 'user1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if existing summary status is locked', async () => {
      jest
        .spyOn(service as any, 'assertCanAccessSummary')
        .mockResolvedValue(undefined);
      mockSummaryPointModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce({
          _id: 'some-id',
          status: 'locked',
        }),
      });

      await expect(
        service.update(
          'some-id',
          { status: 'draft' },
          { userId: 'user1', roleName: 'admin' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recomputeTotalScore', () => {
    it('should set total_score and set grading to "Chưa xếp loại" when status is draft', async () => {
      const mockSummary = {
        _id: 'some-id',
        status: 'draft',
        total_score: 0,
        grading: '',
        details: [{ criterion_id: 'cri-1', final_score: 85 }],
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockCategoryModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([{ _id: 'cat-1', max_score: 100 }]),
      });
      mockCriterionModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([
            { _id: 'cri-1', category_id: 'cat-1', score_per_unit: 1 },
          ]),
      });

      await service.recomputeTotalScore('some-id');

      expect(mockSummary.total_score).toBe(85);
      expect(mockSummary.grading).toBe('Chưa xếp loại');
      expect(mockSummary.save).toHaveBeenCalled();
    });

    it('should set total_score and set grading based on score when status is locked', async () => {
      const mockSummary = {
        _id: 'some-id',
        status: 'locked',
        total_score: 0,
        grading: '',
        details: [{ criterion_id: 'cri-1', final_score: 92 }],
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockCategoryModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([{ _id: 'cat-1', max_score: 100 }]),
      });
      mockCriterionModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([
            { _id: 'cri-1', category_id: 'cat-1', score_per_unit: 1 },
          ]),
      });

      await service.recomputeTotalScore('some-id');

      expect(mockSummary.total_score).toBe(92);
      expect(mockSummary.grading).toBe('Xuất sắc');
      expect(mockSummary.save).toHaveBeenCalled();
    });

    it('should handle zero and negative scores correctly', async () => {
      const mockSummary = {
        _id: 'some-id',
        status: 'locked',
        total_score: 50,
        grading: 'Trung bình',
        details: [{ criterion_id: 'cri-1', final_score: -5 }],
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockCategoryModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([{ _id: 'cat-1', max_score: 100 }]),
      });
      mockCriterionModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([
            { _id: 'cri-1', category_id: 'cat-1', score_per_unit: 1 },
          ]),
      });

      await service.recomputeTotalScore('some-id');

      expect(mockSummary.total_score).toBe(0);
      expect(mockSummary.grading).toBe('Yếu');
      expect(mockSummary.save).toHaveBeenCalled();
    });

    it('should normalize old final_score=-3 to raw score=7 without double deducting', async () => {
      const mockSummary = {
        _id: 'some-id',
        status: 'locked',
        total_score: 50,
        grading: 'Trung bình',
        details: [{ criterion_id: 'cri-vio', final_score: -3 }],
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockCategoryModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([{ _id: 'cat-1', max_score: 100 }]),
      });
      mockCriterionModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([
          {
            _id: 'cri-vio',
            category_id: 'cat-1',
            criterion_type: 'ky_luat',
            score_per_unit: -1,
            max_score: 10,
            is_score_counted: true,
          },
        ]),
      });

      await service.recomputeTotalScore('some-id');

      // final_score=-3 -> rawScore = max_score(10) - |-3| = 7.
      // Since is_score_counted is true, catInfo.currentScore adds 7. Total=7.
      expect(mockSummary.total_score).toBe(7);
      expect(mockSummary.save).toHaveBeenCalled();
    });

    it('should handle scores above 100 correctly', async () => {
      const mockSummary = {
        _id: 'some-id',
        status: 'locked',
        total_score: 50,
        grading: 'Trung bình',
        details: [{ criterion_id: 'cri-1', final_score: 120 }],
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockCategoryModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([{ _id: 'cat-1', max_score: 100 }]),
      });
      mockCriterionModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([
            { _id: 'cri-1', category_id: 'cat-1', score_per_unit: 1 },
          ]),
      });

      await service.recomputeTotalScore('some-id');

      expect(mockSummary.total_score).toBe(100);
      expect(mockSummary.grading).toBe('Xuất sắc');
      expect(mockSummary.save).toHaveBeenCalled();
    });

    it('should set discipline score to max_score or 10 if no detail exists (ky_luat)', async () => {
      const mockSummary = {
        _id: 'some-id',
        status: 'draft',
        total_score: 0,
        grading: '',
        details: [{ criterion_id: 'some-other-cri' }], // Has some detail so it doesn't return early
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);

      mockCategoryModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([{ _id: 'cat-1', max_score: 100 }]),
      });

      mockCriterionModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([
          {
            _id: 'cri-1',
            category_id: 'cat-1',
            criterion_type: 'ky_luat',
            max_score: 10,
            score_per_unit: -2,
            is_score_counted: true,
          },
          {
            _id: 'cri-2',
            category_id: 'cat-1',
            criterion_type: 'ky_luat',
            max_score: 10,
            score_per_unit: -2,
            is_score_counted: false,
          },
        ]),
      });

      await service.recomputeTotalScore('some-id');

      // cri-1 (counted) -> raw 10, contribution 10
      // cri-2 (non-counted) -> raw 10, contribution 0 (10 - 10)
      // total = 10 + 0 = 10
      expect(mockSummary.total_score).toBe(10);
      expect(mockSummary.save).toHaveBeenCalled();
    });

    it('should deduct correct contribution for is_score_counted === false without adding full max_score', async () => {
      const mockSummary = {
        _id: 'some-id',
        status: 'draft',
        total_score: 0,
        grading: '',
        details: [
          { criterion_id: 'cri-reward', final_score: 15 },
          { criterion_id: 'cri-violation-non-counted', final_score: 8 }, // deduct 2
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockCategoryModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([{ _id: 'cat-1', max_score: 100 }]),
      });

      mockCriterionModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([
          {
            _id: 'cri-reward',
            category_id: 'cat-1',
            criterion_type: 'thuong',
            score_per_unit: 5,
          },
          {
            _id: 'cri-violation-non-counted',
            category_id: 'cat-1',
            criterion_type: 'ky_luat',
            max_score: 10,
            score_per_unit: -2,
            is_score_counted: false,
          },
        ]),
      });

      await service.recomputeTotalScore('some-id');

      // final score for reward = 15
      // final score for violation = 8
      // countedScore for violation = 8 - 10 = -2
      // catScore = 15 - 2 = 13
      expect(mockSummary.total_score).toBe(13);
      expect(mockSummary.save).toHaveBeenCalled();
    });

    it('should clamp score per category before clamping total score', async () => {
      const mockSummary = {
        _id: 'some-id',
        status: 'draft',
        total_score: 0,
        grading: '',
        details: [
          { criterion_id: 'cri-cat1-1', final_score: 30 },
          { criterion_id: 'cri-cat2-1', final_score: 40 },
          { criterion_id: 'cri-cat3-1', final_score: 60 },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockCategoryModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([
          { _id: 'cat-1', max_score: 20 }, // 30 clamped to 20
          { _id: 'cat-2', max_score: 50 }, // 40 clamped to 40
          { _id: 'cat-3', max_score: 50 }, // 60 clamped to 50
        ]),
      });

      mockCriterionModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([
          {
            _id: 'cri-cat1-1',
            category_id: 'cat-1',
            criterion_type: 'thuong',
            score_per_unit: 10,
          },
          {
            _id: 'cri-cat2-1',
            category_id: 'cat-2',
            criterion_type: 'thuong',
            score_per_unit: 10,
          },
          {
            _id: 'cri-cat3-1',
            category_id: 'cat-3',
            criterion_type: 'thuong',
            score_per_unit: 10,
          },
        ]),
      });

      await service.recomputeTotalScore('some-id');

      // sum of clamped categories = 20 + 40 + 50 = 110
      // total score clamped to 100
      expect(mockSummary.total_score).toBe(100);
      expect(mockSummary.save).toHaveBeenCalled();
    });

    it('should compute score for draft single_option detail by checking options and selected_option_score fallback', async () => {
      const mockSummary = {
        _id: 'some-id',
        status: 'draft',
        total_score: 0,
        grading: '',
        details: [
          {
            criterion_id: 'cri-opt-draft',
            selected_option_id: 'opt-found',
            selected_option_score: 99, // Should NOT be used since option is found
            status: 'draft',
            current_count: 1,
          },
          {
            criterion_id: 'cri-opt-fallback',
            selected_option_id: 'opt-not-found',
            selected_option_score: 15, // Should be used since option not found in options array
            status: 'draft',
            current_count: 1,
          },
          {
            criterion_id: 'cri-opt-zero',
            selected_option_id: 'opt-not-found-no-score',
            status: 'draft',
            current_count: 1,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockCategoryModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([{ _id: 'cat-1', max_score: 100 }]),
      });

      mockCriterionModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([
          {
            _id: 'cri-opt-draft',
            category_id: 'cat-1',
            scoring_mode: 'single_option',
            options: [{ id: 'opt-found', score: 25 }],
          },
          {
            _id: 'cri-opt-fallback',
            category_id: 'cat-1',
            scoring_mode: 'single_option',
            options: [{ id: 'other-opt', score: 30 }],
          },
          {
            _id: 'cri-opt-zero',
            category_id: 'cat-1',
            scoring_mode: 'single_option',
            options: [],
          },
        ]),
      });

      await service.recomputeTotalScore('some-id');

      // cri-opt-draft score should be 25
      // cri-opt-fallback score should be 15
      // cri-opt-zero score should be 0
      // total score: 25 + 15 + 0 = 40
      expect(mockSummary.total_score).toBe(40);
      expect(mockSummary.save).toHaveBeenCalled();
    });

    it('should calculate 0 score for editable draft reward criterion with count = 0 and no options, ignoring stale positive scores', async () => {
      const mockSummary = {
        _id: 'some-id',
        status: 'draft',
        total_score: 0,
        grading: '',
        details: [
          {
            criterion_id: 'cri-reward-stale',
            current_count: 0,
            system_score: 10,
            sv_score: 10,
            gv_score: 10,
            status: 'draft',
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockCategoryModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([{ _id: 'cat-1', max_score: 100 }]),
      });

      mockCriterionModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([
          {
            _id: 'cri-reward-stale',
            category_id: 'cat-1',
            scoring_mode: 'count',
            score_per_unit: 5,
            max_score: 10,
            criterion_type: 'reward',
          },
        ]),
      });

      await service.recomputeTotalScore('some-id');

      expect(mockSummary.total_score).toBe(0);
      expect(mockSummary.save).toHaveBeenCalled();
    });

    it('should calculate 0 score for draft single_option criterion with current_count = 0 and no option selected', async () => {
      const mockSummary = {
        _id: 'some-id',
        status: 'draft',
        total_score: 0,
        grading: '',
        details: [
          {
            criterion_id: 'cri-opt-cleared',
            current_count: 0,
            selected_option_id: null,
            selected_option_score: null,
            system_score: 0,
            sv_score: 0,
            gv_score: 0,
            status: 'draft',
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockCategoryModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([{ _id: 'cat-1', max_score: 100 }]),
      });

      mockCriterionModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([
          {
            _id: 'cri-opt-cleared',
            category_id: 'cat-1',
            scoring_mode: 'single_option',
            options: [{ id: 'opt-1', label: 'Option 1', score: 10 }],
          },
        ]),
      });

      await service.recomputeTotalScore('some-id');

      expect(mockSummary.total_score).toBe(0);
      expect(mockSummary.save).toHaveBeenCalled();
    });

    it('should calculate 0 score for draft single_option with current_count = 0 and stale selected option', async () => {
      const mockSummary = {
        _id: 'some-id',
        status: 'draft',
        total_score: 0,
        grading: '',
        details: [
          {
            criterion_id: 'cri-opt-stale',
            current_count: 0,
            selected_option_id: 'opt-1',
            selected_option_score: 10,
            system_score: 10,
            sv_score: 10,
            gv_score: 10,
            status: 'draft',
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockCategoryModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([{ _id: 'cat-1', max_score: 100 }]),
      });

      mockCriterionModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([
          {
            _id: 'cri-opt-stale',
            category_id: 'cat-1',
            scoring_mode: 'single_option',
            options: [{ id: 'opt-1', label: 'Option 1', score: 10 }],
          },
        ]),
      });

      await service.recomputeTotalScore('some-id');

      expect(mockSummary.total_score).toBe(0);
      expect(mockSummary.save).toHaveBeenCalled();
    });
  });
});
