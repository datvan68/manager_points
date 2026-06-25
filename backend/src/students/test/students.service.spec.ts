import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ForbiddenException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { StudentsService } from '../students.service';
import { Student } from '../schemas/student.schema';
import { Semester } from '../../semesters/schemas/semester.schema';
import { SummaryPoint } from '../../summaries-point/schemas/summary-point.schema';
import { User } from '../../auth/schemas/user.schema';
import { Role } from '../../auth/schemas/role.schema';
import { Class } from '../../classes/schemas/class.schema';
import { RefreshToken } from '../../auth/schemas/refresh-token.schema';
import * as bcrypt from 'bcrypt';

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
  let refreshTokenModel: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'STUDENT_ACCOUNT_STARTUP_SYNC') return 'off';
              if (key === 'ALLOW_STARTUP_DB_REPAIR') return 'false';
              return null;
            }),
          },
        },
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
            findById: jest.fn().mockImplementation(() => ({
              exec: jest.fn().mockResolvedValue(null),
            })),
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
        {
          provide: getModelToken(RefreshToken.name),
          useValue: {
            updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
          },
        },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    model = module.get(getModelToken(Student.name));
    classModel = module.get(getModelToken(Class.name));
    summaryPointModel = module.get(getModelToken(SummaryPoint.name));
    refreshTokenModel = module.get(getModelToken(RefreshToken.name));
    
    // Reset config service mock
    const configService = module.get<ConfigService>(ConfigService);
    (configService.get as jest.Mock).mockImplementation((key) => {
      if (key === 'STUDENT_ACCOUNT_STARTUP_SYNC') return 'off';
      if (key === 'ALLOW_STARTUP_DB_REPAIR') return 'false';
      return null;
    });
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

  describe('activateStudentAccount', () => {
    it('should activate an existing user if email/user exists', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439013',
        status: 'inactive',
        role: '507f1f77bcf86cd799439012',
        save: jest.fn().mockResolvedValue(true),
      };
      
      jest.spyOn(service['userModel'], 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as any);
      jest.spyOn(service['userModel'], 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as any);
      jest.spyOn(service['studentModel'], 'updateOne').mockResolvedValue({} as any);

      const result = await service.activateStudentAccount('507f1f77bcf86cd799439011');
      expect(result).toBeDefined();
      expect(mockUser.status).toEqual('active');
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should create and activate a new user if no user exists', async () => {
      jest.spyOn(service['userModel'], 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);
      jest.spyOn(service['userModel'], 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      const mockCreatedUser = {
        _id: '507f1f77bcf86cd799439014',
        status: 'active',
        save: jest.fn(),
      };
      jest.spyOn(service['userModel'], 'create').mockResolvedValue(mockCreatedUser as any);
      jest.spyOn(service['studentModel'], 'updateOne').mockResolvedValue({} as any);

      const result = await service.activateStudentAccount('507f1f77bcf86cd799439011');
      expect(result).toBeDefined();
      expect(service['userModel'].create).toHaveBeenCalled();
    });
  });

  describe('bulkActivateStudentAccounts', () => {
    it('should activate multiple accounts successfully', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439013',
        status: 'inactive',
        role: '507f1f77bcf86cd799439012',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(service['userModel'], 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as any);
      jest.spyOn(service['userModel'], 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as any);
      jest.spyOn(service['studentModel'], 'updateOne').mockResolvedValue({} as any);

      const result = await service.bulkActivateStudentAccounts(['507f1f77bcf86cd799439011']);
      expect(result).toBeDefined();
      expect(result.success).toEqual(1);
    });
  });

  describe('resetStudentAccountPassword', () => {
    it('should throw ForbiddenException if requester is Student', async () => {
      const requester = { userId: 'student-id', roleName: 'Student' };
      await expect(
        service.resetStudentAccountPassword('507f1f77bcf86cd799439011', requester),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if student is not found', async () => {
      const requester = { userId: 'admin-id', roleName: 'Admin' };
      jest.spyOn(service['studentModel'], 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(
        service.resetStudentAccountPassword('507f1f77bcf86cd799439011', requester),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if student has no linked user_id', async () => {
      const requester = { userId: 'admin-id', roleName: 'Admin' };
      const studentNoUser = { ...getCloneMockStudent(), user_id: null };
      
      jest.spyOn(service['studentModel'], 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(studentNoUser),
      } as any);

      await expect(
        service.resetStudentAccountPassword('507f1f77bcf86cd799439011', requester),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully reset password, keep INACTIVE status, and revoke refresh tokens', async () => {
      const requester = { userId: 'admin-id', roleName: 'Admin' };
      const student = getCloneMockStudent();
      const mockUser = {
        _id: '507f1f77bcf86cd799439013',
        status: 'inactive',
        pw_hash: 'old-hash',
        failed_login_attempts: 5,
        locked_until: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(service['studentModel'], 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(student),
      } as any);
      
      jest.spyOn(service['userModel'], 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as any);

      const updateManySpy = jest.spyOn(refreshTokenModel, 'updateMany').mockResolvedValue({} as any);

      // Mock getAccountStatusMap to prevent errors in attachAccountStatus
      jest.spyOn(service as any, 'getAccountStatusMap').mockResolvedValue({
        byId: new Map([[mockUser._id, 'inactive']]),
        byEmail: new Map(),
      });

      const result = await service.resetStudentAccountPassword('507f1f77bcf86cd799439011', requester);

      expect(result).toBeDefined();
      expect(mockUser.status).toBe('inactive');
      expect(mockUser.failed_login_attempts).toBe(0);
      expect(mockUser.locked_until).toBeNull();
      expect(mockUser.save).toHaveBeenCalled();
      expect(updateManySpy).toHaveBeenCalledWith(
        { user_id: mockUser._id },
        { $set: { is_revoked: true } },
      );
    });

    it('should successfully reset password, change status from locked to active, and revoke refresh tokens', async () => {
      const requester = { userId: 'admin-id', roleName: 'Admin' };
      const student = getCloneMockStudent();
      const mockUser = {
        _id: '507f1f77bcf86cd799439013',
        status: 'locked',
        pw_hash: 'old-hash',
        failed_login_attempts: 5,
        locked_until: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(service['studentModel'], 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(student),
      } as any);
      
      jest.spyOn(service['userModel'], 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as any);

      const updateManySpy = jest.spyOn(refreshTokenModel, 'updateMany').mockResolvedValue({} as any);

      // Mock getAccountStatusMap to prevent errors in attachAccountStatus
      jest.spyOn(service as any, 'getAccountStatusMap').mockResolvedValue({
        byId: new Map([[mockUser._id, 'active']]),
        byEmail: new Map(),
      });

      const result = await service.resetStudentAccountPassword('507f1f77bcf86cd799439011', requester);

      expect(result).toBeDefined();
      expect(mockUser.status).toBe('active');
      expect(mockUser.failed_login_attempts).toBe(0);
      expect(mockUser.locked_until).toBeNull();
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('lockStudentAccount', () => {
    it('should throw ForbiddenException if requester is Student', async () => {
      const requester = { userId: 'student-id', roleName: 'Student' };
      await expect(
        service.lockStudentAccount('507f1f77bcf86cd799439011', requester),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should lock user successfully and revoke refresh tokens', async () => {
      const requester = { userId: 'admin-id', roleName: 'Admin' };
      const student = getCloneMockStudent();
      const mockUser = {
        _id: '507f1f77bcf86cd799439013',
        status: 'active',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(service['studentModel'], 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(student),
      } as any);
      
      jest.spyOn(service['userModel'], 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as any);

      const updateManySpy = jest.spyOn(refreshTokenModel, 'updateMany').mockResolvedValue({} as any);

      jest.spyOn(service as any, 'getAccountStatusMap').mockResolvedValue({
        byId: new Map([[mockUser._id, 'locked']]),
        byEmail: new Map(),
      });

      const result = await service.lockStudentAccount('507f1f77bcf86cd799439011', requester);

      expect(result).toBeDefined();
      expect(mockUser.status).toBe('locked');
      expect(mockUser.save).toHaveBeenCalled();
      expect(updateManySpy).toHaveBeenCalledWith(
        { user_id: mockUser._id },
        { $set: { is_revoked: true } },
      );
    });
  });

  describe('unlockStudentAccount', () => {
    it('should throw ForbiddenException if requester is Student', async () => {
      const requester = { userId: 'student-id', roleName: 'Student' };
      await expect(
        service.unlockStudentAccount('507f1f77bcf86cd799439011', requester),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should unlock user successfully', async () => {
      const requester = { userId: 'admin-id', roleName: 'Admin' };
      const student = getCloneMockStudent();
      const mockUser = {
        _id: '507f1f77bcf86cd799439013',
        status: 'locked',
        locked_until: new Date(),
        failed_login_attempts: 3,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(service['studentModel'], 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(student),
      } as any);
      
      jest.spyOn(service['userModel'], 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as any);

      jest.spyOn(service as any, 'getAccountStatusMap').mockResolvedValue({
        byId: new Map([[mockUser._id, 'active']]),
        byEmail: new Map(),
      });

      const result = await service.unlockStudentAccount('507f1f77bcf86cd799439011', requester);

      expect(result).toBeDefined();
      expect(mockUser.status).toBe('active');
      expect(mockUser.locked_until).toBeNull();
      expect(mockUser.failed_login_attempts).toBe(0);
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('getDefaultPasswordFromDob', () => {
    it('should return empty string if dateBir is invalid or missing', () => {
      expect(service.getDefaultPasswordFromDob(null)).toBe('');
      expect(service.getDefaultPasswordFromDob(undefined)).toBe('');
      expect(service.getDefaultPasswordFromDob('invalid-date')).toBe('');
    });

    it('should calculate password correctly using GMT+7', () => {
      // 1999-12-31T20:00:00.000Z in UTC is 2000-01-01T03:00:00.000Z in GMT+7
      const dob1 = new Date('1999-12-31T20:00:00.000Z');
      expect(service.getDefaultPasswordFromDob(dob1)).toBe('01012000');

      // 2003-05-15T00:00:00.000Z in UTC is 2003-05-15T07:00:00.000Z in GMT+7
      const dob2 = '2003-05-15T00:00:00.000Z';
      expect(service.getDefaultPasswordFromDob(dob2)).toBe('15052003');
    });
  });

  describe('remediateStalePasswords', () => {
    let originalRemediationMode: string | undefined;

    beforeEach(() => {
      originalRemediationMode = process.env.PASSWORD_REMEDIATION_MODE;
    });

    afterEach(() => {
      if (originalRemediationMode === undefined) {
        delete process.env.PASSWORD_REMEDIATION_MODE;
      } else {
        process.env.PASSWORD_REMEDIATION_MODE = originalRemediationMode;
      }
      jest.restoreAllMocks();
    });

    it('should do nothing if PASSWORD_REMEDIATION_MODE is "off"', async () => {
      process.env.PASSWORD_REMEDIATION_MODE = 'off';
      const findStudentSpy = jest.spyOn(service['studentModel'], 'find');
      
      await service['remediateStalePasswords']();

      expect(findStudentSpy).not.toHaveBeenCalled();
    });

    it('should run in dry-run mode and log affected users without saving them', async () => {
      process.env.PASSWORD_REMEDIATION_MODE = 'dry-run';
      
      const dob = new Date('1999-12-31T20:00:00.000Z'); // correct: 01012000, wrong (UTC): 31121999
      const mockStudentObj = {
        student_code: 'SV12345',
        date_bir: dob,
        email: 'sv12345@school.edu.vn',
      };
      const mockUserObj = {
        email: 'sv12345@school.edu.vn',
        pw_hash: 'hashed_wrong_password',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(service['studentModel'], 'find').mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockStudentObj]),
      } as any);

      const findUserSpy = jest.spyOn(service['userModel'], 'find').mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockUserObj]),
      } as any);

      jest.spyOn(service as any, 'getStudentEmail').mockReturnValue('sv12345@school.edu.vn');
      
      const bcryptCompareSpy = jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true as never);
      const loggerLogSpy = jest.spyOn(service['logger'], 'log');

      await service['remediateStalePasswords']();

      expect(findUserSpy).toHaveBeenCalledWith({
        $or: [
          { email: { $in: ['sv12345@school.edu.vn'] } },
          { user_name: { $in: ['SV12345'] } }
        ]
      });
      expect(bcryptCompareSpy).toHaveBeenCalled();
      expect(mockUserObj.save).not.toHaveBeenCalled();
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DRY-RUN] Found 1 student accounts with incorrect timezone DOB passwords')
      );
    });

    it('should run in apply mode, re-hash, and save the updated users', async () => {
      process.env.PASSWORD_REMEDIATION_MODE = 'apply';

      const dob = new Date('1999-12-31T20:00:00.000Z'); // correct: 01012000, wrong (UTC): 31121999
      const mockStudentObj = {
        student_code: 'SV12345',
        date_bir: dob,
        email: 'sv12345@school.edu.vn',
      };
      const mockUserObj = {
        email: 'sv12345@school.edu.vn',
        pw_hash: 'hashed_wrong_password',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(service['studentModel'], 'find').mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockStudentObj]),
      } as any);

      const findUserSpy = jest.spyOn(service['userModel'], 'find').mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockUserObj]),
      } as any);

      jest.spyOn(service as any, 'getStudentEmail').mockReturnValue('sv12345@school.edu.vn');
      
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true as never);
      jest.spyOn(require('bcrypt'), 'hash').mockResolvedValue('new_hashed_correct_password' as never);
      const loggerLogSpy = jest.spyOn(service['logger'], 'log');

      await service['remediateStalePasswords']();

      expect(findUserSpy).toHaveBeenCalledWith({
        $or: [
          { email: { $in: ['sv12345@school.edu.vn'] } },
          { user_name: { $in: ['SV12345'] } }
        ]
      });
      expect(mockUserObj.pw_hash).toBe('new_hashed_correct_password');
      expect(mockUserObj.save).toHaveBeenCalled();
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[APPLY] Successfully remediated 1/1 student accounts')
      );
    });

    it('should not expose password values or raw secrets in logs during remediation', async () => {
      process.env.PASSWORD_REMEDIATION_MODE = 'apply';

      const dob = new Date('1999-12-31T20:00:00.000Z'); // correct DOB password: 01012000, wrong: 31121999
      const mockStudentObj = {
        student_code: 'SV12345',
        date_bir: dob,
        email: 'sv12345@school.edu.vn',
      };
      const mockUserObj = {
        email: 'sv12345@school.edu.vn',
        pw_hash: 'hashed_wrong_password',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(service['studentModel'], 'find').mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockStudentObj]),
      } as any);

      jest.spyOn(service['userModel'], 'find').mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockUserObj]),
      } as any);

      jest.spyOn(service as any, 'getStudentEmail').mockReturnValue('sv12345@school.edu.vn');
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true as never);
      jest.spyOn(require('bcrypt'), 'hash').mockResolvedValue('new_hashed_correct_password' as never);

      const loggerLogSpy = jest.spyOn(service['logger'], 'log');

      await service['remediateStalePasswords']();

      // Check all logger.log invocations
      for (const call of loggerLogSpy.mock.calls) {
        const logMsg = call[0];
        
        // Ensure no passwords, secrets, hashes, unmasked emails, or raw DOB in strings
        expect(logMsg).not.toContain('01012000');
        expect(logMsg).not.toContain('31121999');
        expect(logMsg).not.toContain('hashed_wrong_password');
        expect(logMsg).not.toContain('new_hashed_correct_password');
        expect(logMsg).not.toContain('sv12345@school.edu.vn');
        expect(logMsg).not.toContain(dob.toISOString());
        
        // If student code is present, it must be masked (SV12345 -> SV1***45)
        if (logMsg.includes('SV1')) {
          expect(logMsg).toContain('SV1***45');
          expect(logMsg).not.toContain('SV12345');
        }
      }
    });
  });

  describe('Student Account Sync', () => {
    it('should not sync on startup if config is off', async () => {
      const syncSpy = jest.spyOn(service, 'syncLegacyStudentsAccounts').mockResolvedValue(null as any);
      await service.onModuleInit();
      expect(syncSpy).not.toHaveBeenCalled();
    });

    it('should call sync with preview if config is dry-run', async () => {
      const configService = service['configService'];
      (configService.get as jest.Mock).mockImplementation((k) => k === 'STUDENT_ACCOUNT_STARTUP_SYNC' ? 'dry-run' : null);
      const syncSpy = jest.spyOn(service, 'syncLegacyStudentsAccounts').mockResolvedValue(null as any);
      await service.onModuleInit();
      expect(syncSpy).toHaveBeenCalledWith('preview');
    });

    it('should call sync with apply if config is apply and repair allowed', async () => {
      const configService = service['configService'];
      (configService.get as jest.Mock).mockImplementation((k) => {
        if (k === 'STUDENT_ACCOUNT_STARTUP_SYNC') return 'apply';
        if (k === 'ALLOW_STARTUP_DB_REPAIR') return 'true';
        return null;
      });
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const syncSpy = jest.spyOn(service, 'syncLegacyStudentsAccounts').mockResolvedValue(null as any);
      await service.onModuleInit();
      expect(syncSpy).toHaveBeenCalledWith('apply');
      process.env.NODE_ENV = origEnv;
    });

    it('should block apply if production and repair not allowed', async () => {
      const configService = service['configService'];
      (configService.get as jest.Mock).mockImplementation((k) => k === 'STUDENT_ACCOUNT_STARTUP_SYNC' ? 'apply' : 'false');
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const syncSpy = jest.spyOn(service, 'syncLegacyStudentsAccounts').mockResolvedValue(null as any);
      await service.onModuleInit();
      expect(syncSpy).not.toHaveBeenCalled();
      process.env.NODE_ENV = origEnv;
    });

    it('should return correct summary on preview', async () => {
      const userModel = service['userModel'];
      jest.spyOn(userModel, 'find').mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      } as any);

      const summary = await service.syncLegacyStudentsAccounts('preview');
      expect(summary.scanned).toBe(1);
      expect(summary.created).toBe(1);
      expect(summary.linked).toBe(0);
      expect(summary.samples).toBeDefined();
    });
  });
});
