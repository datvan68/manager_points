import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  AttendanceSession,
  AttendanceSessionDocument,
} from './schemas/attendance-session.schema';
import {
  AttendanceCheckin,
  AttendanceCheckinDocument,
} from './schemas/attendance-checkin.schema';
import { OpenSessionDto } from './dto/open-session.dto';
import { CheckinQrDto } from './dto/checkin-qr.dto';
import { CheckinProximityDto } from './dto/checkin-proximity.dto';
import {
  ActivityAttendance,
  ActivityAttendanceDocument,
} from '../club-attendance/schemas/club-attendance.schema';
import {
  ActivityMember,
  ActivityMemberDocument,
} from '../activities/schemas/activity-member.schema';
import {
  ActivitySchedule,
  ActivityScheduleDocument,
} from '../activity-schedules/schemas/activity-schedule.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { ActivityAttendanceSyncService } from '../club-attendance/club-attendance-sync.service';
import {
  AttendanceRealtimeEvent,
  attendanceEventEmitter,
} from '../system/attendance-event-emitter';

@Injectable()
export class AttendanceSessionsService {
  private readonly logger = new Logger(AttendanceSessionsService.name);

  constructor(
    @InjectModel(AttendanceSession.name)
    private sessionModel: Model<AttendanceSessionDocument>,
    @InjectModel(AttendanceCheckin.name)
    private checkinModel: Model<AttendanceCheckinDocument>,
    @InjectModel(ActivityAttendance.name)
    private clubAttendanceModel: Model<ActivityAttendanceDocument>,
    @InjectModel(ActivityMember.name)
    private clubMemberModel: Model<ActivityMemberDocument>,
    @InjectModel(ActivitySchedule.name)
    private scheduleModel: Model<ActivityScheduleDocument>,
    @InjectModel(Student.name)
    private studentModel: Model<StudentDocument>,
    private activityAttendanceSyncService: ActivityAttendanceSyncService,
  ) {}

  // ── Open Session ──

  async openSession(
    dto: OpenSessionDto,
    userId: string,
    roleCode?: string,
  ): Promise<AttendanceSessionDocument> {
    await this.ensureManager(dto.context_type, dto.context_id, userId, roleCode);
    await this.ensureTodaySchedule(dto.context_type, dto.context_id, dto.schedule_id);
    // Check for existing active session in same context
    const existing = await this.sessionModel.findOne({
      context_type: dto.context_type,
      context_id: new Types.ObjectId(dto.context_id),
      status: 'active',
    });
    if (existing) {
      throw new BadRequestException(
        'Đã có phiên điểm danh đang mở cho ngữ cảnh này. Vui lòng đóng phiên cũ trước.',
      );
    }

    // Validate proximity-specific fields
    if (dto.method === 'proximity') {
      if (dto.latitude == null || dto.longitude == null) {
        throw new BadRequestException(
          'Phương thức proximity yêu cầu tọa độ GPS (latitude, longitude).',
        );
      }
    }

    const sessionData: any = {
      context_type: dto.context_type,
      context_id: new Types.ObjectId(dto.context_id),
      semester_id: new Types.ObjectId(dto.semester_id),
      method: dto.method,
      status: 'active',
      opened_by: new Types.ObjectId(userId),
      opened_at: new Date(),
      allow_late_checkin: dto.allow_late_checkin ?? false,
      auto_approve: dto.auto_approve ?? true,
      title: dto.title,
      description: dto.description,
      max_checkins: dto.max_checkins,
    };

    if (dto.schedule_id) {
      sessionData.schedule_id = new Types.ObjectId(dto.schedule_id);
    }

    if (dto.auto_close_at) {
      sessionData.auto_close_at = new Date(dto.auto_close_at);
    }

    // QR-specific setup
    if (dto.method === 'qr') {
      sessionData.qr_refresh_interval = dto.qr_refresh_interval ?? 30;
      sessionData.qr_token = uuidv4();
      sessionData.qr_token_expires_at = new Date(
        Date.now() + (sessionData.qr_refresh_interval * 1000),
      );
    }

    // Proximity-specific setup
    if (dto.method === 'proximity') {
      sessionData.latitude = dto.latitude;
      sessionData.longitude = dto.longitude;
      sessionData.radius_meters = dto.radius_meters ?? 100;
    }

    const session = new this.sessionModel(sessionData);
    const saved = await session.save();

    this.logger.log(
      `Session opened: ${saved._id} (${dto.method}) for ${dto.context_type}:${dto.context_id}`,
    );
    this.emitEvent({ type: 'attendance.session_opened', contextType: saved.context_type, contextId: saved.context_id.toString(), sessionId: saved._id.toString(), checkinCount: saved.checkin_count, session: this.toPublicSession(saved) });

    return saved;
  }

  // ── Close Session ──

  async closeSession(
    sessionId: string,
    userId: string,
    roleCode?: string,
  ): Promise<AttendanceSessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên điểm danh');
    }
    if (session.status !== 'active') {
      throw new BadRequestException('Phiên điểm danh đã đóng');
    }
    await this.ensureManager(session.context_type, session.context_id.toString(), userId, roleCode);

    session.status = 'closed';
    session.closed_at = new Date();
    const saved = await session.save();
    this.emitEvent({ type: 'attendance.session_closed', contextType: saved.context_type, contextId: saved.context_id.toString(), sessionId: saved._id.toString(), checkinCount: saved.checkin_count, session: this.toPublicSession(saved) });
    return saved;
  }

  // ── QR Token Management ──

  async getQrData(
    sessionId: string,
    userId: string,
    roleCode?: string,
  ): Promise<{ token: string; expires_at: Date; refresh_interval: number; checkin_count: number }> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên điểm danh');
    }
    if (session.status !== 'active') {
      throw new BadRequestException('Phiên điểm danh đã đóng');
    }
    if (session.method !== 'qr') {
      throw new BadRequestException('Phiên này không dùng phương thức QR');
    }
    await this.ensureManager(session.context_type, session.context_id.toString(), userId, roleCode);

    // Auto-rotate if token expired
    const now = new Date();
    if (!session.qr_token_expires_at || session.qr_token_expires_at <= now) {
      session.qr_token = uuidv4();
      session.qr_token_expires_at = new Date(
        now.getTime() + (session.qr_refresh_interval * 1000),
      );
      await session.save();
      this.emitEvent({ type: 'attendance.qr_rotated', contextType: session.context_type, contextId: session.context_id.toString(), sessionId: session._id.toString(), checkinCount: session.checkin_count });
    }

    return {
      token: session.qr_token,
      expires_at: session.qr_token_expires_at,
      refresh_interval: session.qr_refresh_interval,
      checkin_count: session.checkin_count,
    };
  }

  // ── QR Check-in ──

  async checkinQr(
    dto: CheckinQrDto,
    userId: string,
    roleCode: string,
    userAgent?: string,
  ): Promise<AttendanceCheckinDocument> {
    // Find session by token
    const session = await this.sessionModel.findOne({
      qr_token: dto.token,
      status: 'active',
    });
    if (!session) {
      throw new BadRequestException(
        'Mã QR không hợp lệ hoặc đã hết hạn. Vui lòng quét mã mới.',
      );
    }

    // Check token expiry
    if (session.qr_token_expires_at && session.qr_token_expires_at < new Date()) {
      throw new BadRequestException(
        'Mã QR đã hết hạn. Vui lòng quét mã mới.',
      );
    }

    const studentId = await this.validateMembership(session, userId, roleCode);

    // Check duplicate
    await this.checkDuplicate(session._id.toString(), studentId);

    // Check max checkins
    this.checkMaxCheckins(session);

    // Create check-in
    const checkin = new this.checkinModel({
      session_id: session._id,
      student_id: new Types.ObjectId(studentId),
      method: 'qr',
      status: 'present',
      checked_in_at: new Date(),
      qr_token_used: dto.token,
      user_agent: userAgent,
    });

    const saved = await checkin.save();

    // Update checkin count
    await this.sessionModel.findByIdAndUpdate(session._id, {
      $inc: { checkin_count: 1 },
    });
    this.emitEvent({ type: 'attendance.checkin_created', contextType: session.context_type, contextId: session.context_id.toString(), sessionId: session._id.toString(), checkinCount: session.checkin_count + 1, checkin: this.toRealtimeCheckin(saved) });

    // Sync to activity attendance if applicable.
    if (['club', 'activity'].includes(session.context_type) && session.schedule_id) {
      await this.syncToActivityAttendance(saved, session);
    }

    this.logger.log(
      `QR check-in: student ${studentId} → session ${session._id}`,
    );

    return saved;
  }

  // ── Proximity Check-in ──

  async checkinProximity(
    dto: CheckinProximityDto,
    userId: string,
    roleCode: string,
    userAgent?: string,
  ): Promise<AttendanceCheckinDocument> {
    const session = await this.sessionModel.findById(dto.session_id);
    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên điểm danh');
    }
    if (session.status !== 'active') {
      throw new BadRequestException('Phiên điểm danh đã đóng');
    }
    if (session.method !== 'proximity') {
      throw new BadRequestException('Phiên này không dùng phương thức proximity');
    }

    const studentId = await this.validateMembership(session, userId, roleCode);

    // Check duplicate
    await this.checkDuplicate(session._id.toString(), studentId);

    // Calculate distance using Haversine formula
    const distance = this.haversineDistance(
      session.latitude,
      session.longitude,
      dto.latitude,
      dto.longitude,
    );

    if (distance > session.radius_meters) {
      throw new BadRequestException(
        `Bạn đang ở ngoài phạm vi điểm danh. Khoảng cách: ${Math.round(distance)}m, cho phép: ${session.radius_meters}m.`,
      );
    }

    // Check max checkins
    this.checkMaxCheckins(session);

    // Create check-in
    const checkin = new this.checkinModel({
      session_id: session._id,
      student_id: new Types.ObjectId(studentId),
      method: 'proximity',
      status: 'present',
      checked_in_at: new Date(),
      latitude: dto.latitude,
      longitude: dto.longitude,
      distance_meters: Math.round(distance),
      user_agent: userAgent,
    });

    const saved = await checkin.save();

    // Update checkin count
    await this.sessionModel.findByIdAndUpdate(session._id, {
      $inc: { checkin_count: 1 },
    });
    this.emitEvent({ type: 'attendance.checkin_created', contextType: session.context_type, contextId: session.context_id.toString(), sessionId: session._id.toString(), checkinCount: session.checkin_count + 1, checkin: this.toRealtimeCheckin(saved) });

    // Sync to activity attendance if applicable.
    if (['club', 'activity'].includes(session.context_type) && session.schedule_id) {
      await this.syncToActivityAttendance(saved, session);
    }

    this.logger.log(
      `Proximity check-in: student ${studentId} → session ${session._id} (${Math.round(distance)}m)`,
    );

    return saved;
  }

  // ── Query Methods ──

  async getActiveSession(
    contextType: string,
    contextId: string,
    userId: string,
    roleCode: string,
  ): Promise<AttendanceSessionDocument | null> {
    // Auto-expire sessions past auto_close_at
    await this.sessionModel.updateMany(
      {
        status: 'active',
        auto_close_at: { $lte: new Date() },
      },
      { $set: { status: 'expired', closed_at: new Date() } },
    );

    const session = await this.sessionModel
      .findOne({
        context_type: contextType,
        context_id: new Types.ObjectId(contextId),
        status: 'active',
      })
      .populate('opened_by', 'user_name')
      .lean()
      .exec();
    if (session) await this.validateMembership(session, userId, roleCode);
    return session;
  }

  async getSessionById(
    sessionId: string,
  ): Promise<AttendanceSessionDocument> {
    const session = await this.sessionModel
      .findById(sessionId)
      .populate('opened_by', 'user_name')
      .exec();
    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên điểm danh');
    }
    return session;
  }

  async getCheckins(
    sessionId: string,
    userId: string,
    roleCode: string,
  ): Promise<AttendanceCheckinDocument[]> {
    const session = await this.sessionModel.findById(sessionId).lean().exec();
    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên điểm danh');
    }
    const studentId = await this.validateMembership(session, userId, roleCode);
    const isManager = await this.isManager(session, userId, roleCode);
    return this.checkinModel
      .find({
        session_id: new Types.ObjectId(sessionId),
        ...(isManager ? {} : { student_id: new Types.ObjectId(studentId) }),
      })
      .populate('student_id', 'full_name student_code email')
      .sort({ checked_in_at: -1 })
      .lean()
      .exec();
  }

  async getSessionHistory(
    contextType: string,
    contextId: string,
    page = 1,
    limit = 10,
  ): Promise<{
    items: AttendanceSessionDocument[];
    total: number;
  }> {
    const filter = {
      context_type: contextType,
      context_id: new Types.ObjectId(contextId),
    };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.sessionModel
        .find(filter)
        .populate('opened_by', 'user_name')
        .sort({ opened_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.sessionModel.countDocuments(filter),
    ]);

    return { items, total };
  }

  // ── Private Helpers ──

  /**
   * Haversine formula to calculate distance between two lat/lng points in meters.
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  /**
   * Resolve an active member before student attendance data is accessed.
   */
  private async validateMembership(
    session: AttendanceSessionDocument,
    userId: string,
    roleCode: string,
  ): Promise<string> {
    if (roleCode === 'ADMIN') {
      return '';
    }

    if (!['club', 'activity'].includes(session.context_type)) {
      throw new ForbiddenException('Attendance access is not available for this context.');
    }

    const requesterId = new Types.ObjectId(userId);
    const studentId = await this.resolveRequesterStudentId(requesterId);
    const membershipOwners: Array<{ user_id?: Types.ObjectId; student_id?: Types.ObjectId }> = [{ user_id: requesterId }];
    if (studentId) membershipOwners.push({ student_id: new Types.ObjectId(studentId) });
    const member = await this.clubMemberModel.findOne({
      activity_id: session.context_id,
      status: 'active',
      $or: membershipOwners,
    });
    if (!member) {
      throw new ForbiddenException('An active activity membership is required.');
    }
    if (member.student_id) return member.student_id.toString();

    if (!studentId) {
      throw new ForbiddenException('An active activity membership is required.');
    }
    return studentId;
  }

  private async isManager(session: AttendanceSessionDocument | any, userId: string, roleCode?: string): Promise<boolean> {
    if (roleCode === 'ADMIN') return true;
    if (!['club', 'activity'].includes(session.context_type) || !Types.ObjectId.isValid(userId)) return false;
    const requesterId = new Types.ObjectId(userId);
    const studentId = await this.resolveRequesterStudentId(requesterId);
    const membershipOwners: Array<{ user_id?: Types.ObjectId; student_id?: Types.ObjectId }> = [{ user_id: requesterId }];
    if (studentId) membershipOwners.push({ student_id: new Types.ObjectId(studentId) });
    const member = await this.clubMemberModel.findOne({
      activity_id: session.context_id,
      status: 'active',
      role: 'president',
      $or: membershipOwners,
    });
    return Boolean(member);
  }

  private async resolveRequesterStudentId(requesterId: Types.ObjectId): Promise<string | null> {
    const student = await this.studentModel
      .findOne({ user_id: requesterId })
      .select('_id')
      .lean()
      .exec();
    return student?._id?.toString() || null;
  }

  private async ensureManager(contextType: string, contextId: string, userId: string, roleCode?: string): Promise<void> {
    if (roleCode === 'ADMIN') return;
    if (!['club', 'activity'].includes(contextType) || !Types.ObjectId.isValid(contextId)) {
      throw new ForbiddenException('Attendance management is not available for this context.');
    }
    const manager = await this.isManager({ context_type: contextType, context_id: new Types.ObjectId(contextId) }, userId, roleCode);
    if (!manager) throw new ForbiddenException('Only an administrator or active president can manage attendance.');
  }

  private async ensureTodaySchedule(
    contextType: string,
    contextId: string,
    scheduleId: string,
  ): Promise<void> {
    if (!['club', 'activity'].includes(contextType) || !Types.ObjectId.isValid(scheduleId)) {
      throw new BadRequestException('Attendance requires a valid activity schedule for today.');
    }

    const schedule = await this.scheduleModel.findOne({
      _id: new Types.ObjectId(scheduleId),
      activity_id: new Types.ObjectId(contextId),
      status: { $ne: 'cancelled' },
    }).lean().exec();
    if (!schedule || this.toHoChiMinhDate(schedule.start_time) !== this.toHoChiMinhDate(new Date())) {
      throw new BadRequestException('Attendance requires a non-cancelled activity schedule for today.');
    }
  }

  private toHoChiMinhDate(value: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);
  }

  private emitEvent(event: AttendanceRealtimeEvent): void {
    attendanceEventEmitter.emit('attendance_event', event);
  }

  private toPublicSession(session: AttendanceSessionDocument | any): Record<string, unknown> {
    return {
      _id: session._id.toString(), context_type: session.context_type,
      context_id: session.context_id.toString(), method: session.method,
      schedule_id: session.schedule_id?.toString(),
      status: session.status, opened_at: session.opened_at, closed_at: session.closed_at,
      latitude: session.latitude, longitude: session.longitude,
      radius_meters: session.radius_meters, title: session.title,
      checkin_count: session.checkin_count,
    };
  }

  private toRealtimeCheckin(checkin: AttendanceCheckinDocument | any) {
    return {
      _id: checkin._id?.toString() || '', student_id: checkin.student_id.toString(),
      method: checkin.method, status: checkin.status,
      checked_in_at: checkin.checked_in_at, distance_meters: checkin.distance_meters,
    };
  }

  /**
   * Check for duplicate check-in in the same session.
   */
  private async checkDuplicate(
    sessionId: string,
    studentId: string,
  ): Promise<void> {
    const existing = await this.checkinModel.findOne({
      session_id: new Types.ObjectId(sessionId),
      student_id: new Types.ObjectId(studentId),
    });
    if (existing) {
      throw new BadRequestException('Bạn đã điểm danh cho phiên này rồi.');
    }
  }

  /**
   * Check if session has reached max check-ins.
   */
  private checkMaxCheckins(session: AttendanceSessionDocument): void {
    if (
      session.max_checkins &&
      session.checkin_count >= session.max_checkins
    ) {
      throw new BadRequestException(
        'Phiên điểm danh đã đạt số lượng tối đa.',
      );
    }
  }

  /**
   * Sync a check-in to the existing club-attendance system.
   * Creates a ActivityAttendance record with auto-approved status.
   */
  private async syncToActivityAttendance(
    checkin: AttendanceCheckinDocument,
    session: AttendanceSessionDocument,
  ): Promise<void> {
    try {
      // Check for existing club attendance record
      const existing = await this.clubAttendanceModel.findOne({
        schedule_id: session.schedule_id,
        student_id: checkin.student_id,
      });

      if (existing) {
        // Update existing record
        existing.status = checkin.status;
        existing.check_in_time = checkin.checked_in_at;
        if (session.auto_approve) {
          existing.approval_status = 'approved';
          existing.approved_at = new Date();
          existing.approved_by = session.opened_by;
        }
        await existing.save();

        checkin.synced = true;
        checkin.synced_record_id = existing._id;
        await checkin.save();
        await this.syncApprovedActivityAttendance(existing);
        return;
      }

      // Create new club attendance record
      const clubAttendance = new this.clubAttendanceModel({
        activity_id: session.context_id,
        schedule_id: session.schedule_id,
        student_id: checkin.student_id,
        semester_id: session.semester_id,
        status: checkin.status,
        check_in_time: checkin.checked_in_at,
        recorded_by: session.opened_by,
        recorded_by_role: 'teacher',
        recorded_at: new Date(),
        approval_status: session.auto_approve ? 'approved' : 'pending',
        approved_by: session.auto_approve ? session.opened_by : undefined,
        approved_at: session.auto_approve ? new Date() : undefined,
        note: `Điểm danh tự động qua ${checkin.method === 'qr' ? 'QR Code' : 'Proximity'}`,
      });

      const saved = await clubAttendance.save();

      // Update checkin sync reference
      checkin.synced = true;
      checkin.synced_record_id = saved._id;
      await checkin.save();
      await this.syncApprovedActivityAttendance(saved);

      this.logger.log(
        `Synced checkin ${checkin._id} → ActivityAttendance ${saved._id}`,
      );
    } catch (error: any) {
      // Don't fail the check-in if sync fails (can be retried)
      if (error.code === 11000) {
        this.logger.warn(
          `Duplicate club attendance for schedule ${session.schedule_id}, student ${checkin.student_id}`,
        );
      } else {
        this.logger.error(
          `Failed to sync checkin ${checkin._id} to club attendance: ${error.message}`,
        );
      }
    }
  }

  private async syncApprovedActivityAttendance(
    attendance: ActivityAttendanceDocument,
  ): Promise<void> {
    if (attendance.approval_status !== 'approved') return;

    try {
      const result = await this.activityAttendanceSyncService
        .syncAttendanceToAcademicRecord(attendance._id.toString());
      this.logger.log(
        `Activity attendance ${attendance._id} evaluation: ${result.synced ? 'OK' : result.reason}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to evaluate activity attendance ${attendance._id}: ${error.message}`,
      );
    }
  }
}
