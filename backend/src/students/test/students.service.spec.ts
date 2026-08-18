import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { StudentsService } from '../students.service';
import { Student } from '../schemas/student.schema';
import { Semester } from '../../semesters/schemas/semester.schema';
import { SummaryPoint } from '../../summaries-point/schemas/summary-point.schema';
import { User } from '../../auth/schemas/user.schema';
import { Role } from '../../auth/schemas/role.schema';
import { Class } from '../../classes/schemas/class.schema';
import { RefreshToken } from '../../auth/schemas/refresh-token.schema';
import { DormitoryRosterEntry } from '../../dormitory/schemas/dormitory-roster-entry.schema';
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
  let registrationModel: any;

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
                select: jest.fn().mockReturnThis(),
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
              insertMany: jest
                .fn()
                .mockImplementation(() =>
                  Promise.resolve([getCloneMockStudent()]),
                ),
              bulkWrite: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
              updateOne: jest.fn().mockResolvedValue({}),
              countDocuments: jest.fn().mockImplementation(() => {
                const query = Promise.resolve(1) as any;
                query.exec = jest.fn().mockResolvedValue(1);
                return query;
              }),
            },
          ),
        },
        {
          provide: getModelToken(Semester.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              exec: jest
                .fn()
                .mockResolvedValue([
                  { _id: 'mock-semester-id', status: 'active' },
                ]),
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
            countDocuments: jest.fn().mockImplementation(() => {
              const query = Promise.resolve(1) as any;
              query.exec = jest.fn().mockResolvedValue(1);
              return query;
            }),
          },
        },
        {
          provide: getModelToken(Role.name),
          useValue: {
            findOne: jest.fn().mockReturnValue({
              exec: jest
                .fn()
                .mockResolvedValue({ _id: 'mock-role-id', name: 'Student' }),
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
        {
          provide: getModelToken(DormitoryRosterEntry.name),
          useValue: {
            countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
          },
        },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    model = module.get(getModelToken(Student.name));
    classModel = module.get(getModelToken(Class.name));
    summaryPointModel = module.get(getModelToken(SummaryPoint.name));
    refreshTokenModel = module.get(getModelToken(RefreshToken.name));
    registrationModel = module.get(getModelToken(DormitoryRosterEntry.name));

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
        save: jest
          .fn()
          .mockResolvedValue({ _id: '507f1f77bcf86cd799439011', ...d }),
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

      const mockResult = [
        { ...mockStudent, student_code: dtos[0].student_code },
      ];
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
      const requester = {
        userId: '507f1f77bcf86cd799439013',
        roleName: 'Student',
      };
      const result = await service.findAll(requester);
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0]._id).toBe(mockStudent._id);
    });

    it('should return empty list if student profile not found for Student requester', async () => {
      const requester = {
        userId: '507f1f77bcf86cd799439014',
        roleName: 'Student',
      };
      model.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      const result = await service.findAll(requester);
      expect(result).toEqual([]);
    });

    it('should return full list if requester is Admin', async () => {
      const requester = {
        userId: '507f1f77bcf86cd799439015',
        roleName: 'Admin',
      };
      const result = await service.findAll(requester);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return only students for the requested classId', async () => {
      const requester = {
        userId: '507f1f77bcf86cd799439015',
        roleName: 'Admin',
      };
      const classId = '507f1f77bcf86cd799439012';

      model.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([getCloneMockStudent()]),
      });

      const result = await service.findAll({ classId }, requester);
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(model.find).toHaveBeenCalledWith({
        class_id: new Types.ObjectId(classId),
      });
    });

    it('should return empty for invalid classId', async () => {
      const requester = {
        userId: '507f1f77bcf86cd799439015',
        roleName: 'Admin',
      };
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
        exec: jest
          .fn()
          .mockResolvedValue([{ _id: new Types.ObjectId(classId) }]),
      } as any);

      model.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([getCloneMockStudent()]),
      });

      const result = await service.findAll({ classId }, requester);
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(model.find).toHaveBeenCalledWith({
        class_id: new Types.ObjectId(classId),
      });
    });

    it('should return empty list if teacher requests classId that is not assigned to them', async () => {
      const requester = { userId: 'teacher-user-id', roleName: 'Teacher' };
      const classId = '507f1f77bcf86cd799439099'; // not assigned

      jest.spyOn(classModel, 'find').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([
            { _id: new Types.ObjectId('507f1f77bcf86cd799439012') },
          ]),
      } as any);

      const result = await service.findAll({ classId }, requester);
      expect(result).toEqual([]);
    });

    it('should return empty list if student requests a classId that is not their own class', async () => {
      const requester = {
        userId: '507f1f77bcf86cd799439013',
        roleName: 'Student',
      };
      const classId = '507f1f77bcf86cd799439099'; // not student's class

      const result = await service.findAll({ classId }, requester);
      expect(result).toEqual([]);
    });
  });

  describe('findMe', () => {
    it('should return student profile for the current logged in student', async () => {
      const requester = {
        userId: '507f1f77bcf86cd799439013',
        roleName: 'Student',
      };
      const result = await service.findMe(requester);
      expect(result).toBeDefined();
      expect(result.full_name).toEqual('Nguyễn Văn A');
    });

    it('should throw UnauthorizedException if userId is invalid', async () => {
      const requester = { userId: 'invalid-id', roleName: 'Student' };
      await expect(service.findMe(requester)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw NotFoundException if student profile is not found', async () => {
      const requester = {
        userId: '507f1f77bcf86cd799439014',
        roleName: 'Student',
      };
      model.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.findMe(requester)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a student if found (no requester specified)', async () => {
      const result = await service.findOne('507f1f77bcf86cd799439011');
      expect(result).toBeDefined();
      expect(result.full_name).toEqual('Nguyễn Văn A');
    });

    it('should expose KTX registration status only when a linked registration exists', async () => {
      registrationModel.countDocuments.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(1) });
      const result = await service.findOne(mockStudent._id);
      expect(result.has_dormitory_roster).toBe(true);
      expect(registrationModel.countDocuments).toHaveBeenCalledWith({ student_id: mockStudent._id });
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
      const requester = {
        userId: '507f1f77bcf86cd799439013',
        roleName: 'Student',
      };
      const result = await service.findOne(mockStudent._id, requester);
      expect(result).toBeDefined();
      expect(result.full_name).toEqual('Nguyễn Văn A');
    });

    it('should throw ForbiddenException if requester is Student and requests another profile', async () => {
      const requester = {
        userId: '507f1f77bcf86cd799439019',
        roleName: 'Student',
      };
      await expect(service.findOne(mockStudent._id, requester)).rejects.toThrow(
        ForbiddenException,
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

  describe('resolve', () => {
    it('should resolve a student by valid ObjectId', async () => {
      const result = await service.resolve('507f1f77bcf86cd799439011');
      expect(result).toBeDefined();
      expect(result.full_name).toEqual('Nguyễn Văn A');
    });

    it('should resolve a student by student code', async () => {
      const result = await service.resolve('SV-2023-001');
      expect(result).toBeDefined();
      expect(result.student_code).toEqual('SV-2023-001');
    });

    it('should throw NotFoundException if student not found by ObjectId or code', async () => {
      model.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.resolve('invalid-id-or-code')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return student profile if requester is Student and resolves their own profile', async () => {
      const requester = {
        userId: '507f1f77bcf86cd799439013',
        roleName: 'Student',
      };
      const result = await service.resolve(mockStudent._id, requester);
      expect(result).toBeDefined();
      expect(result.full_name).toEqual('Nguyễn Văn A');
    });

    it('should throw ForbiddenException if requester is Student and resolves another profile', async () => {
      const requester = {
        userId: '507f1f77bcf86cd799439019',
        roleName: 'Student',
      };
      await expect(service.resolve(mockStudent._id, requester)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('should update and return the updated student', async () => {
      const updateDto = { full_name: 'Nguyễn Văn B' };
      const result = await service.update(
        '507f1f77bcf86cd799439011',
        updateDto,
      );
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException on update if student not found', async () => {
      model.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.update('507f1f77bcf86cd799439011', {}),
      ).rejects.toThrow(NotFoundException);
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
      await expect(
        service.update('507f1f77bcf86cd799439011', updateDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete related summaries when status change is confirmed', async () => {
      const updateDto = {
        status: 'Reserved',
        deleteTrainingScoresConfirmed: true,
      };

      summaryPointModel.deleteMany.mockClear();

      const result = await service.update(
        '507f1f77bcf86cd799439011',
        updateDto,
      );
      expect(result).toBeDefined();
      expect(summaryPointModel.deleteMany).toHaveBeenCalledWith({
        student_id: new Types.ObjectId('507f1f77bcf86cd799439011'),
      });
    });

    it('should not delete summaries when status is not changed away from Studying', async () => {
      const updateDto = { status: 'Studying' };

      summaryPointModel.deleteMany.mockClear();

      const result = await service.update(
        '507f1f77bcf86cd799439011',
        updateDto,
      );
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
        exec: jest
          .fn()
          .mockResolvedValue([{ _id: '507f1f77bcf86cd799439012' }]),
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

      await expect(service.findOne(mockStudent._id, requester)).rejects.toThrow(
        NotFoundException,
      );
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
      jest
        .spyOn(service['studentModel'], 'updateOne')
        .mockResolvedValue({} as any);

      const result = await service.activateStudentAccount(
        '507f1f77bcf86cd799439011',
      );
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
      jest
        .spyOn(service['userModel'], 'create')
        .mockResolvedValue(mockCreatedUser as any);
      jest
        .spyOn(service['studentModel'], 'updateOne')
        .mockResolvedValue({} as any);

      const result = await service.activateStudentAccount(
        '507f1f77bcf86cd799439011',
      );
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
      jest
        .spyOn(service['studentModel'], 'updateOne')
        .mockResolvedValue({} as any);

      const result = await service.bulkActivateStudentAccounts([
        '507f1f77bcf86cd799439011',
      ]);
      expect(result).toBeDefined();
      expect(result.success).toEqual(1);
    });
  });

  describe('resetStudentAccountPassword', () => {
    it('should throw ForbiddenException if requester is Student', async () => {
      const requester = { userId: 'student-id', roleName: 'Student' };
      await expect(
        service.resetStudentAccountPassword(
          '507f1f77bcf86cd799439011',
          requester,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if student is not found', async () => {
      const requester = { userId: 'admin-id', roleName: 'Admin' };
      jest.spyOn(service['studentModel'], 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(
        service.resetStudentAccountPassword(
          '507f1f77bcf86cd799439011',
          requester,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if student has no linked user_id', async () => {
      const requester = { userId: 'admin-id', roleName: 'Admin' };
      const studentNoUser = { ...getCloneMockStudent(), user_id: null };

      jest.spyOn(service['studentModel'], 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue(studentNoUser),
      } as any);

      await expect(
        service.resetStudentAccountPassword(
          '507f1f77bcf86cd799439011',
          requester,
        ),
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

      const updateManySpy = jest
        .spyOn(refreshTokenModel, 'updateMany')
        .mockResolvedValue({} as any);

      // Mock getAccountStatusMap to prevent errors in attachAccountStatus
      jest.spyOn(service as any, 'getAccountStatusMap').mockResolvedValue({
        byId: new Map([[mockUser._id, 'inactive']]),
        byEmail: new Map(),
      });

      const result = await service.resetStudentAccountPassword(
        '507f1f77bcf86cd799439011',
        requester,
      );

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

      const updateManySpy = jest
        .spyOn(refreshTokenModel, 'updateMany')
        .mockResolvedValue({} as any);

      // Mock getAccountStatusMap to prevent errors in attachAccountStatus
      jest.spyOn(service as any, 'getAccountStatusMap').mockResolvedValue({
        byId: new Map([[mockUser._id, 'active']]),
        byEmail: new Map(),
      });

      const result = await service.resetStudentAccountPassword(
        '507f1f77bcf86cd799439011',
        requester,
      );

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

      const updateManySpy = jest
        .spyOn(refreshTokenModel, 'updateMany')
        .mockResolvedValue({} as any);

      jest.spyOn(service as any, 'getAccountStatusMap').mockResolvedValue({
        byId: new Map([[mockUser._id, 'locked']]),
        byEmail: new Map(),
      });

      const result = await service.lockStudentAccount(
        '507f1f77bcf86cd799439011',
        requester,
      );

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

      const result = await service.unlockStudentAccount(
        '507f1f77bcf86cd799439011',
        requester,
      );

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

      const findUserSpy = jest
        .spyOn(service['userModel'], 'find')
        .mockReturnValue({
          exec: jest.fn().mockResolvedValue([mockUserObj]),
        } as any);

      jest
        .spyOn(service as any, 'getStudentEmail')
        .mockReturnValue('sv12345@school.edu.vn');

      const bcryptCompareSpy = jest
        .spyOn(require('bcrypt'), 'compare')
        .mockResolvedValue(true as never);
      const loggerLogSpy = jest.spyOn(service['logger'], 'log');

      await service['remediateStalePasswords']();

      expect(findUserSpy).toHaveBeenCalledWith({
        $or: [
          { email: { $in: ['sv12345@school.edu.vn'] } },
          { user_name: { $in: ['SV12345'] } },
        ],
      });
      expect(bcryptCompareSpy).toHaveBeenCalled();
      expect(mockUserObj.save).not.toHaveBeenCalled();
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[DRY-RUN] Found 1 student accounts with incorrect timezone DOB passwords',
        ),
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

      const findUserSpy = jest
        .spyOn(service['userModel'], 'find')
        .mockReturnValue({
          exec: jest.fn().mockResolvedValue([mockUserObj]),
        } as any);

      jest
        .spyOn(service as any, 'getStudentEmail')
        .mockReturnValue('sv12345@school.edu.vn');

      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true as never);
      jest
        .spyOn(require('bcrypt'), 'hash')
        .mockResolvedValue('new_hashed_correct_password' as never);
      const loggerLogSpy = jest.spyOn(service['logger'], 'log');

      await service['remediateStalePasswords']();

      expect(findUserSpy).toHaveBeenCalledWith({
        $or: [
          { email: { $in: ['sv12345@school.edu.vn'] } },
          { user_name: { $in: ['SV12345'] } },
        ],
      });
      expect(mockUserObj.pw_hash).toBe('new_hashed_correct_password');
      expect(mockUserObj.save).toHaveBeenCalled();
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[APPLY] Successfully remediated 1/1 student accounts',
        ),
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

      jest
        .spyOn(service as any, 'getStudentEmail')
        .mockReturnValue('sv12345@school.edu.vn');
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true as never);
      jest
        .spyOn(require('bcrypt'), 'hash')
        .mockResolvedValue('new_hashed_correct_password' as never);

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
      const syncSpy = jest
        .spyOn(service, 'syncLegacyStudentsAccounts')
        .mockResolvedValue(null as any);
      await service.onModuleInit();
      expect(syncSpy).not.toHaveBeenCalled();
    });

    it('should call sync with preview if config is dry-run', async () => {
      const configService = service['configService'];
      (configService.get as jest.Mock).mockImplementation((k) =>
        k === 'STUDENT_ACCOUNT_STARTUP_SYNC' ? 'dry-run' : null,
      );
      const syncSpy = jest
        .spyOn(service, 'syncLegacyStudentsAccounts')
        .mockResolvedValue(null as any);
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
      const syncSpy = jest
        .spyOn(service, 'syncLegacyStudentsAccounts')
        .mockResolvedValue(null as any);
      await service.onModuleInit();
      expect(syncSpy).toHaveBeenCalledWith('apply');
      process.env.NODE_ENV = origEnv;
    });

    it('should block apply if production and repair not allowed', async () => {
      const configService = service['configService'];
      (configService.get as jest.Mock).mockImplementation((k) =>
        k === 'STUDENT_ACCOUNT_STARTUP_SYNC' ? 'apply' : 'false',
      );
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const syncSpy = jest
        .spyOn(service, 'syncLegacyStudentsAccounts')
        .mockResolvedValue(null as any);
      await service.onModuleInit();
      expect(syncSpy).not.toHaveBeenCalled();
      process.env.NODE_ENV = origEnv;
    });

    it('should return correct summary on preview', async () => {
      const studentModel = service['studentModel'];
      const student = getCloneMockStudent();
      student.user_id = null;
      jest.spyOn(studentModel, 'find').mockReturnValue({
        exec: jest.fn().mockResolvedValue([student]),
      } as any);

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

  describe('Two-step Student Excel Import', () => {
    let mockClass: any;
    let mockSemesters: any[];

    beforeEach(() => {
      mockClass = {
        _id: '507f1f77bcf86cd799439012',
        class_name: 'CNTT1',
      };
      mockSemesters = [
        { _id: 'mock-semester-1', status: 'active' },
        { _id: 'mock-semester-2', status: 'active' },
      ];

      classModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockClass),
      });

      jest.spyOn(service['semesterModel'], 'find').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSemesters),
      } as any);

      jest.spyOn(service['studentModel'], 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      } as any);

      jest.spyOn(service['userModel'], 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      } as any);

      service['importSessions'].clear();
    });

    describe('importPreview', () => {
      it('should block student role from performing preview (ForbiddenException)', async () => {
        const requester = { userId: 'student-id', roleName: 'Student' };
        await expect(
          service.importPreview('507f1f77bcf86cd799439012', [], requester),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should throw NotFoundException if class does not exist', async () => {
        const requester = { userId: 'admin-id', roleName: 'Admin' };
        classModel.findById.mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(null),
        } as any);

        await expect(
          service.importPreview('non-existent-class-id', [], requester),
        ).rejects.toThrow(NotFoundException);
      });

      it('should return valid count, errors, duplicate counts and not write to DB', async () => {
        const requester = { userId: 'admin-id', roleName: 'Admin' };
        const rows = [
          {
            'Mã sinh viên': 'SV001',
            'Họ và tên': 'Student One',
            'Ngày sinh': '2003-01-15',
            'Giới tính': 'Nam',
            Email: 's1@school.edu.vn',
          },
          {
            'Mã sinh viên': 'SV002',
            'Họ và tên': 'Student Two',
            'Ngày sinh': '15/05/2003',
            'Giới tính': 'Nữ',
            Email: 's2@school.edu.vn',
          },
          {
            'Mã sinh viên': 'SV003',
            'Họ và tên': 'Student Three',
            'Ngày sinh': 'invalid-date',
            'Giới tính': 'Nam',
          },
          {
            'Mã sinh viên': 'SV004',
            'Họ và tên': 'Student Four',
            'Ngày sinh': '2003-02-20',
            'Giới tính': 'Nam',
            Email: 'invalid-email',
          },
        ];

        const saveSpy = jest.fn();
        const studentModelSpy = jest
          .spyOn(service, 'studentModel' as any)
          .mockImplementation(() => {
            return {
              save: saveSpy,
            };
          });

        const result = await service.importPreview(
          '507f1f77bcf86cd799439012',
          rows,
          requester,
        );

        expect(result).toBeDefined();
        expect(result.totalRows).toBe(4);
        expect(result.validCount).toBe(2);
        expect(result.errorCount).toBe(2);
        expect(result.errors.length).toBe(2);
        expect(result.sessionId).toBeDefined();

        expect(studentModelSpy).not.toHaveBeenCalled();
        expect(saveSpy).not.toHaveBeenCalled();

        const session = service['importSessions'].get(result.sessionId);
        expect(session).toBeDefined();
        expect(session.validItems.length).toBe(2);
        expect(session.validItems[0].student_code).toBe('SV001');
        expect(session.validItems[0].sex).toBe('Male');
        expect(session.validItems[1].student_code).toBe('SV002');
        expect(session.validItems[1].sex).toBe('Female');
      });

      it('should validate formats (student code normalize, valid email, sex mapping like Nam -> Male, valid date of birth)', async () => {
        const requester = { userId: 'admin-id', roleName: 'Admin' };
        const rows = [
          {
            'Mã SV': '  SV001  ',
            'Họ và tên': 'Student One',
            'Ngày sinh': '2003-01-15',
            'Giới tính': 'Nam',
            Email: 's1@school.edu.vn',
          },
          {
            'Mã SV': 'SV002',
            'Họ và tên': 'Student Two',
            'Ngày sinh': '2003-05-20',
            'Giới tính': 'khác',
            Email: 's2@school.edu.vn',
          },
        ];

        const result = await service.importPreview(
          '507f1f77bcf86cd799439012',
          rows,
          requester,
        );
        expect(result.validCount).toBe(2);

        const session = service['importSessions'].get(result.sessionId);
        expect(session.validItems[0].student_code).toBe('SV001');
        expect(session.validItems[1].sex).toBe('Other');
      });

      it('should catch duplicates inside the Excel list as well as already existing students in DB', async () => {
        const requester = { userId: 'admin-id', roleName: 'Admin' };
        const rows = [
          {
            'Mã sinh viên': 'SV001',
            'Họ và tên': 'Student One',
            'Ngày sinh': '2003-01-15',
            'Giới tính': 'Nam',
          },
          {
            'Mã sinh viên': 'SV001',
            'Họ và tên': 'Student Dupe',
            'Ngày sinh': '2003-01-15',
            'Giới tính': 'Nam',
          },
          {
            'Mã sinh viên': 'SV002',
            'Họ và tên': 'Student Existing',
            'Ngày sinh': '2003-01-15',
            'Giới tính': 'Nam',
          },
        ];

        jest.spyOn(service['studentModel'], 'find').mockReturnValue({
          select: jest.fn().mockReturnThis(),
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([{ student_code: 'SV002' }]),
        } as any);

        const result = await service.importPreview(
          '507f1f77bcf86cd799439012',
          rows,
          requester,
        );
        expect(result.totalRows).toBe(3);
        expect(result.validCount).toBe(1);
        expect(result.errorCount).toBe(2);

        expect(result.errors[0].reason).toContain(
          'bị trùng lặp trong file Excel',
        );
        expect(result.errors[1].reason).toContain('đã tồn tại trong hệ thống');
      });

      it('should support split name columns (Họ đệm + Tên / Ho dem + Ten)', async () => {
        const requester = { userId: 'admin-id', roleName: 'Admin' };
        const rows = [
          {
            'Mã SV': 'SV003',
            'Họ đệm': 'Nguyễn Văn',
            Tên: 'Anh',
            'Ngày sinh': '2004-05-15',
            'Giới tính': 'Nam',
          },
          {
            'Mã SV': 'SV004',
            'Ho dem': 'Lê Thị',
            Ten: 'Bình',
            'Ngày sinh': '2005-11-20',
            'Giới tính': 'Nữ',
          },
        ];

        const result = await service.importPreview(
          '507f1f77bcf86cd799439012',
          rows,
          requester,
        );
        expect(result.validCount).toBe(2);

        const session = service['importSessions'].get(result.sessionId);
        expect(session.validItems[0].full_name).toBe('Nguyễn Văn Anh');
        expect(session.validItems[1].full_name).toBe('Lê Thị Bình');
      });

      it('should normalize headers (leading/trailing space, multiple spaces, capitalization, non-breaking spaces)', async () => {
        const requester = { userId: 'admin-id', roleName: 'Admin' };
        const rows = [
          {
            '  Mã SV\u200B  ': 'SV005',
            'Họ\u00A0đệm': 'Trần',
            '  Tên  ': 'Chi',
            'Ngày sinh': '2004-01-01',
            'Giới tính': 'Nữ',
          },
        ];

        const result = await service.importPreview(
          '507f1f77bcf86cd799439012',
          rows,
          requester,
        );
        expect(result.validCount).toBe(1);

        const session = service['importSessions'].get(result.sessionId);
        expect(session.validItems[0].student_code).toBe('SV005');
        expect(session.validItems[0].full_name).toBe('Trần Chi');
      });

      it('should fail validation if only family name or only given name is present', async () => {
        const requester = { userId: 'admin-id', roleName: 'Admin' };
        const rows = [
          {
            'Mã SV': 'SV006',
            'Họ đệm': 'Nguyễn',
            'Ngày sinh': '2004-01-01',
            'Giới tính': 'Nam',
          },
          {
            'Mã SV': 'SV007',
            Tên: 'Bình',
            'Ngày sinh': '2004-01-01',
            'Giới tính': 'Nam',
          },
        ];

        const result = await service.importPreview(
          '507f1f77bcf86cd799439012',
          rows,
          requester,
        );
        expect(result.validCount).toBe(0);
        expect(result.errorCount).toBe(2);
        expect(result.errors[0].reason).toContain(
          'Họ và tên không được để trống',
        );
        expect(result.errors[1].reason).toContain(
          'Họ và tên không được để trống',
        );
      });

      it('should include resolved fullName in errors array when other fields fail', async () => {
        const requester = { userId: 'admin-id', roleName: 'Admin' };
        const rows = [
          {
            'Mã SV': 'SV008',
            'Họ đệm': 'Phạm Hoàng',
            Tên: 'Dương',
            'Ngày sinh': 'invalid-date',
            'Giới tính': 'Nam',
          },
        ];

        const result = await service.importPreview(
          '507f1f77bcf86cd799439012',
          rows,
          requester,
        );
        expect(result.errorCount).toBe(1);
        expect(result.errors[0].fullName).toBe('Phạm Hoàng Dương');
        expect(result.errors[0].reason).toContain('Ngày sinh không hợp lệ');
      });
    });

    describe('importConfirm', () => {
      it('should block student role from performing confirm (ForbiddenException)', async () => {
        const requester = { userId: 'student-id', roleName: 'Student' };
        await expect(
          service.importConfirm('session-id', requester),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should throw BadRequestException for non-existing, expired, or committed session IDs', async () => {
        const requester = { userId: 'admin-id', roleName: 'Admin' };
        await expect(
          service.importConfirm('non-existent', requester),
        ).rejects.toThrow(BadRequestException);

        service['importSessions'].set('session-committing', {
          id: 'session-committing',
          status: 'committing',
          validItems: [],
        });
        await expect(
          service.importConfirm('session-committing', requester),
        ).rejects.toThrow(BadRequestException);
      });

      it('should verify status updates to committing and processes rows in background', async () => {
        const requester = { userId: 'admin-id', roleName: 'Admin' };
        const sessionId = 'session-123';
        const session = {
          id: sessionId,
          status: 'ready_to_commit',
          classId: '507f1f77bcf86cd799439012',
          validItems: [
            {
              student_code: 'SV001',
              full_name: 'Student One',
              date_bir: new Date('2003-01-15'),
              sex: 'Male',
              status: 'Studying',
            },
          ],
          errors: [],
          totalRows: 1,
          progress: 0,
          processedCount: 0,
          insertedCount: 0,
          duplicatedCount: 0,
          failedCount: 0,
          commitErrors: [],
        };
        service['importSessions'].set(sessionId, session);

        const processSpy = jest
          .spyOn(service as any, 'processStudentImportBatch')
          .mockImplementation(async () => {});

        const result = await service.importConfirm(sessionId, requester);

        expect(result).toEqual({
          success: true,
          message: 'Đã bắt đầu tiến trình import',
        });
        expect(session.status).toBe('committing');
        expect(processSpy).toHaveBeenCalledWith(sessionId, requester);
      });

      it('should verify it creates students, creates linked users with default passwords based on date_bir, and initializes active semester SummaryPoints', async () => {
        const requester = { userId: 'admin-id', roleName: 'Admin' };
        const sessionId = 'session-456';

        const date_bir = new Date('2003-01-15');
        const session = {
          id: sessionId,
          status: 'ready_to_commit',
          classId: '507f1f77bcf86cd799439012',
          validItems: [
            {
              student_code: 'SV001',
              full_name: 'Student One',
              date_bir,
              sex: 'Male',
              status: 'Studying',
              email: 's1@school.edu.vn',
            },
          ],
          errors: [],
          totalRows: 1,
          progress: 0,
          processedCount: 0,
          insertedCount: 0,
          duplicatedCount: 0,
          failedCount: 0,
          commitErrors: [],
        };
        service['importSessions'].set(sessionId, session);

        const savedStudent = {
          _id: 'mock-student-id-999',
          student_code: 'SV001',
          full_name: 'Student One',
          date_bir,
          sex: 'Male',
          status: 'Studying',
          email: 's1@school.edu.vn',
          class_id: new Types.ObjectId('507f1f77bcf86cd799439012'),
        };

        const mockStudentConstructor = jest
          .spyOn(service, 'studentModel' as any)
          .mockImplementation(() => {
            return {
              save: jest.fn().mockResolvedValue(savedStudent),
            };
          });

        const generateUserSpy = jest
          .spyOn(service as any, 'generateStudentUser')
          .mockResolvedValue({ _id: 'mock-user-id' });
        const ensureLinkSpy = jest
          .spyOn(service as any, 'ensureStudentUserLink')
          .mockImplementation(async (student: any, user: any) => {
            student.user_id = user?._id || user;
          });
        const summaryBulkWriteSpy = jest
          .spyOn(service['summaryPointModel'], 'bulkWrite')
          .mockResolvedValue({} as any);

        await service['processStudentImportBatch'](sessionId, requester);

        expect(mockStudentConstructor).toHaveBeenCalled();
        expect(generateUserSpy).toHaveBeenCalledWith(savedStudent, '15012003');
        expect(ensureLinkSpy).toHaveBeenCalledWith(savedStudent, {
          _id: 'mock-user-id',
        });
        expect(summaryBulkWriteSpy).toHaveBeenCalled();

        const bulkOps = summaryBulkWriteSpy.mock.calls[0][0];
        expect(bulkOps.length).toBe(mockSemesters.length);
        expect(bulkOps[0].updateOne.filter.student_id).toBe(savedStudent._id);
        expect(bulkOps[0].updateOne.filter.semester_id).toBe(
          mockSemesters[0]._id,
        );

        expect(session.status).toBe('completed');
        expect(session.progress).toBe(100);
        expect(session.insertedCount).toBe(1);
      });

      it('should test that duplicate key errors (11000) during database commit are caught, counted as duplicates, and do not crash the session', async () => {
        const requester = { userId: 'admin-id', roleName: 'Admin' };
        const sessionId = 'session-789';
        const session = {
          id: sessionId,
          status: 'ready_to_commit',
          classId: '507f1f77bcf86cd799439012',
          validItems: [
            {
              student_code: 'SV001',
              full_name: 'Student One',
              date_bir: new Date('2003-01-15'),
              sex: 'Male',
              status: 'Studying',
            },
          ],
          errors: [],
          totalRows: 1,
          progress: 0,
          processedCount: 0,
          insertedCount: 0,
          duplicatedCount: 0,
          failedCount: 0,
          commitErrors: [],
        };
        service['importSessions'].set(sessionId, session);

        const mongoError = new Error('Duplicate key error');
        (mongoError as any).code = 11000;

        jest.spyOn(service, 'studentModel' as any).mockImplementation(() => {
          return {
            save: jest.fn().mockRejectedValue(mongoError),
          };
        });

        await service['processStudentImportBatch'](sessionId, requester);

        expect(session.status).toBe('completed');
        expect(session.progress).toBe(100);
        expect(session.insertedCount).toBe(0);
        expect(session.duplicatedCount).toBe(1);
        expect(session.failedCount).toBe(1);
        expect(session.commitErrors.length).toBe(1);
        expect(session.commitErrors[0].reason).toContain(
          'Mã sinh viên đã tồn tại trong hệ thống',
        );
      });
    });

    describe('getImportProgress', () => {
      it('should return current progress statistics', () => {
        const sessionId = 'session-progress';
        const session = {
          id: sessionId,
          status: 'completed',
          classId: '507f1f77bcf86cd799439012',
          validItems: [1, 2, 3],
          errors: [{}, {}],
          totalRows: 5,
          progress: 100,
          processedCount: 5,
          insertedCount: 3,
          duplicatedCount: 2,
          failedCount: 2,
          commitErrors: [{ studentCode: 'SV002', reason: 'Dupe' }],
        };
        service['importSessions'].set(sessionId, session);

        const result = service.getImportProgress(sessionId);

        expect(result).toEqual({
          status: 'completed',
          progress: 100,
          processedCount: 5,
          insertedCount: 3,
          duplicatedCount: 2,
          totalRows: 5,
          failedItems: [{ studentCode: 'SV002', reason: 'Dupe' }],
          acceptedCount: 3,
          failedCount: 2,
          skippedCount: 2,
        });
      });

      it('should throw NotFoundException for non-existent session', () => {
        expect(() => service.getImportProgress('non-existent')).toThrow(
          NotFoundException,
        );
      });
    });
  });
});
