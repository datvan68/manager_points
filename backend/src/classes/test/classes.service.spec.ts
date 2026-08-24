import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ClassesService } from '../classes.service';
import { Class } from '../schemas/class.schema';
import { Student } from '../../students/schemas/student.schema';
import { User } from '../../auth/schemas/user.schema';
import * as xlsx from 'xlsx';

jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
}));

const mockClass = {
  _id: '507f1f77bcf86cd799439011',
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
                session: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockClass),
              }),
              countDocuments: jest.fn().mockResolvedValue(0),
              findOne: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
                populate: jest.fn().mockReturnThis(),
              }),
              db: {
                startSession: jest.fn().mockResolvedValue({
                  withTransaction: jest.fn(async (work: () => Promise<unknown>) => work()),
                  endSession: jest.fn().mockResolvedValue(undefined),
                }),
                model: jest.fn().mockReturnValue({
                  find: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnThis(),
                    lean: jest.fn().mockReturnThis(),
                    exec: jest.fn().mockResolvedValue([]),
                  }),
                  deleteMany: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
                  }),
                  updateMany: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
                  }),
                  countDocuments: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue(0),
                  }),
                  findOne: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue(null),
                  }),
                }),
              },
            },
          ),
        },
        {
          provide: getModelToken(Student.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              session: jest.fn().mockReturnThis(),
              lean: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            }),
            deleteMany: jest.fn().mockReturnValue({
              session: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue({}),
            }),
          },
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            deleteMany: jest.fn().mockReturnValue({
              session: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue({}),
            }),
          },
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
      expect((result[0] as any)._id).toEqual(mockClass._id);
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

      await expect(
        service.update('mock-class-id', { class_name: 'Class A Updated' }),
      ).rejects.toThrow(ConflictException);
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

    it('keeps the class when a dependent purge fails so a retry can finish', async () => {
      const studentId = '507f1f77bcf86cd799439012';
      const userId = '507f1f77bcf86cd799439013';
      const deleteClass = model.findByIdAndDelete;
      (service as any).studentModel.find.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: studentId, user_id: userId }]),
      });
      (service as any).userModel.deleteMany.mockReturnValueOnce({
        exec: jest.fn().mockRejectedValue(new Error('purge failed')),
      });

      await expect(service.remove(mockClass._id)).rejects.toThrow('purge failed');
      expect(deleteClass).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException on remove if class not found', async () => {
      model.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.remove('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('previewImport', () => {
    it('should correctly preview valid data', async () => {
      const mockFile = { buffer: Buffer.from('') } as any;
      (xlsx.read as jest.Mock).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      });
      (xlsx.utils.sheet_to_json as jest.Mock).mockReturnValue([
        {
          class_name: 'Class B',
          class_year: '2023',
          department_code: 'IT',
          advisor_email: 'gv1@example.com',
          class_course: 'Đại học',
        },
      ]);

      const dbModelMock = model.db.model as jest.Mock;
      dbModelMock.mockImplementation((name: string) => {
        if (name === 'Department')
          return {
            find: () => ({
              exec: jest
                .fn()
                .mockResolvedValue([{ code: 'IT', _id: 'dept-id' }]),
            }),
          };
        if (name === 'User')
          return {
            find: () => ({
              exec: jest
                .fn()
                .mockResolvedValue([
                  { email: 'gv1@example.com', _id: 'user-id' },
                ]),
            }),
          };
        return { find: () => ({ exec: jest.fn().mockResolvedValue([]) }) };
      });
      model.find.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });

      const result = await service.previewImport(mockFile);
      expect(result.validRows).toBe(1);
      expect(result.invalidRows).toBe(0);
      expect(result.rows[0].status).toBe('valid');
    });

    it('should flag duplicate class in file', async () => {
      const mockFile = { buffer: Buffer.from('') } as any;
      (xlsx.read as jest.Mock).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      });
      (xlsx.utils.sheet_to_json as jest.Mock).mockReturnValue([
        { class_name: 'Class B', class_year: '2023', department_code: 'IT' },
        { class_name: 'Class B', class_year: '2023', department_code: 'IT' },
      ]);

      const dbModelMock = model.db.model as jest.Mock;
      dbModelMock.mockImplementation(() => ({
        find: () => ({ exec: jest.fn().mockResolvedValue([]) }),
      }));
      model.find.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });

      const result = await service.previewImport(mockFile);
      expect(result.rows[1].status).toBe('duplicate_in_file');
    });
  });

  describe('confirmImport', () => {
    it('should successfully import valid rows', async () => {
      const dbModelMock = model.db.model as jest.Mock;
      dbModelMock.mockImplementation((name: string) => {
        if (name === 'Department')
          return {
            find: () => ({
              exec: jest
                .fn()
                .mockResolvedValue([{ code: 'IT', _id: 'dept-id' }]),
            }),
          };
        if (name === 'User')
          return { find: () => ({ exec: jest.fn().mockResolvedValue([]) }) };
        return { find: () => ({ exec: jest.fn().mockResolvedValue([]) }) };
      });

      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const dto = {
        rows: [
          { class_name: 'Class B', class_year: '2023', department_code: 'IT' },
        ],
        mode: 'skip_duplicates' as const,
      };

      const result = await service.confirmImport(dto);
      expect(result.success).toBe(1);
    });

    it('should throw BadRequestException if mode is fail_on_duplicates and duplicates exist', async () => {
      model.countDocuments.mockResolvedValueOnce(1);
      const dto = {
        rows: [
          { class_name: 'Class B', class_year: '2023', department_code: 'IT' },
        ],
        mode: 'fail_on_duplicates' as const,
      };

      await expect(service.confirmImport(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
