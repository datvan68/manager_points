import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import { StudentsService } from '../students.service';
import { Student } from '../schemas/student.schema';
import { Semester } from '../../semesters/schemas/semester.schema';
import { SummaryPoint } from '../../summaries-point/schemas/summary-point.schema';
import { User } from '../../auth/schemas/user.schema';
import { Role } from '../../auth/schemas/role.schema';
import { Class } from '../../classes/schemas/class.schema';

const mockStudent = {
  _id: '507f1f77bcf86cd799439011',
  student_code: 'SV-2023-001',
  full_name: 'Nguyễn Văn A',
  email: 'a.nv@student.edu.vn',
  date_bir: new Date('2003-01-01'),
  sex: 'Male',
  status: 'Studying',
  class_id: { _id: '507f1f77bcf86cd799439012' },
  training_point_id: 'mock-tp-id',
  user_id: { _id: '507f1f77bcf86cd799439013' },
};

describe('StudentsService', () => {
  let service: StudentsService;
  let model: any;
  let classModel: any;

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
                .mockResolvedValue({ _id: '507f1f77bcf86cd799439011', ...dto }),
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
              bulkWrite: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
            },
          ),
        },
        {
          provide: getModelToken(Semester.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([{ _id: 'mock-semester-id', status: 'active' }]),
            }),
          },
        },
        {
          provide: getModelToken(SummaryPoint.name),
          useValue: {
            insertMany: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            }),
            findOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            }),
            create: jest.fn().mockResolvedValue({ _id: 'mock-user-id' }),
            deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
          },
        },
        {
          provide: getModelToken(Role.name),
          useValue: {
            findOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ _id: 'mock-role-id', name: 'Student' }),
            }),
          },
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

    service = module.get<StudentsService>(StudentsService);
    model = module.get(getModelToken(Student.name));
    classModel = module.get(getModelToken(Class.name));
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
        class_id: '507f1f77bcf86cd799439012',
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
          class_id: '507f1f77bcf86cd799439012',
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
    it('should return list containing only self profile when requester is Student', async () => {
      const requester = { userId: '507f1f77bcf86cd799439013', roleName: 'Student' };
      const result = await service.findAll(requester);
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0]._id).toBe(mockStudent._id);
    });

    it('should return empty list if student profile not found for Student requester', async () => {
      const requester = { userId: '507f1f77bcf86cd799439014', roleName: 'Student' };
      model.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      const result = await service.findAll(requester);
      expect(result).toEqual([]);
    });

    it('should return full list if requester is Admin', async () => {
      const requester = { userId: '507f1f77bcf86cd799439015', roleName: 'Admin' };
      const result = await service.findAll(requester);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('findMe', () => {
    it('should return student profile for the current logged in student', async () => {
      const requester = { userId: '507f1f77bcf86cd799439013', roleName: 'Student' };
      const result = await service.findMe(requester);
      expect(result).toBeDefined();
      expect(result.full_name).toEqual('Nguyễn Văn A');
    });

    it('should throw UnauthorizedException if userId is invalid', async () => {
      const requester = { userId: 'invalid-id', roleName: 'Student' };
      await expect(service.findMe(requester)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException if student profile is not found', async () => {
      const requester = { userId: '507f1f77bcf86cd799439014', roleName: 'Student' };
      model.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.findMe(requester)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return a student if found (no requester specified)', async () => {
      const result = await service.findOne('507f1f77bcf86cd799439011');
      expect(result).toBeDefined();
      expect(result.full_name).toEqual('Nguyễn Văn A');
    });

    it('should throw NotFoundException if student not found by ID', async () => {
      model.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.findOne('507f1f77bcf86cd799439019')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return student profile if requester is Student and requests their own profile', async () => {
      const requester = { userId: '507f1f77bcf86cd799439013', roleName: 'Student' };
      const result = await service.findOne(mockStudent._id, requester);
      expect(result).toBeDefined();
      expect(result.full_name).toEqual('Nguyễn Văn A');
    });

    it('should throw ForbiddenException if requester is Student and requests another profile', async () => {
      const requester = { userId: '507f1f77bcf86cd799439019', roleName: 'Student' };
      await expect(service.findOne(mockStudent._id, requester)).rejects.toThrow(ForbiddenException);
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
      const result = await service.update('507f1f77bcf86cd799439011', updateDto);
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException on update if student not found', async () => {
      model.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.update('507f1f77bcf86cd799439011', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if requester is Student', async () => {
      const requester = { userId: 'student-user-id', roleName: 'Student' };
      await expect(
        service.update('507f1f77bcf86cd799439011', {}, requester),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if ID is invalid', async () => {
      await expect(service.update('invalid-id', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete and return the deleted student', async () => {
      const result = await service.remove('507f1f77bcf86cd799439011');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException on remove if student not found', async () => {
      model.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.remove('507f1f77bcf86cd799439011')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if requester is Student', async () => {
      const requester = { userId: 'student-user-id', roleName: 'Student' };
      await expect(
        service.remove('507f1f77bcf86cd799439011', requester),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if ID is invalid', async () => {
      await expect(service.remove('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('teacher scope and validation', () => {
    it('should return student profile if requester is Teacher and student is in their class', async () => {
      const requester = { userId: 'teacher-user-id', roleName: 'Teacher' };
      jest.spyOn(classModel, 'find').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: '507f1f77bcf86cd799439012' }]),
      } as any);

      const result = await service.findOne(mockStudent._id, requester);
      expect(result).toBeDefined();
      expect(result.full_name).toEqual('Nguyễn Văn A');
    });

    it('should throw NotFoundException if requester is Teacher and student is NOT in their class', async () => {
      const requester = { userId: 'teacher-user-id', roleName: 'Teacher' };
      jest.spyOn(classModel, 'find').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: 'other-class-id' }]),
      } as any);

      model.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne(mockStudent._id, requester)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException on findOne if ID is invalid', async () => {
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
