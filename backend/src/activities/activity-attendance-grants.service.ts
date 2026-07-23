import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserStatus } from '../auth/schemas/user.schema';
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
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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

  private async activeTeacher(teacherId: string) {
    const teacher: any = await this.userModel.findOne({
      _id: new Types.ObjectId(teacherId),
      status: UserStatus.ACTIVE,
    }).select('user_name email status role').populate('role', 'role_code').lean().exec();
    if (!teacher || teacher.role?.role_code?.toUpperCase() !== 'TEACHER') {
      throw new BadRequestException('Attendance may only be delegated to an active teacher.');
    }
    return teacher;
  }

  async candidates(activityId: string, user: any) {
    await this.assertAdministrator(activityId, user);
    const users: any[] = await this.userModel.find({ status: UserStatus.ACTIVE })
      .select('user_name email role').populate('role', 'role_code')
      .sort({ user_name: 1 }).lean().exec();
    const teachers = users.filter((candidate) => candidate.role?.role_code?.toUpperCase() === 'TEACHER');
    const teacherIds = teachers.map((teacher) => teacher._id);
    const [classes, grants]: any[] = await Promise.all([
      this.classModel.find({ advisor_id: { $in: teacherIds } }).select('class_name class_year advisor_id').sort({ class_name: 1 }).lean().exec(),
      this.grantModel.find({ activity_id: new Types.ObjectId(activityId), teacher_id: { $in: teacherIds } }).lean().exec(),
    ]);
    const classesByTeacher = new Map<string, any[]>();
    for (const row of classes) {
      const key = row.advisor_id.toString();
      classesByTeacher.set(key, [...(classesByTeacher.get(key) || []), row]);
    }
    const grantsByTeacher = new Map<string, any>(grants.map((grant: any) => [grant.teacher_id.toString(), grant]));
    return teachers.map((teacher) => {
      const grant = grantsByTeacher.get(teacher._id.toString());
      return {
        _id: teacher._id,
        user_name: teacher.user_name,
        email: teacher.email,
        classes: classesByTeacher.get(teacher._id.toString()) || [],
        grant_status: grant?.status || 'default',
        effective_methods: grant
          ? (grant.status === 'active' ? grant.allowed_methods : [])
          : ['manual_class'],
      };
    });
  }

  async list(activityId: string, user: any) {
    const candidates = await this.candidates(activityId, user);
    return candidates.map((candidate: any) => ({
      teacher_id: {
        _id: candidate._id,
        user_name: candidate.user_name,
        email: candidate.email,
      },
      allowed_methods: candidate.effective_methods,
      effective_methods: candidate.effective_methods,
      status: candidate.grant_status,
      grant_status: candidate.grant_status,
    }));
  }

  async upsert(activityId: string, teacherId: string, methods: ActivityAttendanceMethod[], user: any) {
    if (!Types.ObjectId.isValid(teacherId)) throw new BadRequestException('Invalid teacher ID.');
    const { requesterId } = await this.assertAdministrator(activityId, user);
    await this.activeTeacher(teacherId);
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
    await this.activeTeacher(teacherId);
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
    const classFilter: any = canAdminister ? {} : { advisor_id: new Types.ObjectId(requesterId) };
    const classes = await this.classModel.find(classFilter)
      .select('class_name class_year').sort({ class_name: 1 }).lean().exec();
    const grant: any = canAdminister ? null : await this.grantModel.findOne({
      activity_id: new Types.ObjectId(activityId), teacher_id: new Types.ObjectId(requesterId),
    }).lean().exec();
    let isActiveTeacher = false;
    if (!canAdminister) {
      const requester: any = await this.userModel.findOne({
        _id: new Types.ObjectId(requesterId), status: UserStatus.ACTIVE,
      }).select('role').populate('role', 'role_code').lean().exec();
      isActiveTeacher = requester?.role?.role_code?.toUpperCase() === 'TEACHER';
    }
    return {
      can_administer_grants: canAdminister,
      grant_status: canAdminister ? 'inherent' : grant?.status || (isActiveTeacher ? 'default' : 'none'),
      effective_methods: canAdminister
        ? ['qr', 'proximity', 'manual_class']
        : grant
          ? (grant.status === 'active' ? grant.allowed_methods : [])
          : (isActiveTeacher ? ['manual_class'] : []),
      classes,
    };
  }

  async assertMethod(activityId: string, userId: string, roleCode: string | undefined, method: string) {
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid requester ID.');
    const activity = await this.activity(activityId);
    if (roleCode?.toUpperCase() === 'ADMIN' || activity.advisor_id?.toString() === userId) return;
    const grant: any = await this.grantModel.findOne({
      activity_id: new Types.ObjectId(activityId), teacher_id: new Types.ObjectId(userId),
    }).select('status allowed_methods').lean().exec();
    if (grant) {
      if (grant.status === 'active' && grant.allowed_methods.includes(method)) return;
      throw new ForbiddenException('Attendance method is not granted or has been revoked.');
    }
    const requester: any = await this.userModel.findOne({
      _id: new Types.ObjectId(userId), status: UserStatus.ACTIVE,
    }).select('role').populate('role', 'role_code').lean().exec();
    if (requester?.role?.role_code?.toUpperCase() === 'TEACHER' && method === 'manual_class') return;
    throw new ForbiddenException('Attendance method is not granted or has been revoked.');
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
