import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ActivityAttendanceConfig,
  ActivityAttendanceConfigDocument,
} from './schemas/activity-attendance-config.schema';
import {
  CreateAttendanceConfigDto,
  UpdateAttendanceConfigDto,
} from './dto/attendance-config.dto';

@Injectable()
export class ActivityAttendanceConfigService {
  constructor(
    @InjectModel(ActivityAttendanceConfig.name)
    private configModel: Model<ActivityAttendanceConfigDocument>,
  ) {}

  async create(
    dto: CreateAttendanceConfigDto,
    userId: string,
  ): Promise<ActivityAttendanceConfigDocument> {
    // Check duplicate
    const filter: any = {
      semester_id: new Types.ObjectId(dto.semester_id),
    };
    if (dto.activity_id) {
      filter.activity_id = new Types.ObjectId(dto.activity_id);
    } else {
      filter.activity_id = null;
    }

    const existing = await this.configModel.findOne(filter);
    if (existing) {
      throw new BadRequestException(
        dto.activity_id
          ? 'Cấu hình cho Hoạt động này trong học kỳ đã tồn tại'
          : 'Cấu hình mặc định cho học kỳ đã tồn tại',
      );
    }

    const config = new this.configModel({
      ...dto,
      activity_id: dto.activity_id ? new Types.ObjectId(dto.activity_id) : null,
      semester_id: new Types.ObjectId(dto.semester_id),
      criterion_id: new Types.ObjectId(dto.criterion_id),
      created_by: new Types.ObjectId(userId),
    });

    return config.save();
  }

  async findAll(semesterId?: string): Promise<ActivityAttendanceConfigDocument[]> {
    const filter: any = {};
    if (semesterId) filter.semester_id = new Types.ObjectId(semesterId);

    return this.configModel
      .find(filter)
      .populate('activity_id', 'name code')
      .populate('semester_id', 'name')
      .populate('criterion_id', 'name code')
      .populate('created_by', 'user_name')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async findByActivity(
    activityId: string,
    semesterId: string,
  ): Promise<ActivityAttendanceConfigDocument | null> {
    // Try club-specific config first
    let config = await this.configModel
      .findOne({
        activity_id: new Types.ObjectId(activityId),
        semester_id: new Types.ObjectId(semesterId),
        status: 'active',
      })
      .populate('criterion_id', 'name code')
      .lean()
      .exec();

    // Fallback to default config
    if (!config) {
      config = await this.configModel
        .findOne({
          activity_id: null,
          semester_id: new Types.ObjectId(semesterId),
          status: 'active',
        })
        .populate('criterion_id', 'name code')
        .lean()
        .exec();
    }

    return config;
  }

  async findOne(id: string): Promise<ActivityAttendanceConfigDocument> {
    const config = await this.configModel
      .findById(id)
      .populate('activity_id', 'name code')
      .populate('semester_id', 'name')
      .populate('criterion_id', 'name code')
      .populate('created_by', 'user_name')
      .exec();

    if (!config) {
      throw new NotFoundException('Không tìm thấy cấu hình');
    }
    return config;
  }

  async update(
    id: string,
    dto: UpdateAttendanceConfigDto,
  ): Promise<ActivityAttendanceConfigDocument> {
    const updateData: any = { ...dto };
    if (dto.criterion_id) {
      updateData.criterion_id = new Types.ObjectId(dto.criterion_id);
    }

    const config = await this.configModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true },
    );

    if (!config) {
      throw new NotFoundException('Không tìm thấy cấu hình');
    }
    return config;
  }

  async remove(id: string): Promise<{ message: string }> {
    const config = await this.configModel.findByIdAndDelete(id);
    if (!config) {
      throw new NotFoundException('Không tìm thấy cấu hình');
    }
    return { message: 'Đã xóa cấu hình' };
  }

  async getEffectiveConfig(
    activityId: string,
    semesterId: string,
  ): Promise<ActivityAttendanceConfigDocument | null> {
    return this.findByActivity(activityId, semesterId);
  }
}
