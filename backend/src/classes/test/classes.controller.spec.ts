import { Test, TestingModule } from '@nestjs/testing';
import { ClassesController } from '../classes.controller';
import { ClassesService } from '../classes.service';
import { BadRequestException } from '@nestjs/common';

const mockClass = {
  _id: 'mock-class-id',
  class_name: 'Class A',
  class_year: '2023-2027',
  dept_id: 'mock-dept-id',
  advisor_id: 'mock-user-id',
  class_course: 'Cao đẳng',
};

const mockClassesService = {
  create: jest.fn().mockResolvedValue(mockClass),
  findAll: jest.fn().mockResolvedValue([mockClass]),
  findOne: jest.fn().mockResolvedValue(mockClass),
  update: jest.fn().mockResolvedValue(mockClass),
  remove: jest.fn().mockResolvedValue(mockClass),
  previewImport: jest.fn(),
  confirmImport: jest.fn(),
};

describe('ClassesController', () => {
  let controller: ClassesController;
  let service: ClassesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassesController],
      providers: [
        {
          provide: ClassesService,
          useValue: mockClassesService,
        },
      ],
    }).compile();

    controller = module.get<ClassesController>(ClassesController);
    service = module.get<ClassesService>(ClassesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create and return a class', async () => {
      const dto = {
        class_name: 'Class A',
        class_year: '2023-2027',
        dept_id: 'mock-dept-id',
        class_course: 'Cao đẳng',
      };
      const result = await controller.create(dto);
      expect(result).toEqual(mockClass);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return an array of classes', async () => {
      const result = await controller.findAll();
      expect(result).toEqual([mockClass]);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a class by id', async () => {
      const result = await controller.findOne('mock-class-id');
      expect(result).toEqual(mockClass);
      expect(service.findOne).toHaveBeenCalledWith('mock-class-id');
    });
  });

  describe('update', () => {
    it('should update and return the updated class', async () => {
      const dto = { class_name: 'Class A Updated' };
      const result = await controller.update('mock-class-id', dto);
      expect(result).toEqual(mockClass);
      expect(service.update).toHaveBeenCalledWith('mock-class-id', dto);
    });
  });

  describe('remove', () => {
    it('should remove and return the deleted class', async () => {
      const result = await controller.remove('mock-class-id');
      expect(result).toEqual(mockClass);
      expect(service.remove).toHaveBeenCalledWith('mock-class-id');
    });
  });

  describe('previewImport', () => {
    it('should throw BadRequestException if file is not provided', () => {
      expect(() => controller.previewImport(undefined as any)).toThrow(
        BadRequestException,
      );
    });

    it('should call previewImport on service and return result', async () => {
      const mockFile = {
        buffer: Buffer.from(''),
        originalname: 'test.xlsx',
      } as any;
      const mockResult = { validRows: 1, invalidRows: 0 };
      mockClassesService.previewImport.mockResolvedValueOnce(mockResult);

      const result = await controller.previewImport(mockFile);
      expect(result).toEqual(mockResult);
      expect(service.previewImport).toHaveBeenCalledWith(mockFile);
    });
  });

  describe('confirmImport', () => {
    it('should call confirmImport on service and return result', async () => {
      const dto = { rows: [], mode: 'skip_duplicates' } as any;
      const mockResult = { success: 1, skipped: 0, errors: [] };
      mockClassesService.confirmImport.mockResolvedValueOnce(mockResult);

      const result = await controller.confirmImport(dto);
      expect(result).toEqual(mockResult);
      expect(service.confirmImport).toHaveBeenCalledWith(dto);
    });
  });
});
