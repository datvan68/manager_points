import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsController } from '../departments.controller';
import { DepartmentsService } from '../departments.service';

const mockDepartment = {
  _id: 'mock-id',
  name: 'IT Department',
  code: 'IT',
  description: 'Information Technology',
};

const mockDepartmentsService = {
  create: jest.fn().mockResolvedValue(mockDepartment),
  findAll: jest.fn().mockResolvedValue([mockDepartment]),
  findOne: jest.fn().mockResolvedValue(mockDepartment),
  update: jest.fn().mockResolvedValue(mockDepartment),
  remove: jest.fn().mockResolvedValue(mockDepartment),
};

describe('DepartmentsController', () => {
  let controller: DepartmentsController;
  let service: DepartmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentsController],
      providers: [
        {
          provide: DepartmentsService,
          useValue: mockDepartmentsService,
        },
      ],
    }).compile();

    controller = module.get<DepartmentsController>(DepartmentsController);
    service = module.get<DepartmentsService>(DepartmentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create and return a department', async () => {
      const dto = { name: 'IT Department', code: 'IT', description: 'Information Technology' };
      const result = await controller.create(dto);
      expect(result).toEqual(mockDepartment);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return an array of departments', async () => {
      const result = await controller.findAll();
      expect(result).toEqual([mockDepartment]);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a department by id', async () => {
      const result = await controller.findOne('mock-id');
      expect(result).toEqual(mockDepartment);
      expect(service.findOne).toHaveBeenCalledWith('mock-id');
    });
  });

  describe('update', () => {
    it('should update and return the updated department', async () => {
      const dto = { name: 'Updated IT Department' };
      const result = await controller.update('mock-id', dto);
      expect(result).toEqual(mockDepartment);
      expect(service.update).toHaveBeenCalledWith('mock-id', dto);
    });
  });

  describe('remove', () => {
    it('should remove and return the deleted department', async () => {
      const result = await controller.remove('mock-id');
      expect(result).toEqual(mockDepartment);
      expect(service.remove).toHaveBeenCalledWith('mock-id');
    });
  });
});
