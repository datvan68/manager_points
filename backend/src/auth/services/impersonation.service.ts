import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ImpersonationSession,
  ImpersonationSessionDocument,
  ImpersonationSessionStatus,
} from '../schemas/impersonation-session.schema';
import { LoginLog, LoginLogDocument } from '../schemas/login-log.schema';
import { User, UserDocument, UserStatus } from '../schemas/user.schema';
import { systemEventEmitter } from '../../system/system-event-emitter';

export const IMPERSONATION_LEASE_MS = 4 * 60 * 60 * 1000;
export const IMPERSONATION_CHAINING_DENIAL_REASON =
  'IMPERSONATION_CHAINING_NOT_ALLOWED';

type AuditContext = {
  actorUserId?: string;
  subjectUserId?: string;
  sessionId?: string;
  browserSessionId?: string;
  reason?: string;
};

@Injectable()
export class ImpersonationService implements OnModuleInit {
  constructor(
    @InjectModel(ImpersonationSession.name)
    private readonly sessionModel: Model<ImpersonationSessionDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(LoginLog.name)
    private readonly loginLogModel: Model<LoginLogDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    // The unique partial indexes are the hard cross-process concurrency guard.
    // Fail startup rather than serve an endpoint with only a racy count check.
    await this.sessionModel.createIndexes();
  }

  async acquire(
    actorUserId: string,
    subjectUserId: string,
    browserSessionId: string,
    ip: string,
  ): Promise<{
    session: ImpersonationSessionDocument;
    subject: UserDocument;
  }> {
    try {
      if (
        !Types.ObjectId.isValid(actorUserId) ||
        !Types.ObjectId.isValid(subjectUserId)
      ) {
        throw new BadRequestException({
          code: 'INVALID_IMPERSONATION_USER',
          message: 'ID người dùng không hợp lệ',
        });
      }
      if (actorUserId === subjectUserId) {
        throw new BadRequestException({
          code: 'IMPERSONATION_SELF_NOT_ALLOWED',
          message: 'Không thể truy cập với tư cách chính mình',
        });
      }

      const [actor, subject] = await Promise.all([
        this.userModel.findById(actorUserId).populate('role').exec(),
        this.userModel.findById(subjectUserId).populate('role').exec(),
      ]);

      if (
        !actor ||
        actor.status !== UserStatus.ACTIVE ||
        (actor.role as any)?.role_code !== 'ADMIN'
      ) {
        throw new ForbiddenException({
          code: 'IMPERSONATION_ADMIN_REQUIRED',
          message: 'Chỉ quản trị viên đang hoạt động mới được phép truy cập',
        });
      }
      if (!subject) {
        throw new BadRequestException({
          code: 'IMPERSONATION_TARGET_NOT_FOUND',
          message: 'Người dùng không tồn tại',
        });
      }
      if (subject.status !== UserStatus.ACTIVE) {
        throw new ConflictException({
          code: 'IMPERSONATION_TARGET_INACTIVE',
          message: 'Chỉ có thể truy cập tài khoản đang hoạt động',
        });
      }
      if ((subject.role as any)?.role_code === 'ADMIN') {
        throw new ForbiddenException({
          code: 'IMPERSONATION_ADMIN_TARGET_NOT_ALLOWED',
          message: 'Không thể truy cập với tư cách quản trị viên khác',
        });
      }

      const now = new Date();
      await this.expireStaleSessions(now);

      const duplicate = await this.sessionModel
        .findOne({
          subject_user_id: subject._id,
          status: ImpersonationSessionStatus.ACTIVE,
        })
        .exec();
      if (duplicate) {
        throw new ConflictException({
          code: 'IMPERSONATION_TARGET_ALREADY_ACTIVE',
          message: 'Tài khoản này đang được truy cập',
        });
      }

      const expiresAt = new Date(now.getTime() + IMPERSONATION_LEASE_MS);
      for (let slot = 1; slot <= 5; slot += 1) {
        try {
          const session = await this.sessionModel.create({
            slot,
            actor_user_id: actor._id,
            subject_user_id: subject._id,
            browser_session_id: browserSessionId,
            status: ImpersonationSessionStatus.ACTIVE,
            expires_at: expiresAt,
            ip_address: ip,
          });
          return { session, subject };
        } catch (error: any) {
          if (error?.code !== 11000) throw error;

          // A concurrent request may have claimed this subject on another slot.
          const activeSubject = await this.sessionModel
            .findOne({
              subject_user_id: subject._id,
              status: ImpersonationSessionStatus.ACTIVE,
            })
            .exec();
          if (activeSubject) {
            throw new ConflictException({
              code: 'IMPERSONATION_TARGET_ALREADY_ACTIVE',
              message: 'Tài khoản này đang được truy cập',
            });
          }
        }
      }

      throw new ConflictException({
        code: 'IMPERSONATION_LIMIT_REACHED',
        message: 'Đã đạt giới hạn 5 tài khoản đang được truy cập',
      });
    } catch (error) {
      await this.auditBestEffort('impersonation_denied', ip, {
        actorUserId,
        subjectUserId,
        browserSessionId,
        reason: this.errorCode(error),
      });
      throw error;
    }
  }

  async validateSession(
    sessionId: string,
    subjectUserId: string,
    actorUserId?: string,
  ): Promise<ImpersonationSessionDocument> {
    if (
      !Types.ObjectId.isValid(sessionId) ||
      !Types.ObjectId.isValid(subjectUserId) ||
      (actorUserId !== undefined && !Types.ObjectId.isValid(actorUserId))
    ) {
      throw new UnauthorizedException('Phiên truy cập không hợp lệ');
    }
    const now = new Date();
    const session = await this.sessionModel
      .findOne({
        _id: new Types.ObjectId(sessionId),
        subject_user_id: new Types.ObjectId(subjectUserId),
        status: ImpersonationSessionStatus.ACTIVE,
        expires_at: { $gt: now },
        ...(actorUserId
          ? { actor_user_id: new Types.ObjectId(actorUserId) }
          : {}),
      })
      .exec();
    if (!session) {
      throw new UnauthorizedException('Phiên truy cập đã kết thúc');
    }

    const actor = await this.userModel
      .findById(session.actor_user_id)
      .populate('role')
      .exec();
    if (
      !actor ||
      actor.status !== UserStatus.ACTIVE ||
      (actor.role as any)?.role_code !== 'ADMIN'
    ) {
      await this.release(session._id.toString(), 'actor_no_longer_admin').catch(
        () => undefined,
      );
      throw new UnauthorizedException('Quyền quản trị viên không còn hợp lệ');
    }
    return session;
  }

  async release(
    sessionId: string,
    reason: string,
    ip = '0.0.0.0',
  ): Promise<ImpersonationSessionDocument | null> {
    if (!Types.ObjectId.isValid(sessionId)) return null;
    const session = await this.sessionModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(sessionId),
          status: ImpersonationSessionStatus.ACTIVE,
        },
        {
          $set: {
            status: ImpersonationSessionStatus.ENDED,
            ended_at: new Date(),
            ended_reason: reason,
          },
        },
        { new: true },
      )
      .exec();
    if (session) {
      await this.auditBestEffort('impersonation_stop', ip, {
        actorUserId: session.actor_user_id.toString(),
        subjectUserId: session.subject_user_id.toString(),
        sessionId: session._id.toString(),
        browserSessionId: session.browser_session_id,
        reason,
      });
    }
    return session;
  }

  async recordStarted(session: ImpersonationSessionDocument): Promise<void> {
    await this.audit('impersonation_start', session.ip_address, {
      actorUserId: session.actor_user_id.toString(),
      subjectUserId: session.subject_user_id.toString(),
      sessionId: session._id.toString(),
      browserSessionId: session.browser_session_id,
    });
  }

  async releaseActiveForActorBrowserSession(
    actorUserId: string,
    browserSessionId: string,
    ip = '0.0.0.0',
  ): Promise<ImpersonationSessionDocument | null> {
    if (
      !Types.ObjectId.isValid(actorUserId) ||
      !/^[A-Za-z0-9_-]{16,64}$/.test(browserSessionId)
    ) {
      return null;
    }

    const session = await this.sessionModel
      .findOne({
        actor_user_id: new Types.ObjectId(actorUserId),
        browser_session_id: browserSessionId,
        status: ImpersonationSessionStatus.ACTIVE,
      })
      .exec();
    if (!session) return null;

    await this.release(session._id.toString(), 'handoff_timeout', ip);
    return session;
  }

  async releaseActiveForSubject(
    subjectUserId: string,
    ip = '0.0.0.0',
  ): Promise<ImpersonationSessionDocument | null> {
    if (!Types.ObjectId.isValid(subjectUserId)) return null;

    const session = await this.sessionModel
      .findOneAndUpdate(
        {
          subject_user_id: new Types.ObjectId(subjectUserId),
          status: ImpersonationSessionStatus.ACTIVE,
          expires_at: { $gt: new Date() },
        },
        {
          $set: {
            status: ImpersonationSessionStatus.ENDED,
            ended_at: new Date(),
            ended_reason: 'admin_terminated',
          },
        },
        { new: true },
      )
      .exec();
    if (session) {
      await this.auditBestEffort('impersonation_stop', ip, {
        actorUserId: session.actor_user_id.toString(),
        subjectUserId: session.subject_user_id.toString(),
        sessionId: session._id.toString(),
        browserSessionId: session.browser_session_id,
        reason: 'admin_terminated',
      });
    }
    return session;
  }

  async recordGuardDenied(
    actorUserId: string | undefined,
    subjectUserId: string | undefined,
    ip: string,
    reason = 'IMPERSONATION_ADMIN_REQUIRED',
  ): Promise<void> {
    await this.auditBestEffort('impersonation_denied', ip, {
      actorUserId,
      subjectUserId,
      reason,
    });
  }

  async getActiveSubjectUserIds(now = new Date()): Promise<Set<string>> {
    const sessions = await this.sessionModel
      .find({
        status: ImpersonationSessionStatus.ACTIVE,
        expires_at: { $gt: now },
      })
      .exec();

    return new Set(sessions.map((session) => session.subject_user_id.toString()));
  }

  private async expireStaleSessions(now: Date): Promise<void> {
    await this.sessionModel.updateMany(
      {
        status: ImpersonationSessionStatus.ACTIVE,
        expires_at: { $lte: now },
      },
      {
        $set: {
          status: ImpersonationSessionStatus.EXPIRED,
          ended_at: now,
          ended_reason: 'lease_expired',
        },
      },
    );
  }

  private async audit(
    action: string,
    ip: string,
    context: AuditContext,
  ): Promise<void> {
    const userId =
      context.subjectUserId && Types.ObjectId.isValid(context.subjectUserId)
        ? new Types.ObjectId(context.subjectUserId)
        : null;
    const log = await this.loginLogModel.create({
      user_id: userId,
      ip_address: ip,
      action,
      login_time: new Date(),
      details: JSON.stringify(context),
    });
    try {
      const populatedLog = await log.populate({
        path: 'user_id',
        select: 'user_name email role',
        populate: { path: 'role', select: 'name role_code' },
      });
      systemEventEmitter.emit('login_log', populatedLog);
    } catch {
      // Persistence is the audit guarantee; realtime delivery is best effort.
    }
  }

  private async auditBestEffort(
    action: string,
    ip: string,
    context: AuditContext,
  ): Promise<void> {
    try {
      await this.audit(action, ip, context);
    } catch {
      // State transitions and denied requests must not be undone by telemetry.
    }
  }

  private errorCode(error: any): string {
    const response = error?.getResponse?.();
    return response?.code || error?.code || error?.name || 'UNKNOWN';
  }
}
