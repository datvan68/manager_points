import { Test, TestingModule } from '@nestjs/testing';
import { ClassesController } from '../classes.controller';
import { ClassesService } from '../classes.service';
import { ClassType } from '../schemas/class.schema';

const mockClass = {
  _id: 'mock-class-id',
  class_name: 'Class A',
  class_year: '2023-2027',
  dept_id: 'mock-dept-id',
  user_id: 'mock-user-id',
  class_type: 'Cao đẳng',
};

const mockClassesService = {
  create: jest.fn().mockResolvedValue(mockClass),
  findAll: jest.fn().mockResolvedValue([mockClass]),
  findOne: jest.fn().mockResolvedValue(mockClass),
  update: jest.fn().mockResolvedValue(mockClass),
  remove: jest.fn().mockResolvedValue(mockClass),
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
        class_type: ClassType.CAO_DANG,
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
});
