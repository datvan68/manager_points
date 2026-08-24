import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Class, ClassDocument } from './schemas/class.schema';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { isStudent } from '../auth/utils/role.util';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import * as xlsx from 'xlsx';
import {
  ImportClassConfirmDto,
  ImportClassRowDto,
} from './dto/import-class.dto';

@Injectable()
export class ClassesService {
  constructor(
    @InjectModel(Class.name) private classModel: Model<ClassDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private normalizeClassPayload<T extends CreateClassDto | UpdateClassDto>(
    dto: T,
  ) {
    const payload: any = { ...dto };
    if (payload.class_type && !payload.class_course) {
      payload.class_course = payload.class_type;
    }
    delete payload.class_type;
    return payload;
  }

  private isTeacher(requester?: any) {
    const role = (requester?.roleName || '').toLowerCase();
    return role.includes('teacher') || role.includes('advisor');
  }

  private handleDuplicateClassNameError(error: any): never {
    if (error?.code === 11000 && error?.keyPattern?.class_name) {
      const duplicateName = error?.keyValue?.class_name || 'provided';
      throw new ConflictException(
        `Tên lớp "${duplicateName}" đã tồn tại trong hệ thống`,
      );
    }

    throw error;
  }

  async create(createClassDto: CreateClassDto): Promise<Class> {
    try {
      const newClass = new this.classModel(
        this.normalizeClassPayload(createClassDto),
      );
      return await newClass.save();
    } catch (error) {
      this.handleDuplicateClassNameError(error);
    }
  }

  async findAll(requester?: any): Promise<Class[]> {
    if (requester && isStudent(requester) && requester.userId) {
      const studentModel = this.classModel.db.model('Student');
      const student = await studentModel
        .findOne({ user_id: new Types.ObjectId(requester.userId) })
        .exec();
      if (!student || !student.class_id) return [];
      return this.classModel
        .find({ _id: student.class_id })
        .populate('dept_id', 'name code')
        .populate('advisor_id', 'user_name email')
        .exec();
    }

    const filter = this.isTeacher(requester)
      ? { advisor_id: requester.userId }
      : {};

    return this.classModel
      .find(filter)
      .populate('dept_id', 'name code')
      .populate('advisor_id', 'user_name email')
      .exec();
  }

  async findOne(id: string, requester?: any): Promise<Class> {
    if (requester && isStudent(requester) && requester.userId) {
      const studentModel = this.classModel.db.model('Student');
      const student = await studentModel
        .findOne({ user_id: new Types.ObjectId(requester.userId) })
        .exec();
      if (!student || student.class_id?.toString() !== id) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập thông tin của lớp học khác.',
        );
      }
    }

    const query = this.isTeacher(requester)
      ? this.classModel.findOne({ _id: id, advisor_id: requester.userId })
      : this.classModel.findById(id);
    const classEntity = await query
      .populate('dept_id', 'name code')
      .populate('advisor_id', 'user_name email')
      .exec();

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${id} not found`);
    }
    return classEntity;
  }

  async update(id: string, updateClassDto: UpdateClassDto): Promise<Class> {
    let updatedClass;
    try {
      updatedClass = await this.classModel
        .findByIdAndUpdate(id, this.normalizeClassPayload(updateClassDto), {
          returnDocument: 'after',
        })
        .populate('dept_id', 'name code')
        .populate('advisor_id', 'user_name email')
        .exec();
    } catch (error) {
      this.handleDuplicateClassNameError(error);
    }

    if (!updatedClass) {
      throw new NotFoundException(`Class with ID ${id} not found`);
    }
    return updatedClass;
  }

  async remove(id: string): Promise<Class> {
    const existingClass = await this.classModel.findById(id).exec();
    if (!existingClass) {
      throw new NotFoundException(`Class with ID ${id} not found`);
    }

    // MongoDB standalone deployments do not support transactions. Every
    // operation below is idempotent and the class is removed last so a retry
    // can finish a partially completed purge.
    const asObjectId = (value: unknown): any =>
      Types.ObjectId.isValid(value as any) ? new Types.ObjectId(value as any) : value;
    const classId: any = asObjectId(existingClass._id);
    const students = await this.studentModel
      .find({ class_id: classId })
      .select('_id user_id')
      .lean()
      .exec();
    const studentIds = students.map((student) => asObjectId(student._id));
    const userIds = students
      .map((student) => student.user_id)
      .filter(Boolean)
      .map((userId) => asObjectId(userId));
    const model = (name: string): Model<any> => this.classModel.db.model(name);
    const deleteMany = async (name: string, filter: Record<string, unknown>) => {
      await model(name).deleteMany(filter).exec();
    };

    await deleteMany('DailyClassReport', { class_id: classId });
    const classSessions = await model('AttendanceSession')
      .find({ class_id: classId })
      .select('_id')
      .lean()
      .exec();
    if (classSessions.length) {
      await deleteMany('AttendanceCheckin', {
        session_id: { $in: classSessions.map((session) => session._id) },
      });
    }
    await deleteMany('AttendanceSession', { class_id: classId });
    await deleteMany('ActivityAttendance', {
      $or: [{ class_id: classId }, { student_id: { $in: studentIds } }],
    });
    await deleteMany('StudentTaskProgress', {
      $or: [
        { classId },
        { studentId: { $in: studentIds } },
        { assigneeUserId: { $in: userIds } },
      ],
    });
    await model('StudentTask').updateMany(
      { $or: [{ targetClassIds: classId }, { targetStudentIds: { $in: studentIds } }] },
      { $pull: { targetClassIds: classId, targetStudentIds: { $in: studentIds } } },
    ).exec();
    await model('Activity').updateMany(
      { vice_president_ids: { $in: studentIds } },
      { $pull: { vice_president_ids: { $in: studentIds } } },
    ).exec();
    await model('Activity').updateMany(
      { president_id: { $in: studentIds } },
      { $unset: { president_id: '' } },
    ).exec();

    if (studentIds.length) {
      await deleteMany('AcademicRecord', { student_id: { $in: studentIds } });
      await deleteMany('SummaryPoint', { student_id: { $in: studentIds } });
      await deleteMany('ActivityMember', { student_id: { $in: studentIds } });
      await deleteMany('ActivityMembershipTransfer', { student_id: { $in: studentIds } });
      await deleteMany('ActivityAttendance', { student_id: { $in: studentIds } });
      await deleteMany('ActivityCompletionAward', { student_id: { $in: studentIds } });
      await deleteMany('ScheduleRegistration', { student_id: { $in: studentIds } });
      await deleteMany('AttendanceCheckin', { student_id: { $in: studentIds } });
      await deleteMany('Contract', { student_id: { $in: studentIds } });
      await deleteMany('DormitoryRosterEntry', { student_id: { $in: studentIds } });
      await deleteMany('Invoice', { student_id: { $in: studentIds } });
      await deleteMany('RoomFeeInvoice', { student_id: { $in: studentIds } });
      await deleteMany('MaintenanceRequest', { student_id: { $in: studentIds } });
      await deleteMany('Violation', { student_id: { $in: studentIds } });
      await model('StudentTask').updateMany(
        { targetStudentIds: { $in: studentIds } },
        { $pull: { targetStudentIds: { $in: studentIds } } },
      ).exec();
    }

    if (userIds.length) {
      await deleteMany('ActivityFavorite', { user_id: { $in: userIds } });
      await deleteMany('ImpersonationSession', {
        $or: [{ actor_user_id: { $in: userIds } }, { subject_user_id: { $in: userIds } }],
      });
      await deleteMany('LoginLog', { user_id: { $in: userIds } });
      await deleteMany('PasswordResetRequest', { user_id: { $in: userIds } });
      await deleteMany('PasswordResetToken', { user_id: { $in: userIds } });
      await deleteMany('RefreshToken', {
        $or: [{ user_id: { $in: userIds } }, { actor_user_id: { $in: userIds } }],
      });
      await deleteMany('SystemPerformanceMetric', { user_id: { $in: userIds } });
    }

    await this.userModel.deleteMany({ _id: { $in: userIds } }).exec();
    await this.studentModel.deleteMany({ _id: { $in: studentIds } }).exec();
    return (await this.classModel.findByIdAndDelete(classId).exec()) as unknown as Class;
  }

  async getClassSummary(requester?: any): Promise<any[]> {
    const classes = await this.findAll(requester);
    const studentModel = this.classModel.db.model('Student');

    const summaries = await Promise.all(
      classes.map(async (cls: any) => {
        const [studentCount, avatarsRaw] = await Promise.all([
          studentModel.countDocuments({ class_id: cls._id }).exec(),
          studentModel
            .find({ class_id: cls._id })
            .select('_id full_name student_code')
            .limit(3)
            .lean()
            .exec(),
        ]);

        const avatars = avatarsRaw.map((s: any) => ({
          _id: s._id,
          full_name: s.full_name,
          student_code: s.student_code,
        }));

        return {
          classId: cls._id.toString(),
          studentCount,
          avatars,
        };
      }),
    );

    return summaries;
  }

  async previewImport(file: Express.Multer.File) {
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const totalRows = rawData.length;
    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;
    const rows = [];

    const deptModel = this.classModel.db.model('Department');
    const userModel = this.classModel.db.model('User');

    const classNamesInFile = new Set<string>();

    // Optimization: fetch all needed data at once
    const allDeptCodes = [
      ...new Set(
        rawData
          .map((r: any) =>
            String(r['department_code'] || r['Mã khoa'] || '').trim(),
          )
          .filter(Boolean),
      ),
    ];
    const allEmails = [
      ...new Set(
        rawData
          .map((r: any) =>
            String(r['advisor_email'] || r['Email cố vấn'] || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    ];
    const allClassNames = [
      ...new Set(
        rawData
          .map((r: any) => String(r['class_name'] || r['Tên lớp'] || '').trim())
          .filter(Boolean),
      ),
    ];

    const depts = await deptModel.find({ code: { $in: allDeptCodes } }).exec();
    const deptMap = new Map(depts.map((d: any) => [d.code, d._id]));

    const users = await userModel.find({ email: { $in: allEmails } }).exec();
    const userMap = new Map(
      users.map((u: any) => [u.email.toLowerCase(), u._id]),
    );

    const existingClasses = await this.classModel
      .find({ class_name: { $in: allClassNames } })
      .exec();
    const existingClassSet = new Set(
      existingClasses.map((c: any) => c.class_name),
    );

    for (let i = 0; i < rawData.length; i++) {
      const row: any = rawData[i];
      const rowNumber = i + 2;

      const className = String(
        row['class_name'] || row['Tên lớp'] || '',
      ).trim();
      const classYear = String(
        row['class_year'] || row['Khóa/Năm học'] || '',
      ).trim();
      const deptCode = String(
        row['department_code'] || row['Mã khoa'] || '',
      ).trim();
      const advisorEmail = String(
        row['advisor_email'] || row['Email cố vấn'] || '',
      ).trim();
      const classCourse = String(
        row['class_course'] || row['Hệ đào tạo'] || '',
      ).trim();
      const headquarters = String(
        row['headquarters'] || row['Cơ sở'] || '',
      ).trim();

      const data = {
        class_name: className,
        class_year: classYear,
        department_code: deptCode,
        advisor_email: advisorEmail,
        class_course: classCourse,
        headquarters: headquarters,
      };

      const errors: string[] = [];
      let status = 'valid';

      if (!className) errors.push('Thiếu Tên lớp');
      if (!classYear) errors.push('Thiếu Khóa/Năm học');
      if (!deptCode) errors.push('Thiếu Mã khoa');

      if (errors.length > 0) {
        status = 'missing_required_field';
      } else {
        if (classNamesInFile.has(className)) {
          errors.push('Tên lớp bị trùng trong file');
          status = 'duplicate_in_file';
        } else {
          classNamesInFile.add(className);
        }

        if (!deptMap.has(deptCode)) {
          errors.push(`Không tìm thấy khoa có mã ${deptCode}`);
          if (status === 'valid') status = 'department_not_found';
        }

        if (advisorEmail && !userMap.has(advisorEmail.toLowerCase())) {
          errors.push(`Không tìm thấy cố vấn có email ${advisorEmail}`);
          if (status === 'valid') status = 'advisor_not_found';
        }

        if (existingClassSet.has(className)) {
          errors.push(`Lớp ${className} đã tồn tại trong hệ thống`);
          if (status === 'valid') status = 'duplicate_in_database';
        }
      }

      if (status === 'valid') {
        validRows++;
      } else if (status.includes('duplicate')) {
        duplicateRows++;
      } else {
        invalidRows++;
      }

      rows.push({
        rowNumber,
        status,
        data,
        errors,
      });
    }

    return {
      totalRows,
      validRows,
      invalidRows,
      duplicateRows,
      rows,
    };
  }

  async confirmImport(confirmDto: ImportClassConfirmDto) {
    const { rows, mode = 'skip_duplicates' } = confirmDto;

    const deptModel = this.classModel.db.model('Department');
    const userModel = this.classModel.db.model('User');

    const results = {
      success: 0,
      skipped: 0,
      errors: [] as any[],
    };

    if (mode === 'fail_on_duplicates') {
      const classNames = rows.map((r) => r.class_name);
      const existingCount = await this.classModel.countDocuments({
        class_name: { $in: classNames },
      });
      if (existingCount > 0) {
        throw new BadRequestException(
          'Có lớp đã tồn tại trong database (fail_on_duplicates mode).',
        );
      }
    }

    const allDeptCodes = [...new Set(rows.map((r) => r.department_code))];
    const depts = await deptModel.find({ code: { $in: allDeptCodes } }).exec();
    const deptMap = new Map(depts.map((d: any) => [d.code, d._id]));

    const allEmails = [
      ...new Set(
        rows.map((r) => r.advisor_email?.toLowerCase()).filter(Boolean),
      ),
    ];
    const users = await userModel.find({ email: { $in: allEmails } }).exec();
    const userMap = new Map(
      users.map((u: any) => [u.email.toLowerCase(), u._id]),
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const existingClass = await this.classModel
          .findOne({ class_name: row.class_name })
          .exec();
        if (existingClass) {
          results.skipped++;
          continue;
        }

        const deptId = deptMap.get(row.department_code);
        if (!deptId) {
          results.errors.push({
            row: i + 2,
            error: `Không tìm thấy khoa ${row.department_code}`,
          });
          continue;
        }

        let advisorId = null;
        if (row.advisor_email) {
          advisorId = userMap.get(row.advisor_email.toLowerCase());
        }

        const newClass = new this.classModel({
          class_name: row.class_name,
          class_year: row.class_year,
          dept_id: deptId,
          advisor_id: advisorId,
          class_course: row.class_course,
          headquarters: row.headquarters,
        });

        await newClass.save();
        results.success++;
      } catch (error: any) {
        results.errors.push({ row: i + 2, error: error.message });
      }
    }

    return results;
  }
}
