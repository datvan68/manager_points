import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationDetailService } from '../evaluation-detail.service';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AcademicRecord } from '../../academic-record/schemas/academic-record.schema';
import { Criterion } from '../../criteria/schemas/criterion.schema';
import { SummaryPoint } from '../../summaries-point/schemas/summary-point.schema';
import { User } from '../../auth/schemas/user.schema';
import { Student } from '../../students/schemas/student.schema';
import { Class } from '../../classes/schemas/class.schema';

describe('EvaluationDetailService', () => {
  let service: EvaluationDetailService;

  const mockAcademicRecordModel = {
    find: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  };

  const mockCriterionModel = {
    findById: jest.fn(),
  };

  const mockSummaryPointModel = Object.assign(
    jest.fn(),
    {
      findById: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      updateOne: jest.fn(),
      aggregate: jest.fn(),
    }
  );

  const mockUserModel = {
    findById: jest.fn(),
  };

  const mockStudentModel = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockClassModel = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationDetailService,
        {
          provide: getModelToken(AcademicRecord.name),
          useValue: mockAcademicRecordModel,
        },
        {
          provide: getModelToken(Criterion.name),
          useValue: mockCriterionModel,
        },
        {
          provide: getModelToken(SummaryPoint.name),
          useValue: mockSummaryPointModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
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

    service = module.get<EvaluationDetailService>(EvaluationDetailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should initialize lock fields to null and change locked status to draft', async () => {
      const summaryId = new Types.ObjectId().toString();
      const criterionId = new Types.ObjectId().toString();

      mockSummaryPointModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: summaryId,
          student_id: new Types.ObjectId(),
          semester_id: new Types.ObjectId(),
          status: 'draft',
          details: [],
          save: jest.fn(),
        }),
      } as any);

      mockCriterionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          criterion_name: 'Test Criterion',
          score_per_unit: 5,
          min_score: 0,
          max_score: 10,
        }),
      } as any);

      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'syncAcademicRecords').mockResolvedValue(undefined);

      // Create a mocked model constructor behaviour
      const saveSpy = jest.fn();
      jest.spyOn(service as any, 'summaryPointModel').mockImplementation(() => ({
        save: saveSpy,
      }));

      // Mock findByIdAndUpdate to simulate DB push
      mockSummaryPointModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      } as any);

      const dto: any = {
        summary_id: summaryId,
        criterion_id: criterionId,
        current_count: 1,
        status: 'locked', // Client attempts to create as locked
        final_score: 10,  // Client attempts to write directly
        locked_at: new Date().toISOString(),
        locked_by: new Types.ObjectId().toString(),
      };

      const result = await service.create(dto, { userId: 'admin1', roleName: 'admin' });

      // Check normalization in create:
      expect(result.final_score).toBeNull();
      expect(result.locked_at).toBeNull();
      expect(result.locked_by).toBeNull();
      expect(result.status).toBe('draft');
      expect(result.system_score).toBe(5); // 1 * 5
    });

    it('should throw BadRequestException if summary is locked', async () => {
      const summaryId = new Types.ObjectId().toString();
      mockSummaryPointModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: summaryId,
          status: 'locked',
        }),
      } as any);
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);

      await expect(
        service.create({ summary_id: summaryId, criterion_id: 'c1' }, { userId: 'u1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should throw BadRequestException if update payload contains status: locked', async () => {
      await expect(
        service.update('some-id', { status: 'locked' } as any, { userId: 'u1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if update payload contains final_score, locked_at, or locked_by', async () => {
      await expect(
        service.update('some-id', { final_score: 10 } as any, { userId: 'u1' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.update('some-id', { locked_at: new Date().toISOString() } as any, { userId: 'u1' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.update('some-id', { locked_by: 'some-user' } as any, { userId: 'u1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully update and recalculate when valid fields are passed', async () => {
      const detailId = new Types.ObjectId();
      const criterionId = new Types.ObjectId();
      const summaryId = new Types.ObjectId();

      const mockSummary = {
        _id: summaryId,
        student_id: new Types.ObjectId(),
        semester_id: new Types.ObjectId(),
        status: 'draft',
        details: [
          {
            _id: detailId,
            criterion_id: criterionId,
            current_count: 1,
            system_score: 5,
            sv_score: null,
            gv_score: null,
            status: 'draft',
          },
        ],
      };

      mockSummaryPointModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSummary),
      } as any);
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'syncAcademicRecords').mockResolvedValue(undefined);
      mockAcademicRecordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      } as any);

      mockCriterionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          score_per_unit: 10,
          min_score: 0,
          max_score: 20,
        }),
      } as any);

      const updatedSummary = {
        ...mockSummary,
        details: Object.assign(
          [
            {
              ...mockSummary.details[0],
              current_count: 2,
              system_score: 20,
              gv_score: 20,
            },
          ],
          {
            id: jest.fn().mockReturnValue({
              ...mockSummary.details[0],
              current_count: 2,
              system_score: 20,
              gv_score: 20,
            }),
          }
        ),
      };

      mockSummaryPointModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedSummary),
      } as any);
      mockSummaryPointModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedSummary),
      } as any);

      // Mock aggregation for recomputeTotalScore
      mockSummaryPointModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ totalScore: 20 }]),
      } as any);
      mockSummaryPointModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      } as any);

      const result = await service.update(
        detailId.toString(),
        {
          current_count: 2,
          gv_score: 20,
          gv_reviewed_at: new Date().toISOString(),
          gv_reviewed_by: '507f1f77bcf86cd799439016',
        },
        { userId: '507f1f77bcf86cd799439016', roleName: 'admin' },
      );

      expect(result.current_count).toBe(2);
      expect(result.system_score).toBe(20);
      expect(result.gv_score).toBe(20);
    });
  });
});
