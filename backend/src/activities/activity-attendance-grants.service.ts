import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { isAdminUser } from '../auth/utils/role.util';
import { Class, ClassDocument } from '../classes/schemas/class.schema';
import { Activity, ActivityDocument } from './schemas/activity.schema';
import {
  ActivityAttendanceGrant,
  ActivityAttendanceGrantDocument,
  ActivityAttendanceMethod,
} from './schemas/activity-attendance-grant.schema';

@Injectable()
export class ActivityAttendanceGrantsService {
  constructor(
    @InjectModel(Activity.name) private activityModel: Model<ActivityDocument>,
    @InjectModel(ActivityAttendanceGrant.name) private grantModel: Model<ActivityAttendanceGrantDocument>,
    @InjectModel(Class.name) private classModel: Model<ClassDocument>,
  ) {}

  private userId(user: any): string {
    const id = (user?.userId || user?._id || user?.id)?.toString();
    if (!id || !Types.ObjectId.isValid(id)) throw new BadRequestException('A valid authenticated requester is required.');
    return id;
  }

  private async activity(activityId: string) {
    if (!Types.ObjectId.isValid(activityId)) throw new BadRequestException('Invalid activity ID.');
    const activity = await this.activityModel.findById(activityId).select('advisor_id').lean().exec();
    if (!activity) throw new NotFoundException('Activity not found.');
    return activity;
  }

  private async assertAdministrator(activityId: string, user: any) {
    const activity = await this.activity(activityId);
    const requesterId = this.userId(user);
    if (!isAdminUser(user) && activity.advisor_id?.toString() !== requesterId) {
      throw new ForbiddenException('Only an administrator or assigned advisor may manage attendance grants.');
    }
    return { activity, requesterId };
  }

  async candidates(activityId: string, user: any) {
    await this.assertAdministrator(activityId, user);
    return this.classModel.find({ advisor_id: { $exists: true, $ne: null } })
      .select('class_name advisor_id')
      .populate('advisor_id', 'user_name')
      .sort({ class_name: 1 }).lean().exec();
  }

  async list(activityId: string, user: any) {
    await this.assertAdministrator(activityId, user);
    return this.grantModel.find({ activity_id: new Types.ObjectId(activityId) })
      .populate('teacher_id', 'user_name email').sort({ updatedAt: -1 }).lean().exec();
  }

  async upsert(activityId: string, teacherId: string, methods: ActivityAttendanceMethod[], user: any) {
    if (!Types.ObjectId.isValid(teacherId)) throw new BadRequestException('Invalid teacher ID.');
    const { requesterId } = await this.assertAdministrator(activityId, user);
    const ownsClass = await this.classModel.exists({ advisor_id: new Types.ObjectId(teacherId) } as any);
    if (!ownsClass) throw new BadRequestException('Attendance may only be delegated to a homeroom teacher.');
    const now = new Date();
    return this.grantModel.findOneAndUpdate(
      { activity_id: new Types.ObjectId(activityId), teacher_id: new Types.ObjectId(teacherId) },
      {
        $set: { allowed_methods: methods, status: 'active', granted_by: new Types.ObjectId(requesterId), granted_at: now },
        $unset: { revoked_by: 1, revoked_at: 1 },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).exec();
  }

  async revoke(activityId: string, teacherId: string, user: any) {
    if (!Types.ObjectId.isValid(teacherId)) throw new BadRequestException('Invalid teacher ID.');
    const { requesterId } = await this.assertAdministrator(activityId, user);
    const grant = await this.grantModel.findOneAndUpdate(
      { activity_id: new Types.ObjectId(activityId), teacher_id: new Types.ObjectId(teacherId) },
      { $set: { status: 'revoked', revoked_by: new Types.ObjectId(requesterId), revoked_at: new Date() } },
      { new: true },
    ).exec();
    if (!grant) throw new NotFoundException('Attendance grant not found.');
    return grant;
  }

  async capabilities(activityId: string, user: any) {
    const activity = await this.activity(activityId);
    const requesterId = this.userId(user);
    const canAdminister = isAdminUser(user) || activity.advisor_id?.toString() === requesterId;
    const classes = await this.classModel.find({ advisor_id: new Types.ObjectId(requesterId) } as any)
      .select('class_name class_year').sort({ class_name: 1 }).lean().exec();
    const grant = canAdminister ? null : await this.grantModel.findOne({
      activity_id: new Types.ObjectId(activityId), teacher_id: new Types.ObjectId(requesterId), status: 'active',
    }).lean().exec();
    return {
      can_administer_grants: canAdminister,
      grant_status: canAdminister ? 'inherent' : grant?.status || 'none',
      effective_methods: canAdminister ? ['qr', 'proximity', 'manual_class'] : grant?.allowed_methods || [],
      classes,
    };
  }

  async assertMethod(activityId: string, userId: string, roleCode: string | undefined, method: string) {
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid requester ID.');
    const activity = await this.activity(activityId);
    if (roleCode?.toUpperCase() === 'ADMIN' || activity.advisor_id?.toString() === userId) return;
    const grant = await this.grantModel.exists({
      activity_id: new Types.ObjectId(activityId), teacher_id: new Types.ObjectId(userId),
      status: 'active', allowed_methods: method,
    });
    if (!grant) throw new ForbiddenException('Attendance method is not granted or has been revoked.');
  }

  async assertOwnClass(classId: string, userId: string, roleCode?: string) {
    if (roleCode?.toUpperCase() === 'ADMIN') return;
    if (!Types.ObjectId.isValid(classId) || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid class or requester ID.');
    }
    const owned = await this.classModel.exists({ _id: new Types.ObjectId(classId), advisor_id: new Types.ObjectId(userId) } as any);
    if (!owned) throw new ForbiddenException('Manual attendance is restricted to the teacher’s own class.');
  }
}
