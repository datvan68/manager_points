import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Student, StudentDocument } from './schemas/student.schema';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Semester } from '../semesters/schemas/semester.schema';
import { SummaryPoint } from '../summaries-point/schemas/summary-point.schema';
import { User, UserDocument, UserStatus } from '../auth/schemas/user.schema';
import { RefreshToken, RefreshTokenDocument } from '../auth/schemas/refresh-token.schema';
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
    @InjectModel(RefreshToken.name) private refreshTokenModel: Model<RefreshTokenDocument>,
    private configService: ConfigService,
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
      const syncConfig = this.configService.get<string>('STUDENT_ACCOUNT_STARTUP_SYNC') || 'off';
      const isProduction = process.env.NODE_ENV === 'production';
      const allowRepair = this.configService.get<string>('ALLOW_STARTUP_DB_REPAIR') === 'true';

      const studentsCount = await this.studentModel.countDocuments();
      const usersCount = await this.userModel.countDocuments();

      if (studentsCount > 0 && usersCount === 0) {
        this.logger.warn(
          `Users collection is empty while students has ${studentsCount} records. Startup student-account repair is disabled. Run explicit sync job if this is intended.`,
        );
      }

      if (syncConfig === 'apply') {
        if (isProduction && !allowRepair) {
          this.logger.warn('STUDENT_ACCOUNT_STARTUP_SYNC is "apply" but ALLOW_STARTUP_DB_REPAIR is not "true" in production. Skipping sync.');
        } else {
          await this.syncLegacyStudentsAccounts('apply');
        }
      } else if (syncConfig === 'dry-run') {
        await this.syncLegacyStudentsAccounts('preview');
      }
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

    try {
      await this.remediateStalePasswords();
    } catch (remediateErr) {
      this.logger.error('Failed to remediate stale student passwords:', remediateErr);
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

  async syncLegacyStudentsAccounts(mode: 'preview' | 'apply' = 'preview') {
    const students = await this.studentModel.find().exec();
    if (students.length === 0) return { scanned: 0, created: 0, linked: 0, orphaned: 0, skipped: 0 };

    let created = 0;
    let linked = 0;
    let orphaned = 0;
    let skipped = 0;

    const studentEmails = students.map((student) => this.getStudentEmail(student));
    const existingUsers = await this.userModel
      .find({ email: { $in: studentEmails } })
      .exec();
    const existingEmails = new Set(existingUsers.map((user) => user.email));
    
    // To check orphan link, we should find all users by student user_id, but to avoid many queries, 
    // we can gather all user_ids from students
    const studentUserIds = students.map(s => s.user_id).filter(id => !!id) as Types.ObjectId[];
    const existingUsersById = await this.userModel.find({ _id: { $in: studentUserIds } }).exec();
    const existingUserIds = new Set(existingUsersById.map(u => u._id.toString()));

    const legacyNameUsers = existingUsers.filter((user) =>
      !/^\d+$/.test(user.user_name),
    );
    if (legacyNameUsers.length > 0 && mode === 'apply') {
      this.logger.log(
        `Detected ${legacyNameUsers.length} legacy student accounts with name-based usernames.`,
      );
      for (const user of legacyNameUsers) {
        const student = students.find(
          (candidate) => this.getStudentEmail(candidate) === user.email,
        );
        if (student) {
          user.user_name = student.student_code;
          await user.save();
        }
      }
    }

    const previewSamples = [];

    for (const student of students) {
      const email = this.getStudentEmail(student);
      const hasEmailLink = existingEmails.has(email);
      const hasOrphanLink = student.user_id && !existingUserIds.has(student.user_id.toString());

      if (hasEmailLink) {
        linked++;
      } else if (hasOrphanLink) {
        orphaned++;
        if (mode === 'apply') {
           try {
             const plainPassword = this.getDefaultPasswordFromDob(student.date_bir);
             const linkedUser = await this.generateStudentUser(student, plainPassword, false);
             await this.ensureStudentUserLink(student, linkedUser);
             created++;
           } catch (error) {
             skipped++;
           }
        } else {
           if (previewSamples.length < 5) {
             previewSamples.push({
               student_code: student.student_code,
               email: email.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => {
                 return gp1 + '*'.repeat(gp2.length);
               }),
               reason: 'orphan_user_link'
             });
           }
        }
      } else {
        // Missing user completely
        if (mode === 'apply') {
           try {
             const plainPassword = this.getDefaultPasswordFromDob(student.date_bir);
             const linkedUser = await this.generateStudentUser(student, plainPassword, false);
             await this.ensureStudentUserLink(student, linkedUser);
             created++;
           } catch (error) {
             skipped++;
           }
        } else {
           created++; // Will be created
           if (previewSamples.length < 5) {
             previewSamples.push({
               student_code: student.student_code,
               email: email.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => {
                 return gp1 + '*'.repeat(gp2.length);
               }),
               reason: 'missing_user'
             });
           }
        }
      }
    }

    const summary = {
      scanned: students.length,
      created: mode === 'preview' ? created : created,
      linked,
      orphaned,
      skipped,
      samples: mode === 'preview' ? previewSamples : undefined
    };

    if (mode === 'apply') {
      this.logger.log(
        `Student account sync completed: scanned=${summary.scanned}, created=${summary.created}, linked=${summary.linked}, orphaned=${summary.orphaned}, skipped=${summary.skipped}`,
      );
    }

    return summary;
  }

  private async generateStudentUser(student: any, plainPasswordDob: string, logCreation: boolean = true) {
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
      user_name: student.student_code,
      email: studentEmail,
      pw_hash,
      status: UserStatus.INACTIVE,
      role: defaultRole?._id,
      date_birth: student.date_bir,
    });
    
    if (logCreation) {
      this.logger.log(
        `Auto-created login account for student ${student.full_name} (${student.student_code}).`,
      );
    }

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
        const plainPassword = this.getDefaultPasswordFromDob(createdStudent.date_bir);

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

      if (createdStudent.status === 'Studying') {
        try {
          let semesters = await this.semesterModel
            .find({ status: 'active' })
            .exec();
          if (semesters.length === 0) {
            semesters = await this.semesterModel.find().exec();
          }

          const bulkOps = semesters.map((sem) => ({
            updateOne: {
              filter: {
                student_id: (createdStudent as any)._id,
                semester_id: sem._id,
                period_id: null,
              },
              update: {
                $setOnInsert: {
                  student_id: (createdStudent as any)._id,
                  semester_id: sem._id,
                  period_id: null,
                  total_score: 0,
                  grading: 'chưa xếp loại',
                  status: 'draft',
                  details: [],
                },
              },
              upsert: true,
            },
          }));

          if (bulkOps.length > 0) {
            await this.summaryPointModel.bulkWrite(bulkOps, { ordered: false });
            this.logger.log(
              `Auto-created or verified summary point rows for ${createStudentDto.full_name}.`,
            );
          }
        } catch (sumErr: any) {
          const isDupKey = sumErr.code === 11000 || (sumErr.writeErrors && sumErr.writeErrors.some((e: any) => e.code === 11000));
          if (isDupKey) {
            this.logger.warn(
              `Summary points already existed for student ${createStudentDto.full_name} (${createdStudent.student_code}).`,
            );
          } else {
            this.logger.error(
              `Failed to auto-create summary points for new student ${createStudentDto.full_name}:`,
              sumErr,
            );
          }
        }
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
          const plainPassword = this.getDefaultPasswordFromDob(student.date_bir);

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

        const bulkOps: any[] = [];
        createdStudents.forEach((student) => {
          if (student.status === 'Studying') {
            semesters.forEach((sem) => {
              bulkOps.push({
                updateOne: {
                  filter: {
                    student_id: (student as any)._id,
                    semester_id: sem._id,
                    period_id: null,
                  },
                  update: {
                    $setOnInsert: {
                      student_id: (student as any)._id,
                      semester_id: sem._id,
                      period_id: null,
                      total_score: 0,
                      grading: 'chưa xếp loại',
                      status: 'draft',
                      details: [],
                    },
                  },
                  upsert: true,
                },
              });
            });
          }
        });

        if (bulkOps.length > 0) {
          await this.summaryPointModel.bulkWrite(bulkOps, { ordered: false });
          this.logger.log(
            `Auto-created or verified ${bulkOps.length} summary point rows for bulk import.`,
          );
        }
      } catch (sumErr: any) {
        const isDupKey = sumErr.code === 11000 || (sumErr.writeErrors && sumErr.writeErrors.some((e: any) => e.code === 11000));
        if (isDupKey) {
          this.logger.warn(
            `Summary points already existed for some of the bulk imported students.`,
          );
        } else {
          this.logger.error(
            'Failed to auto-create summary points for bulk imported students:',
            sumErr,
          );
        }
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

  async findAll(
    query?: {
      classId?: string;
      departmentId?: string;
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      fields?: string;
    },
    requester?: any,
  ): Promise<any> {
    let classId: string | undefined;
    let departmentId: string | undefined;
    let page: number | undefined;
    let limit: number | undefined;
    let search: string | undefined;
    let status: string | undefined;
    let fields: string | undefined;
    let actualRequester = requester;

    if (query && ('roleName' in query || 'userId' in query || 'role' in query || 'username' in query)) {
      actualRequester = query;
      classId = undefined;
    } else if (query) {
      classId = query.classId;
      departmentId = query.departmentId;
      page = query.page;
      limit = query.limit;
      search = query.search;
      status = query.status;
      fields = query.fields;
    }

    const isPaginationRequested = page !== undefined || limit !== undefined;
    const isRequesterStudent = isStudent(actualRequester);

    if (isRequesterStudent) {
      if (!actualRequester?.userId || !Types.ObjectId.isValid(actualRequester.userId)) {
        return isPaginationRequested
          ? { data: [], meta: { total: 0, page: page || 1, limit: limit || 10, totalPages: 0 } }
          : [];
      }
      const student = await this.studentModel
        .findOne({ user_id: new Types.ObjectId(actualRequester.userId) })
        .populate({
          path: 'class_id',
          populate: { path: 'dept_id', select: 'name code' },
        })
        .populate('training_point_id')
        .populate('user_id', 'user_name email status role')
        .exec();
      if (!student) {
        return isPaginationRequested
          ? { data: [], meta: { total: 0, page: page || 1, limit: limit || 10, totalPages: 0 } }
          : [];
      }
      const attached = await this.attachAccountStatus(student);

      if (classId) {
        if (!Types.ObjectId.isValid(classId)) {
          return isPaginationRequested
            ? { data: [], meta: { total: 0, page: page || 1, limit: limit || 10, totalPages: 0 } }
            : [];
        }
        const studentClassId = typeof student.class_id === 'object'
          ? (student.class_id as any)?._id?.toString()
          : (student.class_id as any)?.toString();
        if (studentClassId !== classId) {
          return isPaginationRequested
            ? { data: [], meta: { total: 0, page: page || 1, limit: limit || 10, totalPages: 0 } }
            : [];
        }
      }

      return isPaginationRequested
        ? { data: [attached], meta: { total: 1, page: page || 1, limit: limit || 10, totalPages: 1 } }
        : [attached];
    }

    const teacherClassIds = await this.getTeacherClassIds(actualRequester);
    const filter: any = {};

    if (classId) {
      if (!Types.ObjectId.isValid(classId)) {
        return isPaginationRequested
          ? { data: [], meta: { total: 0, page: page || 1, limit: limit || 10, totalPages: 0 } }
          : [];
      }

      if (teacherClassIds) {
        const isAssigned = teacherClassIds.some((id) => id.toString() === classId);
        if (!isAssigned) {
          return isPaginationRequested
            ? { data: [], meta: { total: 0, page: page || 1, limit: limit || 10, totalPages: 0 } }
            : [];
        }
      }
      filter.class_id = new Types.ObjectId(classId);
    } else if (departmentId) {
      if (!Types.ObjectId.isValid(departmentId)) {
        return isPaginationRequested
          ? { data: [], meta: { total: 0, page: page || 1, limit: limit || 10, totalPages: 0 } }
          : [];
      }
      const deptClasses = await this.classModel.find({ dept_id: new Types.ObjectId(departmentId) } as any).select('_id').lean().exec();
      const deptClassIds = deptClasses.map((c) => c._id);
      if (teacherClassIds) {
        const allowedClassIds = teacherClassIds.filter((id) =>
          deptClassIds.some((dId) => dId.toString() === id.toString()),
        );
        filter.class_id = { $in: allowedClassIds };
      } else {
        filter.class_id = { $in: deptClassIds };
      }
    } else if (teacherClassIds) {
      filter.class_id = { $in: teacherClassIds };
    }

    if (search) {
      filter.$or = [
        { full_name: { $regex: search, $options: 'i' } },
        { student_code: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      if (status === 'Dropped') {
        filter.status = { $in: ['Dropped', 'Suspended'] };
      } else {
        filter.status = status;
      }
    }

    const isSliderMode = fields === 'slider';

    if (isPaginationRequested) {
      const p = page || 1;
      const l = limit || 10;

      if (isSliderMode) {
        const [students, total] = await Promise.all([
          this.studentModel
            .find(filter)
            .select('_id student_code full_name status class_id user_id date_bir sex email')
            .populate({
              path: 'class_id',
              select: 'class_name _id',
            })
            .skip((p - 1) * l)
            .limit(l)
            .lean()
            .exec(),
          this.studentModel.countDocuments(filter).exec(),
        ]);

        return {
          data: students,
          meta: {
            total,
            page: p,
            limit: l,
            totalPages: Math.ceil(total / l),
          },
        };
      }

      const [students, total] = await Promise.all([
        this.studentModel
          .find(filter)
          .populate({
            path: 'class_id',
            populate: { path: 'dept_id', select: 'name code' },
          })
          .populate('training_point_id')
          .populate('user_id', 'user_name email status role')
          .skip((p - 1) * l)
          .limit(l)
          .exec(),
        this.studentModel.countDocuments(filter).exec(),
      ]);

      const statusMap = await this.getAccountStatusMap(students);
      const data = await Promise.all(
        students.map((student) => this.attachAccountStatus(student, statusMap)),
      );

      return {
        data,
        meta: {
          total,
          page: p,
          limit: l,
          totalPages: Math.ceil(total / l),
        },
      };
    } else {
      if (isSliderMode) {
        return this.studentModel
          .find(filter)
          .select('_id student_code full_name status class_id user_id date_bir sex email')
          .populate({
            path: 'class_id',
            select: 'class_name _id',
          })
          .lean()
          .exec();
      }

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

  async resolve(identifier: string, requester?: any): Promise<any> {
    const isObjectId = Types.ObjectId.isValid(identifier);
    const isRequesterStudent = isStudent(requester);

    if (isRequesterStudent) {
      const query = isObjectId
        ? { _id: identifier }
        : { student_code: identifier };

      const student = await this.studentModel
        .findOne(query)
        .populate({
          path: 'class_id',
          populate: { path: 'dept_id', select: 'name code' },
        })
        .populate('training_point_id')
        .populate('user_id', 'user_name email status role')
        .exec();

      if (!student) {
        throw new NotFoundException(`Student with identifier ${identifier} not found`);
      }

      const linkedUserId = this.getLinkedUserId(student);
      if (linkedUserId !== requester?.userId) {
        throw new ForbiddenException('Bạn không có quyền truy cập hồ sơ sinh viên này.');
      }

      return this.attachAccountStatus(student);
    }

    const teacherClassIds = await this.getTeacherClassIds(requester);
    const filter: any = isObjectId
      ? { _id: identifier }
      : { student_code: identifier };

    if (teacherClassIds) {
      filter.class_id = { $in: teacherClassIds };
    }

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
      throw new NotFoundException(`Student with identifier ${identifier} not found`);
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
    const oldStudent = await this.studentModel.findById(id).exec();
    if (!oldStudent) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    const isTransitionFromStudying = oldStudent.status === 'Studying' && updateStudentDto.status !== 'Studying' && updateStudentDto.status !== undefined;
    if (isTransitionFromStudying) {
      if (!updateStudentDto.deleteTrainingScoresConfirmed) {
        throw new BadRequestException('Chuyển đổi trạng thái yêu cầu xác nhận xóa bảng điểm rèn luyện.');
      }
      await this.summaryPointModel.deleteMany({ student_id: new Types.ObjectId(id) }).exec();
    }

    try {
      const { deleteTrainingScoresConfirmed, ...cleanDto } = updateStudentDto;
      const normalizedUpdateDto = {
        ...cleanDto,
        ...(Object.prototype.hasOwnProperty.call(cleanDto, 'user_id')
          ? { user_id: this.normalizeStudentUserId(cleanDto.user_id) || null }
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

  async activateStudentAccount(id: string, requester?: any) {
    if (requester && isStudent(requester)) {
      throw new ForbiddenException('Bạn không có quyền kích hoạt tài khoản sinh viên.');
    }

    const student = await this.studentModel.findById(id);
    if (!student) {
      throw new NotFoundException(`Không tìm thấy sinh viên với ID ${id}`);
    }

    const studentEmail = this.getStudentEmail(student);
    const plainPassword = this.getDefaultPasswordFromDob(student.date_bir);

    // Tìm xem đã có user_id liên kết chưa
    let user: UserDocument | null = null;
    const linkedUserId = this.getLinkedUserId(student);

    if (linkedUserId) {
      user = await this.userModel.findById(linkedUserId).exec();
    }

    if (!user) {
      // Tìm bằng email
      user = await this.userModel.findOne({ email: studentEmail }).exec();
    }

    const defaultRole = await this.roleModel.findOne({ name: 'Student' }).exec();

    if (user) {
      // Nếu user đã tồn tại, cập nhật status sang active, gán role Student nếu chưa có
      user.status = UserStatus.ACTIVE;
      user.failed_login_attempts = 0;
      user.locked_until = null;
      if (defaultRole) {
        user.role = defaultRole._id;
      }
      await user.save();
      
      // Đảm bảo student.user_id trỏ tới user này
      await this.ensureStudentUserLink(student, user);
    } else {
      // Nếu chưa có, tạo user mới ở trạng thái ACTIVE
      const pw_hash = await bcrypt.hash(plainPassword, 12);
      const createdUser = await this.userModel.create({
        user_name: student.student_code, // sử dụng student_code làm user_name
        email: studentEmail,
        pw_hash,
        status: UserStatus.ACTIVE,
        role: defaultRole?._id,
        date_birth: student.date_bir,
      });

      await this.ensureStudentUserLink(student, createdUser);
      user = createdUser;
    }

    return this.attachAccountStatus(student);
  }

  async bulkActivateStudentAccounts(ids: string[], requester?: any) {
    if (requester && isStudent(requester)) {
      throw new ForbiddenException('Bạn không có quyền kích hoạt tài khoản sinh viên.');
    }

    let successCount = 0;
    const results = [];

    for (const id of ids) {
      try {
        await this.activateStudentAccount(id, requester);
        successCount++;
        results.push({ id, status: 'success' });
      } catch (err: any) {
        this.logger.error(`Failed to activate student account ${id}:`, err);
        results.push({ id, status: 'fail', error: err.message });
      }
    }

    return {
      success: successCount,
      total: ids.length,
      results,
    };
  }

  async resetStudentAccountPassword(id: string, requester?: any) {
    if (requester && isStudent(requester)) {
      throw new ForbiddenException('Bạn không có quyền reset mật khẩu sinh viên.');
    }

    const student = await this.studentModel.findById(id).exec();
    if (!student) {
      throw new NotFoundException(`Không tìm thấy sinh viên với ID ${id}`);
    }

    const linkedUserId = this.getLinkedUserId(student);
    if (!linkedUserId) {
      throw new BadRequestException('Sinh viên chưa được liên kết tài khoản login.');
    }

    const user = await this.userModel.findById(linkedUserId).exec();
    if (!user) {
      throw new BadRequestException('Không tìm thấy tài khoản người dùng liên kết.');
    }

    // Reset password sang DOB mặc định ddmmyyyy
    const plainPassword = this.getDefaultPasswordFromDob(student.date_bir);

    const pw_hash = await bcrypt.hash(plainPassword, 12);
    user.pw_hash = pw_hash;
    if (user.status !== UserStatus.INACTIVE) {
      user.status = UserStatus.ACTIVE;
    }
    user.failed_login_attempts = 0;
    user.locked_until = null;
    await user.save();

    // Thu hồi toàn bộ refresh tokens
    await this.refreshTokenModel.updateMany(
      { user_id: user._id },
      { $set: { is_revoked: true } },
    );

    return this.attachAccountStatus(student);
  }

  async lockStudentAccount(id: string, requester?: any) {
    if (requester && isStudent(requester)) {
      throw new ForbiddenException('Bạn không có quyền khóa tài khoản sinh viên.');
    }

    const student = await this.studentModel.findById(id).exec();
    if (!student) {
      throw new NotFoundException(`Không tìm thấy sinh viên với ID ${id}`);
    }

    const linkedUserId = this.getLinkedUserId(student);
    if (!linkedUserId) {
      throw new BadRequestException('Sinh viên chưa được liên kết tài khoản login.');
    }

    const user = await this.userModel.findById(linkedUserId).exec();
    if (!user) {
      throw new BadRequestException('Không tìm thấy tài khoản người dùng liên kết.');
    }

    user.status = UserStatus.LOCKED;
    user.locked_until = null; // Manual Lock
    await user.save();

    // Thu hồi toàn bộ refresh tokens
    await this.refreshTokenModel.updateMany(
      { user_id: user._id },
      { $set: { is_revoked: true } },
    );

    return this.attachAccountStatus(student);
  }

  async unlockStudentAccount(id: string, requester?: any) {
    if (requester && isStudent(requester)) {
      throw new ForbiddenException('Bạn không có quyền mở khóa tài khoản sinh viên.');
    }

    const student = await this.studentModel.findById(id).exec();
    if (!student) {
      throw new NotFoundException(`Không tìm thấy sinh viên với ID ${id}`);
    }

    const linkedUserId = this.getLinkedUserId(student);
    if (!linkedUserId) {
      throw new BadRequestException('Sinh viên chưa được liên kết tài khoản login.');
    }

    const user = await this.userModel.findById(linkedUserId).exec();
    if (!user) {
      throw new BadRequestException('Không tìm thấy tài khoản người dùng liên kết.');
    }

    user.status = UserStatus.ACTIVE;
    user.locked_until = null;
    user.failed_login_attempts = 0;
    await user.save();

    return this.attachAccountStatus(student);
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

  getDefaultPasswordFromDob(dateBir: Date | string | null | undefined): string {
    if (!dateBir) return '';
    const dob = new Date(dateBir);
    if (isNaN(dob.getTime())) return '';
    
    // Convert to GMT+7 timezone (Vietnam) before extracting components
    const dobGmt7 = new Date(dob.getTime() + 7 * 60 * 60 * 1000);
    const day = String(dobGmt7.getUTCDate()).padStart(2, '0');
    const month = String(dobGmt7.getUTCMonth() + 1).padStart(2, '0');
    const year = dobGmt7.getUTCFullYear();
    return `${day}${month}${year}`;
  }

  private async remediateStalePasswords() {
    const mode = process.env.PASSWORD_REMEDIATION_MODE || 'off';
    if (mode === 'off') {
      this.logger.log('Student password remediation is disabled (PASSWORD_REMEDIATION_MODE is "off").');
      return;
    }

    const isDryRun = mode !== 'apply';
    this.logger.log(`Starting student password remediation in ${isDryRun ? 'DRY-RUN' : 'APPLY'} mode...`);

    const students = await this.studentModel.find().exec();
    const studentEmails = students.map((student) => this.getStudentEmail(student));
    const studentCodes = students.map((student) => student.student_code).filter(Boolean);
    
    const users = await this.userModel.find({
      $or: [
        { email: { $in: studentEmails } },
        { user_name: { $in: studentCodes } }
      ]
    }).exec();
    let affectedCount = 0;
    let remediatedCount = 0;
    const affectedCodes: string[] = [];
    
    for (const user of users) {
      const student = students.find(
        (s) => this.getStudentEmail(s) === user.email || s.student_code === user.user_name
      );
      if (!student || !student.date_bir) continue;
      
      const dob = new Date(student.date_bir);
      const wrongDay = String(dob.getUTCDate()).padStart(2, '0');
      const wrongMonth = String(dob.getUTCMonth() + 1).padStart(2, '0');
      const wrongYear = dob.getUTCFullYear();
      const wrongPassword = `${wrongDay}${wrongMonth}${wrongYear}`;
      
      const correctPassword = this.getDefaultPasswordFromDob(student.date_bir);
      
      if (wrongPassword === correctPassword) continue;
      
      const passwordHash = user.pw_hash || (user as any).password_hash;
      if (passwordHash) {
        const isWrongPassword = await bcrypt.compare(wrongPassword, passwordHash);
        if (isWrongPassword) {
          affectedCount++;
          const maskedCode = student.student_code ? `${student.student_code.slice(0, 3)}***${student.student_code.slice(-2)}` : 'unknown';
          affectedCodes.push(maskedCode);

          if (!isDryRun) {
            const newHash = await bcrypt.hash(correctPassword, 12);
            user.pw_hash = newHash;
            await user.save();
            remediatedCount++;
          }
        }
      }
    }
    
    if (isDryRun) {
      this.logger.log(`[DRY-RUN] Found ${affectedCount} student accounts with incorrect timezone DOB passwords. Affected: [${affectedCodes.join(', ')}]. No changes applied.`);
    } else {
      this.logger.log(`[APPLY] Successfully remediated ${remediatedCount}/${affectedCount} student accounts. Remediated: [${affectedCodes.join(', ')}].`);
    }
  }
}
