import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EvaluationPeriod,
  EvaluationPeriodDocument,
} from './schemas/evaluation-period.schema';
import {
  CreateEvaluationPeriodDto,
  UpdateEvaluationPeriodDto,
} from './dto/evaluation-period.dto';

@Injectable()
export class EvaluationPeriodsService {
  constructor(
    @InjectModel(EvaluationPeriod.name)
    private periodModel: Model<EvaluationPeriodDocument>,
  ) {}

  async findAll() {
    return this.periodModel
      .find()
      .populate('semester_id')
      .populate('created_by', 'user_name email')
      .sort({ createdAt: -1 });
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID không hợp lệ');

    const period = await this.periodModel
      .findById(id)
      .populate('semester_id')
      .populate('created_by', 'user_name email');

    if (!period) throw new BadRequestException('Kỳ đánh giá không tồn tại');
    return period;
  }

  async create(dto: CreateEvaluationPeriodDto, userId: string) {
    // Kiểm tra: mỗi học kỳ chỉ có 1 kỳ đánh giá active (chưa closed)
    const existing = await this.periodModel.findOne({
      semester_id: dto.semester_id,
      status: { $ne: 'closed' },
    } as any);
    if (existing) {
      throw new ConflictException(
        'Học kỳ này đã có kỳ đánh giá đang hoạt động',
      );
    }

    return this.periodModel.create({
      ...dto,
      created_by: new Types.ObjectId(userId) as any,
    } as any);
  }

  async update(id: string, dto: UpdateEvaluationPeriodDto) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID không hợp lệ');

    const period = await this.periodModel.findById(id);
    if (!period) throw new BadRequestException('Kỳ đánh giá không tồn tại');

    if (dto.semester_id !== undefined)
      (period as any).semester_id = new Types.ObjectId(dto.semester_id);
    if (dto.status !== undefined) period.status = dto.status;
    if (dto.sv_deadline !== undefined)
      period.sv_deadline = new Date(dto.sv_deadline);
    if (dto.gv_deadline !== undefined)
      period.gv_deadline = new Date(dto.gv_deadline);
    if (dto.admin_deadline !== undefined)
      period.admin_deadline = new Date(dto.admin_deadline);

    return period.save();
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID không hợp lệ');

    const result = await this.periodModel.deleteOne({ _id: id });
    if (result.deletedCount === 0)
      throw new BadRequestException('Kỳ đánh giá không tồn tại');

    return { message: 'Xóa kỳ đánh giá thành công' };
  }
}
