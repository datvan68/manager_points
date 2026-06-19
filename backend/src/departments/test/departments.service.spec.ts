import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DepartmentsService } from '../departments.service';
import { Department } from '../schemas/department.schema';
import { Class } from '../../classes/schemas/class.schema';

const mockDepartment = {
  _id: 'mock-id',
  name: 'IT Department',
  code: 'IT',
  description: 'Information Technology',
};

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let model: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        {
          provide: getModelToken(Department.name),
          useValue: Object.assign(
            jest.fn().mockImplementation((dto) => ({
              ...dto,
              save: jest.fn().mockResolvedValue({ _id: 'mock-id', ...dto }),
            })),
            {
              find: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([mockDepartment]),
              }),
              findById: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDepartment),
              }),
              findByIdAndUpdate: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDepartment),
              }),
              findByIdAndDelete: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDepartment),
              }),
            },
          ),
        },
        {
          provide: getModelToken(Class.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              lean: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
    model = module.get(getModelToken(Department.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a department', async () => {
      const dto = {
        name: 'IT Department',
        code: 'IT',
        description: 'Information Technology',
      };
      const result = await service.create(dto);
      expect(result).toBeDefined();
      expect(result.name).toEqual(dto.name);
      expect(result.code).toEqual(dto.code);
    });

    it('should throw ConflictException if department code already exists', async () => {
      const dto = {
        name: 'Information Technology',
        code: 'IT',
      };
      model.mockImplementationOnce((createDto) => ({
        ...createDto,
        save: jest.fn().mockRejectedValue({
          code: 11000,
          keyPattern: { code: 1 },
          keyValue: { code: createDto.code },
        }),
      }));

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return an array of departments', async () => {
      const result = await service.findAll();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect((result[0] as any)._id).toEqual('mock-id');
    });
  });

  describe('findOne', () => {
    it('should return a department if found', async () => {
      const result = await service.findOne('mock-id');
      expect(result).toBeDefined();
      expect(result.code).toEqual('IT');
    });

    it('should throw NotFoundException if department not found', async () => {
      model.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update and return the updated department', async () => {
      const updateDto = { name: 'Updated IT Department' };
      const result = await service.update('mock-id', updateDto);
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException on update if department not found', async () => {
      model.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.update('invalid-id', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if updated department code already exists', async () => {
      model.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockRejectedValue({
          code: 11000,
          keyPattern: { code: 1 },
          keyValue: { code: 'IT' },
        }),
      });

      await expect(service.update('mock-id', { code: 'IT' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('should delete and return the deleted department', async () => {
      const result = await service.remove('mock-id');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException on remove if department not found', async () => {
      model.findByIdAndDelete.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.remove('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
