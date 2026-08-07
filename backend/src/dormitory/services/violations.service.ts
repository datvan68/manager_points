import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Violation, ViolationDocument } from '../schemas/violation.schema';
import {
  CreateViolationDto,
  HandleViolationDto,
} from '../dto/create-violation.dto';
import { v4 as uuidv4 } from 'uuid';

// BR4: Configurable threshold for forced eviction
const SEVERE_VIOLATION_THRESHOLD = 3;

@Injectable()
export class ViolationsService {
  constructor(
    @InjectModel(Violation.name)
    private violationModel: Model<ViolationDocument>,
  ) {}

  async create(
    dto: CreateViolationDto,
    user: any,
  ): Promise<{ violation: Violation; threshold_exceeded: boolean }> {
    const violation = new this.violationModel({
      ...dto,
      violation_code: `VP-${uuidv4().substring(0, 8).toUpperCase()}`,
      status: 'Mới',
      recorded_by_id: user._id || user.userId,
    });

    const saved = await violation.save();

    // BR4: Check if severe violation threshold is exceeded
    const severeCount = await this.violationModel.countDocuments({
      student_id: dto.student_id,
      severity: 'Nghiêm trọng',
    });

    const threshold_exceeded = severeCount >= SEVERE_VIOLATION_THRESHOLD;

    return { violation: saved, threshold_exceeded };
  }

  async findAll(query: {
    student_id?: string;
    room_id?: string;
    status?: string;
    severity?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};
    if (query.student_id) filter.student_id = query.student_id;
    if (query.room_id) filter.room_id = query.room_id;
    if (query.status) filter.status = query.status;
    if (query.severity) filter.severity = query.severity;
    if (query.search) {
      filter.$or = [
        { violation_code: { $regex: query.search, $options: 'i' } },
        { violation_type: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.violationModel
        .find(filter)
        .populate('student_id', 'student_code full_name')
        .populate('room_id', 'room_code')
        .populate('recorded_by_id', 'user_name')
        .populate('resolved_by_id', 'user_name')
        .sort({ recorded_at: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.violationModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Violation> {
    const vp = await this.violationModel
      .findById(id)
      .populate('student_id')
      .populate('room_id')
      .populate('recorded_by_id', 'user_name')
      .populate('resolved_by_id', 'user_name')
      .exec();
    if (!vp) {
      throw new NotFoundException(`Không tìm thấy vi phạm: ${id}`);
    }
    return vp;
  }

  /**
   * UC10: Handle violation
   */
  async handle(
    id: string,
    dto: HandleViolationDto,
    user: any,
  ): Promise<Violation> {
    const vp = await this.violationModel.findById(id);
    if (!vp) {
      throw new NotFoundException(`Không tìm thấy vi phạm: ${id}`);
    }

    vp.resolution_type = dto.resolution_type;
    vp.resolution_notes = dto.resolution_notes || '';
    vp.status = 'Đã xử lý';
    vp.resolved_by_id = user._id || user.userId;

    return vp.save();
  }

  /**
   * Get violation summary for a student
   */
  async getStudentViolationSummary(studentId: string) {
    const violations = await this.violationModel
      .find({ student_id: studentId })
      .sort({ recorded_at: -1 })
      .exec();

    const totalDiemTru = violations.reduce((sum, v) => sum + (v.deducted_points || 0), 0);
    const severeCount = violations.filter((v) => v.severity === 'Nghiêm trọng').length;

    return {
      total: violations.length,
      total_deducted_points: totalDiemTru,
      severe_count: severeCount,
      threshold_exceeded: severeCount >= SEVERE_VIOLATION_THRESHOLD,
      violations,
    };
  }
}
