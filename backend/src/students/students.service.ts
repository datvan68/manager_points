import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Student, StudentDocument } from './schemas/student.schema';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Semester } from '../semesters/schemas/semester.schema';
import { SummaryPoint } from '../summaries-point/schemas/summary-point.schema';
import { User, UserDocument, UserStatus } from '../auth/schemas/user.schema';
import { Role, RoleDocument } from '../auth/schemas/role.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class StudentsService implements OnModuleInit {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Semester.name) private semesterModel: Model<any>,
    @InjectModel(SummaryPoint.name) private summaryPointModel: Model<any>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
  ) { }

  //onModuleInit: xử lý các tác vụ tự động khi khởi động module
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

    // Drop unique index 'user_name_1' on users collection to allow identical student names
    try {
      const collection = this.userModel.collection;
      const indexes = await collection.indexes();
      const hasObsoleteUserIndex = indexes.some(idx => idx.name === 'user_name_1');
      if (hasObsoleteUserIndex) {
        await collection.dropIndex('user_name_1');
        this.logger.warn('Dropped unique index "user_name_1" on users collection.');
      }
    } catch (error) {
      this.logger.error('Failed to drop index "user_name_1":', error);
    }

    // Tự động đồng bộ tài khoản cho các sinh viên cũ chưa có tài khoản User
    try {
      await this.syncLegacyStudentsAccounts();
    } catch (syncErr) {
      this.logger.error('Lỗi khi tự động đồng bộ tài khoản cho sinh viên cũ:', syncErr);
    }
  }

  private async syncLegacyStudentsAccounts() {
    const students = await this.studentModel.find().exec();
    if (students.length === 0) return;

    const studentEmails = students.map(s => (s.email || `${s.student_code}@school.edu.vn`).toLowerCase());
    const existingUsers = await this.userModel.find({ email: { $in: studentEmails } }).exec();
    const existingEmails = new Set(existingUsers.map(u => u.email));

    // Tự động di chuyển dữ liệu cũ: Cập nhật user_name từ Mã SV sang Họ và tên
    const legacyCodeUsers = existingUsers.filter(u => /^\d+$/.test(u.user_name));
    if (legacyCodeUsers.length > 0) {
      this.logger.log(`Phát hiện ${legacyCodeUsers.length} tài khoản cũ có user_name là Mã sinh viên. Bắt đầu tự động cập nhật sang Họ và tên...`);
      for (const u of legacyCodeUsers) {
        const student = students.find(s => (s.email || `${s.student_code}@school.edu.vn`).toLowerCase() === u.email);
        if (student) {
          u.user_name = student.full_name;
          await u.save();
        }
      }
      this.logger.log(`Đã cập nhật thành công Họ và tên cho ${legacyCodeUsers.length} tài khoản sinh viên cũ.`);
    }

    const legacyStudents = students.filter(s => !existingEmails.has((s.email || `${s.student_code}@school.edu.vn`).toLowerCase()));
    if (legacyStudents.length === 0) return;

    this.logger.log(`Phát hiện ${legacyStudents.length} sinh viên cũ chưa có tài khoản User. Bắt đầu tự động đồng bộ tài khoản...`);

    let successCount = 0;
    for (const student of legacyStudents) {
      try {
        const dob = new Date(student.date_bir);
        const day = String(dob.getDate()).padStart(2, '0');
        const month = String(dob.getMonth() + 1).padStart(2, '0');
        const year = dob.getFullYear();
        const plainPassword = `${day}${month}${year}`;

        await this.generateStudentUser(student, plainPassword);
        successCount++;
      } catch (err) {
        this.logger.error(`Không thể tự động tạo tài khoản cho sinh viên cũ ${student.full_name} (${student.student_code}):`, err);
      }
    }

    if (successCount > 0) {
      this.logger.log(`Đã tự động đồng bộ thành công tài khoản cho ${successCount}/${legacyStudents.length} sinh viên cũ.`);
    }
  }

  //tự động tạo tài khoản sinh viên
  private async generateStudentUser(student: any, plainPasswordDob: string) {
    const defaultRole = await this.roleModel.findOne({ name: 'Student' });
    const pw_hash = await bcrypt.hash(plainPasswordDob, 12);
    const studentEmail = student.email || `${student.student_code}@school.edu.vn`;

    const existingUser = await this.userModel.findOne({ email: studentEmail.toLowerCase() });
    if (!existingUser) {
      await this.userModel.create({
        user_name: student.full_name,
        email: studentEmail.toLowerCase(),
        pw_hash,
        status: UserStatus.INACTIVE,
        role: defaultRole?._id,
        date_birth: student.date_bir,
      });
      this.logger.log(`Tự động cấp tài khoản đăng nhập (Chưa active) cho sinh viên: ${student.full_name} (Mã: ${student.student_code})`);
    }
  }

  async create(createStudentDto: CreateStudentDto): Promise<Student> {
    try {
      const createdStudent = await new this.studentModel(createStudentDto).save();

      // Tự động cấp tài khoản đăng nhập (Chưa active) dựa trên mã sinh viên và ngày sinh
      try {
        const dob = new Date(createdStudent.date_bir);
        const day = String(dob.getDate()).padStart(2, '0');
        const month = String(dob.getMonth() + 1).padStart(2, '0');
        const year = dob.getFullYear();
        const plainPassword = `${day}${month}${year}`;

        await this.generateStudentUser(createdStudent, plainPassword);
      } catch (userErr) {
        this.logger.error('Lỗi khi tự động khởi tạo tài khoản đăng nhập cho sinh viên mới:', userErr);
      }

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
  //bulk import
  async createBulk(createStudentDtos: CreateStudentDto[]) {
    try {
      const createdStudents = await this.studentModel.insertMany(createStudentDtos);

      // Tự động cấp tài khoản đăng nhập (Chưa active) hàng loạt
      try {
        for (const student of createdStudents) {
          const dob = new Date(student.date_bir);
          const day = String(dob.getDate()).padStart(2, '0');
          const month = String(dob.getMonth() + 1).padStart(2, '0');
          const year = dob.getFullYear();
          const plainPassword = `${day}${month}${year}`;

          await this.generateStudentUser(student, plainPassword);
        }
      } catch (userErr) {
        this.logger.error('Lỗi khi tự động khởi tạo tài khoản đăng nhập hàng loạt cho sinh viên mới:', userErr);
      }

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
  //check trùng lặp
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

  async findAll(): Promise<any[]> {
    const students = await this.studentModel.find()
      .populate({
        path: 'class_id',
        populate: { path: 'dept_id', select: 'name code' }
      })
      .populate('training_point_id')
      .exec();

    const studentEmails = students.map(s => (s.email || `${s.student_code}@school.edu.vn`).toLowerCase());
    const users = await this.userModel.find({ email: { $in: studentEmails } }).select('email status').exec();
    const userStatusMap = new Map(users.map(u => [u.email, u.status]));

    return students.map(student => {
      const studentObj = student.toObject();
      const emailKey = (student.email || `${student.student_code}@school.edu.vn`).toLowerCase();
      (studentObj as any).account_status = userStatusMap.get(emailKey) || 'inactive';
      return studentObj;
    });
  }

  async findOne(id: string): Promise<any> {
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

    const studentEmail = (student.email || `${student.student_code}@school.edu.vn`).toLowerCase();
    const user = await this.userModel.findOne({ email: studentEmail }).select('status').exec();
    const studentObj = student.toObject();
    (studentObj as any).account_status = user?.status || 'inactive';
    return studentObj;
  }

  async findByStudentCode(student_code: string): Promise<any> {
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
    const studentEmail = (student.email || `${student.student_code}@school.edu.vn`).toLowerCase();
    const user = await this.userModel.findOne({ email: studentEmail }).select('status').exec();
    const studentObj = student.toObject();
    (studentObj as any).account_status = user?.status || 'inactive';
    return studentObj;
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
    const student = await this.studentModel.findById(id).exec();
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    const deletedStudent = await this.studentModel.findByIdAndDelete(id).exec();

    // Tự động xóa tài khoản User liên kết tương ứng
    try {
      const studentEmail = (student.email || `${student.student_code}@school.edu.vn`).toLowerCase();
      const userDelResult = await this.userModel.deleteOne({ email: studentEmail });
      if (userDelResult.deletedCount > 0) {
        this.logger.log(`Tự động xóa tài khoản User liên kết cho sinh viên đã xóa: ${student.full_name} (${student.student_code})`);
      }
    } catch (userErr) {
      this.logger.error(`Lỗi khi tự động xóa tài khoản User cho sinh viên đã bị xóa: ${student.full_name}`, userErr);
    }

    return student as any;
  }
}
