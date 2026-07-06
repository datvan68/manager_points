import { Test, TestingModule } from '@nestjs/testing';
import { CriteriaService } from '../criteria.service';
import { getModelToken } from '@nestjs/mongoose';
import { Criterion } from '../schemas/criterion.schema';
import { Types } from 'mongoose';
import { CategoriesService } from '../../categories/categories.service';

describe('CriteriaService', () => {
  let service: CriteriaService;

  const mockCategoriesService = {
    findOne: jest.fn(),
  };

  const mockCriterionModel = function (dto: any) {
    this.data = dto;
    this.save = jest.fn().mockResolvedValue(this.data);
  };
  mockCriterionModel.find = jest.fn();
  mockCriterionModel.findOne = jest.fn();
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
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
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
        options: [{ id: 'opt1', label: 'Lựa chọn 1 modified', score: 15 }],
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

  describe('criterion_code validation', () => {
    it('should throw BadRequestException if criterion_code already exists on create', async () => {
      mockCriterionModel.findOne.mockResolvedValueOnce({
        _id: 'some_id',
        criterion_code: 'I.A',
      });

      const dto: any = {
        criterion_code: 'I.A',
        criterion_name: 'Test Code',
      };

      await expect(service.create(dto)).rejects.toThrow(
        'Mã tiêu chí đã tồn tại',
      );
      expect(mockCriterionModel.findOne).toHaveBeenCalledWith({
        criterion_code: expect.objectContaining({ $regex: expect.any(RegExp) }),
      });
    });

    it('should throw BadRequestException if criterion_code already exists with different case on create', async () => {
      // simulate db has 'I.A'
      mockCriterionModel.findOne.mockResolvedValueOnce({
        _id: 'some_id',
        criterion_code: 'I.A',
      });

      const dto: any = {
        criterion_code: 'i.a', // user sends lowercase
        criterion_name: 'Test Code Case',
      };

      await expect(service.create(dto)).rejects.toThrow(
        'Mã tiêu chí đã tồn tại',
      );
      expect(mockCriterionModel.findOne).toHaveBeenCalledWith({
        criterion_code: expect.objectContaining({ $regex: expect.any(RegExp) }),
      });
    });

    it('should trim criterion_code before saving and looking up on create', async () => {
      mockCriterionModel.findOne.mockResolvedValueOnce(null);

      const dto: any = {
        criterion_code: '  I.B  ',
        criterion_name: 'Test Trim',
      };

      const result = await service.create(dto);
      expect(mockCriterionModel.findOne).toHaveBeenCalledWith({
        criterion_code: expect.objectContaining({ $regex: expect.any(RegExp) }),
      });
      expect(result.criterion_code).toBe('I.B');
    });

    it('should throw BadRequestException if criterion_code already exists on update', async () => {
      const criterionId = new Types.ObjectId().toString();
      mockCriterionModel.findOne.mockResolvedValueOnce({
        _id: new Types.ObjectId().toString(),
        criterion_code: 'I.C',
      });

      const updateDto: any = {
        criterion_code: 'I.C',
      };

      await expect(service.update(criterionId, updateDto)).rejects.toThrow(
        'Mã tiêu chí đã tồn tại',
      );
    });

    it('should throw BadRequestException if criterion_code already exists with different case on update', async () => {
      const criterionId = new Types.ObjectId().toString();
      // simulating db has 'I.C'
      mockCriterionModel.findOne.mockResolvedValueOnce({
        _id: new Types.ObjectId().toString(),
        criterion_code: 'I.C',
      });

      const updateDto: any = {
        criterion_code: 'i.c', // user sends lowercase
      };

      await expect(service.update(criterionId, updateDto)).rejects.toThrow(
        'Mã tiêu chí đã tồn tại',
      );
    });

    it('should trim criterion_code before looking up on update', async () => {
      const criterionId = new Types.ObjectId().toString();
      mockCriterionModel.findOne.mockResolvedValueOnce(null);
      mockCriterionModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: criterionId,
          criterion_code: 'I.D',
        }),
      } as any);

      const updateDto: any = {
        criterion_code: '  I.D  ',
      };

      await service.update(criterionId, updateDto);
      expect(mockCriterionModel.findOne).toHaveBeenCalledWith({
        criterion_code: expect.objectContaining({ $regex: expect.any(RegExp) }),
        _id: { $ne: expect.any(Types.ObjectId) },
      });
    });
  });

  describe('suggestCode', () => {
    it('should return {category_code}.1 if parent category has no criteria', async () => {
      const categoryId = new Types.ObjectId().toString();
      mockCategoriesService.findOne.mockResolvedValueOnce({
        category_code: 'I',
      });
      mockCriterionModel.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      } as any);

      const result = await service.suggestCode(categoryId);
      expect(result).toEqual({ suggestedCode: 'I.1' });
    });

    it('should return {category_code}.3 if parent category has .1 and .2', async () => {
      const categoryId = new Types.ObjectId().toString();
      mockCategoriesService.findOne.mockResolvedValueOnce({
        category_code: 'II',
      });
      mockCriterionModel.find.mockReturnValueOnce({
        exec: jest
          .fn()
          .mockResolvedValue([
            { criterion_code: 'II.1' },
            { criterion_code: 'II.2' },
          ]),
      } as any);

      const result = await service.suggestCode(categoryId);
      expect(result).toEqual({ suggestedCode: 'II.3' });
    });

    it('should return max number + 1 even if codes are out of order or have gaps', async () => {
      const categoryId = new Types.ObjectId().toString();
      mockCategoriesService.findOne.mockResolvedValueOnce({
        category_code: 'III',
      });
      mockCriterionModel.find.mockReturnValueOnce({
        exec: jest
          .fn()
          .mockResolvedValue([
            { criterion_code: 'III.5' },
            { criterion_code: 'III.1' },
            { criterion_code: 'III.10' },
          ]),
      } as any);

      const result = await service.suggestCode(categoryId);
      expect(result).toEqual({ suggestedCode: 'III.11' });
    });

    it('should ignore criteria that do not match the expected prefix pattern', async () => {
      const categoryId = new Types.ObjectId().toString();
      mockCategoriesService.findOne.mockResolvedValueOnce({
        category_code: 'IV',
      });
      mockCriterionModel.find.mockReturnValueOnce({
        exec: jest
          .fn()
          .mockResolvedValue([
            { criterion_code: 'IV.1' },
            { criterion_code: 'IV.2' },
            { criterion_code: 'INVALID.99' },
            { criterion_code: 'IV_OTHER' },
          ]),
      } as any);

      const result = await service.suggestCode(categoryId);
      expect(result).toEqual({ suggestedCode: 'IV.3' });
    });

    it('should not crash and ignore criteria missing criterion_code', async () => {
      const categoryId = new Types.ObjectId().toString();
      mockCategoriesService.findOne.mockResolvedValueOnce({
        category_code: 'V',
      });
      mockCriterionModel.find.mockReturnValueOnce({
        exec: jest
          .fn()
          .mockResolvedValue([
            { criterion_name: 'Missing code' },
            { criterion_code: 'V.1' },
            { criterion_code: undefined },
          ]),
      } as any);

      const result = await service.suggestCode(categoryId);
      expect(result).toEqual({ suggestedCode: 'V.2' });
    });

    it('should throw BadRequestException if categoryId is invalid', async () => {
      await expect(service.suggestCode('invalid-id')).rejects.toThrow(
        'ID danh mục không hợp lệ',
      );
    });
  });
});
