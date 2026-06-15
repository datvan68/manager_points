import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ForbiddenException, UnauthorizedException, BadRequestException } from '@nestjs/common';
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
const getCloneMockStudent = () => ({
  ...mockStudent,
  date_bir: new Date(mockStudent.date_bir),
  class_id: { ...mockStudent.class_id },
  user_id: mockStudent.user_id ? { ...mockStudent.user_id } : null,
});

describe('StudentsService', () => {
  let service: StudentsService;
  let model: any;
  let classModel: any;
  let summaryPointModel: any;

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
              find: jest.fn().mockImplementation(() => ({
                populate: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([getCloneMockStudent()]),
              })),
              findById: jest.fn().mockImplementation(() => ({
                populate: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(getCloneMockStudent()),
              })),
              findOne: jest.fn().mockImplementation(() => ({
                populate: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(getCloneMockStudent()),
              })),
              findByIdAndUpdate: jest.fn().mockImplementation(() => ({
                exec: jest.fn().mockResolvedValue(getCloneMockStudent()),
              })),
              findByIdAndDelete: jest.fn().mockImplementation(() => ({
                exec: jest.fn().mockResolvedValue(getCloneMockStudent()),
              })),
              insertMany: jest.fn().mockImplementation(() => Promise.resolve([getCloneMockStudent()])),
              bulkWrite: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
              updateOne: jest.fn().mockResolvedValue({}),
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
            bulkWrite: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
            deleteMany: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            }),
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
    summaryPointModel = module.get(getModelToken(SummaryPoint.name));
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
      expect(summaryPointModel.bulkWrite).toHaveBeenCalled();

      // Verify identity contract in bulkWrite call
      const bulkWriteCall = summaryPointModel.bulkWrite.mock.calls[0];
      const bulkOps = bulkWriteCall[0];
      expect(bulkOps[0].updateOne.filter.period_id).toBeNull();
      expect(bulkOps[0].updateOne.update.$setOnInsert.period_id).toBeNull();
    });

    it('should handle duplicate key error (11000) during auto-create summary points gracefully', async () => {
      const dto = {
        student_code: 'SV-2023-002',
        full_name: 'Nguyễn Văn B',
        email: 'b.nv@student.edu.vn',
        date_bir: '2003-01-01',
        sex: 'Male',
        status: 'Studying',
        class_id: '507f1f77bcf86cd799439012',
        training_point_id: 'mock-tp-id',
      };

      const mongoError = new Error('Duplicate key');
      (mongoError as any).code = 11000;
      summaryPointModel.bulkWrite.mockRejectedValueOnce(mongoError);

      const mockResult = { ...mockStudent, student_code: dto.student_code };
      model.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockResult),
      });

      const result = await service.create(dto);
      expect(result).toBeDefined();
      expect(result.student_code).toEqual(dto.student_code);
    });

    it('should not create summaries for non-Studying statuses during create', async () => {
      const dto = {
        student_code: 'SV-2023-001',
        full_name: 'Nguyễn Văn A',
        email: 'a.nv@student.edu.vn',
        date_bir: '2003-01-01',
        sex: 'Male',
        status: 'Reserved',
        class_id: '507f1f77bcf86cd799439012',
        training_point_id: 'mock-tp-id',
      };
      
      model.mockImplementationOnce((d: any) => ({
        ...d,
        save: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011', ...d }),
      }));
      
      summaryPointModel.bulkWrite.mockClear();

      const result = await service.create(dto);
      expect(result).toBeDefined();
      expect(summaryPointModel.bulkWrite).not.toHaveBeenCalled();
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
      expect(summaryPointModel.bulkWrite).toHaveBeenCalled();
    });

    it('should handle duplicate key error (11000) during bulk auto-create summary points gracefully', async () => {
      const dtos = [
        {
          student_code: 'SV-2023-003',
          full_name: 'Nguyễn Văn C',
          email: 'c.nv@student.edu.vn',
          date_bir: '2003-01-01',
          sex: 'Male',
          status: 'Studying',
          class_id: '507f1f77bcf86cd799439012',
          training_point_id: 'mock-tp-id',
        },
      ];

      const mongoError = new Error('Duplicate key');
      (mongoError as any).code = 11000;
      summaryPointModel.bulkWrite.mockRejectedValueOnce(mongoError);

      const mockResult = [{ ...mockStudent, student_code: dtos[0].student_code }];
      model.insertMany.mockResolvedValueOnce(mockResult);
      model.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockResult),
      });

      const result = await service.createBulk(dtos);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].student_code).toEqual(dtos[0].student_code);
    });

    it('should only build summaries for Studying students during bulk import', async () => {
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
        {
          student_code: 'SV-2023-002',
          full_name: 'Nguyễn Văn B',
          email: 'b.nv@student.edu.vn',
          date_bir: '2003-01-01',
          sex: 'Male',
          status: 'Reserved',
          class_id: '507f1f77bcf86cd799439012',
          training_point_id: 'mock-tp-id',
        },
      ];

      const mockResult = [
        { ...mockStudent, student_code: 'SV-2023-001', status: 'Studying' },
        { ...mockStudent, student_code: 'SV-2023-002', status: 'Reserved' },
      ];
      model.insertMany.mockResolvedValueOnce(mockResult);
      model.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockResult),
      });

      summaryPointModel.bulkWrite.mockClear();

      const result = await service.createBulk(dtos);
      expect(result).toBeDefined();
      expect(summaryPointModel.bulkWrite).toHaveBeenCalled();
      
      const bulkOps = summaryPointModel.bulkWrite.mock.calls[0][0];
      expect(bulkOps.length).toBe(1);
      expect(bulkOps[0].updateOne.filter.student_id).toEqual(mockResult[0]._id);
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

    it('should return only students for the requested classId', async () => {
      const requester = { userId: '507f1f77bcf86cd799439015', roleName: 'Admin' };
      const classId = '507f1f77bcf86cd799439012';
      
      model.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([getCloneMockStudent()]),
      });

      const result = await service.findAll({ classId }, requester);
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(model.find).toHaveBeenCalledWith({ class_id: new Types.ObjectId(classId) });
    });

    it('should return empty for invalid classId', async () => {
      const requester = { userId: '507f1f77bcf86cd799439015', roleName: 'Admin' };
      const classId = 'invalid-class-id';
      
      const result = await service.findAll({ classId }, requester);
      expect(result).toEqual([]);
    });

    it('should allow teacher requester to see students if classId matches an assigned class', async () => {
      const requester = { userId: 'teacher-user-id', roleName: 'Teacher' };
      const classId = '507f1f77bcf86cd799439012';
      
      jest.spyOn(classModel, 'find').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId(classId) }]),
      } as any);

      model.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([getCloneMockStudent()]),
      });

      const result = await service.findAll({ classId }, requester);
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(model.find).toHaveBeenCalledWith({ class_id: new Types.ObjectId(classId) });
    });

    it('should return empty list if teacher requests classId that is not assigned to them', async () => {
      const requester = { userId: 'teacher-user-id', roleName: 'Teacher' };
      const classId = '507f1f77bcf86cd799439099'; // not assigned
      
      jest.spyOn(classModel, 'find').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId('507f1f77bcf86cd799439012') }]),
      } as any);

      const result = await service.findAll({ classId }, requester);
      expect(result).toEqual([]);
    });

    it('should return empty list if student requests a classId that is not their own class', async () => {
      const requester = { userId: '507f1f77bcf86cd799439013', roleName: 'Student' };
      const classId = '507f1f77bcf86cd799439099'; // not student's class
      
      const result = await service.findAll({ classId }, requester);
      expect(result).toEqual([]);
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

    it('should throw BadRequestException if changing status from Studying without confirmation', async () => {
      const updateDto = { status: 'Reserved' };
      await expect(service.update('507f1f77bcf86cd799439011', updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete related summaries when status change is confirmed', async () => {
      const updateDto = { status: 'Reserved', deleteTrainingScoresConfirmed: true };
      
      summaryPointModel.deleteMany.mockClear();

      const result = await service.update('507f1f77bcf86cd799439011', updateDto);
      expect(result).toBeDefined();
      expect(summaryPointModel.deleteMany).toHaveBeenCalledWith({
        student_id: new Types.ObjectId('507f1f77bcf86cd799439011'),
      });
    });

    it('should not delete summaries when status is not changed away from Studying', async () => {
      const updateDto = { status: 'Studying' };
      
      summaryPointModel.deleteMany.mockClear();

      const result = await service.update('507f1f77bcf86cd799439011', updateDto);
      expect(result).toBeDefined();
      expect(summaryPointModel.deleteMany).not.toHaveBeenCalled();
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
