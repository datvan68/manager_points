import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AcademicRecord,
  AcademicRecordDocument,
} from './schemas/academic-record.schema';
import {
  SummaryPoint,
  SummaryPointDocument,
} from '../summaries-point/schemas/summary-point.schema';
import {
  Criterion,
  CriterionDocument,
} from '../criteria/schemas/criterion.schema';
import { CreateAcademicRecordDto } from './dto/create-academic-record.dto';
import { BulkCreateAcademicRecordDto } from './dto/bulk-create-academic-record.dto';
import { UpdateAcademicRecordDto } from './dto/update-academic-record.dto';
import { Student } from '../students/schemas/student.schema';
import { Class } from '../classes/schemas/class.schema';
import { getRequesterRoleName, isStudent, isTeacher } from '../auth/utils/role.util';
import { SummariesPointService } from '../summaries-point/summaries-point.service';
import { gradingEventEmitter } from '../system/grading-event-emitter';
import { IntentScoreDto } from './dto/intent-score.dto';
import { calculateCriterionScoreHelper, normalizeObjectId, buildGradingEventPayload } from './academic-record.utils';


export interface AcademicRecordFindAllQuery {
  page?: number;
  limit?: number;
  search?: string;
  classId?: string;
  semesterId?: string;
  studentId?: string;
  startDate?: string;
  endDate?: string;
  creator?: string;
}

@Injectable()
export class AcademicRecordService {
  constructor(
    @InjectModel(AcademicRecord.name)
    private readonly academicRecordModel: Model<AcademicRecordDocument>,
    @InjectModel(SummaryPoint.name)
    private readonly summaryPointModel: Model<SummaryPointDocument>,
    @InjectModel(Criterion.name)
    private readonly criterionModel: Model<CriterionDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<any>,
    @InjectModel(Class.name)
    private readonly classModel: Model<any>,
    @Inject(forwardRef(() => SummariesPointService))
    private readonly summariesPointService: SummariesPointService,
  ) { }

  private importSessions = new Map<string, any>();

  private async checkSummaryLocked(studentId: any, semesterId: any): Promise<void> {
    if (!studentId || !semesterId) return;
    const summary = await this.summaryPointModel.findOne({
      student_id: new Types.ObjectId(normalizeObjectId(studentId)),
      semester_id: new Types.ObjectId(normalizeObjectId(semesterId)),
    } as any).exec();
    if (summary && summary.status === 'locked') {
      throw new BadRequestException('Không thể thực hiện thao tác do bảng điểm rèn luyện đã chốt.');
    }
  }

  private async safeSync(record: any): Promise<void> {
    if (!record) return;
    const studentId = normalizeObjectId(record.student_id);
    const semesterId = normalizeObjectId(record.semester_id);
    const criterionId = normalizeObjectId(record.criterion_id);

    if (studentId && semesterId && criterionId) {
      await this.syncStudentCriterionScore(studentId, semesterId, criterionId);
    }
  }

  /**
   * Helper function to sync student's criterion count and system score in SummaryPoint(s)
   */
  async syncStudentCriterionScore(
    studentId: string,
    semesterId: string,
    criterionId: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(studentId) || !Types.ObjectId.isValid(semesterId) || !Types.ObjectId.isValid(criterionId)) {
      return;
    }

    // 1. Count how many active academic records exist for this student, semester, and criterion
    const activeCount = await this.academicRecordModel.countDocuments({
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(semesterId),
      criterion_id: new Types.ObjectId(criterionId),
      status: 'active',
      is_deleted: { $ne: true },
    } as any).exec();

    // 2. Fetch the criterion definition to get details
    const criterion = await this.criterionModel.findById(criterionId).exec();
    if (!criterion) return;

    // 3. Compute system_score
    let optId: string | null = null;
    let optLabel: string | null = null;
    let optScore: number | null = null;
    let manualScore: number | null = null;

    if (activeCount > 0) {
      // Find the latest active record to extract option or manual score if applicable
      const latestRecord = await this.academicRecordModel.findOne({
        student_id: new Types.ObjectId(studentId),
        semester_id: new Types.ObjectId(semesterId),
        criterion_id: new Types.ObjectId(criterionId),
        status: 'active',
        is_deleted: { $ne: true },
      } as any).sort({ createdAt: -1 }).exec();

      if (latestRecord) {
        if (criterion.scoring_mode === 'single_option') {
          if (latestRecord.selected_option_id) {
            optId = latestRecord.selected_option_id;
            optLabel = latestRecord.selected_option_label || null;
            optScore = latestRecord.selected_option_score !== undefined ? latestRecord.selected_option_score : null;
          } else if (latestRecord.record_title && latestRecord.record_title.startsWith('Lựa chọn option ')) {
            optId = latestRecord.record_title.replace('Lựa chọn option ', '');
          }
        } else {
          if (latestRecord.record_title && latestRecord.record_title.startsWith('Nhập điểm tay: ')) {
            const manualScoreStr = latestRecord.record_title.replace('Nhập điểm tay: ', '');
            manualScore = parseFloat(manualScoreStr) || 0;
          }
        }
      }
    }

    const scoringResult = calculateCriterionScoreHelper({
      criterion,
      count: activeCount,
      selectedOptionId: optId,
      selectedOptionLabel: optLabel,
      selectedOptionScore: optScore,
      manualScore,
      isSyncPath: true,
    });

    const systemScore = scoringResult.systemScore;
    const selectedOptionId = scoringResult.selectedOptionId;
    const selectedOptionLabel = scoringResult.selectedOptionLabel;
    const selectedOptionScore = scoringResult.selectedOptionScore;


    // 4. Find all SummaryPoints for this student and semester
    let summaries = await this.summaryPointModel.find({
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(semesterId),
    } as any).exec();

    // If no summaries exist, we don't automatically create one since it should be generated via period/import flow
    // but just to be safe, if we need to initialize one, we can check.
    for (const summary of summaries) {
      if (summary.status === 'locked') {
        continue;
      }

      let success = false;
      let attempts = 0;
      while (!success && attempts < 3) {
        try {
          let currentSummary = summary;
          if (attempts > 0) {
            currentSummary = await this.summaryPointModel.findById(summary._id).exec() as any;
            if (!currentSummary || currentSummary.status === 'locked') break;
          }

          let details = currentSummary.details || [];
          const detailIndex = details.findIndex(
            (d: any) => d.criterion_id && d.criterion_id.toString() === criterionId,
          );

          if (detailIndex === -1) {
            // Add new embedded detail
            const newDetail: any = {
              criterion_id: new Types.ObjectId(criterionId),
              current_count: criterion.scoring_mode === 'single_option' ? (activeCount > 0 ? 1 : 0) : activeCount,
              system_score: systemScore,
              selected_option_id: selectedOptionId,
              selected_option_label: selectedOptionLabel,
              selected_option_score: selectedOptionScore,
              sv_score: null,
              sv_submitted_at: null,
              gv_score: null,
              gv_reviewed_at: null,
              gv_reviewed_by: null,
              final_score: null,
              locked_at: null,
              locked_by: null,
              status: 'draft',
              description: '',
              log: [],
            };
            if (newDetail.status === 'draft') {
              newDetail.sv_score = systemScore;
              newDetail.gv_score = systemScore;
            }
            details.push(newDetail);
          } else {
            // Update existing embedded detail
            const detail = details[detailIndex];
            detail.current_count = criterion.scoring_mode === 'single_option' ? (activeCount > 0 ? 1 : 0) : activeCount;
            detail.system_score = systemScore;
            detail.selected_option_id = selectedOptionId;
            detail.selected_option_label = selectedOptionLabel;
            detail.selected_option_score = selectedOptionScore;
            // Also update final_score to systemScore if it hasn't been set by student/gv/admin yet
            if (detail.status === 'draft') {
              if (detail.sv_score === null || detail.sv_score === undefined) {
                detail.sv_score = systemScore;
              }
              if (detail.gv_score === null || detail.gv_score === undefined) {
                detail.gv_score = systemScore;
              }
            }
            details[detailIndex] = detail;
          }

          currentSummary.details = details;
          currentSummary.markModified('details');
          await currentSummary.save();
          const recomputed = await this.summariesPointService.recomputeTotalScore(currentSummary._id.toString());
          const student = await this.studentModel.findById(studentId).exec();
          const payload = await buildGradingEventPayload({
            type: 'academic_record_changed',
            summary: recomputed || currentSummary,
            student,
            criterionIds: [criterionId],
          });
          gradingEventEmitter.emit('grading_event', payload);

          success = true;
        } catch (err: any) {
          if (err.name === 'VersionError') {
            attempts++;
            if (attempts >= 3) {
              console.warn(`[syncStudentCriterionScore] VersionError retries exhausted for summary ${summary._id}`);
              break;
            }
            await new Promise(res => setTimeout(res, 20 * attempts));
          } else {
            throw err;
          }
        }
      }
    }
  }


  async syncMultipleStudentCriterionScores(
    records: { student_id: any, semester_id: any, criterion_id: any }[]
  ): Promise<void> {
    if (!records || records.length === 0) return;

    // Group by student_id and semester_id
    const groups = new Map<string, { studentId: string; semesterId: string; criterionIds: Set<string> }>();
    for (const r of records) {
      const sId = normalizeObjectId(r.student_id);
      const semId = normalizeObjectId(r.semester_id);
      const cId = normalizeObjectId(r.criterion_id);
      if (!sId || !semId || !cId) continue;
      const key = `${sId}_${semId}`;
      if (!groups.has(key)) {
        groups.set(key, { studentId: sId, semesterId: semId, criterionIds: new Set() });
      }
      groups.get(key)!.criterionIds.add(cId);
    }

    // Preload criteria and categories definitions to avoid N+1 queries during sync & recompute
    const allCriterionIds = Array.from(new Set(records.map(r => r.criterion_id ? r.criterion_id.toString() : '').filter(Boolean)));
    const criteria = await this.criterionModel.find({ _id: { $in: allCriterionIds as any } } as any).lean().exec();
    const criteriaMap = new Map(criteria.map((c: any) => [c._id.toString(), c]));

    const allCategories = await this.summaryPointModel.db.model('Category').find().lean().exec();
    const allCriteria = await this.criterionModel.find().lean().exec();
    const preloadedMetadata = { categories: allCategories, criteria: allCriteria };

    // Sync each student/semester group
    for (const [_, group] of groups) {
      const { studentId, semesterId, criterionIds } = group;
      if (!Types.ObjectId.isValid(studentId) || !Types.ObjectId.isValid(semesterId)) continue;

      const student = await this.studentModel.findById(studentId).exec();

      // Count active academic records for all criteria of this student/semester in one aggregation
      const activeCounts = await this.academicRecordModel.aggregate([
        {
          $match: {
            student_id: new Types.ObjectId(studentId),
            semester_id: new Types.ObjectId(semesterId),
            criterion_id: { $in: Array.from(criterionIds).map(id => new Types.ObjectId(id)) },
            status: 'active',
            is_deleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: '$criterion_id',
            count: { $sum: 1 }
          }
        }
      ]);
      const countMap = new Map(activeCounts.map(c => [c._id.toString(), c.count]));

      // Preload latest records for all criteria in this student/semester group in one query
      const latestRecordsAgg = await this.academicRecordModel.aggregate([
        {
          $match: {
            student_id: new Types.ObjectId(studentId),
            semester_id: new Types.ObjectId(semesterId),
            criterion_id: { $in: Array.from(criterionIds).map(id => new Types.ObjectId(id)) },
            status: 'active',
            is_deleted: { $ne: true }
          }
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$criterion_id',
            latestDoc: { $first: '$$ROOT' }
          }
        }
      ]);
      const latestRecordMap = new Map(latestRecordsAgg.map(r => [r._id.toString(), r.latestDoc]));

      // Load all SummaryPoints for this student and semester
      const summaries = await this.summaryPointModel.find({
        student_id: new Types.ObjectId(studentId),
        semester_id: new Types.ObjectId(semesterId)
      } as any).exec();

      for (const summary of summaries) {
        if (summary.status === 'locked') continue;

        let success = false;
        let attempts = 0;
        while (!success && attempts < 3) {
          try {
            let currentSummary = summary;
            if (attempts > 0) {
              currentSummary = await this.summaryPointModel.findById(summary._id).exec() as any;
              if (!currentSummary || currentSummary.status === 'locked') break;
            }

            let details = currentSummary.details || [];

            for (const criterionId of criterionIds) {
              const criterion = criteriaMap.get(criterionId) as any;
              if (!criterion) continue;

              const activeCount = countMap.get(criterionId) || 0;
              const latestRecord = latestRecordMap.get(criterionId) as any;

              let optId: string | null = null;
              let optLabel: string | null = null;
              let optScore: number | null = null;
              let manualScore: number | null = null;

              if (activeCount > 0 && latestRecord) {
                if (criterion.scoring_mode === 'single_option') {
                  if (latestRecord.selected_option_id) {
                    optId = latestRecord.selected_option_id;
                    optLabel = latestRecord.selected_option_label || null;
                    optScore = latestRecord.selected_option_score !== undefined ? latestRecord.selected_option_score : null;
                  } else if (latestRecord.record_title && latestRecord.record_title.startsWith('Lựa chọn option ')) {
                    optId = latestRecord.record_title.replace('Lựa chọn option ', '');
                  }
                } else {
                  if (latestRecord.record_title && latestRecord.record_title.startsWith('Nhập điểm tay: ')) {
                    const manualScoreStr = latestRecord.record_title.replace('Nhập điểm tay: ', '');
                    manualScore = parseFloat(manualScoreStr) || 0;
                  }
                }
              }

              const scoringResult = calculateCriterionScoreHelper({
                criterion,
                count: activeCount,
                selectedOptionId: optId,
                selectedOptionLabel: optLabel,
                selectedOptionScore: optScore,
                manualScore,
                isSyncPath: true,
              });

              const systemScore = scoringResult.systemScore;
              const selectedOptionId = scoringResult.selectedOptionId;
              const selectedOptionLabel = scoringResult.selectedOptionLabel;
              const selectedOptionScore = scoringResult.selectedOptionScore;

              const detailIndex = details.findIndex((d: any) => d.criterion_id && d.criterion_id.toString() === criterionId);
              if (detailIndex === -1) {
                const newDetail: any = {
                  criterion_id: new Types.ObjectId(criterionId) as any,
                  current_count: scoringResult.currentCount,
                  system_score: systemScore,
                  selected_option_id: selectedOptionId,
                  selected_option_label: selectedOptionLabel,
                  selected_option_score: selectedOptionScore,
                  sv_score: null,
                  sv_submitted_at: null,
                  gv_score: null,
                  gv_reviewed_at: null,
                  gv_reviewed_by: null,
                  final_score: null,
                  locked_at: null,
                  locked_by: null,
                  status: 'draft',
                  description: '',
                  log: [],
                };
                if (newDetail.status === 'draft') {
                  newDetail.sv_score = systemScore;
                  newDetail.gv_score = systemScore;
                }
                details.push(newDetail);
              } else {
                const detail = details[detailIndex];
                detail.current_count = scoringResult.currentCount;
                detail.system_score = systemScore;
                detail.selected_option_id = selectedOptionId;
                detail.selected_option_label = selectedOptionLabel;
                detail.selected_option_score = selectedOptionScore;
                if (detail.status === 'draft') {
                  detail.sv_score = systemScore;
                  detail.gv_score = systemScore;
                }
                details[detailIndex] = detail;
              }
            }

            currentSummary.details = details;
            currentSummary.markModified('details');
            await currentSummary.save();
            const recomputed = await this.summariesPointService.recomputeTotalScore(currentSummary._id.toString(), preloadedMetadata);
            const payload = await buildGradingEventPayload({
              type: 'academic_record_changed',
              summary: recomputed || currentSummary,
              student,
              criterionIds: Array.from(criterionIds),
            });
            gradingEventEmitter.emit('grading_event', payload);

            success = true;
          } catch (err: any) {
            if (err.name === 'VersionError') {
              attempts++;
              if (attempts >= 3) {
                console.warn(`[syncMultipleStudentCriterionScores] VersionError retries exhausted for summary ${summary._id}`);
                break;
              }
              await new Promise(res => setTimeout(res, 20 * attempts));
            } else {
              throw err;
            }
          }
        }
      }
    }
  }


  async handleScoreIntent(intentDto: IntentScoreDto, requester?: any) {
    const { student_id, criterion_id, semester_id, intent_type, target_count, manual_score, selected_option_id, note } = intentDto;

    // Preflight check: check if the summary is locked
    await this.checkSummaryLocked(student_id, semester_id);

    // Verify permissions for the requester
    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      if (roleName.includes('teacher') || roleName.includes('advisor') || roleName.includes('giảng viên')) {
        const classes = await this.classModel.find({ advisor_id: requester.userId }).select('_id').exec();
        const classIds = classes.map((c: any) => c._id.toString());
        const student = await this.studentModel.findById(student_id).select('class_id').exec();
        if (!student || !student.class_id || !classIds.includes(student.class_id.toString())) {
          throw new ForbiddenException('Bạn không có quyền đánh giá sinh viên ngoài lớp phụ trách.');
        }
      } else if (roleName.includes('student')) {
        if (requester.userId !== student_id) {
          throw new ForbiddenException('Bạn không thể thao tác điểm của sinh viên khác.');
        }
      }
    }

    const requesterLevel = this.getRoleLevel(requester?.roleName);
    let changedRecordIds: string[] = [];

    if (intent_type === 'increase' || intent_type === 'decrease' || intent_type === 'set_target_count') {
      const criterion = await this.criterionModel.findById(criterion_id).exec();
      if (!criterion) {
        throw new NotFoundException(`Criterion with ID ${criterion_id} not found`);
      }

      let maxCount = 0;
      if (criterion.scoring_mode === 'single_option') {
        maxCount = 1;
      } else {
        const pointsPerUnit = criterion.score_per_unit || 0;
        if (pointsPerUnit === 0) {
          throw new BadRequestException('Tiêu chí này không hỗ trợ chế độ cộng trừ do điểm trên mỗi đơn vị bằng 0.');
        }
        const maxScore = criterion.max_score || 10;
        maxCount = Math.ceil(maxScore / Math.abs(pointsPerUnit));
      }

      const currentRecords = await this.academicRecordModel.find({
        student_id: new Types.ObjectId(student_id),
        semester_id: new Types.ObjectId(semester_id),
        criterion_id: new Types.ObjectId(criterion_id),
        status: 'active',
        is_deleted: { $ne: true },
      } as any)
        .populate({ path: 'recorded_by', populate: { path: 'role' } })
        .exec();

      let currentCount = currentRecords.length;
      let desiredCount = currentCount;

      if (intent_type === 'increase') desiredCount++;
      else if (intent_type === 'decrease') desiredCount--;
      else if (intent_type === 'set_target_count' && target_count !== undefined) desiredCount = target_count;

      desiredCount = Math.max(0, desiredCount);

      if (desiredCount > maxCount) {
        throw new BadRequestException(`Số lần tích lũy vượt quá giới hạn tối đa cho phép (${maxCount} lần).`);
      }

      if (desiredCount > currentCount) {
        // Need to add records
        const recordsToAdd = desiredCount - currentCount;
        const newRecords = [];
        for (let i = 0; i < recordsToAdd; i++) {
          newRecords.push({
            student_id: new Types.ObjectId(student_id) as any,
            semester_id: new Types.ObjectId(semester_id) as any,
            criterion_id: new Types.ObjectId(criterion_id) as any,
            recorded_by: requester?.userId,
            record_title: note || `Được thêm bởi ${requester?.roleName}`,
            status: 'active',
          });
        }
        const inserted = await this.academicRecordModel.insertMany(newRecords);
        changedRecordIds.push(...inserted.map(r => r._id.toString()));
      } else if (desiredCount < currentCount) {
        // Need to delete records
        let recordsToRemove = currentCount - desiredCount;
        // Reverse to delete the most recent ones first
        for (const record of currentRecords.reverse()) {
          if (recordsToRemove <= 0) break;

          let canDelete = false;
          if (requesterLevel >= 4) {
            canDelete = true;
          } else {
            let creatorRoleName = '';
            if (record.recorded_by && (record.recorded_by as any).role) {
              creatorRoleName = (record.recorded_by as any).role.role_name || '';
            } else if (record.recorded_by && (record.recorded_by as any).role_name) {
              creatorRoleName = (record.recorded_by as any).role_name;
            }

            let creatorLevel = this.getRoleLevel(creatorRoleName) || 1;

            const recordedById = record.recorded_by && (record.recorded_by as any)._id
              ? (record.recorded_by as any)._id.toString()
              : record.recorded_by?.toString();

            if (requesterLevel > creatorLevel || recordedById === requester?.userId) {
              canDelete = true;
            }
          }

          if (canDelete) {
            Logger.log(`[AUDIT_LOG] Hard-delete academic_record _id=${record._id} for student_id=${student_id}, requested_by=${requester?.userId}`);
            await this.academicRecordModel.deleteOne({ _id: record._id });
            changedRecordIds.push(record._id.toString());
            recordsToRemove--;
          }
        }
      }
    } else if (intent_type === 'select_option') {
      const criterion = await this.criterionModel.findById(criterion_id).exec();
      if (!criterion) {
        throw new NotFoundException(`Criterion with ID ${criterion_id} not found`);
      }
      if (criterion.scoring_mode !== 'single_option') {
        throw new BadRequestException('Tiêu chí này không hỗ trợ chế độ chấm điểm lựa chọn duy nhất (single_option).');
      }

      let existingRecord = await this.academicRecordModel.findOne({
        student_id: new Types.ObjectId(student_id),
        semester_id: new Types.ObjectId(semester_id),
        criterion_id: new Types.ObjectId(criterion_id),
        status: 'active',
        is_deleted: { $ne: true },
      } as any).exec();

      if (selected_option_id) {
        const option = criterion.options?.find((o: any) => o.id === selected_option_id);
        if (!option) {
          throw new BadRequestException(`Lựa chọn có ID '${selected_option_id}' không tồn tại trong tiêu chí này.`);
        }

        if (existingRecord) {
          // Kiểm tra xem user có quyền thay đổi không
          let canUpdate = false;
          if (requesterLevel >= 4) {
            canUpdate = true;
          } else {
            let creatorRoleName = '';
            if (existingRecord.recorded_by && (existingRecord.recorded_by as any).role) {
              creatorRoleName = (existingRecord.recorded_by as any).role.role_name || '';
            } else if (existingRecord.recorded_by && (existingRecord.recorded_by as any).role_name) {
              creatorRoleName = (existingRecord.recorded_by as any).role_name;
            }
            let creatorLevel = this.getRoleLevel(creatorRoleName) || 1;
            const recordedById = existingRecord.recorded_by && (existingRecord.recorded_by as any)._id
              ? (existingRecord.recorded_by as any)._id.toString()
              : existingRecord.recorded_by?.toString();

            if (requesterLevel > creatorLevel || recordedById === requester?.userId) {
              canUpdate = true;
            }
          }
          if (!canUpdate) {
            throw new ForbiddenException('Bạn không có quyền sửa đổi điểm do người khác chấm.');
          }

          existingRecord.selected_option_id = selected_option_id;
          existingRecord.selected_option_label = option.label;
          existingRecord.selected_option_score = option.score;
          existingRecord.record_title = `Lựa chọn option ${selected_option_id}`;
          existingRecord.recorded_by = requester?.userId;
          await existingRecord.save();
          changedRecordIds.push(existingRecord._id.toString());
        } else {
          const created = await this.academicRecordModel.create({
            student_id: new Types.ObjectId(student_id) as any,
            semester_id: new Types.ObjectId(semester_id) as any,
            criterion_id: new Types.ObjectId(criterion_id) as any,
            recorded_by: requester?.userId,
            selected_option_id: selected_option_id,
            selected_option_label: option.label,
            selected_option_score: option.score,
            record_title: `Lựa chọn option ${selected_option_id}`,
            status: 'active',
          });
          changedRecordIds.push(created._id.toString());
        }
      } else {
        // Xóa option (bỏ chọn)
        if (existingRecord) {
          let canDelete = false;
          if (requesterLevel >= 4) {
            canDelete = true;
          } else {
            let creatorRoleName = '';
            if (existingRecord.recorded_by && (existingRecord.recorded_by as any).role) {
              creatorRoleName = (existingRecord.recorded_by as any).role.role_name || '';
            } else if (existingRecord.recorded_by && (existingRecord.recorded_by as any).role_name) {
              creatorRoleName = (existingRecord.recorded_by as any).role_name;
            }
            let creatorLevel = this.getRoleLevel(creatorRoleName) || 1;
            const recordedById = existingRecord.recorded_by && (existingRecord.recorded_by as any)._id
              ? (existingRecord.recorded_by as any)._id.toString()
              : existingRecord.recorded_by?.toString();

            if (requesterLevel > creatorLevel || recordedById === requester?.userId) {
              canDelete = true;
            }
          }

          if (!canDelete) {
            throw new ForbiddenException('Bạn không có quyền xóa điểm do người khác chấm.');
          }

          await this.academicRecordModel.deleteOne({ _id: existingRecord._id });
          changedRecordIds.push(existingRecord._id.toString());
        }
      }
    } else if (intent_type === 'set_manual_score') {
      let existingRecord = await this.academicRecordModel.findOne({
        student_id: new Types.ObjectId(student_id),
        semester_id: new Types.ObjectId(semester_id),
        criterion_id: new Types.ObjectId(criterion_id),
        status: 'active',
        is_deleted: { $ne: true },
      } as any).exec();

      if (existingRecord) {
        existingRecord.record_title = `Nhập điểm tay: ${manual_score}`;
        existingRecord.recorded_by = requester?.userId;
        await existingRecord.save();
        changedRecordIds.push(existingRecord._id.toString());
      } else {
        const created = await this.academicRecordModel.create({
          student_id: new Types.ObjectId(student_id) as any,
          semester_id: new Types.ObjectId(semester_id) as any,
          criterion_id: new Types.ObjectId(criterion_id) as any,
          recorded_by: requester?.userId,
          record_title: `Nhập điểm tay: ${manual_score}`,
          status: 'active',
        });
        changedRecordIds.push(created._id.toString());
      }

    } else if (intent_type === 'clear_score') {
      const currentRecords = await this.academicRecordModel.find({
        student_id: new Types.ObjectId(student_id),
        semester_id: new Types.ObjectId(semester_id),
        criterion_id: new Types.ObjectId(criterion_id),
        status: 'active',
        is_deleted: { $ne: true },
      } as any)
        .populate({ path: 'recorded_by', populate: { path: 'role' } })
        .exec();

      for (const record of currentRecords) {
        let canDelete = false;
        if (requesterLevel >= 4) {
          canDelete = true;
        } else {
          let creatorRoleName = '';
          if (record.recorded_by && (record.recorded_by as any).role) {
            creatorRoleName = (record.recorded_by as any).role.role_name || '';
          } else if (record.recorded_by && (record.recorded_by as any).role_name) {
            creatorRoleName = (record.recorded_by as any).role_name;
          }

          let creatorLevel = this.getRoleLevel(creatorRoleName) || 1;

          const recordedById = record.recorded_by && (record.recorded_by as any)._id
            ? (record.recorded_by as any)._id.toString()
            : record.recorded_by?.toString();

          if (requesterLevel > creatorLevel || recordedById === requester?.userId) {
            canDelete = true;
          }
        }

        if (canDelete) {
          Logger.log(`[AUDIT_LOG] Hard-delete academic_record _id=${record._id} for clear_score requested_by=${requester?.userId}`);
          await this.academicRecordModel.deleteOne({ _id: record._id });
          changedRecordIds.push(record._id.toString());
        }
      }
    }

    // Rebuild detail
    await this.syncStudentCriterionScore(student_id, semester_id, criterion_id);

    // Return the updated summary and actual count
    const summary = await this.summaryPointModel.findOne({
      student_id: new Types.ObjectId(student_id),
      semester_id: new Types.ObjectId(semester_id),
    } as any).lean().exec();

    const detail = (summary as any)?.details?.find((d: any) => d.criterion_id?.toString() === criterion_id);

    let syncStatus: 'synced' | 'summary_missing' | 'summary_locked' = 'synced';
    if (!summary) {
      syncStatus = 'summary_missing';
    } else if (summary.status === 'locked') {
      syncStatus = 'summary_locked';
    }

    return {
      success: true,
      actual_count: detail?.current_count || 0,
      evaluation_detail: detail,
      summary: summary ? {
        _id: summary._id.toString(),
        total_score: summary.total_score,
        grading: summary.grading,
        status: summary.status
      } : null,
      changed_record_ids: changedRecordIds,
      sync_status: syncStatus,
    };
  }

  private getRoleLevel(roleName?: string): number {
    if (!roleName) return 1;
    const nameLower = roleName.toLowerCase();
    if (nameLower.includes('admin')) return 4;
    if (nameLower.includes('supervisor') || nameLower.includes('quản sinh') || nameLower.includes('quan sinh')) return 3;
    if (
      nameLower.includes('teacher') ||
      nameLower.includes('adviser') ||
      nameLower.includes('advisor') ||
      nameLower.includes('giảng viên') ||
      nameLower.includes('giang vien') ||
      nameLower.includes('lecturer')
    ) {
      return 2;
    }
    return 1;
  }

  async create(
    createAcademicRecordDto: CreateAcademicRecordDto,
    requester?: any,
  ): Promise<AcademicRecord> {
    await this.checkSummaryLocked(createAcademicRecordDto.student_id, createAcademicRecordDto.semester_id);

    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      if (roleName.includes('teacher') || roleName.includes('advisor') || roleName.includes('giảng viên')) {
        const classes = await this.classModel.find({ advisor_id: requester.userId }).select('_id').exec();
        const classIds = classes.map(c => c._id.toString());
        const student = await this.studentModel.findById(createAcademicRecordDto.student_id).select('class_id').exec();
        if (!student || !student.class_id || !classIds.includes(student.class_id.toString())) {
          throw new ForbiddenException('Bạn không có quyền đánh giá sinh viên ngoài lớp phụ trách.');
        }
      }
    }

    const createdRecord = new this.academicRecordModel(createAcademicRecordDto);
    const saved = await createdRecord.save();

    // Sync points to SummaryPoints
    await this.safeSync(saved);

    return saved.populate([
      { path: 'criterion_id' },
      { path: 'student_id' },
      { path: 'semester_id' },
      { path: 'daily_report_id' },
      { path: 'recorded_by', populate: { path: 'role' } },
    ]);
  }

  async bulkCreate(
    bulkCreateDto: BulkCreateAcademicRecordDto,
    requester?: any,
  ): Promise<any> {
    const { records } = bulkCreateDto;
    if (records && records.length > 0) {
      const studentSemMap = new Map<string, { studentId: string; semesterId: string }>();
      for (const record of records) {
        const sId = record.student_id ? normalizeObjectId(record.student_id) : '';
        const semId = record.semester_id ? normalizeObjectId(record.semester_id) : '';
        if (sId && semId) {
          studentSemMap.set(`${sId}_${semId}`, { studentId: sId, semesterId: semId });
        }
      }
      for (const { studentId, semesterId } of studentSemMap.values()) {
        await this.checkSummaryLocked(studentId, semesterId);
      }
    }
    if (!records || records.length === 0) {
      return { batchId: Date.now().toString(), acceptedCount: 0, insertedCount: 0, duplicatedCount: 0, failedItems: [], createdRecordIds: [], groupsSynced: 0 };
    }

    let validStudentIds: Set<string> | null = null;
    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      // Nếu là Teacher, chỉ được ghi nhận cho sinh viên lớp mình
      if (roleName.includes('teacher') || roleName.includes('advisor') || roleName.includes('giảng viên')) {
        const classes = await this.classModel.find({ advisor_id: requester.userId }).select('_id').exec();
        const classIds = classes.map(c => c._id);
        const students = await this.studentModel.find({ class_id: { $in: classIds } }).select('_id').exec();
        validStudentIds = new Set(students.map(s => s._id.toString()));
      }
    }

    const validRecords = [];
    const failedItems = [];
    const idempotencyMap = new Map<string, boolean>();

    for (const record of records) {
      // Validate RBAC
      if (validStudentIds && !validStudentIds.has(record.student_id.toString())) {
        failedItems.push({ record, reason: 'Không có quyền đánh giá sinh viên này' });
        continue;
      }

      // Lọc bỏ trùng lặp trong cùng batch
      if (record.idempotency_key) {
        if (idempotencyMap.has(record.idempotency_key)) {
          failedItems.push({ record, reason: 'Trùng idempotency_key trong cùng batch' });
          continue;
        }
        idempotencyMap.set(record.idempotency_key, true);
      }
      validRecords.push(record);
    }

    if (validRecords.length === 0) {
      return {
        batchId: Date.now().toString(),
        acceptedCount: records.length,
        insertedCount: 0,
        duplicatedCount: 0,
        failedItems,
        createdRecordIds: [],
        groupsSynced: 0
      };
    }

    // Insert batch records với ordered: false để bỏ qua duplicate keys
    const insertOps = validRecords.map(record => ({
      insertOne: {
        document: record
      }
    }));

    let result;
    let duplicatedCount = 0;
    try {
      result = await this.academicRecordModel.bulkWrite(insertOps as any, { ordered: false });
    } catch (err) {
      if (err.code !== 11000 && !err.message.includes('11000')) {
        throw err;
      }
      // Dù có lỗi 11000 thì các document không bị trùng vẫn được insert vì ordered: false
      result = err.result || err;
      duplicatedCount = err.writeErrors ? err.writeErrors.length : (validRecords.length - (result.insertedCount || result.nInserted || 0));
    }

    const insertedCount = result?.insertedCount || result?.nInserted || 0;
    const createdRecordIds = result?.insertedIds ? Object.values(result.insertedIds) : [];

    // Gom nhóm theo student_id + semester_id + criterion_id để sync
    const groups = new Set<string>();
    for (const record of validRecords) {
      const key = `${record.student_id}_${record.semester_id}_${record.criterion_id}`;
      groups.add(key);
    }

    // Chạy sync point cho từng nhóm, giới hạn concurrency
    const syncFuncs = Array.from(groups).map(groupKey => {
      const [studentId, semesterId, criterionId] = groupKey.split('_');
      return () => this.syncStudentCriterionScore(studentId, semesterId, criterionId);
    });

    const chunkSize = 10;
    for (let i = 0; i < syncFuncs.length; i += chunkSize) {
      const chunk = syncFuncs.slice(i, i + chunkSize);
      await Promise.all(chunk.map(f => f()));
    }

    return {
      batchId: Date.now().toString(),
      acceptedCount: records.length,
      insertedCount,
      duplicatedCount,
      failedItems,
      createdRecordIds,
      groupsSynced: groups.size,
    };
  }

  async findAll(
    query?: AcademicRecordFindAllQuery,
    requester?: any,
  ): Promise<any> {
    let page: number | undefined;
    let limit: number | undefined;
    let search: string | undefined;
    let classId: string | undefined;
    let semesterId: string | undefined;
    let studentId: string | undefined;
    let actualRequester = requester;

    if (query && ('roleName' in query || 'userId' in query || 'role' in query || 'username' in query)) {
      actualRequester = query;
    } else if (query) {
      page = query.page;
      limit = query.limit;
      search = query.search;
      classId = query.classId;
      semesterId = query.semesterId;
      studentId = query.studentId;
    }

    const isPaginationRequested = page !== undefined || limit !== undefined;
    const filter: any = { status: 'active', is_deleted: { $ne: true } };

    if (actualRequester) {
      const roleName = (actualRequester.roleName || '').toLowerCase();

      // Nếu là Student, chỉ trả về các bản ghi thuộc student của user đó
      if (roleName.includes('student')) {
        const student = await this.studentModel.findOne({ user_id: new Types.ObjectId(actualRequester.userId) }).exec();
        if (!student) {
          return isPaginationRequested ? { data: [], meta: { total: 0, page: page || 1, limit: limit || 10, totalPages: 0 } } : [];
        }
        filter.student_id = student._id;
      }
      // Nếu là Teacher, chỉ trả về các bản ghi thuộc class của teacher phụ trách
      else if (roleName.includes('teacher') || roleName.includes('advisor') || roleName.includes('giảng viên')) {
        const classes = await this.classModel.find({ advisor_id: actualRequester.userId }).select('_id').exec();
        const classIds = classes.map(c => c._id);

        const students = await this.studentModel.find({ class_id: { $in: classIds } }).select('_id').exec();
        const studentIds = students.map(s => s._id);

        filter.student_id = { $in: studentIds };
      }
    }

    // Apply class filter if provided
    if (classId && Types.ObjectId.isValid(classId)) {
      const classStudents = await this.studentModel.find({ class_id: new Types.ObjectId(classId) }).select('_id').exec();
      const classStudentIds = classStudents.map(s => s._id);

      if (filter.student_id) {
        if (filter.student_id.$in) {
          filter.student_id.$in = filter.student_id.$in.filter((id: any) =>
            classStudentIds.some(csId => csId.toString() === id.toString())
          );
        } else {
          // Lọc theo một studentId cụ thể của Student
          if (!classStudentIds.some(csId => csId.toString() === filter.student_id.toString())) {
            return isPaginationRequested ? { data: [], meta: { total: 0, page: page || 1, limit: limit || 10, totalPages: 0 } } : [];
          }
        }
      } else {
        filter.student_id = { $in: classStudentIds };
      }
    }

    // Apply student filter if provided
    if (studentId && Types.ObjectId.isValid(studentId)) {
      const targetStudentObjectId = new Types.ObjectId(studentId);
      if (filter.student_id) {
        if (filter.student_id.$in) {
          const hasAccess = filter.student_id.$in.some((id: any) => id.toString() === studentId);
          if (!hasAccess) {
            return isPaginationRequested ? { data: [], meta: { total: 0, page: page || 1, limit: limit || 10, totalPages: 0 } } : [];
          }
        } else {
          if (filter.student_id.toString() !== studentId) {
            return isPaginationRequested ? { data: [], meta: { total: 0, page: page || 1, limit: limit || 10, totalPages: 0 } } : [];
          }
        }
      }
      filter.student_id = targetStudentObjectId;
    }

    // Apply semester filter
    if (semesterId && Types.ObjectId.isValid(semesterId)) {
      filter.semester_id = new Types.ObjectId(semesterId);
    }

    // Apply search filter
    if (search) {
      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        const escapedSearch = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Find students matching search
        const matchingStudents = await this.studentModel.find({
          $or: [
            { full_name: { $regex: escapedSearch, $options: 'i' } },
            { student_code: { $regex: escapedSearch, $options: 'i' } }
          ]
        }).select('_id').exec();
        const studentIds = matchingStudents.map((s: any) => s._id);

        // Find criteria matching search
        const matchingCriteria = await this.criterionModel.find({
          criterion_name: { $regex: escapedSearch, $options: 'i' }
        }).select('_id').exec();
        const criterionIds = matchingCriteria.map((c: any) => c._id);

        if (!filter.$and) filter.$and = [];
        filter.$and.push({
          $or: [
            { record_title: { $regex: escapedSearch, $options: 'i' } },
            { description: { $regex: escapedSearch, $options: 'i' } },
            { student_id: { $in: studentIds } },
            { criterion_id: { $in: criterionIds } }
          ]
        });
      }
    }

    // Process creator query if provided
    const creator = query?.creator;
    if (creator && creator !== 'all') {
      try {
        const roleModel = this.academicRecordModel.db.model('Role');
        const userModel = this.academicRecordModel.db.model('User');

        let roleRegex = '';
        if (creator === 'admin') roleRegex = 'admin';
        else if (creator === 'supervisor') roleRegex = 'supervisor|quản sinh|quan sinh';
        else if (creator === 'teacher') roleRegex = 'teacher|advisor|giảng viên|giang vien';
        else if (creator === 'student') roleRegex = 'student|học sinh|sinh viên';

        if (roleRegex) {
          const matchingRoles = await roleModel.find({ name: { $regex: roleRegex, $options: 'i' } }).select('_id').exec();
          const roleIds = matchingRoles.map((r: any) => r._id);

          const matchingUsers = await userModel.find({ role: { $in: roleIds } }).select('_id').exec();
          const userIds = matchingUsers.map((u: any) => u._id);

          filter.recorded_by = { $in: userIds };
        }
      } catch (err) {
        console.warn('Could not filter by creator due to missing models or error:', err);
      }
    }

    const startDate = query?.startDate;
    const endDate = query?.endDate;
    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) {
        dateFilter.$gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        dateFilter.$lte = new Date(`${endDate}T23:59:59.999Z`);
      }
      if (!filter.$and) filter.$and = [];
      filter.$and.push({
        $or: [
          { recorded_at: dateFilter },
          { date_record: dateFilter }
        ]
      });
    }

    if (isPaginationRequested) {
      const p = page || 1;
      const l = limit || 10;

      const [records, total] = await Promise.all([
        this.academicRecordModel
          .find(filter)
          .populate('criterion_id')
          .populate('student_id')
          .populate('semester_id')
          .populate('daily_report_id')
          .populate({ path: 'recorded_by', populate: { path: 'role' } })
          .sort({ recorded_at: -1, createdAt: -1 })
          .skip((p - 1) * l)
          .limit(l)
          .exec(),
        this.academicRecordModel.countDocuments(filter).exec()
      ]);

      return {
        data: records,
        meta: {
          total,
          page: p,
          limit: l,
          totalPages: Math.ceil(total / l)
        }
      };
    } else {
      return this.academicRecordModel
        .find(filter)
        .populate('criterion_id')
        .populate('student_id')
        .populate('semester_id')
        .populate('daily_report_id')
        .populate({ path: 'recorded_by', populate: { path: 'role' } })
        .sort({ recorded_at: -1, createdAt: -1 })
        .exec();
    }
  }

  async findDeleted(requester?: any): Promise<AcademicRecord[]> {
    const filter: any = { $or: [{ status: 'inactive' }, { is_deleted: true }] };

    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      if (roleName.includes('student')) {
        const student = await this.studentModel.findOne({ user_id: new Types.ObjectId(requester.userId) }).exec();
        if (!student) return [];
        filter.student_id = student._id;
      } else if (roleName.includes('teacher') || roleName.includes('advisor') || roleName.includes('giảng viên')) {
        const classes = await this.classModel.find({ advisor_id: requester.userId }).select('_id').exec();
        const classIds = classes.map(c => c._id);
        const students = await this.studentModel.find({ class_id: { $in: classIds } }).select('_id').exec();
        const studentIds = students.map(s => s._id);
        filter.student_id = { $in: studentIds };
      }
    }

    return this.academicRecordModel
      .find(filter)
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
  }

  async findOne(id: string, requester?: any): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }
    const record = await this.academicRecordModel
      .findOne({ _id: id, status: 'active', is_deleted: { $ne: true } })
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
    if (!record) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      if (roleName.includes('student')) {
        const studentEmail = record.student_id && typeof record.student_id === 'object' ? (record.student_id as any).email : '';
        if (!requester.email || !studentEmail || requester.email.toLowerCase() !== studentEmail.toLowerCase()) {
          throw new ForbiddenException('Bạn không có quyền truy cập ghi nhận rèn luyện của sinh viên khác.');
        }
      } else if (roleName.includes('teacher') || roleName.includes('advisor') || roleName.includes('giảng viên')) {
        const classes = await this.classModel.find({ advisor_id: requester.userId }).select('_id').exec();
        const classIds = classes.map(c => c._id.toString());
        const studentClassId = record.student_id && typeof record.student_id === 'object' ? (record.student_id as any).class_id?.toString() : null;
        if (!studentClassId || !classIds.includes(studentClassId)) {
          throw new ForbiddenException('Bạn không có quyền truy cập sinh viên ngoài lớp phụ trách.');
        }
      }
    }

    return record;
  }

  async findByStudentId(studentId: string, requester?: any): Promise<AcademicRecord[]> {
    if (!Types.ObjectId.isValid(studentId)) {
      return [];
    }

    if (requester) {
      const roleName = getRequesterRoleName(requester);
      const isRequesterStudent = roleName === 'Student';
      const isRequesterTeacher = roleName === 'Teacher';

      if (isRequesterStudent) {
        const student = await this.studentModel.findOne({ user_id: new Types.ObjectId(requester.userId) }).exec();
        if (!student || student._id.toString() !== studentId) {
          throw new ForbiddenException('Bạn không có quyền truy cập ghi nhận rèn luyện của sinh viên khác.');
        }
      } else if (isRequesterTeacher) {
        const classes = await this.classModel.find({ advisor_id: requester.userId }).select('_id').exec();
        const classIds = classes.map(c => c._id.toString());

        const student = await this.studentModel.findById(studentId).exec();
        if (!student || !student.class_id || !classIds.includes(student.class_id.toString())) {
          throw new ForbiddenException('Bạn không có quyền truy cập sinh viên ngoài lớp phụ trách.');
        }
      }
    }

    return this.academicRecordModel
      .find({ student_id: new Types.ObjectId(studentId), status: 'active', is_deleted: { $ne: true } } as any)
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
  }

  async findByDailyReportId(dailyReportId: string, includeDeleted: boolean = false, requester?: any): Promise<AcademicRecord[]> {
    if (!Types.ObjectId.isValid(dailyReportId)) {
      return [];
    }
    const query: any = includeDeleted
      ? { daily_report_id: new Types.ObjectId(dailyReportId) }
      : { daily_report_id: new Types.ObjectId(dailyReportId), status: 'active', is_deleted: { $ne: true } };

    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      if (roleName.includes('student')) {
        const student = await this.studentModel.findOne({ user_id: new Types.ObjectId(requester.userId) }).exec();
        if (!student) return [];
        query.student_id = student._id;
      } else if (roleName.includes('teacher') || roleName.includes('advisor') || roleName.includes('giảng viên')) {
        const classes = await this.classModel.find({ advisor_id: requester.userId }).select('_id').exec();
        const classIds = classes.map(c => c._id);
        const students = await this.studentModel.find({ class_id: { $in: classIds } }).select('_id').exec();
        const studentIds = students.map(s => s._id);
        query.student_id = { $in: studentIds };
      }
    }

    return this.academicRecordModel
      .find(query)
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
  }

  async update(
    id: string,
    updateAcademicRecordDto: UpdateAcademicRecordDto,
    requester?: any,
    bypassDailyReportCheck: boolean = false,
  ): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const oldRecord = await this.academicRecordModel.findOne({ _id: id, status: 'active', is_deleted: { $ne: true } })
      .populate('student_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
    if (!oldRecord) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    await this.checkSummaryLocked(oldRecord.student_id, oldRecord.semester_id);
    if (updateAcademicRecordDto.student_id || updateAcademicRecordDto.semester_id) {
      const nextStudent = updateAcademicRecordDto.student_id || oldRecord.student_id;
      const nextSemester = updateAcademicRecordDto.semester_id || oldRecord.semester_id;
      await this.checkSummaryLocked(nextStudent, nextSemester);
    }

    if (oldRecord.daily_report_id && !bypassDailyReportCheck) {
      throw new BadRequestException(
        'Ghi nhận này thuộc báo cáo điểm danh ngày, không thể chỉnh sửa trực tiếp. Vui lòng chỉnh sửa qua báo cáo ngày tương ứng.',
      );
    }

    if (!bypassDailyReportCheck && requester) {
      this.checkHierarchyPermission(oldRecord, requester);
    }

    const updated = await this.academicRecordModel
      .findByIdAndUpdate(id, updateAcademicRecordDto, {
        returnDocument: 'after',
      })
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
    if (!updated) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    // Sync old key
    await this.safeSync(oldRecord);

    // Sync new key if changed
    const oldStudent = oldRecord.student_id ? oldRecord.student_id.toString() : '';
    const oldSemester = oldRecord.semester_id ? oldRecord.semester_id.toString() : '';
    const oldCriterion = oldRecord.criterion_id ? oldRecord.criterion_id.toString() : '';

    const newStudent = updated.student_id ? updated.student_id.toString() : '';
    const newSemester = updated.semester_id ? updated.semester_id.toString() : '';
    const newCriterion = updated.criterion_id ? updated.criterion_id.toString() : '';

    if (oldStudent !== newStudent || oldSemester !== newSemester || oldCriterion !== newCriterion) {
      await this.safeSync(updated);
    }

    return updated;
  }

  async remove(id: string, requester: any, bypassDailyReportCheck: boolean = false): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const record = await this.academicRecordModel.findOne({ _id: id, status: 'active', is_deleted: { $ne: true } })
      .populate('student_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
    if (!record) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    await this.checkSummaryLocked(record.student_id, record.semester_id);

    if (record.daily_report_id && !bypassDailyReportCheck) {
      throw new BadRequestException(
        'Ghi nhận này thuộc báo cáo điểm danh ngày, không thể xoá trực tiếp. Vui lòng chỉnh sửa hoặc xoá qua báo cáo ngày tương ứng.',
      );
    }

    if (!bypassDailyReportCheck) {
      this.checkHierarchyPermission(record, requester);
    }

    const updatePayload: any = { status: 'inactive', is_deleted: true };
    if (record.idempotency_key) {
      updatePayload.idempotency_key = `${record.idempotency_key}_deleted_${Date.now()}`;
    }

    const deleted = await this.academicRecordModel.findByIdAndUpdate(
      id,
      updatePayload,
      { returnDocument: 'after' },
    ).exec();

    if (!deleted) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    // Sync score update
    try {
      await this.safeSync(deleted);
    } catch (err) {
      console.error(`Error syncing score after soft delete AcademicRecord ${id}:`, err);
    }

    return deleted;
  }

  async restore(id: string, requester?: any): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const record = await this.academicRecordModel.findOne({ _id: id, $or: [{ status: 'inactive' }, { is_deleted: true }] })
      .populate('student_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
    if (!record) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found trong thùng rác`);
    }

    await this.checkSummaryLocked(record.student_id, record.semester_id);

    if (requester) {
      this.checkHierarchyPermission(record, requester);
    }

    record.status = 'active';
    record.is_deleted = false;
    const saved = await record.save();

    // Sync score update
    await this.safeSync(saved);

    return saved.populate([
      { path: 'criterion_id' },
      { path: 'student_id' },
      { path: 'semester_id' },
      { path: 'daily_report_id' },
      { path: 'recorded_by', populate: { path: 'role' } },
    ]);
  }

  async forceRemove(id: string, requester: any, bypassDailyReportCheck: boolean = false): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const record = await this.academicRecordModel.findById(id)
      .populate('student_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
    if (!record) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found or already deleted`);
    }

    await this.checkSummaryLocked(record.student_id, record.semester_id);

    if (!bypassDailyReportCheck && record.status !== 'inactive' && record.is_deleted !== true) {
      throw new BadRequestException('Chỉ có thể xóa vĩnh viễn ghi nhận rèn luyện đã nằm trong thùng rác.');
    }

    if (record.daily_report_id && !bypassDailyReportCheck) {
      throw new BadRequestException(
        'Ghi nhận này thuộc báo cáo điểm danh ngày, không thể xoá vĩnh viễn trực tiếp. Vui lòng xoá báo cáo ngày tương ứng.',
      );
    }

    if (!bypassDailyReportCheck) {
      this.checkHierarchyPermission(record, requester);
    }

    const deleted = await this.academicRecordModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found or already deleted`);
    }

    // Sync score update
    try {
      await this.safeSync(deleted);
    } catch (err) {
      console.error(`Error syncing score after force remove AcademicRecord ${id}:`, err);
    }

    return deleted;
  }

  private checkHierarchyPermission(record: any, requester: any): void {
    if (!requester) {
      throw new ForbiddenException('Thông tin người yêu cầu không hợp lệ.');
    }

    const getRoleLevel = (roleName?: string): number => {
      if (!roleName) return 1;
      const nameLower = roleName.toLowerCase();
      if (nameLower.includes('admin')) return 4;
      if (nameLower.includes('supervisor') || nameLower.includes('quản sinh') || nameLower.includes('quan sinh')) return 3;
      if (
        nameLower.includes('teacher') ||
        nameLower.includes('adviser') ||
        nameLower.includes('advisor') ||
        nameLower.includes('giảng viên') ||
        nameLower.includes('giang vien') ||
        nameLower.includes('lecturer')
      ) {
        return 2;
      }
      return 1; // student or generic user
    };

    const requesterLevel = getRoleLevel(requester.roleName);

    // Nếu là Admin, cho phép xóa luôn
    if (requesterLevel === 4) return;

    // Nếu người yêu cầu là sinh viên (Level 1)
    if (requesterLevel === 1) {
      const studentEmail = record.student_id && typeof record.student_id === 'object' ? record.student_id.email : '';

      // So sánh email của tài khoản đang đăng nhập với email của sinh viên sở hữu bản ghi
      if (requester.email && studentEmail && requester.email.toLowerCase() === studentEmail.toLowerCase()) {
        let creatorId = '';
        if (record.recorded_by) {
          creatorId = typeof record.recorded_by === 'object' ? record.recorded_by._id?.toString() : record.recorded_by.toString();
        }

        // Cho phép sinh viên xóa nếu bản ghi do chính họ tạo, hoặc bản ghi trống recorded_by
        if (
          !creatorId ||
          creatorId === requester.userId
        ) {
          return; // Cho phép xóa!
        }
      }
      throw new ForbiddenException('Bạn chỉ có thể xóa ghi nhận rèn luyện tự chấm của chính mình.');
    }

    let creatorLevel = 1;
    let creatorId = '';

    if (record.recorded_by) {
      creatorId = typeof record.recorded_by === 'object' ? record.recorded_by._id?.toString() : record.recorded_by.toString();
      const creatorRoleName = record.recorded_by.role
        ? (typeof record.recorded_by.role === 'object' ? record.recorded_by.role.name : record.recorded_by.role)
        : '';
      creatorLevel = getRoleLevel(creatorRoleName);
    }

    // Quyền cao hơn (requesterLevel > creatorLevel) được xóa
    if (requesterLevel > creatorLevel) {
      return;
    }

    // Cùng cấp (requesterLevel === creatorLevel) chỉ được xóa của chính mình
    if (requesterLevel === creatorLevel) {
      if (requester.userId === creatorId) {
        return;
      }
      throw new ForbiddenException('Bạn chỉ có thể xóa ghi nhận rèn luyện do chính mình tạo ra.');
    }

    // Cấp thấp hơn không được xóa
    throw new ForbiddenException('Bạn không có quyền xóa ghi nhận rèn luyện của cấp bậc cao hơn.');
  }

  async importPreview(rows: any[], requester: any): Promise<any> {
    const semesterModel = this.academicRecordModel.db.model('Semester');

    // RBAC: Teacher/Advisor chỉ được import ghi nhận cho sinh viên lớp phụ trách
    let validStudentIds: Set<string> | null = null;
    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      if (roleName.includes('teacher') || roleName.includes('advisor') || roleName.includes('giảng viên')) {
        const classes = await this.classModel.find({ advisor_id: requester.userId }).select('_id').exec();
        const classIds = classes.map(c => c._id);
        const students = await this.studentModel.find({ class_id: { $in: classIds } }).select('_id').exec();
        validStudentIds = new Set(students.map(s => s._id.toString()));
      }
    }

    // 1. Thu thập tất cả student_code để query
    const studentCodes = Array.from(new Set(rows.map(r => {
      const code = r['Ma SV'] || r['Mã SV'] || r['Mã sinh viên'] || r['student_code'];
      return code ? code.toString().trim() : '';
    }).filter(Boolean)));

    // 2. Query students
    const students = await this.studentModel.find({ student_code: { $in: studentCodes } }).lean().exec();
    const studentMap = new Map(students.map(s => [s.student_code.toLowerCase(), s]));

    // 3. Query all criteria and semesters (dung lượng nhỏ)
    const criteria = await this.criterionModel.find().lean().exec();
    const criteriaMap = new Map(criteria.map(c => [(c.criterion_name || '').toString().trim().toLowerCase(), c]));
    const criteriaCodeMap = new Map(criteria.map(c => {
      const code = c.criterion_code ? c.criterion_code.toString().trim().toLowerCase() : '';
      return [code, c] as [string, any];
    }).filter(entry => entry[0] !== ''));

    const semesters = await semesterModel.find().lean().exec();
    const semesterMap = new Map(semesters.map((s: any) => [(s.semester_name || s.name || '').toString().trim().toLowerCase(), s]));
    const activeSem = semesters.find((s: any) => s.status === 'active');

    const errors: any[] = [];
    const validItems: any[] = [];
    const seen = new Map<string, number>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;
      const studentCodeRaw = row['Ma SV'] || row['Mã SV'] || row['Mã sinh viên'] || row['student_code'];
      const criterionCodeRaw = row['Ma tieu chi'] || row['Mã tiêu chí'] || row['criterion_code'];
      const criterionRaw = row['Tieu chi'] || row['Tiêu chí'] || row['criterion'] || row['Tieu chi (*)'];
      const dateRaw = row['Ngay ghi nhan'] || row['Ngày ghi nhận'] || row['recorded_at'] || row['Ngay'];
      const noteRaw = row['Ghi chu'] || row['Ghi chú'] || row['note'];
      const semesterRaw = row['Hoc ky'] || row['Học kỳ'] || row['semester'];
      const statusRaw = row['Trang thai'] || row['Trạng thái'] || row['status'];

      const studentCode = studentCodeRaw ? studentCodeRaw.toString().trim() : '';
      if (!studentCode) {
        errors.push({ row: rowNumber, reason: 'Thiếu Mã SV' });
        continue;
      }

      if (!criterionCodeRaw && !criterionRaw) {
        errors.push({ row: rowNumber, studentCode, reason: 'Thiếu Mã tiêu chí hoặc Tiêu chí' });
        continue;
      }

      if (dateRaw === undefined || dateRaw === null || dateRaw === '') {
        errors.push({ row: rowNumber, studentCode, reason: 'Thiếu Ngày ghi nhận' });
        continue;
      }

      const foundStudent = studentMap.get(studentCode.toLowerCase());
      if (!foundStudent) {
        errors.push({ row: rowNumber, studentCode, reason: 'Không tìm thấy sinh viên theo Mã SV' });
        continue;
      }

      if (validStudentIds && !validStudentIds.has(foundStudent._id.toString())) {
        errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: 'Không có quyền ghi nhận cho sinh viên này (ngoài lớp phụ trách)' });
        continue;
      }

      let foundCriterion: any = null;
      if (criterionCodeRaw) {
        const criterionCode = criterionCodeRaw.toString().trim().toLowerCase();
        foundCriterion = criteriaCodeMap.get(criterionCode);
        if (!foundCriterion) {
          errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Không tìm thấy tiêu chí theo mã: ${criterionCodeRaw.toString().trim()}` });
          continue;
        }
      } else {
        const criterionName = criterionRaw.toString().trim();
        foundCriterion = criteriaMap.get(criterionName.toLowerCase());
        if (!foundCriterion) {
          errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Không tìm thấy tiêu chí: ${criterionName}` });
          continue;
        }
      }

      // Parse date
      let recordedAtIso = '';
      let dateErr = false;
      if (typeof dateRaw === 'number') {
        const jsDate = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
        if (isNaN(jsDate.getTime())) dateErr = true; else recordedAtIso = jsDate.toISOString();
      } else {
        const str = dateRaw ? dateRaw.toString().trim() : '';
        const dmy = /^([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{4})$/;
        const m = str.match(dmy);
        if (m) {
          const day = parseInt(m[1], 10); const month = parseInt(m[2], 10) - 1; const year = parseInt(m[3], 10);
          const parsed = new Date(year, month, day);
          if (isNaN(parsed.getTime()) || parsed.getDate() !== day) dateErr = true; else recordedAtIso = parsed.toISOString();
        } else {
          const parsed = new Date(str);
          if (isNaN(parsed.getTime())) dateErr = true; else recordedAtIso = parsed.toISOString();
        }
      }
      if (dateErr) {
        errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Định dạng ngày không hợp lệ: ${dateRaw}` });
        continue;
      }

      // Semester
      let semesterId = '';
      if (semesterRaw) {
        const semStr = semesterRaw.toString().trim().toLowerCase();
        const foundSem = semesterMap.get(semStr) || semesters.find((s: any) => s._id.toString() === semStr);
        if (foundSem) {
          semesterId = foundSem._id.toString();
        } else {
          errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Không tìm thấy học kỳ: ${semesterRaw}` });
          continue;
        }
      } else if (activeSem) {
        semesterId = activeSem._id.toString();
      } else {
        errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: 'Không có học kỳ active để gán mặc định' });
        continue;
      }

      // Check if summary is locked
      const summary = await this.summaryPointModel.findOne({
        student_id: foundStudent._id,
        semester_id: new Types.ObjectId(semesterId),
      } as any).select('status').exec();
      if (summary && summary.status === 'locked') {
        errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: 'Bảng điểm rèn luyện của học kỳ này đã chốt, không thể nhập thêm điểm.' });
        continue;
      }

      const status = statusRaw ? statusRaw.toString().trim().toLowerCase() : 'active';
      if (statusRaw && status !== 'active' && status !== 'inactive') {
        errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Trạng thái không hợp lệ: ${statusRaw}` });
        continue;
      }

      // duplicate check in file
      const idempotency_key = `${studentCode}_${foundCriterion._id.toString()}_${recordedAtIso}`;
      if (seen.has(idempotency_key)) {
        errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Bản ghi trùng lặp trong file (trùng với dòng ${seen.get(idempotency_key)})` });
        continue;
      }
      seen.set(idempotency_key, rowNumber);

      const pointsEffect = foundCriterion.score_per_unit || 0;

      validItems.push({
        student_id: foundStudent._id,
        criterion_id: foundCriterion._id,
        semester_id: new Types.ObjectId(semesterId),
        record_title: foundCriterion.criterion_name,
        description: noteRaw ? noteRaw.toString().trim() : '',
        recorded_by: requester ? new Types.ObjectId(requester.userId) : null,
        recorded_at: new Date(recordedAtIso),
        points_effect: pointsEffect,
        status: status || 'active',
        source: 'import_excel',
        idempotency_key
      });
    }

    const sessionId = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    this.importSessions.set(sessionId, {
      id: sessionId,
      status: 'ready_to_commit',
      validItems,
      errors,
      totalRows: rows.length,
      progress: 0,
      processedCount: 0,
      insertedCount: 0,
      duplicatedCount: 0,
      commitErrors: []
    });

    // Cleanup old sessions
    if (this.importSessions.size > 100) {
      const keys = Array.from(this.importSessions.keys());
      for (let i = 0; i < 50; i++) {
        this.importSessions.delete(keys[i]);
      }
    }

    return {
      sessionId,
      totalRows: rows.length,
      validCount: validItems.length,
      errorCount: errors.length,
      errors
    };
  }

  async importCommit(sessionId: string, requester: any): Promise<any> {
    const session = this.importSessions.get(sessionId);
    if (!session) {
      throw new BadRequestException('Session không tồn tại hoặc đã hết hạn');
    }
    if (session.status !== 'ready_to_commit') {
      throw new BadRequestException('Session đang ở trạng thái không hợp lệ: ' + session.status);
    }

    session.status = 'committing';

    // Background job
    this.processImportBatch(sessionId, requester).catch(err => {
      console.error('Import batch error:', err);
      session.status = 'failed';
      session.commitErrors.push({ reason: err.message });
    });

    return { success: true, message: 'Đã bắt đầu tiến trình import' };
  }

  private async processImportBatch(sessionId: string, requester: any) {
    const session = this.importSessions.get(sessionId);
    if (!session) return;

    const validItems = session.validItems;
    const batchSize = 200;

    try {
      for (let i = 0; i < validItems.length; i += batchSize) {
        const batch = validItems.slice(i, i + batchSize);
        const insertOps = batch.map((record: any) => ({
          insertOne: { document: record }
        }));

        let result;
        try {
          result = await this.academicRecordModel.bulkWrite(insertOps as any, { ordered: false });
        } catch (err: any) {
          if (err.code !== 11000 && !err.message.includes('11000')) {
            throw err;
          }
          result = err.result || err;
          session.duplicatedCount += err.writeErrors ? err.writeErrors.length : (batch.length - (result.insertedCount || result.nInserted || 0));
        }

        session.insertedCount += result?.insertedCount || result?.nInserted || 0;
        session.processedCount += batch.length;
        session.progress = validItems.length > 0 ? Math.floor((session.processedCount / validItems.length) * 100) : 100;

        // Sync điểm sau mỗi batch
        await this.syncMultipleStudentCriterionScores(batch);
      }

      session.status = 'completed';
      session.progress = 100;
    } catch (err: any) {
      session.status = 'failed';
      session.commitErrors.push({ reason: err.message });
    }
  }

  getImportProgress(sessionId: string): any {
    const session = this.importSessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('Session không tồn tại');
    }
    return {
      status: session.status,
      progress: session.progress,
      processedCount: session.processedCount,
      insertedCount: session.insertedCount,
      duplicatedCount: session.duplicatedCount,
      totalRows: session.totalRows,
      failedItems: session.commitErrors,
      acceptedCount: session.validItems ? session.validItems.length : 0,
      failedCount: session.commitErrors ? session.commitErrors.length : 0,
      skippedCount: session.duplicatedCount,
    };
  }
}
