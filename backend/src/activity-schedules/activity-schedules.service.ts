import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ActivitySchedule,
  ActivityScheduleDocument,
} from './schemas/activity-schedule.schema';
import {
  ScheduleRegistration,
  ScheduleRegistrationDocument,
} from './schemas/schedule-registration.schema';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { QueryScheduleDto } from './dto/query-schedule.dto';

import {
  Semester,
  SemesterDocument,
} from '../semesters/schemas/semester.schema';
import {
  ActivityAttendance,
  ActivityAttendanceDocument,
} from '../club-attendance/schemas/club-attendance.schema';
import {
  isStudent,
  isTeacher,
  isSupervisor,
  isAdmin,
} from '../auth/utils/role.util';
import { Activity, ActivityDocument } from '../activities/schemas/activity.schema';

@Injectable()
export class ActivitySchedulesService {
  constructor(
    @InjectModel(ActivitySchedule.name)
    private scheduleModel: Model<ActivityScheduleDocument>,
    @InjectModel(ScheduleRegistration.name)
    private registrationModel: Model<ScheduleRegistrationDocument>,
    @InjectModel(Semester.name)
    private semesterModel: Model<SemesterDocument>,
    @InjectModel(ActivityAttendance.name)
    private activityAttendanceModel: Model<ActivityAttendanceDocument>,
    @InjectModel(Activity.name)
    private activityModel: Model<ActivityDocument>,
  ) {}

  private async validateActivityStatus(activityId: string | Types.ObjectId): Promise<void> {
    const activity = await this.activityModel.findById(activityId).exec();
    if (activity && ['completed', 'cancelled'].includes(activity.participation_status)) {
      throw new BadRequestException('Không thể thay đổi lịch sinh hoạt của hoạt động đã hoàn thành hoặc đã hủy');
    }
  }

  async create(
    dto: CreateScheduleDto,
    userId: string,
  ): Promise<ActivityScheduleDocument> {
    await this.validateActivityStatus(dto.activity_id);
    if (new Date(dto.end_time) <= new Date(dto.start_time)) {
      throw new BadRequestException(
        'Thời gian kết thúc phải sau thời gian bắt đầu',
      );
    }

    if (dto.recurrence) {
      let untilDate = dto.recurrence.until
        ? new Date(dto.recurrence.until)
        : null;
      if (!untilDate) {
        const semester = await this.semesterModel
          .findById(dto.semester_id)
          .exec();
        if (semester) {
          untilDate = new Date(semester.end_date);
        } else {
          // Default to 10 weeks if semester not found
          untilDate = new Date(
            new Date(dto.start_time).getTime() + 10 * 7 * 24 * 60 * 60 * 1000,
          );
        }
      }

      const start = new Date(dto.start_time);
      const end = new Date(dto.end_time);

      // Find Monday of the arranged week containing start_time
      const day = start.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(start.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
      monday.setHours(0, 0, 0, 0);

      let repeatStart = dto.recurrence.start
        ? new Date(dto.recurrence.start)
        : null;

      if (repeatStart) {
        repeatStart.setHours(0, 0, 0, 0);
        if (repeatStart < monday) {
          throw new BadRequestException('Ngày bắt đầu lặp lại không được trước tuần xếp lịch');
        }
      }

      if (repeatStart && untilDate && untilDate < repeatStart) {
        throw new BadRequestException('Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu lặp');
      }

      if (untilDate && untilDate < start) {
        throw new BadRequestException(
          'Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu buổi sinh hoạt đầu tiên',
        );
      }

      if (untilDate && untilDate < monday) {
        throw new BadRequestException(
          'Ngày kết thúc lặp lại không được trước tuần xếp lịch đầu tiên',
        );
      }

      const recurrence_id = new Types.ObjectId();
      const schedulesToCreate: any[] = [];

      const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
      sunday.setHours(23, 59, 59, 999);

      const source_week_start_date = dto.recurrence.source_week_start_date
        ? new Date(dto.recurrence.source_week_start_date)
        : monday;
      const source_week_end_date = dto.recurrence.source_week_end_date
        ? new Date(dto.recurrence.source_week_end_date)
        : sunday;

      let i = 0;
      while (true) {
        let currentStart: Date;
        let currentEnd: Date;

        if (dto.recurrence.type === 'weekly') {
          currentStart = new Date(
            start.getTime() + i * 7 * 24 * 60 * 60 * 1000,
          );
          currentEnd = new Date(end.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        } else if (dto.recurrence.type === 'biweekly') {
          currentStart = new Date(
            start.getTime() + i * 14 * 24 * 60 * 60 * 1000,
          );
          currentEnd = new Date(end.getTime() + i * 14 * 24 * 60 * 60 * 1000);
        } else if (dto.recurrence.type === 'monthly') {
          currentStart = new Date(start);
          currentStart.setMonth(start.getMonth() + i);
          currentEnd = new Date(end);
          currentEnd.setMonth(end.getMonth() + i);
        } else {
          currentStart = new Date(
            start.getTime() + i * 7 * 24 * 60 * 60 * 1000,
          );
          currentEnd = new Date(end.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        }

        if (currentStart > untilDate) {
          break;
        }

        // Only create if it falls on or after repeatStart, or is the anchor session (i === 0)
        if (i === 0 || !repeatStart || currentStart >= repeatStart) {
          schedulesToCreate.push({
            ...dto,
            start_time: currentStart,
            end_time: currentEnd,
            activity_id: new Types.ObjectId(dto.activity_id),
            semester_id: new Types.ObjectId(dto.semester_id),
            instructor_id: dto.instructor_id
              ? new Types.ObjectId(dto.instructor_id)
              : undefined,
            created_by: new Types.ObjectId(userId),
            recurrence_id,
            recurrence: {
              ...dto.recurrence,
              until: untilDate,
              start: repeatStart || monday,
              source_week_start_date,
              source_week_end_date,
            },
          });
        }

        i++;
        // Safety break to prevent infinite loops
        if (i > 100) break;
      }

      if (schedulesToCreate.length === 0) {
        throw new BadRequestException(
          'Không thể tạo buổi sinh hoạt nào trong khoảng thời gian này',
        );
      }

      const createdSchedules =
        await this.scheduleModel.insertMany(schedulesToCreate);
      return createdSchedules[0] as unknown as ActivityScheduleDocument;
    }

    const schedule = new this.scheduleModel({
      ...dto,
      activity_id: new Types.ObjectId(dto.activity_id),
      semester_id: new Types.ObjectId(dto.semester_id),
      instructor_id: dto.instructor_id
        ? new Types.ObjectId(dto.instructor_id)
        : undefined,
      created_by: new Types.ObjectId(userId),
    });

    return schedule.save();
  }

  async findAll(query: QueryScheduleDto): Promise<{
    items: ActivityScheduleDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const filter: any = {};

    if (query.activity_id) filter.activity_id = new Types.ObjectId(query.activity_id);
    if (query.semester_id)
      filter.semester_id = new Types.ObjectId(query.semester_id);
    if (query.status) filter.status = query.status;

    if (query.start_date || query.end_date) {
      filter.start_time = {};
      if (query.start_date) filter.start_time.$gte = new Date(query.start_date);
      if (query.end_date) filter.start_time.$lte = new Date(query.end_date);
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.scheduleModel
        .find(filter)
        .populate('activity_id', 'name code category classroom')
        .populate('instructor_id', 'user_name email')
        .populate('created_by', 'user_name')
        .sort({ start_time: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.scheduleModel.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }

  async findByActivity(
    activityId: string,
    semesterId?: string,
  ): Promise<ActivityScheduleDocument[]> {
    const filter: any = { activity_id: new Types.ObjectId(activityId) };
    if (semesterId) filter.semester_id = new Types.ObjectId(semesterId);

    return this.scheduleModel
      .find(filter)
      .populate('instructor_id', 'user_name email')
      .sort({ start_time: 1 })
      .lean()
      .exec();
  }

  async findMySchedules(studentId: string): Promise<any[]> {
    const registrations = await this.registrationModel
      .find({
        student_id: new Types.ObjectId(studentId),
        status: 'registered',
      })
      .populate({
        path: 'schedule_id',
        populate: [
          { path: 'activity_id', select: 'name code category classroom' },
          { path: 'instructor_id', select: 'user_name' },
        ],
      })
      .lean()
      .exec();

    return registrations;
  }

  async findUpcoming(
    activityId?: string,
    limit = 10,
  ): Promise<ActivityScheduleDocument[]> {
    const filter: any = {
      start_time: { $gte: new Date() },
      status: { $in: ['scheduled', 'ongoing'] },
    };
    if (activityId) filter.activity_id = new Types.ObjectId(activityId);

    return this.scheduleModel
      .find(filter)
      .populate('activity_id', 'name code category classroom')
      .populate('instructor_id', 'user_name')
      .sort({ start_time: 1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<any> {
    const schedule = await this.scheduleModel
      .findById(id)
      .populate('activity_id', 'name code category classroom')
      .populate('instructor_id', 'user_name email')
      .populate('created_by', 'user_name')
      .populate('semester_id', 'name')
      .exec();

    if (!schedule) {
      throw new NotFoundException(
        `Không tìm thấy lịch sinh hoạt với ID: ${id}`,
      );
    }

    const registrationCount = await this.registrationModel.countDocuments({
      schedule_id: new Types.ObjectId(id),
      status: 'registered',
    });

    return { ...schedule.toObject(), registration_count: registrationCount };
  }

  async update(
    id: string,
    dto: UpdateScheduleDto,
  ): Promise<ActivityScheduleDocument> {
    const existing = await this.scheduleModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy lịch sinh hoạt với ID: ${id}`);
    }
    await this.validateActivityStatus(existing.activity_id);

    if (dto.end_time && dto.start_time && new Date(dto.end_time) <= new Date(dto.start_time)) {
      throw new BadRequestException(
        'Thời gian kết thúc phải sau thời gian bắt đầu',
      );
    }

    const getMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(date.getTime() + diff * 24 * 60 * 60 * 1000);
      monday.setHours(0, 0, 0, 0);
      return monday;
    };

    if (existing.recurrence_id) {
      // 1. Lấy thông tin recurrence hiện tại
      const recurrenceType = dto.recurrence?.type || existing.recurrence?.type || 'weekly';
      
      // Xác định start_time và end_time mới cho session đang sửa
      const newStart = dto.start_time ? new Date(dto.start_time) : new Date(existing.start_time);
      const newEnd = dto.end_time ? new Date(dto.end_time) : new Date(existing.end_time);

      // Tính day_of_week mới từ newStart
      const newDayOfWeek = newStart.getDay();

      let untilDate: Date;
      const untilFromDtoOrExisting = dto.recurrence?.until || existing.recurrence?.until;
      if (untilFromDtoOrExisting) {
        untilDate = new Date(untilFromDtoOrExisting);
      } else {
        const semesterId = dto.semester_id || existing.semester_id;
        const semester = semesterId ? await this.semesterModel.findById(semesterId).exec() : null;
        if (semester) {
          untilDate = new Date(semester.end_date);
        } else {
          untilDate = new Date(
            newStart.getTime() + 10 * 7 * 24 * 60 * 60 * 1000,
          );
        }
      }

      // 2. Tìm tất cả các schedule hiện tại trong chuỗi
      const series = await this.scheduleModel.find({
        recurrence_id: existing.recurrence_id
      }).exec();

      let source_week_start_date: Date;
      let source_week_end_date: Date;

      if (existing.recurrence?.source_week_start_date && existing.recurrence?.source_week_end_date) {
        source_week_start_date = new Date(existing.recurrence.source_week_start_date);
        source_week_end_date = new Date(existing.recurrence.source_week_end_date);
      } else {
        // Fallback/Migration: tìm buổi hoạt động có start_time sớm nhất trong chuỗi
        const activeSeries = series.filter(s => s.status !== 'cancelled');
        const fallbackAnchor = activeSeries.length > 0
          ? new Date(Math.min(...activeSeries.map(s => new Date(s.start_time).getTime())))
          : new Date(existing.start_time);
        
        source_week_start_date = getMonday(fallbackAnchor);
        source_week_end_date = new Date(source_week_start_date.getTime() + 6 * 24 * 60 * 60 * 1000);
        source_week_end_date.setHours(23, 59, 59, 999);
      }

      // Kiểm tra xem newStart có trước source_week_start_date không
      if (newStart < source_week_start_date) {
        throw new BadRequestException('Ngày bắt đầu không được trước tuần nguồn lặp');
      }

      const repeatStart = dto.recurrence?.start
        ? new Date(dto.recurrence.start)
        : existing.recurrence?.start
          ? new Date(existing.recurrence.start)
          : source_week_start_date;

      if (repeatStart && repeatStart < source_week_start_date) {
        throw new BadRequestException('Ngày bắt đầu lặp lại không được trước tuần nguồn lặp');
      }

      if (repeatStart && untilDate && untilDate < repeatStart) {
        throw new BadRequestException('Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu lặp');
      }

      if (untilDate && untilDate < newStart) {
        throw new BadRequestException(
          'Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu buổi sinh hoạt đầu tiên',
        );
      }

      let newSourceStart = newStart;
      let newSourceEnd = newEnd;

      if (recurrenceType === 'monthly') {
        let originalAnchorStart = existing.start_time;
        const anchorSession = series.find(s => 
          s.recurrence?.source_week_start_date && 
          new Date(s.start_time) >= source_week_start_date && 
          new Date(s.start_time) <= source_week_end_date
        );
        if (anchorSession) {
          originalAnchorStart = anchorSession.start_time;
        } else {
          const activeSeries = series.filter(s => s.status !== 'cancelled');
          if (activeSeries.length > 0) {
            originalAnchorStart = new Date(Math.min(...activeSeries.map(s => new Date(s.start_time).getTime())));
          }
        }

        const getMonthDiff = (d1: Date, d2: Date) => {
          return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
        };
        const m = getMonthDiff(new Date(originalAnchorStart), new Date(existing.start_time));

        newSourceStart = new Date(newStart);
        newSourceStart.setMonth(newStart.getMonth() - m);

        newSourceEnd = new Date(newEnd);
        newSourceEnd.setMonth(newEnd.getMonth() - m);
      }

      // 3. Sinh ra danh sách các ngày hoạt động mong muốn (desired dates)
      const desiredWeeks: { start: Date; end: Date }[] = [];

      let i = 0;
      while (true) {
        let currentStart: Date;
        let currentEnd: Date;

        let weekMonday: Date;
        if (recurrenceType === 'weekly') {
          weekMonday = new Date(source_week_start_date.getTime() + i * 7 * 24 * 60 * 60 * 1000);
          weekMonday.setHours(0, 0, 0, 0);
          const dayOffset = newDayOfWeek === 0 ? 6 : newDayOfWeek - 1;
          currentStart = new Date(weekMonday.getTime() + dayOffset * 24 * 60 * 60 * 1000);
          currentStart.setHours(newStart.getHours(), newStart.getMinutes(), newStart.getSeconds(), newStart.getMilliseconds());
          currentEnd = new Date(weekMonday.getTime() + dayOffset * 24 * 60 * 60 * 1000);
          currentEnd.setHours(newEnd.getHours(), newEnd.getMinutes(), newEnd.getSeconds(), newEnd.getMilliseconds());
        } else if (recurrenceType === 'biweekly') {
          weekMonday = new Date(source_week_start_date.getTime() + i * 14 * 24 * 60 * 60 * 1000);
          weekMonday.setHours(0, 0, 0, 0);
          const dayOffset = newDayOfWeek === 0 ? 6 : newDayOfWeek - 1;
          currentStart = new Date(weekMonday.getTime() + dayOffset * 24 * 60 * 60 * 1000);
          currentStart.setHours(newStart.getHours(), newStart.getMinutes(), newStart.getSeconds(), newStart.getMilliseconds());
          currentEnd = new Date(weekMonday.getTime() + dayOffset * 24 * 60 * 60 * 1000);
          currentEnd.setHours(newEnd.getHours(), newEnd.getMinutes(), newEnd.getSeconds(), newEnd.getMilliseconds());
        } else if (recurrenceType === 'monthly') {
          currentStart = new Date(newSourceStart);
          currentStart.setMonth(newSourceStart.getMonth() + i);
          currentEnd = new Date(newSourceEnd);
          currentEnd.setMonth(newSourceEnd.getMonth() + i);
        } else {
          weekMonday = new Date(source_week_start_date.getTime() + i * 7 * 24 * 60 * 60 * 1000);
          weekMonday.setHours(0, 0, 0, 0);
          const dayOffset = newDayOfWeek === 0 ? 6 : newDayOfWeek - 1;
          currentStart = new Date(weekMonday.getTime() + dayOffset * 24 * 60 * 60 * 1000);
          currentStart.setHours(newStart.getHours(), newStart.getMinutes(), newStart.getSeconds(), newStart.getMilliseconds());
          currentEnd = new Date(weekMonday.getTime() + dayOffset * 24 * 60 * 60 * 1000);
          currentEnd.setHours(newEnd.getHours(), newEnd.getMinutes(), newEnd.getSeconds(), newEnd.getMilliseconds());
        }

        if (currentStart > untilDate) {
          break;
        }

        if (currentStart < source_week_start_date) {
          throw new BadRequestException('Cấu hình lặp tạo ra lịch sinh hoạt trước tuần nguồn');
        }

        if (i === 0 || currentStart >= repeatStart) {
          desiredWeeks.push({ start: currentStart, end: currentEnd });
        }

        i++;
        if (i > 100) break;
      }

      // 4. Đồng bộ hóa (Reconcile)
      const updatedSeriesIds: string[] = [];

      for (const desired of desiredWeeks) {
        const desiredMonday = getMonday(desired.start);
        const desiredSunday = new Date(desiredMonday);
        desiredSunday.setDate(desiredMonday.getDate() + 6);
        desiredSunday.setHours(23, 59, 59, 999);

        // Tìm schedule hiện tại thuộc tuần này
        const existingInWeek = series.find(s => 
          new Date(s.start_time) >= desiredMonday && new Date(s.start_time) <= desiredSunday
        );

        const recurrenceMetadata = {
          type: recurrenceType,
          day_of_week: newDayOfWeek,
          until: untilDate,
          start: repeatStart,
          source_week_start_date,
          source_week_end_date,
        };

        const updateData = {
          title: dto.title !== undefined ? dto.title : existing.title,
          description: dto.description !== undefined ? dto.description : existing.description,
          schedule_type: dto.schedule_type !== undefined ? dto.schedule_type : existing.schedule_type,
          location: dto.location !== undefined ? dto.location : existing.location,
          instructor_id: dto.instructor_id !== undefined ? dto.instructor_id : existing.instructor_id,
          max_attendees: dto.max_attendees !== undefined ? dto.max_attendees : existing.max_attendees,
          activity_id: dto.activity_id !== undefined ? new Types.ObjectId(dto.activity_id) : existing.activity_id,
          semester_id: dto.semester_id !== undefined ? new Types.ObjectId(dto.semester_id) : existing.semester_id,
          recurrence: recurrenceMetadata,
          start_time: desired.start,
          end_time: desired.end,
        };

        if (existingInWeek) {
          await this.scheduleModel.findByIdAndUpdate(
            existingInWeek._id,
            { $set: updateData },
            { runValidators: true }
          ).exec();
          updatedSeriesIds.push(existingInWeek._id.toString());
        } else {
          const newSchedule = new this.scheduleModel({
            ...updateData,
            recurrence_id: existing.recurrence_id,
            status: 'scheduled',
            created_by: existing.created_by,
          });
          const saved = await newSchedule.save();
          updatedSeriesIds.push(saved._id.toString());
        }
      }

      // Hủy (cancel) các schedule trong chuỗi cũ không còn nằm trong desired weeks
      const toCancel = series.filter(s => !updatedSeriesIds.includes(s._id.toString()));
      if (toCancel.length > 0) {
        const cancelIds = toCancel.map(s => s._id);
        await this.registrationModel.updateMany(
          { schedule_id: { $in: cancelIds }, status: 'registered' },
          { $set: { status: 'cancelled', cancelled_at: new Date() } },
        );
        await this.scheduleModel.updateMany(
          { _id: { $in: cancelIds } },
          { $set: { status: 'cancelled' } },
        );
      }

      const updatedSelf = await this.scheduleModel.findById(id).exec();
      if (!updatedSelf) {
        throw new NotFoundException(`Không tìm thấy lịch sinh hoạt với ID: ${id}`);
      }
      return updatedSelf;
    }

    // Nếu không lặp, chỉ cập nhật buổi hiện tại
    if (dto.recurrence) {
      const start = dto.start_time ? new Date(dto.start_time) : new Date(existing.start_time);
      const untilDate = dto.recurrence.until ? new Date(dto.recurrence.until) : null;
      const monday = getMonday(start);
      const repeatStart = dto.recurrence.start ? new Date(dto.recurrence.start) : null;

      if (repeatStart && repeatStart < monday) {
        throw new BadRequestException('Ngày bắt đầu lặp lại không được trước tuần xếp lịch');
      }

      if (repeatStart && untilDate && untilDate < repeatStart) {
        throw new BadRequestException('Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu lặp');
      }

      if (untilDate && untilDate < start) {
        throw new BadRequestException(
          'Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu buổi sinh hoạt đầu tiên',
        );
      }

      if (untilDate && untilDate < monday) {
        throw new BadRequestException(
          'Ngày kết thúc lặp lại không được trước tuần xếp lịch đầu tiên',
        );
      }
    }

    const schedule = await this.scheduleModel
      .findByIdAndUpdate(
        id,
        { $set: dto },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();

    if (!schedule) {
      throw new NotFoundException(
        `Không tìm thấy lịch sinh hoạt với ID: ${id}`,
      );
    }
    return schedule;
  }

  async remove(id: string, deleteSeries = false): Promise<{ message: string }> {
    const schedule = await this.scheduleModel.findById(id);
    if (!schedule) {
      throw new NotFoundException(`Không tìm thấy lịch sinh hoạt`);
    }
    await this.validateActivityStatus(schedule.activity_id);

    if (deleteSeries && schedule.recurrence_id) {
      const schedules = await this.scheduleModel
        .find({
          recurrence_id: schedule.recurrence_id,
          start_time: { $gte: schedule.start_time },
        })
        .exec();
      const ids = schedules.map((s) => s._id);

      await this.registrationModel.updateMany(
        { schedule_id: { $in: ids }, status: 'registered' },
        { $set: { status: 'cancelled', cancelled_at: new Date() } },
      );

      await this.scheduleModel.updateMany(
        { _id: { $in: ids } },
        { $set: { status: 'cancelled' } },
      );

      return { message: 'Đã hủy chuỗi lịch sinh hoạt' };
    }

    // Cancel all registrations for single schedule
    await this.registrationModel.updateMany(
      { schedule_id: new Types.ObjectId(id), status: 'registered' },
      { $set: { status: 'cancelled', cancelled_at: new Date() } },
    );

    schedule.status = 'cancelled';
    await schedule.save();

    return { message: 'Đã hủy buổi sinh hoạt' };
  }

  async cancelRecurrence(id: string): Promise<{ message: string }> {
    const schedule = await this.scheduleModel.findById(id);
    if (!schedule) {
      throw new NotFoundException(`Không tìm thấy lịch sinh hoạt`);
    }
    await this.validateActivityStatus(schedule.activity_id);

    if (!schedule.recurrence_id) {
      throw new BadRequestException('Lịch sinh hoạt không phải là chuỗi lặp');
    }

    const startOfWeek = new Date(schedule.start_time);
    const day = startOfWeek.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    
    const monday = new Date(startOfWeek.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
    sunday.setHours(23, 59, 59, 999);

    const futureSchedules = await this.scheduleModel.find({
      recurrence_id: schedule.recurrence_id,
      start_time: { $gt: sunday }
    }).exec();

    const futureIds = futureSchedules.map((s) => s._id);

    if (futureIds.length > 0) {
      await this.registrationModel.updateMany(
        { schedule_id: { $in: futureIds }, status: 'registered' },
        { $set: { status: 'cancelled', cancelled_at: new Date() } },
      );

      await this.scheduleModel.updateMany(
        { _id: { $in: futureIds } },
        { $set: { status: 'cancelled' } },
      );
    }

    await this.scheduleModel.updateMany(
      {
        recurrence_id: schedule.recurrence_id,
        start_time: { $lte: sunday }
      },
      {
        $unset: { recurrence: "", recurrence_id: "" }
      }
    );

    return { message: 'Đã hủy lặp lại và giữ lại lịch tuần hiện tại' };
  }


  // ── Registration ──

  async register(
    scheduleId: string,
    studentId: string,
    activityId: string,
  ): Promise<ScheduleRegistrationDocument> {
    const schedule = await this.scheduleModel.findById(scheduleId);
    if (!schedule) {
      throw new NotFoundException('Không tìm thấy buổi sinh hoạt');
    }
    if (schedule.status === 'cancelled' || schedule.status === 'completed') {
      throw new BadRequestException('Buổi sinh hoạt đã kết thúc hoặc bị hủy');
    }

    // Check max attendees
    if (schedule.max_attendees) {
      const count = await this.registrationModel.countDocuments({
        schedule_id: new Types.ObjectId(scheduleId),
        status: 'registered',
      });
      if (count >= schedule.max_attendees) {
        throw new BadRequestException('Buổi sinh hoạt đã đầy');
      }
    }

    // Check duplicate
    const existing = await this.registrationModel.findOne({
      schedule_id: new Types.ObjectId(scheduleId),
      student_id: new Types.ObjectId(studentId),
    });
    if (existing) {
      if (existing.status === 'cancelled') {
        existing.status = 'registered';
        existing.registered_at = new Date();
        existing.cancelled_at = undefined;
        return existing.save();
      }
      throw new BadRequestException('Bạn đã đăng ký buổi sinh hoạt này');
    }

    const registration = new this.registrationModel({
      schedule_id: new Types.ObjectId(scheduleId),
      student_id: new Types.ObjectId(studentId),
      activity_id: new Types.ObjectId(activityId),
      status: 'registered',
      registered_at: new Date(),
    });

    return registration.save();
  }

  async cancelRegistration(
    scheduleId: string,
    studentId: string,
  ): Promise<{ message: string }> {
    const schedule = await this.scheduleModel.findById(scheduleId);
    if (!schedule) {
      throw new NotFoundException('Không tìm thấy buổi sinh hoạt');
    }
    if (new Date() >= new Date(schedule.start_time)) {
      throw new BadRequestException(
        'Không thể hủy đăng ký sau khi buổi sinh hoạt đã bắt đầu',
      );
    }

    const registration = await this.registrationModel.findOneAndUpdate(
      {
        schedule_id: new Types.ObjectId(scheduleId),
        student_id: new Types.ObjectId(studentId),
        status: 'registered',
      },
      { $set: { status: 'cancelled', cancelled_at: new Date() } },
    );

    if (!registration) {
      throw new NotFoundException('Không tìm thấy đăng ký');
    }

    return { message: 'Đã hủy đăng ký' };
  }

  async getRegistrations(
    scheduleId: string,
  ): Promise<ScheduleRegistrationDocument[]> {
    return this.registrationModel
      .find({
        schedule_id: new Types.ObjectId(scheduleId),
        status: 'registered',
      })
      .populate('student_id', 'full_name student_code email')
      .sort({ registered_at: 1 })
      .lean()
      .exec();
  }

  async markCompleted(id: string): Promise<ActivityScheduleDocument> {
    const schedule = await this.scheduleModel.findByIdAndUpdate(
      id,
      { $set: { status: 'completed' } },
      { returnDocument: 'after' },
    );

    if (!schedule) {
      throw new NotFoundException('Không tìm thấy buổi sinh hoạt');
    }
    return schedule;
  }

  private getWeekBoundariesInHoChiMinh(now: Date): { weekStart: Date; weekEnd: Date } {
    const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const dayOfWeek = vnTime.getUTCDay(); // CN = 0, T2 = 1, ..., T7 = 6
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const mondayVn = new Date(vnTime);
    mondayVn.setUTCDate(vnTime.getUTCDate() + diffToMonday);
    mondayVn.setUTCHours(0, 0, 0, 0);

    const weekStartUtc = new Date(mondayVn.getTime() - 7 * 60 * 60 * 1000);

    const nextMondayVn = new Date(mondayVn);
    nextMondayVn.setUTCDate(mondayVn.getUTCDate() + 7);
    const weekEndUtc = new Date(nextMondayVn.getTime() - 7 * 60 * 60 * 1000);

    return { weekStart: weekStartUtc, weekEnd: weekEndUtc };
  }

  private isTodayInHoChiMinh(date: Date, now: Date): boolean {
    const dateVn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const nowVn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    return (
      dateVn.getUTCFullYear() === nowVn.getUTCFullYear() &&
      dateVn.getUTCMonth() === nowVn.getUTCMonth() &&
      dateVn.getUTCDate() === nowVn.getUTCDate()
    );
  }

  private isActiveSchedule(schedule: { status: string; start_time: Date; end_time: Date }, now: Date): boolean {
    return (
      (schedule.status === 'scheduled' || schedule.status === 'ongoing') &&
      schedule.start_time <= now &&
      now < schedule.end_time
    );
  }

  async findActivityTimeline(
    activityId: string,
    requester: any,
  ): Promise<{
    viewer_mode: 'student' | 'staff';
    timezone: string;
    items: any[];
  }> {
    if (!Types.ObjectId.isValid(activityId)) {
      throw new BadRequestException('Mã câu lạc bộ không hợp lệ');
    }

    let viewerMode: 'student' | 'staff';
    if (isStudent(requester)) {
      viewerMode = 'student';
    } else if (isAdmin(requester) || isSupervisor(requester) || isTeacher(requester)) {
      viewerMode = 'staff';
    } else {
      throw new ForbiddenException('Vai trò không được hỗ trợ để truy cập timeline sinh hoạt');
    }

    const now = new Date();

    const schedules = await this.scheduleModel
      .find({
        activity_id: new Types.ObjectId(activityId),
        status: { $ne: 'cancelled' },
      })
      .sort({ start_time: 1, _id: 1 })
      .lean()
      .exec();

    if (schedules.length === 0) {
      return {
        viewer_mode: viewerMode,
        timezone: 'Asia/Ho_Chi_Minh',
        items: [],
      };
    }

    const scheduleIds = schedules.map(s => s._id);

    let attendanceList: any[] = [];
    if (viewerMode === 'student') {
      const studentId = requester.studentId || requester._id || requester.id;
      if (studentId) {
        attendanceList = await this.activityAttendanceModel
          .find({
            schedule_id: { $in: scheduleIds },
            student_id: Types.ObjectId.isValid(studentId) ? new Types.ObjectId(studentId) : studentId,
          })
          .lean()
          .exec();
      }
    } else {
      // staff mode
      attendanceList = await this.activityAttendanceModel
        .find({
          schedule_id: { $in: scheduleIds },
        })
        .populate('student_id', 'full_name student_code')
        .lean()
        .exec();
    }

    const groupedAttendance = new Map<string, any[]>();
    for (const rec of attendanceList) {
      const sId = rec.schedule_id.toString();
      let list = groupedAttendance.get(sId);
      if (!list) {
        list = [];
        groupedAttendance.set(sId, list);
      }
      list.push(rec);
    }

    const items = schedules.map(schedule => {
      const scheduleIdStr = schedule._id.toString();
      const records = groupedAttendance.get(scheduleIdStr) || [];
      const is_today = this.isTodayInHoChiMinh(schedule.start_time, now);
      const is_active = this.isActiveSchedule(schedule, now);

      if (viewerMode === 'student') {
        const my_attendance = records.length > 0 ? {
          _id: records[0]._id,
          activity_id: records[0].activity_id,
          schedule_id: records[0].schedule_id,
          student_id: records[0].student_id,
          semester_id: records[0].semester_id,
          status: records[0].status,
          check_in_time: records[0].check_in_time,
          check_out_time: records[0].check_out_time,
          approval_status: records[0].approval_status,
          recorded_at: records[0].recorded_at,
          note: records[0].note,
        } : null;
        return {
          ...schedule,
          is_today,
          is_active,
          my_attendance,
        };
      } else {
        const attendance_records = records.map(rec => ({
          _id: rec._id,
          student_id: rec.student_id ? {
            _id: rec.student_id._id,
            full_name: rec.student_id.full_name,
            student_code: rec.student_id.student_code,
          } : null,
          status: rec.status,
          check_in_time: rec.check_in_time,
          check_out_time: rec.check_out_time,
          approval_status: rec.approval_status,
          recorded_at: rec.recorded_at,
          note: rec.note,
        }));
        return {
          ...schedule,
          is_today,
          is_active,
          attendance_records,
        };
      }
    });

    return {
      viewer_mode: viewerMode,
      timezone: 'Asia/Ho_Chi_Minh',
      items,
    };
  }
}
