import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Student, StudentDocument } from './schemas/student.schema';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Semester } from '../semesters/schemas/semester.schema';
import { SummaryPoint } from '../summaries-point/schemas/summary-point.schema';
import { User, UserDocument, UserStatus } from '../auth/schemas/user.schema';
import { Role, RoleDocument } from '../auth/schemas/role.schema';
import { Class, ClassDocument } from '../classes/schemas/class.schema';
import { getRequesterRoleName, isStudent, isTeacher, isSupervisor, isAdmin } from '../auth/utils/role.util';

@Injectable()
export class StudentsService implements OnModuleInit {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Semester.name) private semesterModel: Model<any>,
    @InjectModel(SummaryPoint.name) private summaryPointModel: Model<any>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(Class.name) private classModel: Model<ClassDocument>,
  ) {}

  async onModuleInit() {
    try {
      const collection = this.studentModel.collection;
      const indexes = await collection.indexes();
      const hasObsoleteIndex = indexes.some(
        (idx) => idx.name === 'studentId_1',
      );
      if (hasObsoleteIndex) {
        await collection.dropIndex('studentId_1');
        this.logger.warn(
          'Dropped obsolete unique index "studentId_1" on students collection.',
        );
      }
    } catch (error) {
      this.logger.error('Failed to drop obsolete index "studentId_1":', error);
    }

    try {
      const collection = this.userModel.collection;
      const indexes = await collection.indexes();
      const hasObsoleteUserIndex = indexes.some(
        (idx) => idx.name === 'user_name_1',
      );
      if (hasObsoleteUserIndex) {
        await collection.dropIndex('user_name_1');
        this.logger.warn(
          'Dropped unique index "user_name_1" on users collection.',
        );
      }
    } catch (error) {
      this.logger.error('Failed to drop index "user_name_1":', error);
    }

    try {
      await this.syncLegacyStudentsAccounts();
    } catch (syncErr) {
      this.logger.error(
        'Failed to sync legacy student accounts automatically:',
        syncErr,
      );
    }

    try {
      await this.backfillStudentUserIds();
    } catch (syncErr) {
      this.logger.error('Failed to backfill student user_id links:', syncErr);
    }
  }

  private normalizeStudentUserId(userId?: string | Types.ObjectId | null) {
    if (!userId) return undefined;
    if (userId instanceof Types.ObjectId) return userId;
    if (!Types.ObjectId.isValid(userId)) return undefined;
    return new Types.ObjectId(userId);
  }

  private isTeacher(requester?: any) {
    return isTeacher(requester);
  }

  private async getTeacherClassIds(requester?: any) {
    if (!this.isTeacher(requester) || !requester?.userId) return null;

    const classes = await this.classModel
      .find({ advisor_id: requester.userId })
      .select('_id')
      .lean()
      .exec();

    return classes.map((cls) => cls._id);
  }

  private getStudentEmail(student: {
    email?: string;
    student_code: string;
  }): string {
    return (student.email || `${student.student_code}@school.edu.vn`).toLowerCase();
  }

  private getLinkedUserId(student: any): string {
    if (!student?.user_id) return '';
    if (typeof student.user_id === 'object') {
      return (
        student.user_id?._id?.toString?.() ||
        student.user_id?.id?.toString?.() ||
        ''
      );
    }
    return student.user_id.toString();
  }

  private async ensureStudentUserLink(student: any, fallbackUser?: any) {
    const normalizedDtoUserId = this.normalizeStudentUserId(student?.user_id);
    const linkedUserId = normalizedDtoUserId || fallbackUser?._id || fallbackUser;
    if (!linkedUserId) return;

    if (this.getLinkedUserId(student) === linkedUserId.toString()) {
      return;
    }

    await this.studentModel.updateOne(
      { _id: student._id },
      { $set: { user_id: linkedUserId } },
    );
    student.user_id = linkedUserId;
  }

  private async getAccountStatusMap(students: any[]) {
    const linkedUserIds = students
      .map((student) => this.getLinkedUserId(student))
      .filter(Boolean)
      .map((id) => new Types.ObjectId(id));

    const fallbackEmails = students
      .filter((student) => !this.getLinkedUserId(student))
      .map((student) => this.getStudentEmail(student));

    const [usersById, usersByEmail] = await Promise.all([
      linkedUserIds.length > 0
        ? this.userModel
            .find({ _id: { $in: linkedUserIds } })
            .select('_id status')
            .exec()
        : Promise.resolve([] as any[]),
      fallbackEmails.length > 0
        ? this.userModel
            .find({ email: { $in: fallbackEmails } })
            .select('email status')
            .exec()
        : Promise.resolve([] as any[]),
    ]);

    return {
      byId: new Map(
        usersById.map((user) => [user._id.toString(), user.status]),
      ),
      byEmail: new Map(
        usersByEmail.map((user) => [user.email.toLowerCase(), user.status]),
      ),
    };
  }

  private async attachAccountStatus(student: any, accountStatusMap?: any) {
    const statusMap =
      accountStatusMap || (await this.getAccountStatusMap([student]));
    const studentObj = typeof student.toObject === 'function' ? student.toObject() : student;
    const linkedUserId = this.getLinkedUserId(studentObj);
    const emailKey = this.getStudentEmail(studentObj);

    (studentObj as any).account_status =
      statusMap.byId.get(linkedUserId) ||
      statusMap.byEmail.get(emailKey) ||
      'inactive';

    return studentObj;
  }

  private async backfillStudentUserIds() {
    const students = await this.studentModel
      .find({
        $or: [{ user_id: { $exists: false } }, { user_id: null }],
      })
      .select('_id email student_code')
      .exec();
    if (students.length === 0) return;

    const studentEmails = students.map((student) => this.getStudentEmail(student));
    const users = await this.userModel
      .find({ email: { $in: studentEmails } })
      .select('_id email')
      .exec();
    if (users.length === 0) return;

    const userByEmail = new Map(
      users.map((user) => [user.email.toLowerCase(), user._id]),
    );
    const bulkOps = students
      .map((student) => {
        const linkedUserId = userByEmail.get(this.getStudentEmail(student));
        if (!linkedUserId) return null;

        return {
          updateOne: {
            filter: {
              _id: student._id,
              $or: [{ user_id: null }, { user_id: { $exists: false } }],
            },
            update: { $set: { user_id: linkedUserId } },
          },
        };
      })
      .filter(Boolean) as any[];

    if (bulkOps.length === 0) return;

    const result = await this.studentModel.bulkWrite(bulkOps, {
      ordered: false,
    });
    if ((result.modifiedCount || 0) > 0) {
      this.logger.log(
        `Backfilled user_id for ${result.modifiedCount} students.`,
      );
    }
  }

  private async syncLegacyStudentsAccounts() {
    const students = await this.studentModel.find().exec();
    if (students.length === 0) return;

    const studentEmails = students.map((student) => this.getStudentEmail(student));
    const existingUsers = await this.userModel
      .find({ email: { $in: studentEmails } })
      .exec();
    const existingEmails = new Set(existingUsers.map((user) => user.email));

    const legacyCodeUsers = existingUsers.filter((user) =>
      /^\d+$/.test(user.user_name),
    );
    if (legacyCodeUsers.length > 0) {
      this.logger.log(
        `Detected ${legacyCodeUsers.length} legacy student accounts with code-based usernames.`,
      );
      for (const user of legacyCodeUsers) {
        const student = students.find(
          (candidate) => this.getStudentEmail(candidate) === user.email,
        );
        if (student) {
          user.user_name = student.full_name;
          await user.save();
        }
      }
    }

    const legacyStudents = students.filter(
      (student) => !existingEmails.has(this.getStudentEmail(student)),
    );
    if (legacyStudents.length === 0) return;

    this.logger.log(
      `Detected ${legacyStudents.length} legacy students without user accounts.`,
    );

    let successCount = 0;
    for (const student of legacyStudents) {
      try {
        const dob = new Date(student.date_bir);
        const day = String(dob.getDate()).padStart(2, '0');
        const month = String(dob.getMonth() + 1).padStart(2, '0');
        const year = dob.getFullYear();
        const plainPassword = `${day}${month}${year}`;

        const linkedUser = await this.generateStudentUser(student, plainPassword);
        await this.ensureStudentUserLink(student, linkedUser);
        successCount++;
      } catch (error) {
        this.logger.error(
          `Failed to auto-create user for student ${student.full_name} (${student.student_code}):`,
          error,
        );
      }
    }

    if (successCount > 0) {
      this.logger.log(
        `Synced ${successCount}/${legacyStudents.length} legacy student accounts successfully.`,
      );
    }
  }

  private async generateStudentUser(student: any, plainPasswordDob: string) {
    const defaultRole = await this.roleModel.findOne({ name: 'Student' });
    const pw_hash = await bcrypt.hash(plainPasswordDob, 12);
    const studentEmail = this.getStudentEmail(student);

    const existingUser = await this.userModel.findOne({
      email: studentEmail,
    });
    if (existingUser) {
      return existingUser;
    }

    const createdUser = await this.userModel.create({
      user_name: student.full_name,
      email: studentEmail,
      pw_hash,
      status: UserStatus.INACTIVE,
      role: defaultRole?._id,
      date_birth: student.date_bir,
    });
    this.logger.log(
      `Auto-created login account for student ${student.full_name} (${student.student_code}).`,
    );

    return createdUser;
  }

  async create(createStudentDto: CreateStudentDto, requester?: any): Promise<Student> {
    if (requester && isStudent(requester)) {
      throw new ForbiddenException('Bạn không có quyền tạo hồ sơ sinh viên.');
    }
    try {
      const payload = {
        ...createStudentDto,
        ...(Object.prototype.hasOwnProperty.call(createStudentDto, 'user_id')
          ? { user_id: this.normalizeStudentUserId(createStudentDto.user_id) }
          : {}),
      };
      const createdStudent = await new this.studentModel(payload).save();

      try {
        const dob = new Date(createdStudent.date_bir);
        const day = String(dob.getDate()).padStart(2, '0');
        const month = String(dob.getMonth() + 1).padStart(2, '0');
        const year = dob.getFullYear();
        const plainPassword = `${day}${month}${year}`;

        const linkedUser = await this.generateStudentUser(
          createdStudent,
          plainPassword,
        );
        await this.ensureStudentUserLink(createdStudent, linkedUser);
      } catch (userErr) {
        this.logger.error(
          'Failed to auto-create login account for new student:',
          userErr,
        );
      }

      try {
        let semesters = await this.semesterModel
          .find({ status: 'active' })
          .exec();
        if (semesters.length === 0) {
          semesters = await this.semesterModel.find().exec();
        }

        const summariesToCreate = semesters.map((sem) => ({
          student_id: (createdStudent as any)._id,
          semester_id: sem._id,
          total_score: 0,
          grading: 'chưa xếp loại',
          status: 'draft',
        }));

        if (summariesToCreate.length > 0) {
          await this.summaryPointModel.insertMany(summariesToCreate);
          this.logger.log(
            `Auto-created ${summariesToCreate.length} summary point rows for ${createStudentDto.full_name}.`,
          );
        }
      } catch (sumErr) {
        this.logger.error(
          'Failed to auto-create summary points for new student:',
          sumErr,
        );
      }

      return (await this.findOne((createdStudent as any)._id.toString())) as any;
    } catch (error: any) {
      if (error.code === 11000) {
        const duplicateField = Object.keys(error.keyPattern || {})[0];
        if (duplicateField === 'student_code') {
          throw new ConflictException(
            `Mã sinh viên "${createStudentDto.student_code}" đã tồn tại trong hệ thống`,
          );
        }
        if (duplicateField === 'user_id') {
          throw new ConflictException(
            'Tài khoản này đã được liên kết với sinh viên khác.',
          );
        }
        throw new ConflictException(`Dữ liệu bị trùng lặp: ${duplicateField}`);
      }
      throw error;
    }
  }

  async createBulk(createStudentDtos: CreateStudentDto[], requester?: any) {
    if (requester && isStudent(requester)) {
      throw new ForbiddenException('Bạn không có quyền import hồ sơ sinh viên.');
    }
    try {
      const payloads = createStudentDtos.map((dto) => ({
        ...dto,
        ...(Object.prototype.hasOwnProperty.call(dto, 'user_id')
          ? { user_id: this.normalizeStudentUserId(dto.user_id) }
          : {}),
      }));
      const createdStudents = await this.studentModel.insertMany(payloads);

      try {
        for (const student of createdStudents) {
          const dob = new Date(student.date_bir);
          const day = String(dob.getDate()).padStart(2, '0');
          const month = String(dob.getMonth() + 1).padStart(2, '0');
          const year = dob.getFullYear();
          const plainPassword = `${day}${month}${year}`;

          const linkedUser = await this.generateStudentUser(student, plainPassword);
          await this.ensureStudentUserLink(student, linkedUser);
        }
      } catch (userErr) {
        this.logger.error(
          'Failed to auto-create login accounts for bulk imported students:',
          userErr,
        );
      }

      try {
        let semesters = await this.semesterModel
          .find({ status: 'active' })
          .exec();
        if (semesters.length === 0) {
          semesters = await this.semesterModel.find().exec();
        }

        const summariesToCreate: any[] = [];
        createdStudents.forEach((student) => {
          semesters.forEach((sem) => {
            summariesToCreate.push({
              student_id: (student as any)._id,
              semester_id: sem._id,
              total_score: 0,
              grading: 'chưa xếp loại',
              status: 'draft',
            });
          });
        });

        if (summariesToCreate.length > 0) {
          await this.summaryPointModel.insertMany(summariesToCreate);
          this.logger.log(
            `Auto-created ${summariesToCreate.length} summary point rows for bulk import.`,
          );
        }
      } catch (sumErr) {
        this.logger.error(
          'Failed to auto-create summary points for bulk imported students:',
          sumErr,
        );
      }

      const ids = createdStudents.map((student) => student._id);
      return this.studentModel
        .find({ _id: { $in: ids } })
        .populate({
          path: 'class_id',
          populate: { path: 'dept_id', select: 'name code' },
        })
        .populate('training_point_id')
        .populate('user_id', 'user_name email status role')
        .exec();
    } catch (error: any) {
      if (error.code === 11000) {
        const writeError = error.writeErrors?.[0]?.err;
        const duplicateField =
          Object.keys(writeError?.keyPattern || error.keyPattern || {})[0];
        if (duplicateField === 'user_id') {
          throw new ConflictException(
            'Có tài khoản đã được liên kết với sinh viên khác trong danh sách import.',
          );
        }

        const dupKeyVal = writeError?.op?.student_code || 'không xác định';
        const dupName = writeError?.op?.full_name || 'không xác định';

        throw new ConflictException(
          `Mã sinh viên "${dupKeyVal}" (của sinh viên "${dupName}") đã tồn tại trong hệ thống. Vui lòng kiểm tra lại file Excel.`,
        );
      }
      throw error;
    }
  }

  async checkDuplicate(
    studentCodes: string[],
    requester?: any,
  ): Promise<{ student_code: string; full_name: string }[]> {
    if (requester && isStudent(requester)) {
      throw new ForbiddenException('Bạn không có quyền kiểm tra trùng lặp sinh viên.');
    }
    const existing = await this.studentModel
      .find({ student_code: { $in: studentCodes } })
      .select('student_code full_name')
      .exec();
    return existing.map((student) => ({
      student_code: student.student_code,
      full_name: student.full_name,
    }));
  }

  async findAll(requester?: any): Promise<any[]> {
    const isRequesterStudent = isStudent(requester);

    if (isRequesterStudent) {
      if (!requester?.userId || !Types.ObjectId.isValid(requester.userId)) {
        return [];
      }
      const student = await this.studentModel
        .findOne({ user_id: new Types.ObjectId(requester.userId) })
        .populate({
          path: 'class_id',
          populate: { path: 'dept_id', select: 'name code' },
        })
        .populate('training_point_id')
        .populate('user_id', 'user_name email status role')
        .exec();
      if (!student) return [];
      const attached = await this.attachAccountStatus(student);
      return [attached];
    }

    const teacherClassIds = await this.getTeacherClassIds(requester);
    const filter: any = teacherClassIds ? { class_id: { $in: teacherClassIds } } : {};

    const students = await this.studentModel
      .find(filter)
      .populate({
        path: 'class_id',
        populate: { path: 'dept_id', select: 'name code' },
      })
      .populate('training_point_id')
      .populate('user_id', 'user_name email status role')
      .exec();
    const statusMap = await this.getAccountStatusMap(students);
    return Promise.all(
      students.map((student) => this.attachAccountStatus(student, statusMap)),
    );
  }

  async findMe(requester: any): Promise<any> {
    if (!requester?.userId || !Types.ObjectId.isValid(requester.userId)) {
      throw new UnauthorizedException('Thông tin người dùng không hợp lệ');
    }

    const student = await this.studentModel
      .findOne({ user_id: new Types.ObjectId(requester.userId) })
      .populate({
        path: 'class_id',
        populate: { path: 'dept_id', select: 'name code' },
      })
      .populate('training_point_id')
      .populate('user_id', 'user_name email status role')
      .exec();

    if (!student) {
      throw new NotFoundException('Tài khoản chưa liên kết với hồ sơ sinh viên');
    }

    return this.attachAccountStatus(student);
  }

  async findOne(id: string, requester?: any): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    const isRequesterStudent = isStudent(requester);

    if (isRequesterStudent) {
      const student = await this.studentModel
        .findOne({ _id: id })
        .populate({
          path: 'class_id',
          populate: { path: 'dept_id', select: 'name code' },
        })
        .populate('training_point_id')
        .populate('user_id', 'user_name email status role')
        .exec();

      if (!student) {
        throw new NotFoundException(`Student with ID ${id} not found`);
      }

      const linkedUserId = this.getLinkedUserId(student);
      if (linkedUserId !== requester?.userId) {
        throw new ForbiddenException('Bạn không có quyền truy cập hồ sơ sinh viên này.');
      }

      return this.attachAccountStatus(student);
    }

    const teacherClassIds = await this.getTeacherClassIds(requester);
    const filter: any = teacherClassIds
      ? { _id: id, class_id: { $in: teacherClassIds } }
      : { _id: id };

    const student = await this.studentModel
      .findOne(filter)
      .populate({
        path: 'class_id',
        populate: { path: 'dept_id', select: 'name code' },
      })
      .populate('training_point_id')
      .populate('user_id', 'user_name email status role')
      .exec();
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    return this.attachAccountStatus(student);
  }

  async findByStudentCode(student_code: string): Promise<any> {
    const student = await this.studentModel
      .findOne({ student_code })
      .populate({
        path: 'class_id',
        populate: { path: 'dept_id', select: 'name code' },
      })
      .populate('training_point_id')
      .populate('user_id', 'user_name email status role')
      .exec();
    if (!student) {
      throw new NotFoundException(
        `Student with student_code ${student_code} not found`,
      );
    }

    return this.attachAccountStatus(student);
  }

  async update(
    id: string,
    updateStudentDto: UpdateStudentDto,
    requester?: any,
  ): Promise<Student> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    if (requester && isStudent(requester)) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa hồ sơ sinh viên.');
    }
    try {
      const normalizedUpdateDto = {
        ...updateStudentDto,
        ...(Object.prototype.hasOwnProperty.call(updateStudentDto, 'user_id')
          ? { user_id: this.normalizeStudentUserId(updateStudentDto.user_id) || null }
          : {}),
      };

      const updatedStudent = await this.studentModel
        .findByIdAndUpdate(id, normalizedUpdateDto, { returnDocument: 'after' })
        .exec();

      if (!updatedStudent) {
        throw new NotFoundException(`Student with ID ${id} not found`);
      }
      return (await this.findOne(id, requester)) as any;
    } catch (error: any) {
      if (error.code === 11000) {
        const duplicateField = Object.keys(error.keyPattern || {})[0];
        if (duplicateField === 'student_code') {
          throw new ConflictException(
            `Mã sinh viên "${updateStudentDto.student_code}" đã tồn tại trong hệ thống. Vui lòng nhập mã khác!`,
          );
        }
        if (duplicateField === 'user_id') {
          throw new ConflictException(
            'Tài khoản này đã được liên kết với sinh viên khác.',
          );
        }
        throw new ConflictException(
          `Dữ liệu bị trùng lặp ở trường: ${duplicateField}`,
        );
      }
      throw error;
    }
  }

  async remove(id: string, requester?: any): Promise<Student> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    if (requester && isStudent(requester)) {
      throw new ForbiddenException('Bạn không có quyền xóa hồ sơ sinh viên.');
    }
    const student = await this.studentModel.findById(id).exec();
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    await this.studentModel.findByIdAndDelete(id).exec();

    try {
      const linkedUserId = this.getLinkedUserId(student);
      const userDelResult = linkedUserId
        ? await this.userModel.deleteOne({ _id: linkedUserId })
        : await this.userModel.deleteOne({
            email: this.getStudentEmail(student),
          });

      if (userDelResult.deletedCount > 0) {
        this.logger.log(
          `Auto-deleted linked user for removed student ${student.full_name} (${student.student_code}).`,
        );
      }
    } catch (userErr) {
      this.logger.error(
        `Failed to auto-delete linked user for removed student ${student.full_name}:`,
        userErr,
      );
    }

    return student as any;
  }
}
