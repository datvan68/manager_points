import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EvaluationDetail,
  EvaluationDetailDocument,
} from './schemas/evaluation-detail.schema';
import { CreateEvaluationDetailDto } from './dto/create-evaluation-detail.dto';
import { UpdateEvaluationDetailDto } from './dto/update-evaluation-detail.dto';
import {
  AcademicRecord,
  AcademicRecordDocument,
} from '../academic-record/schemas/academic-record.schema';
import {
  Criterion,
  CriterionDocument,
} from '../criteria/schemas/criterion.schema';
import {
  SummaryPoint,
  SummaryPointDocument,
} from '../summaries-point/schemas/summary-point.schema';

@Injectable()
export class EvaluationDetailService {
  constructor(
    @InjectModel(AcademicRecord.name)
    private readonly academicRecordModel: Model<AcademicRecordDocument>,
    @InjectModel(Criterion.name)
    private readonly criterionModel: Model<CriterionDocument>,
    @InjectModel(SummaryPoint.name)
    private readonly summaryPointModel: Model<SummaryPointDocument>,
  ) {}

  /**
   * Helper function to sync direct grading academic records based on currentCount
   */
  private async syncAcademicRecords(
    summary: SummaryPointDocument,
    criterion: CriterionDocument,
    currentCount: number,
  ): Promise<void> {
    // Find all active academic records for this student, semester, and criterion
    const records = await this.academicRecordModel.find({
      student_id: summary.student_id as any,
      semester_id: summary.semester_id as any,
      criterion_id: criterion._id as any,
      status: 'active',
    } as any).exec();

    const diff = currentCount - records.length;
    if (diff > 0) {
      // Create diff new records
      const promises = [];
      for (let i = 0; i < diff; i++) {
        promises.push(
          new this.academicRecordModel({
            criterion_id: criterion._id as any,
            student_id: summary.student_id,
            semester_id: summary.semester_id,
            record_title: `${criterion.criterion_name} (Chấm điểm trực tiếp)`,
            status: 'active',
          }).save()
        );
      }
      await Promise.all(promises);
    } else if (diff < 0) {
      // Delete excess direct grading records, do not touch daily reports or manual entries
      const excessCount = Math.abs(diff);
      const deletableRecords = records.filter(
        (rec) => rec.record_title && rec.record_title.includes('(Chấm điểm trực tiếp)')
      );
      const recordsToDelete = deletableRecords.slice(0, excessCount);
      const promises = recordsToDelete.map((rec) =>
        this.academicRecordModel.findByIdAndDelete(rec._id).exec()
      );
      await Promise.all(promises);
    }
  }

  /**
   * Đếm số academic_record đã có sẵn cho 1 summary + 1 criterion.
   */
  async getPreExistingRecordCount(
    summaryId: string,
    criterionId: string,
  ): Promise<number> {
    const summary = await this.summaryPointModel.findById(summaryId).exec();
    if (!summary) return 0;

    const count = await this.academicRecordModel.countDocuments({
      student_id: summary.student_id as any,
      semester_id: summary.semester_id as any,
      criterion_id: new Types.ObjectId(criterionId) as any,
      status: 'active',
    } as any).exec();

    return count;
  }

  /**
   * Đếm hàng loạt số academic_record đã có sẵn cho tất cả criteria của 1 summary.
   */
  async getPreExistingCountsForSummary(
    summaryId: string,
  ): Promise<Record<string, { original_count: number; current_count: number }>> {
    const summary = await this.summaryPointModel.findById(summaryId).exec();
    if (!summary) return {};

    const records = await this.academicRecordModel.find({
      student_id: summary.student_id as any,
      semester_id: summary.semester_id as any,
      status: 'active',
    } as any).exec();

    const countsMap: Record<string, { original_count: number; current_count: number }> = {};
    records.forEach((rec) => {
      const criId = rec.criterion_id?.toString();
      if (criId) {
        if (!countsMap[criId]) {
          countsMap[criId] = { original_count: 0, current_count: 0 };
        }
        countsMap[criId].current_count += 1;
        // count system records and daily report records as original_count
        if (rec.daily_report_id) {
          countsMap[criId].original_count += 1;
        }
      }
    });

    return countsMap;
  }

  async create(
    createEvaluationDetailDto: CreateEvaluationDetailDto,
  ): Promise<EvaluationDetail> {
    const { summary_id, criterion_id, current_count, ...rest } = createEvaluationDetailDto;

    const summary = await this.summaryPointModel.findById(summary_id).exec();
    if (!summary) {
      throw new NotFoundException(`SummaryPoint with ID ${summary_id} not found`);
    }

    const criterion = await this.criterionModel.findById(criterion_id).exec();
    if (!criterion) {
      throw new NotFoundException(`Criterion with ID ${criterion_id} not found`);
    }

    // Check if detail already exists
    const existingIndex = summary.details.findIndex(
      (d) => d.criterion_id && d.criterion_id.toString() === criterion_id
    );
    if (existingIndex !== -1) {
      throw new ConflictException(`EvaluationDetail for Criterion ${criterion_id} already exists on this SummaryPoint`);
    }

    const countVal = current_count || 0;

    // Sync academic records first
    await this.syncAcademicRecords(summary, criterion, countVal);

    // Compute system score
    let systemScore = countVal * criterion.score_per_unit;
    if (criterion.score_per_unit >= 0) {
      systemScore = Math.max(criterion.min_score, Math.min(criterion.max_score, systemScore));
    } else {
      systemScore = Math.max(-criterion.max_score, Math.min(criterion.min_score, systemScore));
    }

    const newDetail: any = {
      _id: new Types.ObjectId(),
      criterion_id: new Types.ObjectId(criterion_id),
      current_count: countVal,
      system_score: systemScore,
      sv_score: rest.sv_score !== undefined ? rest.sv_score : systemScore,
      sv_submitted_at: rest.sv_submitted_at || null,
      gv_score: rest.gv_score !== undefined ? rest.gv_score : systemScore,
      gv_reviewed_at: rest.gv_reviewed_at || null,
      gv_reviewed_by: rest.gv_reviewed_by ? new Types.ObjectId(rest.gv_reviewed_by) : null,
      final_score: rest.final_score !== undefined ? rest.final_score : systemScore,
      locked_at: rest.locked_at || null,
      locked_by: rest.locked_by ? new Types.ObjectId(rest.locked_by) : null,
      status: rest.status || 'draft',
      description: rest.description || '',
      log: rest.log || [],
    };

    summary.details.push(newDetail);
    summary.markModified('details');
    await summary.save();

    return newDetail;
  }

  async findAll(): Promise<EvaluationDetail[]> {
    const summaries = await this.summaryPointModel.find().exec();
    return summaries.flatMap((s) => s.details || []);
  }

  async findOne(id: string): Promise<EvaluationDetail> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    const summary = await this.summaryPointModel.findOne({
      'details._id': new Types.ObjectId(id),
    }).exec();

    if (!summary) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    const detail = (summary.details as any).id(id);
    return detail;
  }

  async findBySummaryId(summaryId: string): Promise<EvaluationDetail[]> {
    if (!Types.ObjectId.isValid(summaryId)) {
      throw new NotFoundException(`SummaryPoint with ID ${summaryId} not found`);
    }

    const summary = await this.summaryPointModel.findById(summaryId).exec();
    return summary ? summary.details || [] : [];
  }

  async update(
    id: string,
    updateEvaluationDetailDto: UpdateEvaluationDetailDto,
  ): Promise<EvaluationDetail> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    const summary = await this.summaryPointModel.findOne({
      'details._id': new Types.ObjectId(id),
    }).exec();

    if (!summary) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    const detailIndex = summary.details.findIndex((d: any) => d._id.toString() === id);
    const detail = summary.details[detailIndex];

    const criterion = await this.criterionModel.findById(detail.criterion_id).exec();
    if (!criterion) {
      throw new NotFoundException(`Criterion with ID ${detail.criterion_id} not found`);
    }

    if (updateEvaluationDetailDto.current_count !== undefined) {
      let newCount = updateEvaluationDetailDto.current_count;

      const records = await this.academicRecordModel.find({
        student_id: summary.student_id as any,
        semester_id: summary.semester_id as any,
        criterion_id: criterion._id as any,
        status: 'active',
      } as any).exec();

      const originalCount = records.filter(
        (rec) => !(rec.record_title && rec.record_title.includes('(Chấm điểm trực tiếp)'))
      ).length;

      if (newCount < originalCount) {
        newCount = originalCount;
      }

      await this.syncAcademicRecords(summary, criterion, newCount);
      detail.current_count = newCount;

      let systemScore = newCount * criterion.score_per_unit;
      if (criterion.score_per_unit >= 0) {
        systemScore = Math.max(criterion.min_score, Math.min(criterion.max_score, systemScore));
      } else {
        systemScore = Math.max(-criterion.max_score, Math.min(criterion.min_score, systemScore));
      }
      detail.system_score = systemScore;
    }

    // Map other update properties
    if (updateEvaluationDetailDto.sv_score !== undefined) detail.sv_score = updateEvaluationDetailDto.sv_score;
    if (updateEvaluationDetailDto.sv_submitted_at !== undefined) detail.sv_submitted_at = updateEvaluationDetailDto.sv_submitted_at ? new Date(updateEvaluationDetailDto.sv_submitted_at) : null;
    if (updateEvaluationDetailDto.gv_score !== undefined) detail.gv_score = updateEvaluationDetailDto.gv_score;
    if (updateEvaluationDetailDto.gv_reviewed_at !== undefined) detail.gv_reviewed_at = updateEvaluationDetailDto.gv_reviewed_at ? new Date(updateEvaluationDetailDto.gv_reviewed_at) : null;
    if (updateEvaluationDetailDto.gv_reviewed_by !== undefined) detail.gv_reviewed_by = (updateEvaluationDetailDto.gv_reviewed_by ? new Types.ObjectId(updateEvaluationDetailDto.gv_reviewed_by) : null) as any;
    if (updateEvaluationDetailDto.final_score !== undefined) detail.final_score = updateEvaluationDetailDto.final_score;
    if (updateEvaluationDetailDto.locked_at !== undefined) detail.locked_at = updateEvaluationDetailDto.locked_at ? new Date(updateEvaluationDetailDto.locked_at) : null;
    if (updateEvaluationDetailDto.locked_by !== undefined) detail.locked_by = (updateEvaluationDetailDto.locked_by ? new Types.ObjectId(updateEvaluationDetailDto.locked_by) : null) as any;
    if (updateEvaluationDetailDto.status !== undefined) detail.status = updateEvaluationDetailDto.status;
    if (updateEvaluationDetailDto.description !== undefined) detail.description = updateEvaluationDetailDto.description;
    if (updateEvaluationDetailDto.log !== undefined) detail.log = updateEvaluationDetailDto.log as any;

    const updatedSummary = await this.summaryPointModel.findOneAndUpdate(
      { 'details._id': new Types.ObjectId(id) },
      {
        $set: {
          'details.$.current_count': detail.current_count,
          'details.$.system_score': detail.system_score,
          'details.$.sv_score': detail.sv_score,
          'details.$.sv_submitted_at': detail.sv_submitted_at,
          'details.$.gv_score': detail.gv_score,
          'details.$.gv_reviewed_at': detail.gv_reviewed_at,
          'details.$.gv_reviewed_by': detail.gv_reviewed_by,
          'details.$.final_score': detail.final_score,
          'details.$.locked_at': detail.locked_at,
          'details.$.locked_by': detail.locked_by,
          'details.$.status': detail.status,
          'details.$.description': detail.description,
          'details.$.log': detail.log,
        },
      },
      { returnDocument: 'after' },
    ).exec();

    if (!updatedSummary) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    const updatedDetail = (updatedSummary.details as any).id(id);
    return updatedDetail;
  }

  async remove(id: string): Promise<EvaluationDetail> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    const summary = await this.summaryPointModel.findOne({
      'details._id': new Types.ObjectId(id),
    }).exec();

    if (!summary) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    const detailIndex = summary.details.findIndex((d: any) => d._id.toString() === id);
    const deletedDetail = summary.details[detailIndex];

    summary.details.splice(detailIndex, 1);
    summary.markModified('details');
    await summary.save();

    // Clean up all linked academic records for this student/semester/criterion
    await this.academicRecordModel.deleteMany({
      student_id: summary.student_id as any,
      semester_id: summary.semester_id as any,
      criterion_id: deletedDetail.criterion_id as any,
    } as any).exec();

    return deletedDetail;
  }
}
