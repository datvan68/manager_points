import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { StudentsService } from '../students.service';
import { Student } from '../schemas/student.schema';

const mockStudent = {
  _id: 'mock-student-id',
  student_code: 'SV-2023-001',
  full_name: 'Nguyễn Văn A',
  email: 'a.nv@student.edu.vn',
  date_bir: new Date('2003-01-01'),
  sex: 'Male',
  status: 'Studying',
  class_id: 'mock-class-id',
  training_point_id: 'mock-tp-id',
};

describe('StudentsService', () => {
  let service: StudentsService;
  let model: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        {
          provide: getModelToken(Student.name),
          useValue: Object.assign(
            jest.fn().mockImplementation((dto) => ({
              ...dto,
              save: jest
                .fn()
                .mockResolvedValue({ _id: 'mock-student-id', ...dto }),
            })),
            {
              find: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([mockStudent]),
              }),
              findById: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockStudent),
              }),
              findOne: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockStudent),
              }),
              findByIdAndUpdate: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockStudent),
              }),
              findByIdAndDelete: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockStudent),
              }),
              insertMany: jest.fn().mockResolvedValue([mockStudent]),
            },
          ),
        },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    model = module.get(getModelToken(Student.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a student', async () => {
      const dto = {
        student_code: 'SV-2023-001',
        full_name: 'Nguyễn Văn A',
        email: 'a.nv@student.edu.vn',
        date_bir: '2003-01-01',
        sex: 'Male',
        status: 'Studying',
        class_id: 'mock-class-id',
        training_point_id: 'mock-tp-id',
      };
      const result = await service.create(dto);
      expect(result).toBeDefined();
      expect(result.student_code).toEqual(dto.student_code);
    });
  });

  describe('createBulk', () => {
    it('should successfully create multiple students', async () => {
      const dtos = [
        {
          student_code: 'SV-2023-001',
          full_name: 'Nguyễn Văn A',
          email: 'a.nv@student.edu.vn',
          date_bir: '2003-01-01',
          sex: 'Male',
          status: 'Studying',
          class_id: 'mock-class-id',
          training_point_id: 'mock-tp-id',
        },
      ];
      const result = await service.createBulk(dtos);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].student_code).toEqual(dtos[0].student_code);
    });
  });

  describe('findAll', () => {
    it('should return an array of students', async () => {
      const result = await service.findAll();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]._id).toEqual('mock-student-id');
    });
  });

  describe('findOne', () => {
    it('should return a student if found', async () => {
      const result = await service.findOne('mock-student-id');
      expect(result).toBeDefined();
      expect(result.full_name).toEqual('Nguyễn Văn A');
    });

    it('should throw NotFoundException if student not found by ID', async () => {
      model.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByStudentCode', () => {
    it('should return a student by code if found', async () => {
      const result = await service.findByStudentCode('SV-2023-001');
      expect(result).toBeDefined();
      expect(result.student_code).toEqual('SV-2023-001');
    });

    it('should throw NotFoundException if student not found by code', async () => {
      model.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.findByStudentCode('invalid-code')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update and return the updated student', async () => {
      const updateDto = { full_name: 'Nguyễn Văn B' };
      const result = await service.update('mock-student-id', updateDto);
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException on update if student not found', async () => {
      model.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.update('invalid-id', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete and return the deleted student', async () => {
      const result = await service.remove('mock-student-id');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException on remove if student not found', async () => {
      model.findByIdAndDelete.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.remove('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
