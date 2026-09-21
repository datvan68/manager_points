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
import { Criterion } from '../criteria/schemas/criterion.schema';
import { assertCanAccessStudent } from '../auth/utils/grading-access.util';
import { MarkAcademicRecordFollowUpDto } from './dto/mark-academic-record-follow-up.dto';
import { BulkMarkAcademicRecordFollowUpDto } from './dto/bulk-mark-academic-record-follow-up.dto';

@Injectable()
export class AcademicRecordFollowUpService {
  constructor(
    @InjectModel(AcademicRecordFollowUp.name)
    private readonly followUpModel: Model<any>,
    @InjectModel(AcademicRecord.name)
    private readonly academicRecordModel: Model<any>,
    @InjectModel(Criterion.name)
    private readonly criterionModel: Model<any>,
    @InjectModel(Student.name) private readonly studentModel: Model<any>,
    @InjectModel(Class.name) private readonly classModel: Model<any>,
  ) {}

  private validateIds(studentId: string, semesterId: string) {
    if (!Types.ObjectId.isValid(studentId) || !Types.ObjectId.isValid(semesterId)) {
      throw new BadRequestException('studentId hoặc semesterId không hợp lệ');
    }
  }

  private getSafeErrorMessage(error: any): string {
    const response = error?.getResponse?.();
    const message = typeof response === 'string'
      ? response
      : response?.message;
    return Array.isArray(message)
      ? message.join(', ')
      : typeof message === 'string' && message.trim()
        ? message
        : 'Không thể cập nhật trạng thái xử lý';
  }

  async markHandled(
    studentId: string,
    semesterId: string,
    dto: MarkAcademicRecordFollowUpDto,
    requester: any,
  ) {
    this.validateIds(studentId, semesterId);
    await assertCanAccessStudent(requester, studentId, this.classModel, this.studentModel);
    const disciplineCriteria = await this.criterionModel
      .find({ criterion_type: 'ky_luat' })
      .select('_id')
      .exec();
    const disciplineCriterionIds = disciplineCriteria.map((criterion: any) => criterion._id);
    const latest = await this.academicRecordModel
      .find({
        student_id: new Types.ObjectId(studentId),
        semester_id: new Types.ObjectId(semesterId),
        criterion_id: { $in: disciplineCriterionIds },
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
            criterion_id: { $in: disciplineCriterionIds },
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

  async bulkMarkHandled(
    dto: BulkMarkAcademicRecordFollowUpDto,
    requester: any,
  ) {
    const requested = Array.from(new Set(dto.studentIds));
    const succeeded: string[] = [];
    const failed: Array<{ studentId: string; message: string }> = [];

    for (const studentId of requested) {
      try {
        await this.markHandled(studentId, dto.semesterId, dto, requester);
        succeeded.push(studentId);
      } catch (error: any) {
        failed.push({ studentId, message: this.getSafeErrorMessage(error) });
      }
    }

    return {
      requested: requested.length,
      succeeded,
      failed,
      succeededCount: succeeded.length,
      failedCount: failed.length,
    };
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
