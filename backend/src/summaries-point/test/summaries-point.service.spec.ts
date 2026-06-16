import { Test, TestingModule } from '@nestjs/testing';
import { SummariesPointService, resolveRankTier } from '../summaries-point.service';
import { getModelToken } from '@nestjs/mongoose';
import { SummaryPoint } from '../schemas/summary-point.schema';
import { Student } from '../../students/schemas/student.schema';
import { Class } from '../../classes/schemas/class.schema';
import { Types } from 'mongoose';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('resolveRankTier', () => {
  it('should return unranked if status is not locked', () => {
    expect(resolveRankTier(95, 'draft')).toEqual({ rank_tier: 'unranked', rank_label: 'Chưa chốt' });
  });

  it('should return unranked if totalScore is null', () => {
    expect(resolveRankTier(null, 'locked')).toEqual({ rank_tier: 'unranked', rank_label: 'Chưa chốt' });
  });

  it('should return diamond for score >= 90', () => {
    expect(resolveRankTier(90, 'locked')).toEqual({ rank_tier: 'diamond', rank_label: 'Xuất sắc' });
    expect(resolveRankTier(95, 'locked')).toEqual({ rank_tier: 'diamond', rank_label: 'Xuất sắc' });
  });

  it('should return gold for score >= 80 and < 90', () => {
    expect(resolveRankTier(80, 'locked')).toEqual({ rank_tier: 'gold', rank_label: 'Tốt' });
    expect(resolveRankTier(89, 'locked')).toEqual({ rank_tier: 'gold', rank_label: 'Tốt' });
  });

  it('should return silver for score >= 70 and < 80', () => {
    expect(resolveRankTier(70, 'locked')).toEqual({ rank_tier: 'silver', rank_label: 'Khá' });
    expect(resolveRankTier(79, 'locked')).toEqual({ rank_tier: 'silver', rank_label: 'Khá' });
  });

  it('should return bronze for score >= 50 and < 70', () => {
    expect(resolveRankTier(50, 'locked')).toEqual({ rank_tier: 'bronze', rank_label: 'Trung Bình' });
    expect(resolveRankTier(69, 'locked')).toEqual({ rank_tier: 'bronze', rank_label: 'Trung Bình' });
  });

  it('should return unranked (Yếu) for score < 50', () => {
    expect(resolveRankTier(49, 'locked')).toEqual({ rank_tier: 'unranked', rank_label: 'Yếu' });
    expect(resolveRankTier(0, 'locked')).toEqual({ rank_tier: 'unranked', rank_label: 'Yếu' });
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
    }
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
      ],
    }).compile();

    service = module.get<SummariesPointService>(SummariesPointService);
    mockStudentModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011', status: 'Studying' }),
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
      jest.spyOn(service as any, 'assertCanAccessStudent').mockResolvedValue(undefined);
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
      jest.spyOn(service as any, 'assertCanAccessStudent').mockResolvedValue(undefined);
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
      jest.spyOn(service as any, 'assertCanAccessStudent').mockResolvedValue(undefined);
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
      jest.spyOn(service as any, 'assertCanAccessStudent').mockResolvedValue(undefined);
      const dtoWithoutPeriod = {
        student_id: '507f1f77bcf86cd799439011',
        semester_id: '507f1f77bcf86cd799439012',
      };
      const mockExisting = { _id: 'existing-id', ...dtoWithoutPeriod, period_id: null };
      mockSummaryPointModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      const result = await service.create(dtoWithoutPeriod as any);

      expect(mockSummaryPointModel.findOne).toHaveBeenCalledWith(expect.objectContaining({
        student_id: new Types.ObjectId(dtoWithoutPeriod.student_id),
        semester_id: new Types.ObjectId(dtoWithoutPeriod.semester_id),
        period_id: null,
      }));
      expect(result).toEqual(mockExisting);
    });

    it('should throw BadRequestException if period_id is an empty string', async () => {
      jest.spyOn(service as any, 'assertCanAccessStudent').mockResolvedValue(undefined);
      const dtoWithEmptyPeriod = {
        student_id: '507f1f77bcf86cd799439011',
        semester_id: '507f1f77bcf86cd799439012',
        period_id: '',
      };

      await expect(service.create(dtoWithEmptyPeriod as any)).rejects.toThrow(BadRequestException);
    });

    it('should handle race condition with period_id: null and return existing null-period summary', async () => {
      jest.spyOn(service as any, 'assertCanAccessStudent').mockResolvedValue(undefined);
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

      expect(mockSummaryPointModel.findOne).toHaveBeenNthCalledWith(2, expect.objectContaining({
        student_id: new Types.ObjectId(dtoWithNullPeriod.student_id),
        semester_id: new Types.ObjectId(dtoWithNullPeriod.semester_id),
        period_id: null,
      }));
      expect(result).toEqual(mockExisting);
    });

    it('should throw BadRequestException if target student is not Studying', async () => {
      jest.spyOn(service as any, 'assertCanAccessStudent').mockResolvedValue(undefined);
      
      mockStudentModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011', status: 'Reserved' }),
      });

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveGrading', () => {
    const setupApproveGradingMock = (details: any[]) => {
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'recomputeTotalScore').mockResolvedValue(undefined);

      const mockSummary = {
        _id: 'some-id',
        total_score: 85,
        status: 'draft',
        details,
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary); // first findById
      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary); // second findById
      
      const mockPopulatedResult = { ...mockSummary, status: 'locked', rank_tier: 'gold' };
      mockSummaryPointModel.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockPopulatedResult),
      });

      return { mockSummary, mockPopulatedResult };
    };

    it('should throw ForbiddenException if requester is not admin or supervisor', async () => {
      await expect(
        service.approveGrading('some-id', { userId: '507f1f77bcf86cd799439011', roleName: 'student' })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if summary not found after recompute', async () => {
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'recomputeTotalScore').mockResolvedValue(undefined);
      mockSummaryPointModel.findById.mockResolvedValueOnce(null);

      await expect(service.approveGrading('some-id', { userId: '507f1f77bcf86cd799439011', roleName: 'admin' })).rejects.toThrow(NotFoundException);
    });

    it('should calculate rank_tier, update status to locked and save', async () => {
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'recomputeTotalScore').mockResolvedValue(undefined);

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
      
      const mockPopulatedResult = { ...mockSummary, status: 'locked', rank_tier: 'gold' };
      mockSummaryPointModel.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockPopulatedResult),
      });

      const result = await service.approveGrading('some-id', { userId: '507f1f77bcf86cd799439011', roleName: 'admin' });

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
          gv_score: 9,
          sv_score: 8,
          system_score: 7,
          status: 'draft',
          final_score: null,
          log: [],
        },
      ];
      const { mockSummary } = setupApproveGradingMock(details);

      await service.approveGrading('some-id', { userId: '507f1f77bcf86cd799439011', roleName: 'admin' });

      expect(mockSummary.details[0].final_score).toBe(9);
      expect(mockSummary.details[0].status).toBe('locked');
    });

    it('should fallback to sv_score when gv_score is null/undefined', async () => {
      const details = [
        {
          gv_score: null,
          sv_score: 8,
          system_score: 7,
          status: 'draft',
          final_score: null,
          log: [],
        },
        {
          gv_score: undefined,
          sv_score: 6,
          system_score: 5,
          status: 'draft',
          final_score: null,
          log: [],
        },
      ];
      const { mockSummary } = setupApproveGradingMock(details);

      await service.approveGrading('some-id', { userId: '507f1f77bcf86cd799439011', roleName: 'admin' });

      expect(mockSummary.details[0].final_score).toBe(8);
      expect(mockSummary.details[1].final_score).toBe(6);
    });

    it('should fallback to system_score when both gv_score and sv_score are null/undefined', async () => {
      const details = [
        {
          gv_score: null,
          sv_score: null,
          system_score: 7,
          status: 'draft',
          final_score: null,
          log: [],
        },
        {
          gv_score: undefined,
          sv_score: undefined,
          system_score: 5,
          status: 'draft',
          final_score: null,
          log: [],
        },
      ];
      const { mockSummary } = setupApproveGradingMock(details);

      await service.approveGrading('some-id', { userId: '507f1f77bcf86cd799439011', roleName: 'admin' });

      expect(mockSummary.details[0].final_score).toBe(7);
      expect(mockSummary.details[1].final_score).toBe(5);
    });

    it('should preserve 0 as a valid score', async () => {
      const details = [
        {
          gv_score: 0,
          sv_score: 8,
          system_score: 7,
          status: 'draft',
          final_score: null,
          log: [],
        },
        {
          gv_score: null,
          sv_score: 0,
          system_score: 6,
          status: 'draft',
          final_score: null,
          log: [],
        },
        {
          gv_score: null,
          sv_score: null,
          system_score: 0,
          status: 'draft',
          final_score: null,
          log: [],
        },
      ];
      const { mockSummary } = setupApproveGradingMock(details);

      await service.approveGrading('some-id', { userId: '507f1f77bcf86cd799439011', roleName: 'admin' });

      expect(mockSummary.details[0].final_score).toBe(0);
      expect(mockSummary.details[1].final_score).toBe(0);
      expect(mockSummary.details[2].final_score).toBe(0);
    });
  });

  describe('cancelApproval', () => {
    it('should throw ForbiddenException if requester is not admin or supervisor', async () => {
      await expect(
        service.cancelApproval('some-id', { userId: '507f1f77bcf86cd799439011', roleName: 'student' })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if summary not found', async () => {
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);
      mockSummaryPointModel.findById.mockResolvedValueOnce(null);

      await expect(
        service.cancelApproval('some-id', { userId: '507f1f77bcf86cd799439011', roleName: 'admin' })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if status is not locked', async () => {
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);
      mockSummaryPointModel.findById.mockResolvedValueOnce({
        _id: 'some-id',
        status: 'draft',
      });

      await expect(
        service.cancelApproval('some-id', { userId: '507f1f77bcf86cd799439011', roleName: 'admin' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should clear detail.final_score, reset statuses to draft, reset rank fields to null, and log old final_score', async () => {
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'recomputeTotalScore').mockResolvedValue(undefined);

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

      const mockPopulatedResult = { ...mockSummary, status: 'draft', rank_tier: null, rank_label: null, grading: 'Chưa xếp loại' };
      mockSummaryPointModel.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockPopulatedResult),
      });

      const requester = { userId: '507f1f77bcf86cd799439011', roleName: 'admin' };
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
      expect(mockSummary.details[0].log[0]).toEqual(expect.objectContaining({
        from_status: 'locked',
        to_status: 'draft',
        score_before: 85,
        score_after: null,
        count: 1,
        reason: 'Hủy duyệt rèn luyện về Bản nháp',
      }));

      expect(mockSummary.save).toHaveBeenCalled();
      expect(result.grading).toBe('Chưa xếp loại');
      expect(result).toEqual(mockPopulatedResult);
    });
  });

  describe('cancelApprovalBulk', () => {
    it('should throw BadRequestException if summaryIds is empty', async () => {
      await expect(
        service.cancelApprovalBulk([], { userId: 'admin1', roleName: 'admin' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should return results with success and error details', async () => {
      const mockResult = { _id: 'id1', status: 'draft' };
      const cancelApprovalSpy = jest.spyOn(service, 'cancelApproval')
        .mockResolvedValueOnce(mockResult as any)
        .mockRejectedValueOnce(new Error('Some error'));

      const requester = { userId: 'admin1', roleName: 'admin' };
      const results = await service.cancelApprovalBulk(['id1', 'id2'], requester);

      expect(cancelApprovalSpy).toHaveBeenCalledTimes(2);
      expect(cancelApprovalSpy).toHaveBeenNthCalledWith(1, 'id1', requester);
      expect(cancelApprovalSpy).toHaveBeenNthCalledWith(2, 'id2', requester);

      expect(results).toEqual([
        { summaryId: 'id1', success: true, data: mockResult },
        { summaryId: 'id2', success: false, error: 'Some error' }
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
      expect(mockStudentModel.findOne).toHaveBeenCalledWith({ user_id: 'user123' });
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
      expect(mockStudentModel.findOne).toHaveBeenCalledWith({ user_id: 'user123' });
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

  describe('update', () => {
    it('should throw BadRequestException if update attempts to set status to locked', async () => {
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);
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
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);
      mockSummaryPointModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce({
          _id: 'some-id',
          status: 'locked',
        }),
      });

      await expect(
        service.update('some-id', { status: 'draft' }, { userId: 'user1', roleName: 'admin' }),
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
        details: [{ _id: 'detail-1' }],
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockSummaryPointModel.aggregate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce([{ totalScore: 85 }]),
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
        details: [{ _id: 'detail-1' }],
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockSummaryPointModel.aggregate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce([{ totalScore: 92 }]),
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
        details: [{ _id: 'detail-1' }],
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockSummaryPointModel.aggregate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce([{ totalScore: -5 }]),
      });

      await service.recomputeTotalScore('some-id');

      expect(mockSummary.total_score).toBe(0);
      expect(mockSummary.grading).toBe('Yếu');
      expect(mockSummary.save).toHaveBeenCalled();
    });

    it('should handle scores above 100 correctly', async () => {
      const mockSummary = {
        _id: 'some-id',
        status: 'locked',
        total_score: 50,
        grading: 'Trung bình',
        details: [{ _id: 'detail-1' }],
        save: jest.fn().mockResolvedValue(true),
      };

      mockSummaryPointModel.findById.mockResolvedValueOnce(mockSummary);
      mockSummaryPointModel.aggregate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce([{ totalScore: 120 }]),
      });

      await service.recomputeTotalScore('some-id');

      expect(mockSummary.total_score).toBe(100);
      expect(mockSummary.grading).toBe('Xuất sắc');
      expect(mockSummary.save).toHaveBeenCalled();
    });
  });
});
