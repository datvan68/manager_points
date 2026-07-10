import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ClubAttendance,
  ClubAttendanceDocument,
} from './schemas/club-attendance.schema';
import {
  ClubAttendanceConfig,
  ClubAttendanceConfigDocument,
} from '../club-attendance-config/schemas/club-attendance-config.schema';
import {
  AcademicRecord,
  AcademicRecordDocument,
} from '../academic-record/schemas/academic-record.schema';
import { Club, ClubDocument } from '../clubs/schemas/club.schema';
import {
  ClubSchedule,
  ClubScheduleDocument,
} from '../club-schedules/schemas/club-schedule.schema';
import { ActivityCompletionService } from './activity-completion.service';

/**
 * Service responsible for syncing approved club attendance records
 * to AcademicRecord entries for training point calculation.
 *
 * Flow: ClubAttendance (approved) → AcademicRecord → SummaryPoints (via projection)
 */
@Injectable()
export class ClubAttendanceSyncService {
  private readonly logger = new Logger(ClubAttendanceSyncService.name);

  constructor(
    @InjectModel(ClubAttendance.name)
    private attendanceModel: Model<ClubAttendanceDocument>,
    @InjectModel(ClubAttendanceConfig.name)
    private configModel: Model<ClubAttendanceConfigDocument>,
    @InjectModel(AcademicRecord.name)
    private academicRecordModel: Model<AcademicRecordDocument>,
    @InjectModel(Club.name)
    private clubModel: Model<ClubDocument>,
    @InjectModel(ClubSchedule.name)
    private scheduleModel: Model<ClubScheduleDocument>,
    private activityCompletionService: ActivityCompletionService,
  ) {}

  /**
   * Sync a single approved attendance record to AcademicRecord.
   * Called after attendance approval if auto_sync_on_approve is enabled.
   */
  async syncAttendanceToAcademicRecord(
    attendanceId: string,
  ): Promise<{ synced: boolean; record_id?: string; reason?: string }> {
    const attendance = await this.attendanceModel.findById(attendanceId);
    if (!attendance) {
      return { synced: false, reason: 'Attendance record not found' };
    }

    // Only sync approved attendance with present/late status
    if (attendance.approval_status !== 'approved') {
      return { synced: false, reason: 'Attendance not approved' };
    }
    if (attendance.status !== 'present' && attendance.status !== 'late') {
      return { synced: false, reason: 'Only present/late status earns points' };
    }
    if (attendance.synced_to_academic_record) {
      return { synced: false, reason: 'Already synced' };
    }

    // Check if there is an active ActivityCompletionRule
    const hasRule = await this.activityCompletionService.hasActiveRule(
      attendance.club_id,
      attendance.semester_id,
    );

    if (hasRule) {
      // Evaluate completion and award if eligible
      await this.activityCompletionService.checkAndAwardCompletion(
        attendance.student_id.toString(),
        attendance.club_id.toString(),
        attendance.semester_id.toString(),
      );

      // Mark as synced to prevent per-attendance legacy scoring, without linking an academic record
      attendance.synced_to_academic_record = true;
      await attendance.save();

      return {
        synced: true,
        reason: 'Synced and evaluated via Activity Completion Rule',
      };
    }

    // Get effective config
    const config = await this.getEffectiveConfig(
      attendance.club_id.toString(),
      attendance.semester_id.toString(),
    );
    if (!config) {
      return {
        synced: false,
        reason: 'No attendance config found for this club/semester',
      };
    }

    // Check if club has attendance_point_enabled
    const club = await this.clubModel.findById(attendance.club_id).lean();
    if (!club || !club.settings?.attendance_point_enabled) {
      return { synced: false, reason: 'Club attendance points not enabled' };
    }

    // Check min_attendance_for_points
    if (config.min_attendance_for_points > 1) {
      const approvedCount = await this.attendanceModel.countDocuments({
        club_id: attendance.club_id,
        student_id: attendance.student_id,
        semester_id: attendance.semester_id,
        approval_status: 'approved',
        status: { $in: ['present', 'late'] },
      });
      if (approvedCount < config.min_attendance_for_points) {
        return {
          synced: false,
          reason: `Need ${config.min_attendance_for_points} approved attendances, currently ${approvedCount}`,
        };
      }
    }

    // Calculate points based on status
    const points =
      attendance.status === 'present'
        ? config.point_per_attendance
        : config.point_per_late;

    // Check max_points_per_semester
    if (config.max_points_per_semester) {
      const existingPoints = await this.calculateExistingPoints(
        attendance.student_id.toString(),
        attendance.semester_id.toString(),
        attendance.club_id.toString(),
      );
      if (existingPoints + points > config.max_points_per_semester) {
        return {
          synced: false,
          reason: `Would exceed max points per semester (${config.max_points_per_semester})`,
        };
      }
    }

    // Get schedule info for record title
    const schedule = await this.scheduleModel
      .findById(attendance.schedule_id)
      .lean();

    // Build idempotency key to prevent duplicate records
    const idempotencyKey = `club_att:${attendance._id.toString()}`;

    // Check for existing record with same idempotency key
    const existingRecord = await this.academicRecordModel.findOne({
      idempotency_key: idempotencyKey,
      is_deleted: false,
    });
    if (existingRecord) {
      // Update attendance with existing record reference
      attendance.synced_to_academic_record = true;
      attendance.academic_record_id = existingRecord._id;
      await attendance.save();
      return { synced: true, record_id: existingRecord._id.toString() };
    }

    try {
      // Create AcademicRecord
      const academicRecord = new this.academicRecordModel({
        student_id: attendance.student_id,
        semester_id: attendance.semester_id,
        criterion_id: config.criterion_id,
        record_title: `Điểm danh CLB: ${club.name}${schedule ? ` - ${schedule.title}` : ''}`,
        description: `Điểm danh ${attendance.status === 'present' ? 'có mặt' : 'muộn'} tại CLB ${club.name}`,
        recorded_by: attendance.approved_by || attendance.recorded_by,
        recorded_at: new Date(),
        status: 'active',
        is_deleted: false,
        idempotency_key: idempotencyKey,
        source: 'club_attendance',
        recorded_by_role: 'system',
        record_type: 'activity',
        action_type: 'count',
        quantity: 1,
        source_type: 'club_attendance',
        source_id: attendance._id.toString(),
        occurred_at: attendance.check_in_time || attendance.recorded_at,
        payload: {
          club_id: attendance.club_id.toString(),
          club_name: club.name,
          club_code: club.code,
          schedule_id: attendance.schedule_id.toString(),
          schedule_title: schedule?.title,
          attendance_status: attendance.status,
          points_awarded: points,
        },
      });

      const saved = await academicRecord.save();

      // Update attendance record with sync info
      attendance.synced_to_academic_record = true;
      attendance.academic_record_id = saved._id;
      await attendance.save();

      this.logger.log(
        `Synced attendance ${attendance._id} → AcademicRecord ${saved._id} (${points} points)`,
      );

      return { synced: true, record_id: saved._id.toString() };
    } catch (error: any) {
      // Handle duplicate key error gracefully
      if (error.code === 11000) {
        this.logger.warn(`Duplicate idempotency key: ${idempotencyKey}`);
        return {
          synced: false,
          reason: 'Duplicate record prevented by idempotency key',
        };
      }
      this.logger.error(
        `Failed to sync attendance ${attendance._id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Batch sync all approved but unsynced attendance records for a club in a semester.
   */
  async batchSyncClubAttendance(
    clubId: string,
    semesterId: string,
  ): Promise<{
    total: number;
    synced: number;
    skipped: number;
    errors: string[];
  }> {
    const unsyncedAttendances = await this.attendanceModel.find({
      club_id: new Types.ObjectId(clubId),
      semester_id: new Types.ObjectId(semesterId),
      approval_status: 'approved',
      status: { $in: ['present', 'late'] },
      synced_to_academic_record: false,
    });

    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const attendance of unsyncedAttendances) {
      try {
        const result = await this.syncAttendanceToAcademicRecord(
          attendance._id.toString(),
        );
        if (result.synced) {
          synced++;
        } else {
          skipped++;
        }
      } catch (err: any) {
        errors.push(`${attendance._id}: ${err.message}`);
      }
    }

    return { total: unsyncedAttendances.length, synced, skipped, errors };
  }

  /**
   * Revoke academic record when attendance is rejected or deleted after approval.
   */
  async revokeAcademicRecord(attendanceId: string): Promise<boolean> {
    const attendance = await this.attendanceModel.findById(attendanceId);
    if (!attendance || !attendance.academic_record_id) {
      return false;
    }

    // Soft-delete the academic record
    await this.academicRecordModel.findByIdAndUpdate(
      attendance.academic_record_id,
      { $set: { status: 'cancelled', is_deleted: true } },
    );

    // Clear sync reference
    attendance.synced_to_academic_record = false;
    attendance.academic_record_id = null as any;
    await attendance.save();

    this.logger.log(`Revoked AcademicRecord for attendance ${attendanceId}`);
    return true;
  }

  /**
   * Get effective config for a club (club-specific first, then default fallback).
   */
  private async getEffectiveConfig(
    clubId: string,
    semesterId: string,
  ): Promise<ClubAttendanceConfigDocument | null> {
    // Try club-specific config
    let config = await this.configModel.findOne({
      club_id: new Types.ObjectId(clubId),
      semester_id: new Types.ObjectId(semesterId),
      status: 'active',
    });

    // Fallback to default config
    if (!config) {
      config = await this.configModel.findOne({
        club_id: null,
        semester_id: new Types.ObjectId(semesterId),
        status: 'active',
      });
    }

    return config;
  }

  /**
   * Calculate existing synced points for a student in a club for a semester.
   */
  private async calculateExistingPoints(
    studentId: string,
    semesterId: string,
    clubId: string,
  ): Promise<number> {
    const syncedAttendances = await this.attendanceModel
      .find({
        student_id: new Types.ObjectId(studentId),
        semester_id: new Types.ObjectId(semesterId),
        club_id: new Types.ObjectId(clubId),
        synced_to_academic_record: true,
      })
      .lean();

    const config = await this.getEffectiveConfig(clubId, semesterId);
    if (!config) return 0;

    let totalPoints = 0;
    for (const att of syncedAttendances) {
      totalPoints +=
        att.status === 'present'
          ? config.point_per_attendance
          : config.point_per_late;
    }

    return totalPoints;
  }
}
