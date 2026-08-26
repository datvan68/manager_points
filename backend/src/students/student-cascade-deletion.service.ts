import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { Student, StudentDocument } from './schemas/student.schema';

export interface StudentDeletionImpact {
  studentId: string;
  userLinked: boolean;
  dependentRecords: Record<string, number>;
}

type CleanupPlan = {
  name: string;
  collection: string;
  filter: Record<string, unknown>;
  action: 'delete' | 'pull';
  update?: Record<string, unknown>;
};

@Injectable()
export class StudentCascadeDeletionService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
  ) {}

  async remove(id: string, confirmed: boolean): Promise<StudentDeletionImpact | Student> {
    const studentId = new Types.ObjectId(id);
    const student = await this.studentModel.findById(studentId).lean().exec();
    if (!student) throw new NotFoundException(`Student with ID ${id} not found`);

    const userId = this.objectIdFrom(student.user_id);
    const plan = this.buildPlan(studentId, userId);
    const impact = await this.getImpact(id, userId, plan);
    if (!confirmed) return impact;

    const session = await this.connection.startSession();
    try {
      let deletedStudent: Student | null = null;
      await session.withTransaction(async () => {
        for (const item of plan) {
          const collection = this.connection.collection(item.collection);
          if (item.action === 'pull') {
            await collection.updateMany(item.filter, item.update!, { session });
          } else {
            await collection.deleteMany(item.filter, { session });
          }
        }
        const result = await this.studentModel.findOneAndDelete(
          { _id: studentId },
          { session },
        ).exec();
        if (!result) throw new NotFoundException(`Student with ID ${id} not found`);
        deletedStudent = result as Student;
      });
      return deletedStudent as unknown as Student;
    } finally {
      await session.endSession();
    }
  }

  private async getImpact(
    id: string,
    userId: Types.ObjectId | null,
    plan: CleanupPlan[],
  ): Promise<StudentDeletionImpact> {
    const dependentRecords: Record<string, number> = {};
    for (const item of plan) {
      dependentRecords[item.name] = await this.connection
        .collection(item.collection)
        .countDocuments(item.filter);
    }
    return { studentId: id, userLinked: Boolean(userId), dependentRecords };
  }

  private buildPlan(studentId: Types.ObjectId, userId: Types.ObjectId | null): CleanupPlan[] {
    const student = { student_id: studentId };
    const user = userId ? { user_id: userId } : null;
    const either = (studentField: string, userField?: string): Record<string, unknown> => ({
      $or: [
        { [studentField]: studentId },
        ...(userId && userField ? [{ [userField]: userId }] : []),
      ],
    });
    const deleteRef = (name: string, collection: string, filter: Record<string, unknown>): CleanupPlan => ({ name, collection, filter, action: 'delete' });
    const plans: CleanupPlan[] = [
      deleteRef('summaryPoints', 'summarypoints', student),
      deleteRef('academicRecords', 'academicrecords', student),
      deleteRef('activityMembers', 'activity_members', either('student_id', 'user_id')),
      deleteRef('activityMembershipTransfers', 'activity_membership_transfers', userId ? { $or: [{ student_id: studentId }, { requested_by: userId }, { decided_by: userId }] } : student),
      deleteRef('activityAttendances', 'activity_attendances', userId ? { $or: [{ student_id: studentId }, { recorded_by: userId }, { approved_by: userId }] } : student),
      deleteRef('activityCompletionAwards', 'activity_completion_awards', student),
      deleteRef('scheduleRegistrations', 'schedule_registrations', student),
      deleteRef('attendanceCheckins', 'attendance_checkins', student),
      deleteRef('dormitoryRosterEntries', 'dormitory_roster_entries', student),
      deleteRef('dormitoryContracts', 'contracts', student),
      deleteRef('dormitoryInvoices', 'invoices', student),
      deleteRef('roomFeeInvoices', 'dormitory_room_fee_invoices', student),
      deleteRef('dormitoryViolations', 'violations', student),
      deleteRef('maintenanceRequests', 'maintenancerequests', student),
      deleteRef('studentTaskProgress', 'studenttaskprogresses', userId ? { $or: [{ studentId }, { assigneeUserId: userId }, { updatedBy: userId }] } : { studentId }),
      deleteRef('activityFavorites', 'activity_favorites', user || { user_id: studentId }),
      deleteRef('refreshTokens', 'refresh_tokens', userId ? { $or: [{ user_id: userId }, { actor_user_id: userId }] } : { user_id: studentId }),
      deleteRef('passwordResetTokens', 'password_reset_tokens', user || { user_id: studentId }),
      deleteRef('passwordResetRequests', 'password_reset_requests', user || { user_id: studentId }),
      deleteRef('impersonationSessions', 'impersonation_sessions', user ? { $or: [{ actor_user_id: userId }, { subject_user_id: userId }] } : { _id: new Types.ObjectId('000000000000000000000000') }),
      deleteRef('loginLogs', 'login_logs', user || { user_id: studentId }),
      deleteRef('notificationsCreated', 'notifications', user ? { createdBy: userId } : { _id: new Types.ObjectId('000000000000000000000000') }),
      deleteRef('notificationsReceived', 'notifications', user ? { recipientUserId: userId } : { _id: new Types.ObjectId('000000000000000000000000') }),
      deleteRef('auditRecords', 'audit_logs', user || { user_id: studentId }),
      deleteRef('userPerformanceMetrics', 'systemperformancemetrics', user || { user_id: studentId }),
      ...(userId ? [deleteRef('studentTasksOwned', 'studenttasks', { $or: [{ createdBy: userId }, { updatedBy: userId }] })] : []),
    ];
    if (userId) plans.push(deleteRef('user', 'users', { _id: userId }));
    plans.push(
      { name: 'taskTargets', collection: 'studenttasks', filter: { targetStudentIds: studentId }, action: 'pull', update: { $pull: { targetStudentIds: studentId } } },
      ...(userId ? [{ name: 'notificationReaders', collection: 'notifications', filter: { readByUserIds: userId }, action: 'pull' as const, update: { $pull: { readByUserIds: userId } } }] : []),
    );
    return plans;
  }

  private objectIdFrom(value: unknown): Types.ObjectId | null {
    const raw = value && typeof value === 'object' && '_id' in value ? (value as { _id: unknown })._id : value;
    return raw && Types.ObjectId.isValid(String(raw)) ? new Types.ObjectId(String(raw)) : null;
  }
}
