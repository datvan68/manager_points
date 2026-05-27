import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Student, StudentDocument } from './schemas/student.schema';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Semester } from '../semesters/schemas/semester.schema';
import { SummaryPoint } from '../summaries-point/schemas/summary-point.schema';

@Injectable()
export class StudentsService implements OnModuleInit {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Semester.name) private semesterModel: Model<any>,
    @InjectModel(SummaryPoint.name) private summaryPointModel: Model<any>,
  ) {}

  async onModuleInit() {
    // Drop obsolete unique index 'studentId_1' left over from old schema
    try {
      const collection = this.studentModel.collection;
      const indexes = await collection.indexes();
      const hasObsoleteIndex = indexes.some(idx => idx.name === 'studentId_1');
      if (hasObsoleteIndex) {
        await collection.dropIndex('studentId_1');
        this.logger.warn('Dropped obsolete unique index "studentId_1" on students collection.');
      }
    } catch (error) {
      this.logger.error('Failed to drop obsolete index "studentId_1":', error);
    }
  }

  async create(createStudentDto: CreateStudentDto): Promise<Student> {
    try {
      const createdStudent = await new this.studentModel(createStudentDto).save();

      // Tự động tạo điểm rèn luyện tổng kết (summary point) mặc định cho tất cả học kỳ
      try {
        let semesters = await this.semesterModel.find({ status: 'active' }).exec();
        if (semesters.length === 0) {
          semesters = await this.semesterModel.find().exec();
        }

        const summariesToCreate = semesters.map(sem => ({
          student_id: (createdStudent as any)._id,
          semester_id: sem._id,
          total_score: 0,
          grading: 'chưa xếp loại',
          status: 'active'
        }));

        if (summariesToCreate.length > 0) {
          await this.summaryPointModel.insertMany(summariesToCreate);
          this.logger.log(`Tự động khởi tạo ${summariesToCreate.length} bảng điểm 0đ cho sinh viên mới: ${createStudentDto.full_name}`);
        }
      } catch (sumErr) {
        this.logger.error('Lỗi khi tự động khởi tạo summaries points cho sinh viên mới:', sumErr);
      }

      return createdStudent;
    } catch (error: any) {
      if (error.code === 11000) {
        const duplicateField = Object.keys(error.keyPattern || {})[0];
        if (duplicateField === 'student_code') {
          throw new ConflictException(`Mã sinh viên "${createStudentDto.student_code}" đã tồn tại trong hệ thống`);
        }
        throw new ConflictException(`Dữ liệu bị trùng lặp: ${duplicateField}`);
      }
      throw error;
    }
  }

  async createBulk(createStudentDtos: CreateStudentDto[]) {
    try {
      const createdStudents = await this.studentModel.insertMany(createStudentDtos);

      // Tự động tạo điểm rèn luyện tổng kết (summary point) mặc định cho tất cả học kỳ
      try {
        let semesters = await this.semesterModel.find({ status: 'active' }).exec();
        if (semesters.length === 0) {
          semesters = await this.semesterModel.find().exec();
        }

        const summariesToCreate: any[] = [];
        createdStudents.forEach(student => {
          semesters.forEach(sem => {
            summariesToCreate.push({
              student_id: (student as any)._id,
              semester_id: sem._id,
              total_score: 0,
              grading: 'chưa xếp loại',
              status: 'active'
            });
          });
        });

        if (summariesToCreate.length > 0) {
          await this.summaryPointModel.insertMany(summariesToCreate);
          this.logger.log(`Tự động khởi tạo ${summariesToCreate.length} bảng điểm 0đ cho ${createdStudents.length} sinh viên mới trong bulk import.`);
        }
      } catch (sumErr) {
        this.logger.error('Lỗi khi tự động khởi tạo summaries points cho danh sách sinh viên bulk import:', sumErr);
      }

      return createdStudents;
    } catch (error: any) {
      if (error.code === 11000) {
        // MongoBulkWriteError chứa writeErrors là mảng các lỗi ghi
        const writeError = error.writeErrors?.[0]?.err;
        const dupKeyVal = writeError?.op?.student_code || 'không xác định';
        const dupName = writeError?.op?.full_name || 'không xác định';

        throw new ConflictException(
          `Mã sinh viên "${dupKeyVal}" (của sinh viên "${dupName}") đã tồn tại trong hệ thống. Vui lòng kiểm tra lại file Excel.`
        );
      }
      throw error;
    }
  }

  async checkDuplicate(studentCodes: string[]): Promise<{ student_code: string; full_name: string }[]> {
    const existing = await this.studentModel
      .find({ student_code: { $in: studentCodes } })
      .select('student_code full_name')
      .exec();
    return existing.map(student => ({
      student_code: student.student_code,
      full_name: student.full_name
    }));
  }

  async findAll(): Promise<Student[]> {
    return this.studentModel.find()
      .populate({
        path: 'class_id',
        populate: { path: 'dept_id', select: 'name code' }
      })
      .populate('training_point_id')
      .exec();
  }

  async findOne(id: string): Promise<Student> {
    const student = await this.studentModel.findById(id)
      .populate({
          path: 'class_id',
          populate: { path: 'dept_id', select: 'name code' }
      })
      .populate('training_point_id')
      .exec();
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    return student;
  }

  async findByStudentCode(student_code: string): Promise<Student> {
    const student = await this.studentModel.findOne({ student_code })
      .populate({
          path: 'class_id',
          populate: { path: 'dept_id', select: 'name code' }
      })
      .populate('training_point_id')
      .exec();
    if (!student) {
      throw new NotFoundException(`Student with student_code ${student_code} not found`);
    }
    return student;
  }

  async update(id: string, updateStudentDto: UpdateStudentDto): Promise<Student> {
    try {
      const updatedStudent = await this.studentModel
        .findByIdAndUpdate(id, updateStudentDto, { returnDocument: 'after' })
        .exec();
        
      if (!updatedStudent) {
        throw new NotFoundException(`Student with ID ${id} not found`);
      }
      return updatedStudent;
    } catch (error: any) {
      if (error.code === 11000) {
        const duplicateField = Object.keys(error.keyPattern || {})[0];
        if (duplicateField === 'student_code') {
          throw new ConflictException(`Mã sinh viên "${updateStudentDto.student_code}" đã tồn tại trong hệ thống. Vui lòng nhập mã khác!`);
        }
        throw new ConflictException(`Dữ liệu bị trùng lặp ở trường: ${duplicateField}`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<Student> {
    const deletedStudent = await this.studentModel.findByIdAndDelete(id).exec();
    if (!deletedStudent) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    return deletedStudent;
  }
}
