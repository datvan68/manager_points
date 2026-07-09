import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from '../schemas/maintenance-request.schema';
import {
  CreateMaintenanceDto,
  HandleMaintenanceDto,
} from '../dto/create-maintenance.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectModel(MaintenanceRequest.name)
    private maintenanceModel: Model<MaintenanceRequestDocument>,
  ) {}

  async create(
    dto: CreateMaintenanceDto,
    user: any,
  ): Promise<MaintenanceRequest> {
    const request = new this.maintenanceModel({
      ...dto,
      ma_ycbt: `BT-${uuidv4().substring(0, 8).toUpperCase()}`,
      trang_thai: 'Mới',
    });
    return request.save();
  }

  async findAll(query: {
    room_id?: string;
    trang_thai?: string;
    do_uu_tien?: string;
    loai_su_co?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};
    if (query.room_id) filter.room_id = query.room_id;
    if (query.trang_thai) filter.trang_thai = query.trang_thai;
    if (query.do_uu_tien) filter.do_uu_tien = query.do_uu_tien;
    if (query.loai_su_co) filter.loai_su_co = query.loai_su_co;
    if (query.search) {
      filter.$or = [
        { ma_ycbt: { $regex: query.search, $options: 'i' } },
        { mo_ta: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.maintenanceModel
        .find(filter)
        .populate('room_id', 'ma_phong')
        .populate('student_id', 'student_code full_name')
        .populate('ky_thuat_vien_id', 'user_name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.maintenanceModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<MaintenanceRequest> {
    const req = await this.maintenanceModel
      .findById(id)
      .populate('room_id')
      .populate('student_id')
      .populate('ky_thuat_vien_id', 'user_name')
      .exec();
    if (!req) {
      throw new NotFoundException(`Không tìm thấy yêu cầu bảo trì: ${id}`);
    }
    return req;
  }

  /**
   * UC12: Handle maintenance request (assign technician, update status)
   */
  async handle(
    id: string,
    dto: HandleMaintenanceDto,
    user: any,
  ): Promise<MaintenanceRequest> {
    const req = await this.maintenanceModel.findById(id);
    if (!req) {
      throw new NotFoundException(`Không tìm thấy yêu cầu bảo trì: ${id}`);
    }

    if (dto.ky_thuat_vien_id) req.ky_thuat_vien_id = dto.ky_thuat_vien_id as any;
    if (dto.trang_thai) req.trang_thai = dto.trang_thai;
    if (dto.ghi_chu_xu_ly) req.ghi_chu_xu_ly = dto.ghi_chu_xu_ly;

    if (dto.trang_thai === 'Hoàn tất') {
      req.ngay_hoan_tat = new Date();
    }

    return req.save();
  }
}
