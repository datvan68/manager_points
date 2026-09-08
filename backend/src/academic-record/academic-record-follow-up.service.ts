import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AcademicRecord, AcademicRecordDocument } from './schemas/academic-record.schema';
import {
  AcademicRecordFollowUp,
  AcademicRecordFollowUpDocument,
} from './schemas/academic-record-follow-up.schema';
import { Student } from '../students/schemas/student.schema';
import { Class } from '../classes/schemas/class.schema';
import { assertCanAccessStudent } from '../auth/utils/grading-access.util';
import { MarkAcademicRecordFollowUpDto } from './dto/mark-academic-record-follow-up.dto';

@Injectable()
export class AcademicRecordFollowUpService {
  constructor(
    @InjectModel(AcademicRecordFollowUp.name)
    private readonly followUpModel: Model<any>,
    @InjectModel(AcademicRecord.name)
    private readonly academicRecordModel: Model<any>,
    @InjectModel(Student.name) private readonly studentModel: Model<any>,
    @InjectModel(Class.name) private readonly classModel: Model<any>,
  ) {}

  private validateIds(studentId: string, semesterId: string) {
    if (!Types.ObjectId.isValid(studentId) || !Types.ObjectId.isValid(semesterId)) {
      throw new BadRequestException('studentId hoặc semesterId không hợp lệ');
    }
  }

  async markHandled(
    studentId: string,
    semesterId: string,
    dto: MarkAcademicRecordFollowUpDto,
    requester: any,
  ) {
    this.validateIds(studentId, semesterId);
    await assertCanAccessStudent(requester, studentId, this.classModel, this.studentModel);
    const latest = await this.academicRecordModel
      .find({
        student_id: new Types.ObjectId(studentId),
        semester_id: new Types.ObjectId(semesterId),
        status: 'active',
        is_deleted: { $ne: true },
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(1)
      .lean()
      .exec();
    if (!latest[0]) throw new NotFoundException('Không có ghi nhận đang hoạt động để xử lý');

    const record = latest[0] as any;
    const handledAt = new Date();
    const checkpoint = await this.followUpModel.findOneAndUpdate(
      { student_id: new Types.ObjectId(studentId), semester_id: new Types.ObjectId(semesterId) },
      {
        $set: {
          handled_through_record_id: record._id,
          handled_through_created_at: record.createdAt,
          handled_record_count: await this.academicRecordModel.countDocuments({
            student_id: new Types.ObjectId(studentId),
            semester_id: new Types.ObjectId(semesterId),
            status: 'active',
            is_deleted: { $ne: true },
          }).exec(),
          handled_at: handledAt,
          handled_by: new Types.ObjectId(requester.userId),
          ...(dto?.note !== undefined ? { note: dto.note } : {}),
        },
        $setOnInsert: { student_id: new Types.ObjectId(studentId), semester_id: new Types.ObjectId(semesterId) },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean().exec();
    return { success: true, followUp: checkpoint };
  }

  async reset(studentId: string, semesterId: string, requester: any) {
    this.validateIds(studentId, semesterId);
    await assertCanAccessStudent(requester, studentId, this.classModel, this.studentModel);
    const result = await this.followUpModel.deleteOne({
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(semesterId),
    }).exec();
    return { success: true, deleted: result.deletedCount === 1 };
  }
}
