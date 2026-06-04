import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
    @InjectModel(EvaluationDetail.name)
    private readonly evaluationDetailModel: Model<EvaluationDetailDocument>,
    @InjectModel(AcademicRecord.name)
    private readonly academicRecordModel: Model<AcademicRecordDocument>,
    @InjectModel(Criterion.name)
    private readonly criterionModel: Model<CriterionDocument>,
    @InjectModel(SummaryPoint.name)
    private readonly summaryPointModel: Model<SummaryPointDocument>,
  ) {}

  /**
   * Đếm số academic_record đã có sẵn cho 1 summary + 1 criterion.
   * Dùng để frontend hiển thị giá trị mặc định trước khi tạo evaluation_detail.
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
      criteria_id: criterionId as any,
      status: 'active',
    }).exec();

    return count;
  }

  /**
   * Đếm hàng loạt số academic_record đã có sẵn cho tất cả criteria của 1 summary.
   * Trả về map { criterionId: count }
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
    }).exec();

    const countsMap: Record<string, { original_count: number; current_count: number }> = {};
    records.forEach(rec => {
      const criId = rec.criteria_id?.toString();
      if (criId) {
        if (!countsMap[criId]) {
          countsMap[criId] = { original_count: 0, current_count: 0 };
        }
        countsMap[criId].current_count += 1;
        // count system records and daily report records as original_count
        if ((rec as any).source === 'system' || rec.daily_report_id) {
          countsMap[criId].original_count += 1;
        }
      }
    });

    return countsMap;
  }

  private async syncAcademicRecords(detailId: string, currentCount: number): Promise<void> {
    const detail = await this.evaluationDetailModel.findById(detailId).exec();
    if (!detail) return;

    const summary = await this.summaryPointModel.findById(detail.summary_id).exec();
    const criterion = await this.criterionModel.findById(detail.criterion_id).exec();
    if (!summary || !criterion) return;

    // Find all active academic records for this student, semester, and criterion
    const records = await this.academicRecordModel.find({
      student_id: summary.student_id as any,
      semester_id: summary.semester_id as any,
      criteria_id: criterion._id as any,
      status: 'active',
    }).exec();

    // Link any orphaned pre-existing records to this evaluation_detail_id
    const linkPromises = records
      .filter(rec => !rec.evaluation_detail_id)
      .map(rec => {
        rec.evaluation_detail_id = detail._id as any;
        return rec.save();
      });
    await Promise.all(linkPromises);

    const diff = currentCount - records.length;
    if (diff > 0) {
      // Create diff new records
      const promises = [];
      for (let i = 0; i < diff; i++) {
        promises.push(
          new this.academicRecordModel({
            evaluation_detail_id: detail._id as any,
            criteria_id: criterion._id as any,
            student_id: summary.student_id,
            semester_id: summary.semester_id,
            record_title: `${criterion.criterion_name} (Chấm điểm trực tiếp)`,
            points_effect: criterion.score_per_unit || 0,
            status: 'active',
            source: 'direct_grading',
            date_record: new Date(),
          }).save()
        );
      }
      await Promise.all(promises);
    } else if (diff < 0) {
      // CHỈ xóa record tạo từ chấm điểm trực tiếp, KHÔNG xóa manual/system/daily_report
      const excessCount = Math.abs(diff);
      const deletableRecords = records.filter(rec => (rec as any).source === 'direct_grading');
      const recordsToDelete = deletableRecords.slice(0, excessCount);
      const promises = recordsToDelete.map(rec =>
        this.academicRecordModel.findByIdAndDelete(rec._id).exec()
      );
      await Promise.all(promises);
    }
  }

  async create(
    createEvaluationDetailDto: CreateEvaluationDetailDto,
  ): Promise<EvaluationDetail> {
    const { history, current_count, ...rest } = createEvaluationDetailDto;

    const dataToCreate: any = { ...rest };
    const countVal = current_count || 0;

    dataToCreate.current_count = countVal;
    dataToCreate.history =
      history && history.length > 0
        ? history.map(h => ({ ...h, count: h.count !== undefined ? h.count : countVal }))
        : [{ role: 'student', count: countVal, updated_at: new Date() }];

    const created = new this.evaluationDetailModel(dataToCreate);
    const saved = await created.save();
    
    await this.syncAcademicRecords(saved._id.toString(), countVal);

    return saved.populate(['summary_id', 'criterion_id']);
  }

  async findAll(): Promise<EvaluationDetail[]> {
    return this.evaluationDetailModel
      .find()
      .populate('summary_id')
      .populate('criterion_id')
      .exec();
  }

  async findOne(id: string): Promise<EvaluationDetail> {
    const detail = await this.evaluationDetailModel
      .findById(id)
      .populate('summary_id')
      .populate('criterion_id')
      .exec();
    if (!detail) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }
    return detail;
  }

  async findBySummaryId(summaryId: string): Promise<EvaluationDetail[]> {
    return this.evaluationDetailModel
      .find({ summary_id: summaryId as any })
      .populate('criterion_id')
      .exec();
  }

  async update(
    id: string,
    updateEvaluationDetailDto: UpdateEvaluationDetailDto,
  ): Promise<EvaluationDetail> {
    // Nếu có thay đổi current_count, clamp để không nhỏ hơn số record gốc (non-direct_grading)
    if (updateEvaluationDetailDto.current_count !== undefined) {
      const existing = await this.evaluationDetailModel.findById(id).exec();
      if (existing) {
        const summary = await this.summaryPointModel.findById(existing.summary_id).exec();
        const criterion = await this.criterionModel.findById(existing.criterion_id).exec();
        if (summary && criterion) {
          const records = await this.academicRecordModel.find({
            student_id: summary.student_id as any,
            semester_id: summary.semester_id as any,
            criteria_id: criterion._id as any,
            status: 'active',
          }).exec();
          // Đếm số record gốc (không phải direct_grading) — giá trị tối thiểu
          const originalCount = records.filter(rec => (rec as any).source !== 'direct_grading').length;
          if (updateEvaluationDetailDto.current_count < originalCount) {
            updateEvaluationDetailDto.current_count = originalCount;
          }
        }
      }
    }

    const updated = await this.evaluationDetailModel
      .findByIdAndUpdate(id, updateEvaluationDetailDto, {
        returnDocument: 'after',
      })
      .populate('summary_id')
      .populate('criterion_id')
      .exec();
    if (!updated) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    if (updateEvaluationDetailDto.current_count !== undefined) {
      await this.syncAcademicRecords(updated._id.toString(), updateEvaluationDetailDto.current_count);
    }

    return updated;
  }

  async remove(id: string): Promise<EvaluationDetail> {
    const deleted = await this.evaluationDetailModel
      .findByIdAndDelete(id)
      .exec();
    if (!deleted) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }
    
    // Delete all linked academic records
    await this.academicRecordModel.deleteMany({ evaluation_detail_id: deleted._id as any }).exec();

    return deleted;
  }
}
