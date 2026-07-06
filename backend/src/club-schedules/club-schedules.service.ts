import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ClubSchedule,
  ClubScheduleDocument,
} from './schemas/club-schedule.schema';
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

@Injectable()
export class ClubSchedulesService {
  constructor(
    @InjectModel(ClubSchedule.name)
    private scheduleModel: Model<ClubScheduleDocument>,
    @InjectModel(ScheduleRegistration.name)
    private registrationModel: Model<ScheduleRegistrationDocument>,
    @InjectModel(Semester.name)
    private semesterModel: Model<SemesterDocument>,
  ) {}

  async create(
    dto: CreateScheduleDto,
    userId: string,
  ): Promise<ClubScheduleDocument> {
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
            club_id: new Types.ObjectId(dto.club_id),
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
      return createdSchedules[0] as unknown as ClubScheduleDocument;
    }

    const schedule = new this.scheduleModel({
      ...dto,
      club_id: new Types.ObjectId(dto.club_id),
      semester_id: new Types.ObjectId(dto.semester_id),
      instructor_id: dto.instructor_id
        ? new Types.ObjectId(dto.instructor_id)
        : undefined,
      created_by: new Types.ObjectId(userId),
    });

    return schedule.save();
  }

  async findAll(query: QueryScheduleDto): Promise<{
    items: ClubScheduleDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const filter: any = {};

    if (query.club_id) filter.club_id = new Types.ObjectId(query.club_id);
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
        .populate('club_id', 'name code category classroom')
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

  async findByClub(
    clubId: string,
    semesterId?: string,
  ): Promise<ClubScheduleDocument[]> {
    const filter: any = { club_id: new Types.ObjectId(clubId) };
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
          { path: 'club_id', select: 'name code category classroom' },
          { path: 'instructor_id', select: 'user_name' },
        ],
      })
      .lean()
      .exec();

    return registrations;
  }

  async findUpcoming(
    clubId?: string,
    limit = 10,
  ): Promise<ClubScheduleDocument[]> {
    const filter: any = {
      start_time: { $gte: new Date() },
      status: { $in: ['scheduled', 'ongoing'] },
    };
    if (clubId) filter.club_id = new Types.ObjectId(clubId);

    return this.scheduleModel
      .find(filter)
      .populate('club_id', 'name code category classroom')
      .populate('instructor_id', 'user_name')
      .sort({ start_time: 1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<any> {
    const schedule = await this.scheduleModel
      .findById(id)
      .populate('club_id', 'name code category classroom')
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
  ): Promise<ClubScheduleDocument> {
    if (dto.end_time && dto.start_time && new Date(dto.end_time) <= new Date(dto.start_time)) {
      throw new BadRequestException(
        'Thời gian kết thúc phải sau thời gian bắt đầu',
      );
    }

    if (dto.recurrence) {
      const existing = await this.scheduleModel.findById(id).exec();
      if (!existing) {
        throw new NotFoundException(`Không tìm thấy lịch sinh hoạt với ID: ${id}`);
      }

      const start = dto.start_time ? new Date(dto.start_time) : new Date(existing.start_time);
      const untilDate = dto.recurrence.until ? new Date(dto.recurrence.until) : null;

      const day = start.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(start.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
      monday.setHours(0, 0, 0, 0);

      const repeatStart = dto.recurrence.start ? new Date(dto.recurrence.start) : null;

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
    clubId: string,
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
      club_id: new Types.ObjectId(clubId),
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

  async markCompleted(id: string): Promise<ClubScheduleDocument> {
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
}
