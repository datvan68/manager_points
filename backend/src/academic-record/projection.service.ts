import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SummaryPoint,
  SummaryPointDocument,
} from '../summaries-point/schemas/summary-point.schema';
import {
  AcademicRecord,
  AcademicRecordDocument,
} from './schemas/academic-record.schema';
import { ScoreEngineService, groupRecordsByRole, CountsByRole } from './score-engine.service';
import { CountResolutionService, detectConflict } from './count-resolution.service';
import {
  Criterion,
  CriterionDocument,
} from '../criteria/schemas/criterion.schema';

export interface ProjectionResult {
  counts_by_role: Partial<CountsByRole>;
  total_count: number;
  resolved_count: number;
  has_conflict: boolean;
  source_record_count: number;
}

export interface ReconciliationResult {
  criterion_id: string;
  incremental_count: number;
  actual_count: number;
  is_consistent: boolean;
}

@Injectable()
export class ProjectionService {
  private readonly logger = new Logger(ProjectionService.name);

  constructor(
    @InjectModel(SummaryPoint.name)
    private readonly summaryPointModel: Model<SummaryPointDocument>,
    @InjectModel(AcademicRecord.name)
    private readonly academicRecordModel: Model<AcademicRecordDocument>,
    @InjectModel(Criterion.name)
    private readonly criterionModel: Model<CriterionDocument>,
    private readonly scoreEngineService: ScoreEngineService,
    private readonly countResolutionService: CountResolutionService,
  ) {}

  /**
   * Hot path — incremental update via $inc on the embedded detail.
   *
   * Atomically increments the role-specific count within the summary's
   * details array, avoiding full document replacement and reducing
   * VersionError contention.
   *
   * Performance target: ≤ 100ms P95
   */
  async incrementCount(params: {
    studentId: string;
    semesterId: string;
    criterionId: string;
    recorded_by_role: string;
    quantity: number; // +1 or -1
    recordId: string;
  }): Promise<void> {
    const { studentId, semesterId, criterionId, recorded_by_role, quantity, recordId } = params;

    const roleField = `details.$.counts_by_role.${recorded_by_role}`;

    const result = await this.summaryPointModel.updateOne(
      {
        student_id: new Types.ObjectId(studentId),
        semester_id: new Types.ObjectId(semesterId),
        'details.criterion_id': new Types.ObjectId(criterionId),
      } as any,
      {
        $inc: {
          [roleField]: quantity,
          'details.$.source_record_count': quantity > 0 ? 1 : -1,
        },
        $set: {
          'details.$.last_source_record_id': recordId,
          'details.$.last_record_at': new Date(),
        },
      } as any,
    );

    if (result.modifiedCount === 0) {
      this.logger.warn(
        `[incrementCount] No matching detail found for student=${studentId}, criterion=${criterionId}. ` +
        `The detail may not exist yet in the summary. Full recalculation may be needed.`,
      );
    }
  }

  /**
   * Consistency path — full recalculation from academic records.
   *
   * Re-reads all active records for a student+semester+criterion,
   * groups by role, and returns fresh counts. Used as the fallback
   * when incremental updates may have drifted.
   */
  async fullRecalculate(params: {
    studentId: string;
    semesterId: string;
    criterionId: string;
  }): Promise<ProjectionResult> {
    const { studentId, semesterId, criterionId } = params;

    const activeRecords = await this.academicRecordModel.find({
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(semesterId),
      criterion_id: new Types.ObjectId(criterionId),
      status: 'active',
      is_deleted: { $ne: true },
    } as any).lean().exec();

    const countsByRole = groupRecordsByRole(activeRecords);
    const totalCount = activeRecords.length;

    const resolution = this.countResolutionService.resolve({
      counts_by_role: countsByRole,
      context: 'auto',
    });

    const conflict = detectConflict(countsByRole);

    return {
      counts_by_role: countsByRole,
      total_count: totalCount,
      resolved_count: resolution.resolved_count,
      has_conflict: conflict.has_conflict,
      source_record_count: totalCount,
    };
  }

  /**
   * Reconciliation — compare incremental state vs actual DB records.
   *
   * For each criterion of a student's summary, compares the stored
   * source_record_count against the actual count of active records.
   * Returns mismatches so the caller can trigger full recalculation.
   */
  async reconcile(params: {
    studentId: string;
    semesterId: string;
  }): Promise<ReconciliationResult[]> {
    const { studentId, semesterId } = params;

    // Get the summary with all its details
    const summary = await this.summaryPointModel.findOne({
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(semesterId),
      period_id: null,
    } as any).exec();

    if (!summary || !summary.details || summary.details.length === 0) {
      return [];
    }

    // Get actual counts per criterion from academic records
    const actualCounts = await this.academicRecordModel.aggregate([
      {
        $match: {
          student_id: new Types.ObjectId(studentId),
          semester_id: new Types.ObjectId(semesterId),
          status: 'active',
          is_deleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: '$criterion_id',
          count: { $sum: 1 },
        },
      },
    ]);

    const actualCountMap = new Map<string, number>(
      actualCounts.map((c: any) => [c._id.toString(), c.count]),
    );

    const results: ReconciliationResult[] = [];

    for (const detail of summary.details) {
      const criterionId = detail.criterion_id?.toString();
      if (!criterionId) continue;

      const incrementalCount = (detail as any).source_record_count || detail.current_count || 0;
      const actualCount = actualCountMap.get(criterionId) || 0;

      results.push({
        criterion_id: criterionId,
        incremental_count: incrementalCount,
        actual_count: actualCount,
        is_consistent: incrementalCount === actualCount,
      });
    }

    return results;
  }
}
