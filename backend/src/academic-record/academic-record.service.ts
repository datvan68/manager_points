import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
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
import {
  getRequesterRoleName,
  isStudent,
  isTeacher,
} from '../auth/utils/role.util';
import {
  assertCanAccessStudent,
  getGradingRole,
} from '../auth/utils/grading-access.util';
import { SummariesPointService } from '../summaries-point/summaries-point.service';
import { gradingEventEmitter } from '../system/grading-event-emitter';
import { IntentScoreDto } from './dto/intent-score.dto';
import {
  calculateCriterionScoreHelper,
  normalizeObjectId,
  buildGradingEventPayload,
} from './academic-record.utils';
import {
  ScoreEngineService,
  extractStructuredData,
  groupRecordsByRole,
  CountsByRole,
} from './score-engine.service';
import {
  CountResolutionService,
  detectConflict,
} from './count-resolution.service';
import { EvaluationPeriod } from '../evaluation-periods/schemas/evaluation-period.schema';
import { PurgeAcademicRecordsDto } from './dto/purge-academic-records.dto';

export interface AcademicRecordFindAllQuery {
  page?: number;
  limit?: number;
  groupBy?: 'student';
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
    @InjectModel(EvaluationPeriod.name)
    private readonly evaluationPeriodModel: Model<any>,
    @Inject(forwardRef(() => SummariesPointService))
    private readonly summariesPointService: SummariesPointService,
    private readonly scoreEngineService: ScoreEngineService,
    private readonly countResolutionService: CountResolutionService,
  ) {}

  private importSessions = new Map<string, any>();

  private assertFullAdmin(requester: any): void {
    if (requester?.roleCode === 'ADMIN' || requester?.permissions?.includes('ADMIN_FULL')) return;
    throw new ForbiddenException('Cần quyền ADMIN_FULL');
  }

  private purgeDates(dto: PurgeAcademicRecordsDto): { start: Date; end: Date } {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new BadRequestException('Khoảng ngày không hợp lệ');
    }
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }

  private async getPurgePlan(dto: PurgeAcademicRecordsDto) {
    const { start, end } = this.purgeDates(dto);
    const records = await this.academicRecordModel.find({
      recorded_at: { $gte: start, $lte: end },
    }).select('_id daily_report_id semester_id').lean().exec();
    const activePeriods = await this.evaluationPeriodModel.find({
      status: { $in: ['sv_phase', 'gv_phase', 'admin_phase'] },
    }).select('semester_id status').lean().exec();
    const activeSemesterIds = new Set(activePeriods.map((p: any) => p.semester_id?.toString()));
    const eligible = records.filter((r: any) => !r.daily_report_id && !activeSemesterIds.has(r.semester_id?.toString()));
    return {
      startDate: start.toISOString(), endDate: end.toISOString(),
      eligible: eligible.map((r: any) => r._id),
      counts: {
        eligible: eligible.length,
        protectedClassReport: records.filter((r: any) => !!r.daily_report_id).length,
        protectedActiveGrading: records.filter((r: any) => !r.daily_report_id && activeSemesterIds.has(r.semester_id?.toString())).length,
      },
    };
  }

  async previewPurge(dto: PurgeAcademicRecordsDto, requester: any) {
    this.assertFullAdmin(requester);
    const plan = await this.getPurgePlan(dto);
    return { ...plan, eligible: plan.counts.eligible };
  }

  async purge(dto: PurgeAcademicRecordsDto, requester: any) {
    this.assertFullAdmin(requester);
    const plan = await this.getPurgePlan(dto);
    const result = await this.academicRecordModel.deleteMany({ _id: { $in: plan.eligible } }).exec();
    return {
      deleted: result.deletedCount || 0,
      skipped: {
        protectedClassReport: plan.counts.protectedClassReport,
        protectedActiveGrading: plan.counts.protectedActiveGrading,
      },
      counts: plan.counts,
    };
  }

  private async checkSummaryLocked(
    studentId: any,
    semesterId: any,
  ): Promise<void> {
    if (!studentId || !semesterId) return;
    const summary = await this.summaryPointModel
      .findOne({
        student_id: new Types.ObjectId(normalizeObjectId(studentId)),
        semester_id: new Types.ObjectId(normalizeObjectId(semesterId)),
      } as any)
      .exec();
    if (summary && summary.status === 'locked') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Không thể thực hiện thao tác do bảng điểm rèn luyện đã chốt.',
        error: 'Bad Request',
        reasonCode: 'GRADING_SUMMARY_LOCKED',
      });
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

  private calculateSyncDetail(params: {
    criterion: any;
    activeCount: number;
    optId: string | null;
    optLabel: string | null;
    optScore: number | null;
    manualScore: number | null;
    isValidOption: boolean;
    oldDetail: any | null;
    options?: { forceRepairLocked?: boolean };
    requester?: any;
  }): {
    status: 'repaired' | 'skipped';
    skipReason: 'locked' | 'reviewed' | 'approved' | 'invalid_option' | null;
    detail: any;
  } {
    const {
      criterion,
      activeCount,
      optId,
      optLabel,
      optScore,
      manualScore,
      isValidOption,
      oldDetail,
      options,
      requester,
    } = params;

    // 1. Determine manually reviewed status of oldDetail
    const isReviewed =
      oldDetail &&
      (oldDetail.status === 'gv_reviewed' ||
        !!oldDetail.gv_reviewed_by ||
        !!oldDetail.gv_reviewed_at);
    const isLocked =
      oldDetail &&
      (oldDetail.status === 'locked' ||
        !!oldDetail.locked_at ||
        !!oldDetail.locked_by);
    const isApproved =
      oldDetail &&
      oldDetail.final_score !== null &&
      oldDetail.final_score !== undefined;
    const isManuallyReviewed = isReviewed || isLocked || isApproved;

    // 2. Determine skip status and skip_reason
    let status: 'repaired' | 'skipped' = 'repaired';
    let skipReason:
      | 'locked'
      | 'reviewed'
      | 'approved'
      | 'invalid_option'
      | null = null;

    if (isManuallyReviewed && !options?.forceRepairLocked) {
      status = 'skipped';
      if (isApproved) {
        skipReason = 'approved';
      } else if (isLocked) {
        skipReason = 'locked';
      } else {
        skipReason = 'reviewed';
      }
    } else if (!isValidOption) {
      status = 'skipped';
      skipReason = 'invalid_option';
    }

    // 3. Compute system score and options using the helper
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

    // 4. Construct / Update detail
    const detail: any = oldDetail
      ? oldDetail.toObject
        ? oldDetail.toObject()
        : { ...oldDetail }
      : {
          criterion_id: new Types.ObjectId(criterion._id),
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

    if (status === 'skipped') {
      // If skipped, update only current_count and system_score
      detail.current_count =
        criterion.scoring_mode === 'single_option'
          ? activeCount > 0
            ? 1
            : 0
          : activeCount;
      detail.system_score = systemScore;
      if (activeCount > 0) {
        detail.selected_option_id = selectedOptionId;
        detail.selected_option_label = selectedOptionLabel;
        detail.selected_option_score = selectedOptionScore;
      }
    } else {
      // Repaired / New draft detail
      const isReward =
        criterion.criterion_type === 'reward' ||
        criterion.criterion_type === 'bonus' ||
        criterion.score_per_unit > 0 ||
        !(
          criterion.score_per_unit < 0 || criterion.criterion_type === 'ky_luat'
        );

      detail.status = 'draft';
      detail.current_count =
        criterion.scoring_mode === 'single_option'
          ? activeCount > 0
            ? 1
            : 0
          : activeCount;

      const targetScore =
        activeCount === 0
          ? criterion.scoring_mode === 'single_option' || isReward
            ? 0
            : systemScore
          : systemScore;

      detail.system_score = targetScore;

      if (activeCount === 0) {
        detail.selected_option_id = null;
        detail.selected_option_label = null;
        detail.selected_option_score = null;
      } else {
        detail.selected_option_id = selectedOptionId;
        detail.selected_option_label = selectedOptionLabel;
        detail.selected_option_score = selectedOptionScore;
      }

      // Phân bổ điểm theo vai trò:
      const oldSv =
        oldDetail && oldDetail.sv_score !== undefined
          ? oldDetail.sv_score
          : null;
      const oldGv =
        oldDetail && oldDetail.gv_score !== undefined
          ? oldDetail.gv_score
          : null;
      const oldFinal =
        oldDetail && oldDetail.final_score !== undefined
          ? oldDetail.final_score
          : null;

      let requesterLevel = 0;
      if (requester) {
        requesterLevel = this.getRoleLevel(requester.roleName);
      }

      if (requesterLevel === 1) {
        // Student
        detail.sv_score = targetScore;
        detail.gv_score = oldGv;
        detail.final_score = oldFinal;
      } else if (requesterLevel === 2) {
        // Teacher
        detail.gv_score = targetScore;
        detail.sv_score = oldSv;
        detail.final_score = oldFinal;
      } else if (requesterLevel >= 3) {
        // Admin / Supervisor
        detail.final_score = targetScore;
        detail.sv_score = oldSv;
        detail.gv_score = oldGv;
      } else {
        // Fallback (requesterLevel === 0)
        detail.sv_score = targetScore;
        detail.gv_score = targetScore;
        detail.final_score = oldFinal;
      }
    }

    return {
      status,
      skipReason,
      detail,
    };
  }

  /**
   * Helper function to sync student's criterion count and system score in SummaryPoint(s)
   */
  async syncStudentCriterionScore(
    studentId: string,
    semesterId: string,
    criterionId: string,
    requester?: any,
  ): Promise<any> {
    if (
      !Types.ObjectId.isValid(studentId) ||
      !Types.ObjectId.isValid(semesterId) ||
      !Types.ObjectId.isValid(criterionId)
    ) {
      return null;
    }

    // 1. Fetch all active academic records for this student, semester, and criterion
    let query = this.academicRecordModel.find({
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(semesterId),
      criterion_id: new Types.ObjectId(criterionId),
      status: 'active',
      is_deleted: { $ne: true },
    } as any);

    if (query.populate) {
      query = query.populate({
        path: 'recorded_by',
        populate: { path: 'role' },
      });
    }
    if (query.sort) {
      query = query.sort({ createdAt: -1 });
    }

    const activeRecords = await query.exec();

    let resolvedRequester = requester;
    if (!resolvedRequester && activeRecords.length > 0) {
      const latestRecord = activeRecords[0];
      const creator = latestRecord.recorded_by as any;
      if (creator) {
        const roleName =
          creator.role?.name ||
          creator.role?.role_code ||
          creator.role_name ||
          '';
        resolvedRequester = {
          userId: creator._id?.toString(),
          roleName: roleName,
        };
      }
    }

    const activeCount = activeRecords.length;

    // === NEW: Role-aware count grouping ===
    const countsByRole = groupRecordsByRole(activeRecords);

    // 2. Fetch the criterion definition to get details
    const criterion = await this.criterionModel.findById(criterionId).exec();
    if (!criterion) return null;

    // 3. Compute system_score — using extractStructuredData instead of inline parsing
    let optId: string | null = null;
    let optLabel: string | null = null;
    let optScore: number | null = null;
    let manualScore: number | null = null;
    let isValidOption = true;
    const warnings: string[] = [];

    if (activeCount > 1) {
      warnings.push(
        `Duplicate active records detected: ${activeCount} active records exist for this criterion.`,
      );
    }

    if (activeCount > 0) {
      const latestRecord = activeRecords[0];

      if (latestRecord) {
        // Use extractStructuredData instead of inline title parsing
        const structured = extractStructuredData(latestRecord);

        if (criterion.scoring_mode === 'single_option') {
          optId = structured.selected_option_id;
          optLabel = structured.selected_option_label;
          optScore = structured.selected_option_score;

          if (optId) {
            const optionExists = criterion.options?.some(
              (o: any) => o.id === optId,
            );
            if (!optionExists) {
              isValidOption = false;
              warnings.push(`Invalid option ID '${optId}' validation failed.`);
            }
          } else {
            isValidOption = false;
            warnings.push(
              'No option ID found/parsed for single_option criterion.',
            );
          }
        } else {
          manualScore = structured.manual_score;
        }
      }
    }

    // === NEW: Count resolution (auto-resolve) ===
    const resolution = this.countResolutionService.resolve({
      counts_by_role: countsByRole,
      context: 'auto',
    });

    // 4. Find all SummaryPoints for this student and semester
    const summaries = await this.summaryPointModel
      .find({
        student_id: new Types.ObjectId(studentId),
        semester_id: new Types.ObjectId(semesterId),
      } as any)
      .exec();

    let syncResultStatus: 'repaired' | 'skipped' = 'repaired';
    let syncResultSkipReason:
      | 'locked'
      | 'reviewed'
      | 'approved'
      | 'invalid_option'
      | null = null;

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
            currentSummary = (await this.summaryPointModel
              .findById(summary._id)
              .exec()) as any;
            if (!currentSummary || currentSummary.status === 'locked') break;
          }

          const details = currentSummary.details || [];
          const detailIndex = details.findIndex(
            (d: any) =>
              d.criterion_id && d.criterion_id.toString() === criterionId,
          );

          const oldDetail = detailIndex !== -1 ? details[detailIndex] : null;

          const syncResult = this.calculateSyncDetail({
            criterion,
            activeCount,
            optId,
            optLabel,
            optScore,
            manualScore,
            isValidOption,
            oldDetail,
            requester: resolvedRequester,
          });

          syncResultStatus = syncResult.status;
          syncResultSkipReason = syncResult.skipReason;

          // === NEW: Populate role-aware fields in detail ===
          const detail = syncResult.detail;
          detail.counts_by_role = countsByRole;
          detail.has_conflict = resolution.has_conflict;
          detail.source_record_count = activeCount;
          detail.last_record_at =
            activeRecords.length > 0
              ? (activeRecords[0] as any).createdAt ||
                (activeRecords[0] as any).recorded_at
              : null;
          detail.last_source_record_id =
            activeRecords.length > 0
              ? (activeRecords[0] as any)._id?.toString()
              : null;

          // Only populate resolution fields if auto-resolved without conflict
          if (resolution.auto_resolved && !resolution.has_conflict) {
            detail.resolved_count = resolution.resolved_count;
            detail.resolved_by_role = resolution.resolved_by_role;
            detail.resolution_source = resolution.resolution_source;
          }

          if (detailIndex === -1) {
            if (syncResult.status !== 'skipped') {
              details.push(detail);
            }
          } else {
            details[detailIndex] = detail;
          }

          currentSummary.details = details;
          currentSummary.markModified('details');
          await currentSummary.save();
          const recomputed =
            await this.summariesPointService.recomputeTotalScore(
              currentSummary._id.toString(),
            );
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
              console.warn(
                `[syncStudentCriterionScore] VersionError retries exhausted for summary ${summary._id}`,
              );
              break;
            }
            await new Promise((res) => setTimeout(res, 20 * attempts));
          } else {
            throw err;
          }
        }
      }
    }

    const freshSummary = await this.summaryPointModel
      .findOne({
        student_id: new Types.ObjectId(studentId),
        semester_id: new Types.ObjectId(semesterId),
        period_id: null,
      } as any)
      .exec();

    if (freshSummary) {
      const detail = freshSummary.details?.find(
        (d: any) => d.criterion_id && d.criterion_id.toString() === criterionId,
      );
      return {
        updatedDetail: detail,
        totalScore: freshSummary.total_score,
        status: freshSummary.status,
        summary: freshSummary,
        sync_status: syncResultStatus,
        skip_reason: syncResultSkipReason,
        ...(warnings.length > 0 ? { warnings } : {}),
      };
    }
    return warnings.length > 0 ? { warnings } : null;
  }

  async syncMultipleStudentCriterionScores(
    records: { student_id: any; semester_id: any; criterion_id: any }[],
    options?: { forceRepairLocked?: boolean },
  ): Promise<any> {
    if (!records || records.length === 0) return { mismatches: [] };

    const mismatches = [];

    // Group by student_id and semester_id
    const groups = new Map<
      string,
      { studentId: string; semesterId: string; criterionIds: Set<string> }
    >();
    for (const r of records) {
      const sId = normalizeObjectId(r.student_id);
      const semId = normalizeObjectId(r.semester_id);
      const cId = normalizeObjectId(r.criterion_id);
      if (!sId || !semId || !cId) continue;
      const key = `${sId}_${semId}`;
      if (!groups.has(key)) {
        groups.set(key, {
          studentId: sId,
          semesterId: semId,
          criterionIds: new Set(),
        });
      }
      groups.get(key)!.criterionIds.add(cId);
    }

    // Preload criteria and categories definitions to avoid N+1 queries during sync & recompute
    const allCriterionIds = Array.from(
      new Set(
        records
          .map((r) => (r.criterion_id ? r.criterion_id.toString() : ''))
          .filter(Boolean),
      ),
    );
    const criteria = await this.criterionModel
      .find({ _id: { $in: allCriterionIds as any } } as any)
      .lean()
      .exec();
    const criteriaMap = new Map(
      criteria.map((c: any) => [c._id.toString(), c]),
    );

    const allCategories = await this.summaryPointModel.db
      .model('Category')
      .find()
      .lean()
      .exec();
    const allCriteria = await this.criterionModel.find().lean().exec();
    const preloadedMetadata = {
      categories: allCategories,
      criteria: allCriteria,
    };

    // Sync each student/semester group
    for (const [_, group] of groups) {
      const { studentId, semesterId, criterionIds } = group;
      if (
        !Types.ObjectId.isValid(studentId) ||
        !Types.ObjectId.isValid(semesterId)
      )
        continue;

      const student = await this.studentModel.findById(studentId).exec();

      // Fetch all active academic records for these criteria of this student/semester
      const activeRecords = await this.academicRecordModel
        .find({
          student_id: new Types.ObjectId(studentId),
          semester_id: new Types.ObjectId(semesterId),
          criterion_id: {
            $in: Array.from(criterionIds).map((id) => new Types.ObjectId(id)),
          },
          status: 'active',
          is_deleted: { $ne: true },
        } as any)
        .sort({ createdAt: -1 })
        .exec();

      // Group active records by criterionId
      const recordsByCriterion = new Map<string, any[]>();
      for (const rec of activeRecords) {
        const cId = rec.criterion_id.toString();
        if (!recordsByCriterion.has(cId)) {
          recordsByCriterion.set(cId, []);
        }
        recordsByCriterion.get(cId)!.push(rec);
      }

      // Load all SummaryPoints for this student and semester
      const summaries = await this.summaryPointModel
        .find({
          student_id: new Types.ObjectId(studentId),
          semester_id: new Types.ObjectId(semesterId),
        } as any)
        .exec();

      for (const summary of summaries) {
        if (summary.status === 'locked') continue;

        let success = false;
        let attempts = 0;
        while (!success && attempts < 3) {
          try {
            let currentSummary = summary;
            if (attempts > 0) {
              currentSummary = (await this.summaryPointModel
                .findById(summary._id)
                .exec()) as any;
              if (!currentSummary || currentSummary.status === 'locked') break;
            }

            const details = currentSummary.details || [];

            for (const criterionId of criterionIds) {
              const criterion = criteriaMap.get(criterionId);
              if (!criterion) continue;

              const criRecords = recordsByCriterion.get(criterionId) || [];
              const activeCount = criRecords.length;
              const latestRecord = criRecords[0] || null;

              // === NEW: Role-aware count grouping per criterion ===
              const criCountsByRole = groupRecordsByRole(criRecords);

              let optId: string | null = null;
              let optLabel: string | null = null;
              let optScore: number | null = null;
              let manualScore: number | null = null;
              let isValidOption = true;

              if (activeCount > 0 && latestRecord) {
                // Use extractStructuredData instead of inline title parsing
                const structured = extractStructuredData(latestRecord);

                if (criterion.scoring_mode === 'single_option') {
                  optId = structured.selected_option_id;
                  optLabel = structured.selected_option_label;
                  optScore = structured.selected_option_score;

                  if (optId) {
                    const optionExists = criterion.options?.some(
                      (o: any) => o.id === optId,
                    );
                    if (!optionExists) {
                      isValidOption = false;
                    }
                  } else {
                    isValidOption = false;
                  }
                } else {
                  manualScore = structured.manual_score;
                }
              }

              // === NEW: Count resolution per criterion ===
              const criResolution = this.countResolutionService.resolve({
                counts_by_role: criCountsByRole,
                context: 'auto',
              });

              const detailIndex = details.findIndex(
                (d: any) =>
                  d.criterion_id && d.criterion_id.toString() === criterionId,
              );
              const oldDetail =
                detailIndex !== -1 ? details[detailIndex] : null;
              const oldDetailCount = oldDetail ? oldDetail.current_count : 0;
              const oldDetailScore = oldDetail
                ? {
                    sv: oldDetail.sv_score,
                    gv: oldDetail.gv_score,
                    final: oldDetail.final_score,
                  }
                : null;
              const oldDetailOptionId = oldDetail
                ? oldDetail.selected_option_id
                : null;

              const syncResult = this.calculateSyncDetail({
                criterion,
                activeCount,
                optId,
                optLabel,
                optScore,
                manualScore,
                isValidOption,
                oldDetail,
                options,
              });

              let isMismatch = false;
              if (!oldDetail) {
                if (activeCount > 0) isMismatch = true;
              } else {
                if (oldDetail.current_count !== activeCount) {
                  isMismatch = true;
                } else if (
                  criterion.scoring_mode === 'single_option' &&
                  oldDetail.selected_option_id !== optId
                ) {
                  isMismatch = true;
                } else if (
                  oldDetail.system_score !== syncResult.detail.system_score
                ) {
                  isMismatch = true;
                }
              }

              if (isMismatch) {
                mismatches.push({
                  student_id: studentId,
                  semester_id: semesterId,
                  criterion_id: criterionId,
                  scoring_mode: criterion.scoring_mode,
                  active_record_count: activeCount,
                  selected_option_id_from_record: optId,
                  selected_option_id_from_detail: oldDetailOptionId,
                  old_detail_count: oldDetailCount,
                  old_score_fields: oldDetailScore,
                  repaired_detail_count: syncResult.detail.current_count,
                  repaired_selected_option_id:
                    syncResult.detail.selected_option_id,
                  repaired_system_score: syncResult.detail.system_score,
                  status: syncResult.status,
                  skip_reason: syncResult.skipReason,
                });
              }

              // === NEW: Populate role-aware fields in detail ===
              const detail = syncResult.detail;
              detail.counts_by_role = criCountsByRole;
              detail.has_conflict = criResolution.has_conflict;
              detail.source_record_count = activeCount;
              detail.last_record_at = latestRecord
                ? latestRecord.createdAt || latestRecord.recorded_at
                : null;
              detail.last_source_record_id = latestRecord
                ? latestRecord._id?.toString()
                : null;

              if (criResolution.auto_resolved && !criResolution.has_conflict) {
                detail.resolved_count = criResolution.resolved_count;
                detail.resolved_by_role = criResolution.resolved_by_role;
                detail.resolution_source = criResolution.resolution_source;
              }

              if (detailIndex === -1) {
                if (syncResult.status !== 'skipped') {
                  details.push(detail);
                }
              } else {
                details[detailIndex] = detail;
              }
            }

            currentSummary.details = details;
            currentSummary.markModified('details');
            await currentSummary.save();
            const recomputed =
              await this.summariesPointService.recomputeTotalScore(
                currentSummary._id.toString(),
                preloadedMetadata,
              );
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
                console.warn(
                  `[syncMultipleStudentCriterionScores] VersionError retries exhausted for summary ${summary._id}`,
                );
                break;
              }
              await new Promise((res) => setTimeout(res, 20 * attempts));
            } else {
              throw err;
            }
          }
        }
      }
    }

    return {
      mismatches,
    };
  }

  async handleScoreIntent(intentDto: IntentScoreDto, requester?: any) {
    const {
      student_id,
      semester_id,
      criterion_id,
      intent_type,
      target_count,
      manual_score,
      selected_option_id,
      note,
    } = intentDto;

    // Preflight check: check if the summary is locked
    await this.checkSummaryLocked(student_id, semester_id);

    // Verify permissions for the requester
    if (requester) {
      await assertCanAccessStudent(
        requester,
        student_id,
        this.classModel,
        this.studentModel,
      );
    }

    const requesterLevel = this.getRoleLevel(requester?.roleName);
    // === NEW: Derive recorded_by_role from requester ===
    const recordedByRole =
      intentDto.recorded_by_role ||
      this.deriveRecordedByRole(requester?.roleName);
    const changedRecordIds: string[] = [];

    if (
      intent_type === 'increase' ||
      intent_type === 'decrease' ||
      intent_type === 'set_target_count'
    ) {
      const criterion = await this.criterionModel.findById(criterion_id).exec();
      if (!criterion) {
        throw new NotFoundException(
          `Criterion with ID ${criterion_id} not found`,
        );
      }

      let maxCount = 0;
      if (criterion.scoring_mode === 'single_option') {
        maxCount = 1;
      } else {
        const pointsPerUnit = criterion.score_per_unit || 0;
        if (pointsPerUnit === 0) {
          throw new BadRequestException(
            'Tiêu chí này không hỗ trợ chế độ cộng trừ do điểm trên mỗi đơn vị bằng 0.',
          );
        }
        const maxScore = criterion.max_score || 10;
        maxCount = Math.ceil(maxScore / Math.abs(pointsPerUnit));
      }

      // 1. Kiểm tra lệch dữ liệu (mismatch) giữa summary details và academic records hiện tại
      const summaryObj = await this.summaryPointModel
        .findOne({
          student_id: new Types.ObjectId(student_id),
          semester_id: new Types.ObjectId(semester_id),
        } as any)
        .exec();

      if (summaryObj) {
        const detail = summaryObj.details?.find((d: any) => {
          const dCriId = d.criterion_id ? d.criterion_id.toString() : '';
          return dCriId === criterion_id.toString();
        });

        const detailCount = detail ? detail.current_count : 0;
        const currentCountReal = await this.academicRecordModel
          .countDocuments({
            student_id: new Types.ObjectId(student_id),
            semester_id: new Types.ObjectId(semester_id),
            criterion_id: new Types.ObjectId(criterion_id),
            status: 'active',
            is_deleted: { $ne: true },
          } as any)
          .exec();

        if (
          (!detail && currentCountReal > 0) ||
          (detail && detailCount !== currentCountReal)
        ) {
          Logger.warn(
            `[SYNC_ALERT] Phát hiện lệch dữ liệu trước intent: Criterion ID=${criterion_id}, Student ID=${student_id}. Detail count=${detailCount}, Actual active records count=${currentCountReal}. Đang tự động sync...`,
          );
          await this.syncStudentCriterionScore(
            student_id,
            semester_id,
            criterion_id,
            requester,
          );
        }
      }

      const currentRecords = await this.academicRecordModel
        .find({
          student_id: new Types.ObjectId(student_id),
          semester_id: new Types.ObjectId(semester_id),
          criterion_id: new Types.ObjectId(criterion_id),
          status: 'active',
          is_deleted: { $ne: true },
        } as any)
        .populate({ path: 'recorded_by', populate: { path: 'role' } })
        .exec();

      const currentCount = currentRecords.length;
      let desiredCount = currentCount;

      if (intent_type === 'increase') desiredCount++;
      else if (intent_type === 'decrease') desiredCount--;
      else if (intent_type === 'set_target_count' && target_count !== undefined)
        desiredCount = target_count;

      desiredCount = Math.max(0, desiredCount);

      // Guard chống destructive writes:
      if (desiredCount < currentCount) {
        const baseline = intentDto.baseline_count;
        if (baseline !== undefined && baseline !== currentCount) {
          throw new BadRequestException(
            `Dữ liệu chấm điểm trên màn hình không đồng bộ (mismatch). Baseline count là ${baseline} nhưng thực tế hiện tại là ${currentCount}. Vui lòng làm mới trang.`,
          );
        }
      }

      if (desiredCount > maxCount) {
        throw new BadRequestException(
          `Số lần tích lũy vượt quá giới hạn tối đa cho phép (${maxCount} lần).`,
        );
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
            // === NEW: Structured fields ===
            recorded_by_role: recordedByRole,
            action_type: 'count',
            record_type: 'activity',
            quantity: 1,
            source_type: 'manual',
          });
        }
        const inserted = await this.academicRecordModel.insertMany(newRecords);
        changedRecordIds.push(...inserted.map((r) => r._id.toString()));
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
              creatorRoleName =
                (record.recorded_by as any).role.role_name || '';
            } else if (
              record.recorded_by &&
              (record.recorded_by as any).role_name
            ) {
              creatorRoleName = (record.recorded_by as any).role_name;
            }

            const creatorLevel = this.getRoleLevel(creatorRoleName) || 1;

            const recordedById =
              record.recorded_by && (record.recorded_by as any)._id
                ? (record.recorded_by as any)._id.toString()
                : record.recorded_by?.toString();

            if (
              requesterLevel > creatorLevel ||
              recordedById === requester?.userId
            ) {
              canDelete = true;
            }
          }

          if (canDelete) {
            Logger.log(
              `[AUDIT_LOG] Hard-delete academic_record _id=${record._id} for student_id=${student_id}, requested_by=${requester?.userId}`,
            );
            await this.academicRecordModel.deleteOne({ _id: record._id });
            changedRecordIds.push(record._id.toString());
            recordsToRemove--;
          }
        }
      }
    } else if (intent_type === 'select_option') {
      const criterion = await this.criterionModel.findById(criterion_id).exec();
      if (!criterion) {
        throw new NotFoundException(
          `Criterion with ID ${criterion_id} not found`,
        );
      }
      if (criterion.scoring_mode !== 'single_option') {
        throw new BadRequestException(
          'Tiêu chí này không hỗ trợ chế độ chấm điểm lựa chọn duy nhất (single_option).',
        );
      }

      const existingRecord = await this.academicRecordModel
        .findOne({
          student_id: new Types.ObjectId(student_id),
          semester_id: new Types.ObjectId(semester_id),
          criterion_id: new Types.ObjectId(criterion_id),
          status: 'active',
          is_deleted: { $ne: true },
        } as any)
        .exec();

      if (selected_option_id) {
        const option = criterion.options?.find(
          (o: any) => o.id === selected_option_id,
        );
        if (!option) {
          throw new BadRequestException(
            `Lựa chọn có ID '${selected_option_id}' không tồn tại trong tiêu chí này.`,
          );
        }

        if (existingRecord) {
          // Kiểm tra xem user có quyền thay đổi không
          let canUpdate = false;
          if (requesterLevel >= 4) {
            canUpdate = true;
          } else {
            let creatorRoleName = '';
            if (
              existingRecord.recorded_by &&
              (existingRecord.recorded_by as any).role
            ) {
              creatorRoleName =
                (existingRecord.recorded_by as any).role.role_name || '';
            } else if (
              existingRecord.recorded_by &&
              (existingRecord.recorded_by as any).role_name
            ) {
              creatorRoleName = (existingRecord.recorded_by as any).role_name;
            }
            const creatorLevel = this.getRoleLevel(creatorRoleName) || 1;
            const recordedById =
              existingRecord.recorded_by &&
              (existingRecord.recorded_by as any)._id
                ? (existingRecord.recorded_by as any)._id.toString()
                : existingRecord.recorded_by?.toString();

            if (
              requesterLevel > creatorLevel ||
              recordedById === requester?.userId
            ) {
              canUpdate = true;
            }
          }
          if (!canUpdate) {
            throw new ForbiddenException(
              'Bạn không có quyền sửa đổi điểm do người khác chấm.',
            );
          }

          existingRecord.selected_option_id = selected_option_id;
          existingRecord.selected_option_label = option.label;
          existingRecord.selected_option_score = option.score;
          existingRecord.record_title = option.label;
          existingRecord.recorded_by = requester?.userId;
          // === NEW: Structured fields on update ===
          (existingRecord as any).recorded_by_role = recordedByRole;
          (existingRecord as any).action_type = 'select_option';
          (existingRecord as any).record_type = 'selected_option';
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
            record_title: option.label,
            status: 'active',
            // === NEW: Structured fields ===
            recorded_by_role: recordedByRole,
            action_type: 'select_option',
            record_type: 'selected_option',
            quantity: 1,
            source_type: 'manual',
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
            if (
              existingRecord.recorded_by &&
              (existingRecord.recorded_by as any).role
            ) {
              creatorRoleName =
                (existingRecord.recorded_by as any).role.role_name || '';
            } else if (
              existingRecord.recorded_by &&
              (existingRecord.recorded_by as any).role_name
            ) {
              creatorRoleName = (existingRecord.recorded_by as any).role_name;
            }
            const creatorLevel = this.getRoleLevel(creatorRoleName) || 1;
            const recordedById =
              existingRecord.recorded_by &&
              (existingRecord.recorded_by as any)._id
                ? (existingRecord.recorded_by as any)._id.toString()
                : existingRecord.recorded_by?.toString();

            if (
              requesterLevel > creatorLevel ||
              recordedById === requester?.userId
            ) {
              canDelete = true;
            }
          }

          if (canDelete) {
            await this.academicRecordModel.deleteOne({
              _id: existingRecord._id,
            });
            changedRecordIds.push(existingRecord._id.toString());
          }
        }
      }
    } else if (intent_type === 'set_manual_score') {
      const existingRecord = await this.academicRecordModel
        .findOne({
          student_id: new Types.ObjectId(student_id),
          semester_id: new Types.ObjectId(semester_id),
          criterion_id: new Types.ObjectId(criterion_id),
          status: 'active',
          is_deleted: { $ne: true },
        } as any)
        .exec();

      if (existingRecord) {
        existingRecord.record_title = `Nhập điểm tay: ${manual_score}`;
        existingRecord.recorded_by = requester?.userId;
        // === NEW: Structured fields on update ===
        (existingRecord as any).recorded_by_role = recordedByRole;
        (existingRecord as any).action_type = 'manual_score';
        (existingRecord as any).record_type = 'manual_score';
        (existingRecord as any).payload = { manual_score };
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
          // === NEW: Structured fields ===
          recorded_by_role: recordedByRole,
          action_type: 'manual_score',
          record_type: 'manual_score',
          quantity: 1,
          source_type: 'manual',
          payload: { manual_score },
        });
        changedRecordIds.push(created._id.toString());
      }
    } else if (intent_type === 'clear_score') {
      const currentRecords = await this.academicRecordModel
        .find({
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
          } else if (
            record.recorded_by &&
            (record.recorded_by as any).role_name
          ) {
            creatorRoleName = (record.recorded_by as any).role_name;
          }

          const creatorLevel = this.getRoleLevel(creatorRoleName) || 1;

          const recordedById =
            record.recorded_by && (record.recorded_by as any)._id
              ? (record.recorded_by as any)._id.toString()
              : record.recorded_by?.toString();

          if (
            requesterLevel > creatorLevel ||
            recordedById === requester?.userId
          ) {
            canDelete = true;
          }
        }

        if (canDelete) {
          Logger.log(
            `[AUDIT_LOG] Hard-delete academic_record _id=${record._id} for clear_score requested_by=${requester?.userId}`,
          );
          await this.academicRecordModel.deleteOne({ _id: record._id });
          changedRecordIds.push(record._id.toString());
        }
      }
    }

    // Rebuild detail
    await this.syncStudentCriterionScore(
      student_id,
      semester_id,
      criterion_id,
      requester,
    );

    // Return the updated summary and actual count
    const summary = await this.summaryPointModel
      .findOne({
        student_id: new Types.ObjectId(student_id),
        semester_id: new Types.ObjectId(semester_id),
      } as any)
      .lean()
      .exec();

    const detail = (summary as any)?.details?.find(
      (d: any) => d.criterion_id?.toString() === criterion_id,
    );

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
      summary: summary
        ? {
            _id: summary._id.toString(),
            total_score: summary.total_score,
            grading: summary.grading,
            status: summary.status,
          }
        : null,
      changed_record_ids: changedRecordIds,
      sync_status: syncStatus,
    };
  }

  async auditMismatches(
    semesterId: string,
  ): Promise<{ totalScanned: number; totalFixed: number }> {
    const summaries = await this.summaryPointModel
      .find({
        semester_id: new Types.ObjectId(semesterId),
      } as any)
      .exec();

    let totalFixed = 0;

    for (const summary of summaries) {
      const studentId = summary.student_id
        ? (summary.student_id as any)._id || summary.student_id
        : null;
      if (!studentId) continue;

      let isAnyCriterionFixed = false;
      const details = summary.details || [];

      // Lấy tất cả active records của student này trong học kỳ
      const activeRecords = await this.academicRecordModel
        .find({
          student_id: new Types.ObjectId(studentId),
          semester_id: new Types.ObjectId(semesterId),
          status: 'active',
          is_deleted: { $ne: true },
        } as any)
        .exec();

      // Đếm theo criterion_id
      const recordCountByCri: Record<string, number> = {};
      activeRecords.forEach((rec) => {
        const cId = rec.criterion_id ? rec.criterion_id.toString() : '';
        if (cId) {
          recordCountByCri[cId] = (recordCountByCri[cId] || 0) + 1;
        }
      });

      // Lấy tất cả criteria trong DB để đối chiếu cả các criteria chưa có detail
      const criteriaList = await this.criterionModel.find({}).exec();

      for (const cri of criteriaList) {
        const criIdStr = cri._id.toString();
        const detail = details.find(
          (d: any) => d.criterion_id && d.criterion_id.toString() === criIdStr,
        );
        const detailCount = detail ? detail.current_count : 0;
        const actualCount = recordCountByCri[criIdStr] ?? 0;

        if (
          (!detail && actualCount > 0) ||
          (detail && detailCount !== actualCount)
        ) {
          Logger.log(
            `[AUDIT_CLEANUP] Lệch dữ liệu phát hiện cho Sinh viên=${studentId}, Criterion=${criIdStr}. Detail count=${detailCount}, Actual count=${actualCount}. Đang thực hiện đồng bộ...`,
          );
          await this.syncStudentCriterionScore(
            studentId.toString(),
            semesterId,
            criIdStr,
          );
          isAnyCriterionFixed = true;
        }
      }

      if (isAnyCriterionFixed) {
        totalFixed++;
      }
    }

    return {
      totalScanned: summaries.length,
      totalFixed,
    };
  }

  private getRoleLevel(roleName?: string): number {
    if (!roleName) return 1;
    const nameLower = roleName.toLowerCase();
    if (nameLower.includes('admin')) return 4;
    if (
      nameLower.includes('supervisor') ||
      nameLower.includes('quản sinh') ||
      nameLower.includes('quan sinh')
    )
      return 3;
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

  /**
   * Derive the standardized recorded_by_role enum value from a role name string.
   * Uses the same mapping logic as getRoleLevel but returns the enum value
   * for the academic_record.recorded_by_role field.
   */
  private deriveRecordedByRole(roleName?: string): string {
    if (!roleName) return 'system';
    const nameLower = roleName.toLowerCase();
    if (nameLower.includes('admin')) return 'admin';
    if (
      nameLower.includes('supervisor') ||
      nameLower.includes('quản sinh') ||
      nameLower.includes('quan sinh')
    )
      return 'supervisor';
    if (
      nameLower.includes('teacher') ||
      nameLower.includes('adviser') ||
      nameLower.includes('advisor') ||
      nameLower.includes('giảng viên') ||
      nameLower.includes('giang vien') ||
      nameLower.includes('lecturer')
    ) {
      return 'teacher';
    }
    if (
      nameLower.includes('student') ||
      nameLower.includes('sinh viên') ||
      nameLower.includes('sinh vien')
    ) {
      return 'student';
    }
    return 'system';
  }

  async create(
    createAcademicRecordDto: CreateAcademicRecordDto,
    requester?: any,
  ): Promise<AcademicRecord> {
    await this.checkSummaryLocked(
      createAcademicRecordDto.student_id,
      createAcademicRecordDto.semester_id,
    );

    if (requester) {
      await assertCanAccessStudent(
        requester,
        createAcademicRecordDto.student_id,
        this.classModel,
        this.studentModel,
      );
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
      const studentSemMap = new Map<
        string,
        { studentId: string; semesterId: string }
      >();
      for (const record of records) {
        const sId = record.student_id
          ? normalizeObjectId(record.student_id)
          : '';
        const semId = record.semester_id
          ? normalizeObjectId(record.semester_id)
          : '';
        if (sId && semId) {
          studentSemMap.set(`${sId}_${semId}`, {
            studentId: sId,
            semesterId: semId,
          });
        }
      }
      for (const { studentId, semesterId } of studentSemMap.values()) {
        await this.checkSummaryLocked(studentId, semesterId);
      }
    }
    if (!records || records.length === 0) {
      return {
        batchId: Date.now().toString(),
        acceptedCount: 0,
        insertedCount: 0,
        duplicatedCount: 0,
        failedItems: [],
        createdRecordIds: [],
        groupsSynced: 0,
      };
    }

    let validStudentIds: Set<string> | null = null;
    if (requester) {
      const role = getGradingRole(requester);
      // Nếu là Teacher, chỉ được ghi nhận cho sinh viên lớp mình
      if (role === 'teacher') {
        const classes = await this.classModel
          .find({ advisor_id: requester.userId })
          .select('_id')
          .exec();
        const classIds = classes.map((c) => c._id);
        const students = await this.studentModel
          .find({ class_id: { $in: classIds } })
          .select('_id')
          .exec();
        validStudentIds = new Set(students.map((s) => s._id.toString()));
      } else if (role === 'student') {
        validStudentIds = new Set([requester.userId]);
      }
    }

    const validRecords = [];
    const failedItems = [];
    const idempotencyMap = new Map<string, boolean>();

    for (const record of records) {
      // Validate RBAC
      if (
        validStudentIds &&
        !validStudentIds.has(record.student_id.toString())
      ) {
        failedItems.push({
          record,
          reason: 'Không có quyền đánh giá sinh viên này',
        });
        continue;
      }

      // Lọc bỏ trùng lặp trong cùng batch
      if (record.idempotency_key) {
        if (idempotencyMap.has(record.idempotency_key)) {
          failedItems.push({
            record,
            reason: 'Trùng idempotency_key trong cùng batch',
          });
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
        groupsSynced: 0,
      };
    }

    // Insert batch records với ordered: false để bỏ qua duplicate keys
    const insertOps = validRecords.map((record) => ({
      insertOne: {
        document: record,
      },
    }));

    let result;
    let duplicatedCount = 0;
    try {
      result = await this.academicRecordModel.bulkWrite(insertOps as any, {
        ordered: false,
      });
    } catch (err) {
      if (err.code !== 11000 && !err.message.includes('11000')) {
        throw err;
      }
      // Dù có lỗi 11000 thì các document không bị trùng vẫn được insert vì ordered: false
      result = err.result || err;
      duplicatedCount = err.writeErrors
        ? err.writeErrors.length
        : validRecords.length - (result.insertedCount || result.nInserted || 0);
    }

    const insertedCount = result?.insertedCount || result?.nInserted || 0;
    const createdRecordIds = result?.insertedIds
      ? Object.values(result.insertedIds)
      : [];

    // Gom nhóm theo student_id + semester_id + criterion_id để sync
    const groups = new Set<string>();
    for (const record of validRecords) {
      const key = `${record.student_id}_${record.semester_id}_${record.criterion_id}`;
      groups.add(key);
    }

    // Chạy sync point cho từng nhóm, giới hạn concurrency
    const syncFuncs = Array.from(groups).map((groupKey) => {
      const [studentId, semesterId, criterionId] = groupKey.split('_');
      return () =>
        this.syncStudentCriterionScore(studentId, semesterId, criterionId);
    });

    const chunkSize = 10;
    for (let i = 0; i < syncFuncs.length; i += chunkSize) {
      const chunk = syncFuncs.slice(i, i + chunkSize);
      await Promise.all(chunk.map((f) => f()));
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

  private calculateGroupedRecordScore(record: any): number {
    const criterion = record?.criterion;
    if (!criterion) {
      return 0;
    }

    const structured = extractStructuredData(record);
    const result = this.scoreEngineService.calculate({
      criterion,
      calculation_context: 'manual',
      count:
        typeof record.quantity === 'number' && Number.isFinite(record.quantity)
          ? record.quantity
          : 1,
      selected_option_id: structured.selected_option_id,
      selected_option_label: structured.selected_option_label,
      selected_option_score: structured.selected_option_score,
      manual_score: structured.manual_score,
    });

    const isCountAction = structured.action_type === 'count';
    const isDiscipline =
      criterion.criterion_type === 'ky_luat' || criterion.score_per_unit < 0;

    if (isCountAction && isDiscipline) {
      const maxScore =
        criterion.max_score ??
        (criterion.criterion_type === 'ky_luat' || criterion.score_per_unit < 0
          ? 10
          : 100);
      return result.system_score - maxScore;
    }

    return this.scoreEngineService.getCriterionContribution(
      criterion,
      result.system_score,
    );
  }

  private serializeRecordWithEffectivePoints(record: any): any {
    const value =
      typeof record?.toObject === 'function' ? record.toObject() : { ...record };
    const effectivePoints = this.calculateGroupedRecordScore({
      ...value,
      criterion: value.criterion || value.criterion_id,
    });
    return {
      ...value,
      effectivePoints: Number.isFinite(effectivePoints) ? effectivePoints : 0,
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
    let groupBy: 'student' | undefined;
    let actualRequester = requester;

    if (
      query &&
      ('roleName' in query ||
        'userId' in query ||
        'role' in query ||
        'username' in query)
    ) {
      actualRequester = query;
    } else if (query) {
      page = query.page;
      limit = query.limit;
      groupBy = query.groupBy;
      search = query.search;
      classId = query.classId;
      semesterId = query.semesterId;
      studentId = query.studentId;
    }

    const isGroupedByStudent = groupBy === 'student';
    const isPaginationRequested =
      isGroupedByStudent || page !== undefined || limit !== undefined;
    const filter: any = { status: 'active', is_deleted: { $ne: true } };

    if (actualRequester) {
      const roleName = (actualRequester.roleName || '').toLowerCase();

      // Nếu là Student, chỉ trả về các bản ghi thuộc student của user đó
      if (roleName.includes('student')) {
        const student = await this.studentModel
          .findOne({ user_id: new Types.ObjectId(actualRequester.userId) })
          .exec();
        if (!student) {
          return isPaginationRequested
            ? {
                data: [],
                meta: {
                  total: 0,
                  page: page || 1,
                  limit: limit || 10,
                  totalPages: 0,
                  ...(isGroupedByStudent ? { has_more: false } : {}),
                },
              }
            : [];
        }
        filter.student_id = student._id;
      }
      // Nếu là Teacher, chỉ trả về các bản ghi thuộc class của teacher phụ trách
      else if (
        roleName.includes('teacher') ||
        roleName.includes('advisor') ||
        roleName.includes('giảng viên')
      ) {
        const classes = await this.classModel
          .find({ advisor_id: actualRequester.userId })
          .select('_id')
          .exec();
        const classIds = classes.map((c) => c._id);

        const students = await this.studentModel
          .find({ class_id: { $in: classIds } })
          .select('_id')
          .exec();
        const studentIds = students.map((s) => s._id);

        filter.student_id = { $in: studentIds };
      }
    }

    // Apply class filter if provided
    if (classId && Types.ObjectId.isValid(classId)) {
      const classStudents = await this.studentModel
        .find({ class_id: new Types.ObjectId(classId) })
        .select('_id')
        .exec();
      const classStudentIds = classStudents.map((s) => s._id);

      if (filter.student_id) {
        if (filter.student_id.$in) {
          filter.student_id.$in = filter.student_id.$in.filter((id: any) =>
            classStudentIds.some((csId) => csId.toString() === id.toString()),
          );
        } else {
          // Lọc theo một studentId cụ thể của Student
          if (
            !classStudentIds.some(
              (csId) => csId.toString() === filter.student_id.toString(),
            )
          ) {
            return isPaginationRequested
              ? {
                  data: [],
                  meta: {
                    total: 0,
                    page: page || 1,
                    limit: limit || 10,
                    totalPages: 0,
                    ...(isGroupedByStudent ? { has_more: false } : {}),
                  },
                }
              : [];
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
          const hasAccess = filter.student_id.$in.some(
            (id: any) => id.toString() === studentId,
          );
          if (!hasAccess) {
            return isPaginationRequested
              ? {
                  data: [],
                  meta: {
                    total: 0,
                    page: page || 1,
                    limit: limit || 10,
                    totalPages: 0,
                    ...(isGroupedByStudent ? { has_more: false } : {}),
                  },
                }
              : [];
          }
        } else {
          if (filter.student_id.toString() !== studentId) {
            return isPaginationRequested
              ? {
                  data: [],
                  meta: {
                    total: 0,
                    page: page || 1,
                    limit: limit || 10,
                    totalPages: 0,
                    ...(isGroupedByStudent ? { has_more: false } : {}),
                  },
                }
              : [];
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
        const escapedSearch = trimmedSearch.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&',
        );

        // Find students matching search
        const matchingStudents = await this.studentModel
          .find({
            $or: [
              { full_name: { $regex: escapedSearch, $options: 'i' } },
              { student_code: { $regex: escapedSearch, $options: 'i' } },
            ],
          })
          .select('_id')
          .exec();
        const studentIds = matchingStudents.map((s: any) => s._id);

        // Find criteria matching search
        const matchingCriteria = await this.criterionModel
          .find({
            criterion_name: { $regex: escapedSearch, $options: 'i' },
          })
          .select('_id')
          .exec();
        const criterionIds = matchingCriteria.map((c: any) => c._id);

        if (!filter.$and) filter.$and = [];
        filter.$and.push({
          $or: [
            { record_title: { $regex: escapedSearch, $options: 'i' } },
            { description: { $regex: escapedSearch, $options: 'i' } },
            { student_id: { $in: studentIds } },
            { criterion_id: { $in: criterionIds } },
          ],
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
        else if (creator === 'supervisor')
          roleRegex = 'supervisor|quản sinh|quan sinh';
        else if (creator === 'teacher')
          roleRegex = 'teacher|advisor|giảng viên|giang vien';
        else if (creator === 'student')
          roleRegex = 'student|học sinh|sinh viên';

        if (roleRegex) {
          const matchingRoles = await roleModel
            .find({ name: { $regex: roleRegex, $options: 'i' } })
            .select('_id')
            .exec();
          const roleIds = matchingRoles.map((r: any) => r._id);

          const matchingUsers = await userModel
            .find({ role: { $in: roleIds } })
            .select('_id')
            .exec();
          const userIds = matchingUsers.map((u: any) => u._id);

          filter.recorded_by = { $in: userIds };
        }
      } catch (err) {
        console.warn(
          'Could not filter by creator due to missing models or error:',
          err,
        );
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
        $or: [{ recorded_at: dateFilter }, { date_record: dateFilter }],
      });
    }

    if (isGroupedByStudent) {
      const p = page && page > 0 ? page : 1;
      const l = limit && limit > 0 ? limit : 10;
      const criterionCollection =
        (this.criterionModel as any).collection?.name || 'criteria';
      const groupedResult = await this.academicRecordModel
        .aggregate([
          { $match: filter },
          {
            $lookup: {
              from: criterionCollection,
              localField: 'criterion_id',
              foreignField: '_id',
              as: 'criterion',
            },
          },
          {
            $unwind: {
              path: '$criterion',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $sort: {
              createdAt: -1,
              recorded_at: -1,
              _id: -1,
            },
          },
          {
            $group: {
              _id: '$student_id',
              latestRecordId: { $first: '$_id' },
              latestCreatedAt: { $first: '$createdAt' },
              latestRecordedAt: { $first: '$recorded_at' },
              recordCount: { $sum: 1 },
              khenThuongCount: {
                $sum: {
                  $cond: [
                    { $eq: ['$criterion.criterion_type', 'khen_thuong'] },
                    1,
                    0,
                  ],
                },
              },
              congDiemCount: {
                $sum: {
                  $cond: [
                    { $eq: ['$criterion.criterion_type', 'cong_diem'] },
                    1,
                    0,
                  ],
                },
              },
              kyLuatCount: {
                $sum: {
                  $cond: [
                    { $eq: ['$criterion.criterion_type', 'ky_luat'] },
                    1,
                    0,
                  ],
                },
              },
              recordTypes: { $addToSet: '$criterion.criterion_type' },
              // Keep only the score inputs needed to reuse ScoreEngineService
              // after pagination, without returning the full history payload.
              scoreRecords: {
                $push: {
                  criterion: '$criterion',
                  action_type: '$action_type',
                  payload: '$payload',
                  record_title: '$record_title',
                  selected_option_id: '$selected_option_id',
                  selected_option_label: '$selected_option_label',
                  selected_option_score: '$selected_option_score',
                  quantity: '$quantity',
                  points_effect: '$points_effect',
                },
              },
            },
          },
          {
            $set: {
              recordTypeCounts: {
                khen_thuong: '$khenThuongCount',
                cong_diem: '$congDiemCount',
                ky_luat: '$kyLuatCount',
              },
              recordTypes: {
                $filter: {
                  input: ['khen_thuong', 'cong_diem', 'ky_luat'],
                  as: 'recordType',
                  cond: { $in: ['$$recordType', '$recordTypes'] },
                },
              },
            },
          },
          {
            $sort: {
              latestCreatedAt: -1,
              latestRecordedAt: -1,
              _id: 1,
            },
          },
          {
            $facet: {
              data: [
                { $skip: (p - 1) * l },
                { $limit: l },
              ],
              meta: [{ $count: 'total' }],
            },
          },
        ])
        .exec();

      const pageResult = groupedResult[0] || { data: [], meta: [] };
      const groups = pageResult.data || [];
      const latestRecordIds = groups.map((group: any) => group.latestRecordId);
      const latestRecords = latestRecordIds.length
        ? await this.academicRecordModel
            .find({ _id: { $in: latestRecordIds } })
            .populate('criterion_id')
            .populate('student_id')
            .populate('semester_id')
            .populate('daily_report_id')
            .populate({ path: 'recorded_by', populate: { path: 'role' } })
            .exec()
        : [];
      const recordsById = new Map(
        latestRecords.map((record: any) => [record._id.toString(), record]),
      );
      const data = groups
        .map((group: any) => {
          const latestRecord = recordsById.get(group.latestRecordId.toString());
          if (!latestRecord) return null;
          return {
            studentId: group._id.toString(),
            latestRecord,
            recordCount: group.recordCount,
            recordTypeCounts: group.recordTypeCounts || {
              khen_thuong: 0,
              cong_diem: 0,
              ky_luat: 0,
            },
            recordTypes: group.recordTypes || [],
            totalPoints:
              Array.isArray(group.scoreRecords) && group.scoreRecords.length > 0
                ? group.scoreRecords.reduce(
                    (total: number, scoreRecord: any) =>
                      total + this.calculateGroupedRecordScore(scoreRecord),
                    0,
                  )
                : typeof group.totalPoints === 'number'
                  ? group.totalPoints
                  : 0,
          };
        })
        .filter(Boolean);
      const total = pageResult.meta?.[0]?.total || 0;

      return {
        data,
        meta: {
          total,
          page: p,
          limit: l,
          totalPages: Math.ceil(total / l),
          has_more: p * l < total,
        },
      };
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
        this.academicRecordModel.countDocuments(filter).exec(),
      ]);

      return {
        data: records.map((record: any) =>
          this.serializeRecordWithEffectivePoints(record),
        ),
        meta: {
          total,
          page: p,
          limit: l,
          totalPages: Math.ceil(total / l),
        },
      };
    } else {
      const records = await this.academicRecordModel
        .find(filter)
        .populate('criterion_id')
        .populate('student_id')
        .populate('semester_id')
        .populate('daily_report_id')
        .populate({ path: 'recorded_by', populate: { path: 'role' } })
        .sort({ recorded_at: -1, createdAt: -1 })
        .exec();
      return records.map((record: any) =>
        this.serializeRecordWithEffectivePoints(record),
      );
    }
  }

  async findDeleted(requester?: any): Promise<AcademicRecord[]> {
    const filter: any = { $or: [{ status: 'inactive' }, { is_deleted: true }] };

    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      if (roleName.includes('student')) {
        const student = await this.studentModel
          .findOne({ user_id: new Types.ObjectId(requester.userId) })
          .exec();
        if (!student) return [];
        filter.student_id = student._id;
      } else if (
        roleName.includes('teacher') ||
        roleName.includes('advisor') ||
        roleName.includes('giảng viên')
      ) {
        const classes = await this.classModel
          .find({ advisor_id: requester.userId })
          .select('_id')
          .exec();
        const classIds = classes.map((c) => c._id);
        const students = await this.studentModel
          .find({ class_id: { $in: classIds } })
          .select('_id')
          .exec();
        const studentIds = students.map((s) => s._id);
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
        const studentEmail =
          record.student_id && typeof record.student_id === 'object'
            ? (record.student_id as any).email
            : '';
        if (
          !requester.email ||
          !studentEmail ||
          requester.email.toLowerCase() !== studentEmail.toLowerCase()
        ) {
          throw new ForbiddenException(
            'Bạn không có quyền truy cập ghi nhận rèn luyện của sinh viên khác.',
          );
        }
      } else if (
        roleName.includes('teacher') ||
        roleName.includes('advisor') ||
        roleName.includes('giảng viên')
      ) {
        const classes = await this.classModel
          .find({ advisor_id: requester.userId })
          .select('_id')
          .exec();
        const classIds = classes.map((c) => c._id.toString());
        const studentClassId =
          record.student_id && typeof record.student_id === 'object'
            ? (record.student_id as any).class_id?.toString()
            : null;
        if (!studentClassId || !classIds.includes(studentClassId)) {
          throw new ForbiddenException(
            'Bạn không có quyền truy cập sinh viên ngoài lớp phụ trách.',
          );
        }
      }
    }

    return record;
  }

  async findByStudentId(
    studentId: string,
    requester?: any,
    pagination?: { page?: number; limit?: number },
  ): Promise<
    | AcademicRecord[]
    | {
        data: AcademicRecord[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        has_more: boolean;
      }
  > {
    const isPaginationRequested =
      pagination !== undefined &&
      (pagination.page !== undefined || pagination.limit !== undefined);

    if (!Types.ObjectId.isValid(studentId)) {
      if (isPaginationRequested) {
        const p = pagination?.page || 1;
        const l = pagination?.limit || 10;
        return {
          data: [],
          total: 0,
          page: p,
          limit: l,
          totalPages: 0,
          has_more: false,
        };
      }
      return [];
    }

    if (requester) {
      const roleName = getRequesterRoleName(requester);
      const isRequesterStudent = roleName === 'Student';
      const isRequesterTeacher = roleName === 'Teacher';

      if (isRequesterStudent) {
        const student = await this.studentModel
          .findOne({ user_id: new Types.ObjectId(requester.userId) })
          .exec();
        if (!student || student._id.toString() !== studentId) {
          throw new ForbiddenException(
            'Bạn không có quyền truy cập ghi nhận rèn luyện của sinh viên khác.',
          );
        }
      } else if (isRequesterTeacher) {
        const classes = await this.classModel
          .find({ advisor_id: requester.userId })
          .select('_id')
          .exec();
        const classIds = classes.map((c) => c._id.toString());

        const student = await this.studentModel.findById(studentId).exec();
        if (
          !student ||
          !student.class_id ||
          !classIds.includes(student.class_id.toString())
        ) {
          throw new ForbiddenException(
            'Bạn không có quyền truy cập sinh viên ngoài lớp phụ trách.',
          );
        }
      }
    }

    const filter: any = {
      student_id: new Types.ObjectId(studentId),
      status: 'active',
      is_deleted: { $ne: true },
    };

    if (isPaginationRequested) {
      const p = pagination.page && pagination.page > 0 ? pagination.page : 1;
      const l = pagination.limit && pagination.limit > 0 ? pagination.limit : 10;

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
        this.academicRecordModel.countDocuments(filter).exec(),
      ]);

      const totalPages = Math.ceil(total / l);
      const has_more = p * l < total;

      return {
        data: records.map((record: any) =>
          this.serializeRecordWithEffectivePoints(record),
        ),
        total,
        page: p,
        limit: l,
        totalPages,
        has_more,
      };
    }

    const records = await this.academicRecordModel
      .find(filter)
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .sort({ recorded_at: -1, createdAt: -1 })
      .exec();
    return records.map((record: any) =>
      this.serializeRecordWithEffectivePoints(record),
    );
  }

  async findByDailyReportId(
    dailyReportId: string,
    includeDeleted: boolean = false,
    requester?: any,
  ): Promise<AcademicRecord[]> {
    if (!Types.ObjectId.isValid(dailyReportId)) {
      return [];
    }
    const query: any = includeDeleted
      ? { daily_report_id: new Types.ObjectId(dailyReportId) }
      : {
          daily_report_id: new Types.ObjectId(dailyReportId),
          status: 'active',
          is_deleted: { $ne: true },
        };

    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      if (roleName.includes('student')) {
        const student = await this.studentModel
          .findOne({ user_id: new Types.ObjectId(requester.userId) })
          .exec();
        if (!student) return [];
        query.student_id = student._id;
      } else if (
        roleName.includes('teacher') ||
        roleName.includes('advisor') ||
        roleName.includes('giảng viên')
      ) {
        const classes = await this.classModel
          .find({ advisor_id: requester.userId })
          .select('_id')
          .exec();
        const classIds = classes.map((c) => c._id);
        const students = await this.studentModel
          .find({ class_id: { $in: classIds } })
          .select('_id')
          .exec();
        const studentIds = students.map((s) => s._id);
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

    const oldRecord = await this.academicRecordModel
      .findOne({ _id: id, status: 'active', is_deleted: { $ne: true } })
      .populate('student_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
    if (!oldRecord) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    await this.checkSummaryLocked(oldRecord.student_id, oldRecord.semester_id);
    if (
      updateAcademicRecordDto.student_id ||
      updateAcademicRecordDto.semester_id
    ) {
      const nextStudent =
        updateAcademicRecordDto.student_id || oldRecord.student_id;
      const nextSemester =
        updateAcademicRecordDto.semester_id || oldRecord.semester_id;
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
    const oldStudent = oldRecord.student_id
      ? oldRecord.student_id.toString()
      : '';
    const oldSemester = oldRecord.semester_id
      ? oldRecord.semester_id.toString()
      : '';
    const oldCriterion = oldRecord.criterion_id
      ? oldRecord.criterion_id.toString()
      : '';

    const newStudent = updated.student_id ? updated.student_id.toString() : '';
    const newSemester = updated.semester_id
      ? updated.semester_id.toString()
      : '';
    const newCriterion = updated.criterion_id
      ? updated.criterion_id.toString()
      : '';

    if (
      oldStudent !== newStudent ||
      oldSemester !== newSemester ||
      oldCriterion !== newCriterion
    ) {
      await this.safeSync(updated);
    }

    return updated;
  }

  async remove(
    id: string,
    requester: any,
    bypassDailyReportCheck: boolean = false,
  ): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const record = await this.academicRecordModel
      .findOne({ _id: id, status: 'active', is_deleted: { $ne: true } })
      .populate('student_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
    if (!record) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

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

    const deleted = await this.academicRecordModel
      .findByIdAndUpdate(id, updatePayload, { returnDocument: 'after' })
      .exec();

    if (!deleted) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    // Sync score update
    await this.safeSync(deleted);

    return deleted;
  }

  private async bulkDelete(
    ids: string[],
    operation: (id: string) => Promise<AcademicRecord>,
  ) {
    const requested = Array.from(new Set(ids));
    const succeeded: string[] = [];
    const failed: Array<{ id: string; message: string }> = [];

    for (const id of requested) {
      try {
        await operation(id);
        succeeded.push(id);
      } catch (error: any) {
        const response = error?.getResponse?.();
        const message = typeof response === 'string'
          ? response
          : response?.message || error?.message || 'Không thể xoá ghi nhận';
        failed.push({ id, message: Array.isArray(message) ? message.join(', ') : message });
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

  async bulkRemove(ids: string[], requester: any) {
    return this.bulkDelete(ids, (id) => this.remove(id, requester));
  }

  async restore(id: string, requester?: any): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const record = await this.academicRecordModel
      .findOne({ _id: id, $or: [{ status: 'inactive' }, { is_deleted: true }] })
      .populate('student_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
    if (!record) {
      throw new NotFoundException(
        `AcademicRecord with ID ${id} not found trong thùng rác`,
      );
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

  async forceRemove(
    id: string,
    requester: any,
    bypassDailyReportCheck: boolean = false,
  ): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const record = await this.academicRecordModel
      .findById(id)
      .populate('student_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
    if (!record) {
      throw new NotFoundException(
        `AcademicRecord with ID ${id} not found or already deleted`,
      );
    }

    if (
      !bypassDailyReportCheck &&
      record.status !== 'inactive' &&
      record.is_deleted !== true
    ) {
      throw new BadRequestException(
        'Chỉ có thể xóa vĩnh viễn ghi nhận rèn luyện đã nằm trong thùng rác.',
      );
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
      throw new NotFoundException(
        `AcademicRecord with ID ${id} not found or already deleted`,
      );
    }

    // Sync score update
    await this.safeSync(deleted);

    return deleted;
  }

  async bulkForceRemove(
    ids: string[],
    requester: any,
    bypassDailyReportCheck = false,
  ) {
    return this.bulkDelete(ids, (id) =>
      this.forceRemove(id, requester, bypassDailyReportCheck),
    );
  }

  private checkHierarchyPermission(record: any, requester: any): void {
    if (!requester) {
      throw new ForbiddenException('Thông tin người yêu cầu không hợp lệ.');
    }

    const getRoleLevel = (roleName?: string): number => {
      if (!roleName) return 1;
      const nameLower = roleName.toLowerCase();
      if (nameLower.includes('admin')) return 4;
      if (
        nameLower.includes('supervisor') ||
        nameLower.includes('quản sinh') ||
        nameLower.includes('quan sinh')
      )
        return 3;
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
      const studentEmail =
        record.student_id && typeof record.student_id === 'object'
          ? record.student_id.email
          : '';

      // So sánh email của tài khoản đang đăng nhập với email của sinh viên sở hữu bản ghi
      if (
        requester.email &&
        studentEmail &&
        requester.email.toLowerCase() === studentEmail.toLowerCase()
      ) {
        let creatorId = '';
        if (record.recorded_by) {
          creatorId =
            typeof record.recorded_by === 'object'
              ? record.recorded_by._id?.toString()
              : record.recorded_by.toString();
        }

        // Cho phép sinh viên xóa nếu bản ghi do chính họ tạo, hoặc bản ghi trống recorded_by
        if (!creatorId || creatorId === requester.userId) {
          return; // Cho phép xóa!
        }
      }
      throw new ForbiddenException(
        'Bạn chỉ có thể xóa ghi nhận rèn luyện tự chấm của chính mình.',
      );
    }

    let creatorLevel = 1;
    let creatorId = '';

    if (record.recorded_by) {
      creatorId =
        typeof record.recorded_by === 'object'
          ? record.recorded_by._id?.toString()
          : record.recorded_by.toString();
      const creatorRoleName = record.recorded_by.role
        ? typeof record.recorded_by.role === 'object'
          ? record.recorded_by.role.name
          : record.recorded_by.role
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
      throw new ForbiddenException(
        'Bạn chỉ có thể xóa ghi nhận rèn luyện do chính mình tạo ra.',
      );
    }

    // Cấp thấp hơn không được xóa
    throw new ForbiddenException(
      'Bạn không có quyền xóa ghi nhận rèn luyện của cấp bậc cao hơn.',
    );
  }

  async importPreview(rows: any[], requester: any): Promise<any> {
    const semesterModel = this.academicRecordModel.db.model('Semester');

    // RBAC: Teacher/Advisor chỉ được import ghi nhận cho sinh viên lớp phụ trách
    let validStudentIds: Set<string> | null = null;
    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      if (
        roleName.includes('teacher') ||
        roleName.includes('advisor') ||
        roleName.includes('giảng viên')
      ) {
        const classes = await this.classModel
          .find({ advisor_id: requester.userId })
          .select('_id')
          .exec();
        const classIds = classes.map((c) => c._id);
        const students = await this.studentModel
          .find({ class_id: { $in: classIds } })
          .select('_id')
          .exec();
        validStudentIds = new Set(students.map((s) => s._id.toString()));
      }
    }

    // 1. Thu thập tất cả student_code để query
    const studentCodes = Array.from(
      new Set(
        rows
          .map((r) => {
            const code =
              r['Ma SV'] ||
              r['Mã SV'] ||
              r['Mã sinh viên'] ||
              r['student_code'];
            return code ? code.toString().trim() : '';
          })
          .filter(Boolean),
      ),
    );

    // 2. Query students
    const students = await this.studentModel
      .find({ student_code: { $in: studentCodes } })
      .lean()
      .exec();
    const studentMap = new Map(
      students.map((s) => [s.student_code.toLowerCase(), s]),
    );

    // 3. Query all criteria and semesters (dung lượng nhỏ)
    const criteria = await this.criterionModel.find().lean().exec();
    const criteriaMap = new Map(
      criteria.map((c) => [
        (c.criterion_name || '').toString().trim().toLowerCase(),
        c,
      ]),
    );
    const criteriaCodeMap = new Map(
      criteria
        .map((c) => {
          const code = c.criterion_code
            ? c.criterion_code.toString().trim().toLowerCase()
            : '';
          return [code, c] as [string, any];
        })
        .filter((entry) => entry[0] !== ''),
    );

    const semesters = await semesterModel.find().lean().exec();
    const semesterMap = new Map(
      semesters.map((s: any) => [
        (s.semester_name || s.name || '').toString().trim().toLowerCase(),
        s,
      ]),
    );
    const activeSem = semesters.find((s: any) => s.status === 'active');

    const errors: any[] = [];
    const validItems: any[] = [];
    const seen = new Map<string, number>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;
      const studentCodeRaw =
        row['Ma SV'] ||
        row['Mã SV'] ||
        row['Mã sinh viên'] ||
        row['student_code'];
      const criterionCodeRaw =
        row['Ma tieu chi'] || row['Mã tiêu chí'] || row['criterion_code'];
      const criterionRaw =
        row['Tieu chi'] ||
        row['Tiêu chí'] ||
        row['criterion'] ||
        row['Tieu chi (*)'];
      const dateRaw =
        row['Ngay ghi nhan'] ||
        row['Ngày ghi nhận'] ||
        row['recorded_at'] ||
        row['Ngay'];
      const noteRaw = row['Ghi chu'] || row['Ghi chú'] || row['note'];
      const semesterRaw = row['Hoc ky'] || row['Học kỳ'] || row['semester'];
      const statusRaw = row['Trang thai'] || row['Trạng thái'] || row['status'];

      const studentCode = studentCodeRaw
        ? studentCodeRaw.toString().trim()
        : '';
      if (!studentCode) {
        errors.push({ row: rowNumber, reason: 'Thiếu Mã SV' });
        continue;
      }

      if (!criterionCodeRaw && !criterionRaw) {
        errors.push({
          row: rowNumber,
          studentCode,
          reason: 'Thiếu Mã tiêu chí hoặc Tiêu chí',
        });
        continue;
      }

      if (dateRaw === undefined || dateRaw === null || dateRaw === '') {
        errors.push({
          row: rowNumber,
          studentCode,
          reason: 'Thiếu Ngày ghi nhận',
        });
        continue;
      }

      const foundStudent = studentMap.get(studentCode.toLowerCase());
      if (!foundStudent) {
        errors.push({
          row: rowNumber,
          studentCode,
          reason: 'Không tìm thấy sinh viên theo Mã SV',
        });
        continue;
      }

      if (
        validStudentIds &&
        !validStudentIds.has(foundStudent._id.toString())
      ) {
        errors.push({
          row: rowNumber,
          studentCode,
          fullName: foundStudent.full_name,
          reason:
            'Không có quyền ghi nhận cho sinh viên này (ngoài lớp phụ trách)',
        });
        continue;
      }

      let foundCriterion: any = null;
      if (criterionCodeRaw) {
        const criterionCode = criterionCodeRaw.toString().trim().toLowerCase();
        foundCriterion = criteriaCodeMap.get(criterionCode);
        if (!foundCriterion) {
          errors.push({
            row: rowNumber,
            studentCode,
            fullName: foundStudent.full_name,
            reason: `Không tìm thấy tiêu chí theo mã: ${criterionCodeRaw.toString().trim()}`,
          });
          continue;
        }
      } else {
        const criterionName = criterionRaw.toString().trim();
        foundCriterion = criteriaMap.get(criterionName.toLowerCase());
        if (!foundCriterion) {
          errors.push({
            row: rowNumber,
            studentCode,
            fullName: foundStudent.full_name,
            reason: `Không tìm thấy tiêu chí: ${criterionName}`,
          });
          continue;
        }
      }

      // Parse date
      let recordedAtIso = '';
      let dateErr = false;
      if (typeof dateRaw === 'number') {
        const jsDate = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
        if (isNaN(jsDate.getTime())) dateErr = true;
        else recordedAtIso = jsDate.toISOString();
      } else {
        const str = dateRaw ? dateRaw.toString().trim() : '';
        const dmy = /^([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{4})$/;
        const m = str.match(dmy);
        if (m) {
          const day = parseInt(m[1], 10);
          const month = parseInt(m[2], 10) - 1;
          const year = parseInt(m[3], 10);
          const parsed = new Date(year, month, day);
          if (isNaN(parsed.getTime()) || parsed.getDate() !== day)
            dateErr = true;
          else recordedAtIso = parsed.toISOString();
        } else {
          const parsed = new Date(str);
          if (isNaN(parsed.getTime())) dateErr = true;
          else recordedAtIso = parsed.toISOString();
        }
      }
      if (dateErr) {
        errors.push({
          row: rowNumber,
          studentCode,
          fullName: foundStudent.full_name,
          reason: `Định dạng ngày không hợp lệ: ${dateRaw}`,
        });
        continue;
      }

      // Semester
      let semesterId = '';
      if (semesterRaw) {
        const semStr = semesterRaw.toString().trim().toLowerCase();
        const foundSem =
          semesterMap.get(semStr) ||
          semesters.find((s: any) => s._id.toString() === semStr);
        if (foundSem) {
          semesterId = foundSem._id.toString();
        } else {
          errors.push({
            row: rowNumber,
            studentCode,
            fullName: foundStudent.full_name,
            reason: `Không tìm thấy học kỳ: ${semesterRaw}`,
          });
          continue;
        }
      } else if (activeSem) {
        semesterId = activeSem._id.toString();
      } else {
        errors.push({
          row: rowNumber,
          studentCode,
          fullName: foundStudent.full_name,
          reason: 'Không có học kỳ active để gán mặc định',
        });
        continue;
      }

      // Check if summary is locked
      const summary = await this.summaryPointModel
        .findOne({
          student_id: foundStudent._id,
          semester_id: new Types.ObjectId(semesterId),
        } as any)
        .select('status')
        .exec();
      if (summary && summary.status === 'locked') {
        errors.push({
          row: rowNumber,
          studentCode,
          fullName: foundStudent.full_name,
          reason:
            'Bảng điểm rèn luyện của học kỳ này đã chốt, không thể nhập thêm điểm.',
        });
        continue;
      }

      const status = statusRaw
        ? statusRaw.toString().trim().toLowerCase()
        : 'active';
      if (statusRaw && status !== 'active' && status !== 'inactive') {
        errors.push({
          row: rowNumber,
          studentCode,
          fullName: foundStudent.full_name,
          reason: `Trạng thái không hợp lệ: ${statusRaw}`,
        });
        continue;
      }

      // duplicate check in file
      const idempotency_key = `${studentCode}_${foundCriterion._id.toString()}_${recordedAtIso}`;
      if (seen.has(idempotency_key)) {
        errors.push({
          row: rowNumber,
          studentCode,
          fullName: foundStudent.full_name,
          reason: `Bản ghi trùng lặp trong file (trùng với dòng ${seen.get(idempotency_key)})`,
        });
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
        idempotency_key,
      });
    }

    const sessionId =
      Date.now().toString() + Math.random().toString(36).substring(2, 7);
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
      commitErrors: [],
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
      errors,
    };
  }

  async importCommit(sessionId: string, requester: any): Promise<any> {
    const session = this.importSessions.get(sessionId);
    if (!session) {
      throw new BadRequestException('Session không tồn tại hoặc đã hết hạn');
    }
    if (session.status !== 'ready_to_commit') {
      throw new BadRequestException(
        'Session đang ở trạng thái không hợp lệ: ' + session.status,
      );
    }

    session.status = 'committing';

    // Background job
    this.processImportBatch(sessionId, requester).catch((err) => {
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
          insertOne: { document: record },
        }));

        let result;
        try {
          result = await this.academicRecordModel.bulkWrite(insertOps, {
            ordered: false,
          });
        } catch (err: any) {
          if (err.code !== 11000 && !err.message.includes('11000')) {
            throw err;
          }
          result = err.result || err;
          session.duplicatedCount += err.writeErrors
            ? err.writeErrors.length
            : batch.length - (result.insertedCount || result.nInserted || 0);
        }

        session.insertedCount +=
          result?.insertedCount || result?.nInserted || 0;
        session.processedCount += batch.length;
        session.progress =
          validItems.length > 0
            ? Math.floor((session.processedCount / validItems.length) * 100)
            : 100;

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
