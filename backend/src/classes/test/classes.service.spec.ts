import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ClassesService } from '../classes.service';
import { Class } from '../schemas/class.schema';

const mockClass = {
  _id: 'mock-class-id',
  class_name: 'Class A',
  class_year: '2023-2027',
  dept_id: 'mock-dept-id',
  advisor_id: 'mock-user-id',
  class_course: 'Cao đẳng',
};

describe('ClassesService', () => {
  let service: ClassesService;
  let model: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        {
          provide: getModelToken(Class.name),
          useValue: Object.assign(
            jest.fn().mockImplementation((dto) => ({
              ...dto,
              save: jest
                .fn()
                .mockResolvedValue({ _id: 'mock-class-id', ...dto }),
            })),
            {
              find: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([mockClass]),
              }),
              findById: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockClass),
              }),
              findByIdAndUpdate: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockClass),
              }),
              findByIdAndDelete: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockClass),
              }),
            },
          ),
        },
      ],
    }).compile();

    service = module.get<ClassesService>(ClassesService);
    model = module.get(getModelToken(Class.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a class', async () => {
      const dto = {
        class_name: 'Class A',
        class_year: '2023-2027',
        dept_id: 'mock-dept-id',
        class_course: 'Cao đẳng',
      };
      const result = await service.create(dto);
      expect(result).toBeDefined();
      expect(result.class_name).toEqual(dto.class_name);
    });

    it('should throw ConflictException if duplicate key error', async () => {
      model.mockImplementationOnce((dto: any) => ({
        ...dto,
        save: jest.fn().mockRejectedValue({
          code: 11000,
          keyPattern: { class_name: 1 },
          keyValue: { class_name: 'Class A' },
        }),
      }));
      
      const dto = {
        class_name: 'Class A',
        class_year: '2023-2027',
        dept_id: 'mock-dept-id',
        class_course: 'Cao đẳng',
      };
      
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should map class_type alias to class_course when creating a class', async () => {
      const dto = {
        class_name: 'Class B',
        class_year: '2023-2027',
        dept_id: 'mock-dept-id',
        class_type: 'Trung cap',
      };

      await service.create(dto as any);

      expect(model).toHaveBeenCalledWith({
        class_name: dto.class_name,
        class_year: dto.class_year,
        dept_id: dto.dept_id,
        class_course: dto.class_type,
      });
    });
  });

  describe('findAll', () => {
    it('should return an array of classes', async () => {
      const result = await service.findAll();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect((result[0] as any)._id).toEqual('mock-class-id');
    });
  });

  describe('findOne', () => {
    it('should return a class if found', async () => {
      const result = await service.findOne('mock-class-id');
      expect(result).toBeDefined();
      expect(result.class_name).toEqual('Class A');
    });

    it('should throw NotFoundException if class not found', async () => {
      model.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update and return the updated class', async () => {
      const updateDto = { class_name: 'Class A Updated' };
      const result = await service.update('mock-class-id', updateDto);
      expect(result).toBeDefined();
    });

    it('should throw ConflictException if duplicate key error on update', async () => {
      model.findByIdAndUpdate.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue({
          code: 11000,
          keyPattern: { class_name: 1 },
          keyValue: { class_name: 'Class A Updated' },
        }),
      });

      await expect(service.update('mock-class-id', { class_name: 'Class A Updated' })).rejects.toThrow(ConflictException);
    });

    it('should map class_type alias to class_course when updating a class', async () => {
      await service.update('mock-class-id', { class_type: 'Cao dang' } as any);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'mock-class-id',
        expect.objectContaining({ class_course: 'Cao dang' }),
        { returnDocument: 'after' },
      );
    });

    it('should throw NotFoundException on update if class not found', async () => {
      model.findByIdAndUpdate.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.update('invalid-id', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete and return the deleted class', async () => {
      const result = await service.remove('mock-class-id');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException on remove if class not found', async () => {
      model.findByIdAndDelete.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.remove('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
