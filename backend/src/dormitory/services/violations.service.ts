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
      ma_vp: `VP-${uuidv4().substring(0, 8).toUpperCase()}`,
      trang_thai: 'Mới',
      nguoi_ghi_nhan_id: user._id || user.userId,
    });

    const saved = await violation.save();

    // BR4: Check if severe violation threshold is exceeded
    const severeCount = await this.violationModel.countDocuments({
      student_id: dto.student_id,
      muc_do: 'Nghiêm trọng',
    });

    const threshold_exceeded = severeCount >= SEVERE_VIOLATION_THRESHOLD;

    return { violation: saved, threshold_exceeded };
  }

  async findAll(query: {
    student_id?: string;
    room_id?: string;
    trang_thai?: string;
    muc_do?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};
    if (query.student_id) filter.student_id = query.student_id;
    if (query.room_id) filter.room_id = query.room_id;
    if (query.trang_thai) filter.trang_thai = query.trang_thai;
    if (query.muc_do) filter.muc_do = query.muc_do;
    if (query.search) {
      filter.$or = [
        { ma_vp: { $regex: query.search, $options: 'i' } },
        { loai_vi_pham: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.violationModel
        .find(filter)
        .populate('student_id', 'student_code full_name')
        .populate('room_id', 'ma_phong')
        .populate('nguoi_ghi_nhan_id', 'user_name')
        .populate('nguoi_xu_ly_id', 'user_name')
        .sort({ ngay_ghi_nhan: -1 })
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
      .populate('nguoi_ghi_nhan_id', 'user_name')
      .populate('nguoi_xu_ly_id', 'user_name')
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

    vp.hinh_thuc_xu_ly = dto.hinh_thuc_xu_ly;
    vp.ghi_chu_xu_ly = dto.ghi_chu_xu_ly || '';
    vp.trang_thai = 'Đã xử lý';
    vp.nguoi_xu_ly_id = user._id || user.userId;

    return vp.save();
  }

  /**
   * Get violation summary for a student
   */
  async getStudentViolationSummary(studentId: string) {
    const violations = await this.violationModel
      .find({ student_id: studentId })
      .sort({ ngay_ghi_nhan: -1 })
      .exec();

    const totalDiemTru = violations.reduce((sum, v) => sum + (v.diem_tru || 0), 0);
    const severeCount = violations.filter((v) => v.muc_do === 'Nghiêm trọng').length;

    return {
      total: violations.length,
      total_diem_tru: totalDiemTru,
      severe_count: severeCount,
      threshold_exceeded: severeCount >= SEVERE_VIOLATION_THRESHOLD,
      violations,
    };
  }
}
