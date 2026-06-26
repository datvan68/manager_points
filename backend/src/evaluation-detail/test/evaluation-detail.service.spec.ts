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
import { SummariesPointService } from '../../summaries-point/summaries-point.service';

describe('EvaluationDetailService', () => {
  let service: EvaluationDetailService;

  const mockAcademicRecordModel = Object.assign(
    jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({}),
    })),
    {
      find: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
      findByIdAndDelete: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    }
  );

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

  const mockSummariesPointService = {
    recomputeTotalScore: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: SummariesPointService,
          useValue: mockSummariesPointService,
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
      jest.spyOn(service as any, 'syncAcademicRecords').mockImplementation(async (_, __, count) => ({ actualCount: count, originalCount: 0, dailyReportCount: 0, permissionLockedCount: 0 }));

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
    it('should successfully create a detail with scoring_mode single_option', async () => {
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
          criterion_name: 'Test Criterion Option',
          scoring_mode: 'single_option',
          options: [
            { id: 'opt1', label: 'Option 1', score: 8 },
          ],
        }),
      } as any);

      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'syncAcademicRecords').mockImplementation(async (_, __, count) => ({ actualCount: count, originalCount: 0, dailyReportCount: 0, permissionLockedCount: 0 }));

      mockSummaryPointModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      } as any);

      const dto: any = {
        summary_id: summaryId,
        criterion_id: criterionId,
        selected_option_id: 'opt1',
      };

      const result = await service.create(dto, { userId: 'admin1', roleName: 'admin' });

      expect(result.system_score).toBe(8);
      expect(result.current_count).toBe(1);
      expect(result.selected_option_id).toBe('opt1');
    });

    it('should throw BadRequestException if invalid option is provided for single_option', async () => {
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
          criterion_name: 'Test Criterion Option',
          scoring_mode: 'single_option',
          options: [
            { id: 'opt1', label: 'Option 1', score: 8 },
          ],
        }),
      } as any);

      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);

      const dto: any = {
        summary_id: summaryId,
        criterion_id: criterionId,
        selected_option_id: 'opt-invalid',
      };

      await expect(
        service.create(dto, { userId: 'admin1', roleName: 'admin' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should record system_score as 7 when violation max=10, count=3, score_per_unit=-1', async () => {
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
          criterion_name: 'Vi pham tru diem',
          score_per_unit: -1,
          min_score: 0,
          max_score: 10,
        }),
      } as any);

      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'syncAcademicRecords').mockImplementation(async (_, __, count) => ({ actualCount: count, originalCount: 0, dailyReportCount: 0, permissionLockedCount: 0 }));

      mockSummaryPointModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      } as any);

      const dto: any = {
        summary_id: summaryId,
        criterion_id: criterionId,
        current_count: 3,
      };

      const result = await service.create(dto, { userId: 'admin1', roleName: 'admin' });

      // systemScore should be max(0, min(10, 10 - 3 * |-1|)) = 7
      expect(result.system_score).toBe(7);
      expect(result.current_count).toBe(3);
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
      jest.spyOn(service as any, 'syncAcademicRecords').mockImplementation(async (_, __, count) => ({ actualCount: count, originalCount: 0, dailyReportCount: 0, permissionLockedCount: 0 }));
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

    it('should successfully update a detail with scoring_mode single_option', async () => {
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
            system_score: 8,
            selected_option_id: 'opt1',
            status: 'draft',
          },
        ],
      };

      mockSummaryPointModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSummary),
      } as any);
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'syncAcademicRecords').mockImplementation(async (_, __, count) => ({ actualCount: count, originalCount: 0, dailyReportCount: 0, permissionLockedCount: 0 }));

      mockCriterionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          scoring_mode: 'single_option',
          options: [
            { id: 'opt1', label: 'Option 1', score: 8 },
            { id: 'opt2', label: 'Option 2', score: 10 },
          ],
        }),
      } as any);

      const updatedSummary = {
        ...mockSummary,
        details: Object.assign(
          [
            {
              ...mockSummary.details[0],
              current_count: 1,
              system_score: 10,
              selected_option_id: 'opt2',
            },
          ],
          {
            id: jest.fn().mockReturnValue({
              ...mockSummary.details[0],
              current_count: 1,
              system_score: 10,
              selected_option_id: 'opt2',
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
        exec: jest.fn().mockResolvedValue([{ totalScore: 10 }]),
      } as any);
      mockSummaryPointModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      } as any);

      const result = await service.update(
        detailId.toString(),
        {
          selected_option_id: 'opt2',
        } as any,
        { userId: 'admin1', roleName: 'admin' },
      );

      expect(result.system_score).toBe(10);
      expect(result.selected_option_id).toBe('opt2');
    });

    it('should throw BadRequestException if update provides invalid option for single_option', async () => {
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
            system_score: 8,
            selected_option_id: 'opt1',
            status: 'draft',
          },
        ],
      };

      mockSummaryPointModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSummary),
      } as any);
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);

      mockCriterionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          scoring_mode: 'single_option',
          options: [
            { id: 'opt1', label: 'Option 1', score: 8 },
            { id: 'opt2', label: 'Option 2', score: 10 },
          ],
        }),
      } as any);

      await expect(
        service.update(
          detailId.toString(),
          { selected_option_id: 'opt-invalid' } as any,
          { userId: 'admin1', roleName: 'admin' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should update system_score to 7 when violation max=10, count changes to 3, score_per_unit=-1', async () => {
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
            system_score: 9,
            status: 'draft',
          },
        ],
      };

      mockSummaryPointModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSummary),
      } as any);
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'syncAcademicRecords').mockImplementation(async (_, __, count) => ({ actualCount: count, originalCount: 0, dailyReportCount: 0, permissionLockedCount: 0 }));
      mockAcademicRecordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      } as any);

      mockCriterionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          score_per_unit: -1,
          min_score: 0,
          max_score: 10,
        }),
      } as any);

      const updatedSummary = {
        ...mockSummary,
        details: Object.assign(
          [
            {
              ...mockSummary.details[0],
              current_count: 3,
              system_score: 7,
            },
          ],
          {
            id: jest.fn().mockReturnValue({
              ...mockSummary.details[0],
              current_count: 3,
              system_score: 7,
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

      mockSummaryPointModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ totalScore: 7 }]),
      } as any);
      mockSummaryPointModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      } as any);

      const result = await service.update(
        detailId.toString(),
        {
          current_count: 3,
        } as any,
        { userId: 'admin1', roleName: 'admin' },
      );

      // max=10, score=-1, count=3 => 7
      expect(result.system_score).toBe(7);
      expect(result.current_count).toBe(3);
    });
  });

  describe('bulkUpsert', () => {
    it('should process current_count: 0 and not clamp if records are deletable', async () => {
      const summaryId = new Types.ObjectId().toString();
      const criterionId = new Types.ObjectId().toString();
      
      const mockSummary = {
        _id: summaryId,
        student_id: new Types.ObjectId(),
        semester_id: new Types.ObjectId(),
        status: 'draft',
        details: [
          {
            _id: new Types.ObjectId(),
            criterion_id: criterionId,
            current_count: 1,
            system_score: 10,
            status: 'draft',
          },
        ],
      };

      mockSummaryPointModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSummary),
      } as any);
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);

      mockCriterionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          score_per_unit: 10,
          min_score: 0,
          max_score: 100,
        }),
      } as any);

      mockAcademicRecordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: 'rec1', recorded_by: 'admin1' }]),
      } as any);
      
      jest.spyOn(service as any, 'canRequesterDeleteRecord').mockReturnValue(true);

      mockSummaryPointModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSummary),
      } as any);

      const dto: any = {
        summary_id: summaryId,
        details: [
          {
            criterion_id: criterionId,
            current_count: 0,
          }
        ]
      };

      const result = await service.bulkUpsert(dto, { userId: 'admin1', roleName: 'admin' });

      expect(result.success).toBe(true);
      expect(result.clampResults.length).toBe(0);
      
      expect(mockSummaryPointModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            'details.$.current_count': 0,
            'details.$.system_score': 0,
          })
        })
      );
    });

    it('should NOT clamp and simply update current_count even if record has daily_report_id', async () => {
      const summaryId = new Types.ObjectId().toString();
      const criterionId = new Types.ObjectId().toString();
      
      const mockSummary = {
        _id: summaryId,
        student_id: new Types.ObjectId(),
        semester_id: new Types.ObjectId(),
        status: 'draft',
        details: [
          {
            _id: new Types.ObjectId(),
            criterion_id: criterionId,
            current_count: 1,
            system_score: 10,
            status: 'draft',
          },
        ],
      };

      mockSummaryPointModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSummary),
      } as any);
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);

      mockCriterionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          score_per_unit: 10,
          min_score: 0,
          max_score: 100,
        }),
      } as any);

      mockAcademicRecordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: 'rec1', daily_report_id: 'dr1', recorded_by: 'admin1' }]),
      } as any);
      
      jest.spyOn(service as any, 'canRequesterDeleteRecord').mockReturnValue(false);

      mockSummaryPointModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSummary),
      } as any);

      const dto: any = {
        summary_id: summaryId,
        details: [
          {
            criterion_id: criterionId,
            current_count: 0,
          }
        ]
      };

      const result = await service.bulkUpsert(dto, { userId: 'admin1', roleName: 'admin' });

      expect(result.success).toBe(true);
      expect(result.clampResults.length).toBe(0);
      
      expect(mockSummaryPointModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            'details.$.current_count': 0,
            'details.$.system_score': 0,
          })
        })
      );
    });

    it('should NOT clamp if record cannot be deleted due to permissions', async () => {
      const summaryId = new Types.ObjectId().toString();
      const criterionId = new Types.ObjectId().toString();
      
      const mockSummary = {
        _id: summaryId,
        student_id: new Types.ObjectId(),
        semester_id: new Types.ObjectId(),
        status: 'draft',
        details: [
          {
            _id: new Types.ObjectId(),
            criterion_id: criterionId,
            current_count: 1,
            system_score: 10,
            status: 'draft',
          },
        ],
      };

      mockSummaryPointModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSummary),
      } as any);
      jest.spyOn(service as any, 'assertCanAccessSummary').mockResolvedValue(undefined);

      mockCriterionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          score_per_unit: 10,
          min_score: 0,
          max_score: 100,
        }),
      } as any);

      mockAcademicRecordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: 'rec1', recorded_by: { _id: 'admin_id', role: { name: 'admin' } } }]),
      } as any);
      
      jest.spyOn(service as any, 'canRequesterDeleteRecord').mockReturnValue(false);

      mockSummaryPointModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSummary),
      } as any);

      const dto: any = {
        summary_id: summaryId,
        details: [
          {
            criterion_id: criterionId,
            current_count: 0,
          }
        ]
      };

      const result = await service.bulkUpsert(dto, { userId: 'teacher1', roleName: 'teacher' });

      expect(result.success).toBe(true);
      expect(result.clampResults.length).toBe(0);
      
      expect(mockSummaryPointModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            'details.$.current_count': 0,
            'details.$.system_score': 0,
          })
        })
      );
    });
  });

  describe('syncAcademicRecords', () => {
    it('should create new records when diff > 0', async () => {
      const summaryId = new Types.ObjectId().toString();
      const criterionId = new Types.ObjectId().toString();
      const summary = {
        _id: summaryId,
        student_id: new Types.ObjectId(),
        semester_id: new Types.ObjectId(),
      } as any;
      
      const criterion = {
        _id: criterionId,
        criterion_name: 'Test Criterion',
      } as any;
      
      // Setup mock to return 1 existing record
      mockAcademicRecordModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { _id: 'rec1', recorded_by: 'admin1', status: 'active' }
        ]),
      } as any);
      
      const requester = { userId: new Types.ObjectId().toString(), roleName: 'admin' };
      
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ user_name: 'Admin' }),
      } as any);
      
      // We want to sync to count 3, diff will be 3 - 1 = 2
      const result = await (service as any).syncAcademicRecords(summary, criterion, 3, requester);
      
      expect(result.actualCount).toBe(3);
      expect(mockAcademicRecordModel).toHaveBeenCalledTimes(2);
    });

    it('should delete records when diff < 0 using findByIdAndDelete', async () => {
      const summaryId = new Types.ObjectId().toString();
      const criterionId = new Types.ObjectId().toString();
      const summary = {
        _id: summaryId,
        student_id: new Types.ObjectId(),
        semester_id: new Types.ObjectId(),
      } as any;
      
      const criterion = {
        _id: criterionId,
        criterion_name: 'Test Criterion',
      } as any;
      
      // Setup mock to return 3 existing records
      mockAcademicRecordModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { _id: 'rec1', recorded_by: 'admin1', status: 'active', createdAt: new Date('2023-01-01') },
          { _id: 'rec2', recorded_by: 'admin1', status: 'active', createdAt: new Date('2023-01-02') },
          { _id: 'rec3', recorded_by: 'admin1', status: 'active', createdAt: new Date('2023-01-03') }
        ]),
      } as any);
      
      // Reset delete mock
      mockAcademicRecordModel.findByIdAndDelete.mockClear();
      
      // requester is admin, can delete all records
      const requester = { userId: 'admin1', roleName: 'admin' };
      
      jest.spyOn(service as any, 'canRequesterDeleteRecord').mockReturnValue(true);
      
      // We want to sync to count 1, diff will be 1 - 3 = -2. So 2 records should be deleted.
      const result = await (service as any).syncAcademicRecords(summary, criterion, 1, requester);
      
      expect(result.actualCount).toBe(1);
      expect(mockAcademicRecordModel.findByIdAndDelete).toHaveBeenCalledTimes(2);
      // It should delete the most recent records first (rec3, rec2)
      expect(mockAcademicRecordModel.findByIdAndDelete).toHaveBeenCalledWith('rec3');
      expect(mockAcademicRecordModel.findByIdAndDelete).toHaveBeenCalledWith('rec2');
    });
  });
});
