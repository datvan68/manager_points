import { Test, TestingModule } from '@nestjs/testing';
import { CriteriaService } from '../criteria.service';
import { getModelToken } from '@nestjs/mongoose';
import { Criterion } from '../schemas/criterion.schema';
import { Types } from 'mongoose';

describe('CriteriaService', () => {
  let service: CriteriaService;

  const mockCriterionModel = function (dto: any) {
    this.data = dto;
    this.save = jest.fn().mockResolvedValue(this.data);
  };
  mockCriterionModel.find = jest.fn();
  mockCriterionModel.findById = jest.fn();
  mockCriterionModel.findByIdAndUpdate = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CriteriaService,
        {
          provide: getModelToken(Criterion.name),
          useValue: mockCriterionModel,
        },
      ],
    }).compile();

    service = module.get<CriteriaService>(CriteriaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create single_option criterion', () => {
    it('should successfully create a criterion with scoring_mode = single_option', async () => {
      const dto: any = {
        category_id: new Types.ObjectId().toString(),
        criterion_name: 'Test Single Option',
        criterion_type: 'cong_diem',
        scoring_mode: 'single_option',
        options: [
          { id: 'opt1', label: 'Lựa chọn 1', score: 10 },
          { id: 'opt2', label: 'Lựa chọn 2', score: 20 },
        ],
      };

      const result = await service.create(dto);
      expect(result.scoring_mode).toBe('single_option');
      expect(result.options).toBeDefined();
      expect(result.options?.length).toBe(2);
      expect(result.options?.[0].score).toBe(10);
    });
  });

  describe('update single_option criterion', () => {
    it('should successfully update a criterion with scoring_mode = single_option', async () => {
      const criterionId = new Types.ObjectId().toString();
      const updateDto: any = {
        scoring_mode: 'single_option',
        options: [
          { id: 'opt1', label: 'Lựa chọn 1 modified', score: 15 },
        ],
      };

      mockCriterionModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          ...updateDto,
        }),
      } as any);

      const result = await service.update(criterionId, updateDto);
      expect(result.scoring_mode).toBe('single_option');
      expect(result.options).toBeDefined();
      expect(result.options?.length).toBe(1);
      expect(result.options?.[0].score).toBe(15);
      expect(result.options?.[0].label).toBe('Lựa chọn 1 modified');
    });
  });
});
