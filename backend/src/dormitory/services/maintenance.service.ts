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
import { emitDormitoryOverviewInvalidated } from '../dormitory-overview-event-emitter';

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
      request_code: `BT-${uuidv4().substring(0, 8).toUpperCase()}`,
      status: 'Mới',
    });
    const saved = await request.save();
    emitDormitoryOverviewInvalidated('maintenance');
    return saved;
  }

  async findAll(query: {
    room_id?: string;
    status?: string;
    priority?: string;
    issue_type?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};
    if (query.room_id) filter.room_id = query.room_id;
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.issue_type) filter.issue_type = query.issue_type;
    if (query.search) {
      filter.$or = [
        { request_code: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.maintenanceModel
        .find(filter)
        .populate('room_id', 'room_code')
        .populate('student_id', 'student_code full_name')
        .populate('technician_id', 'user_name')
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
      .populate('technician_id', 'user_name')
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

    if (dto.technician_id) req.technician_id = dto.technician_id as any;
    if (dto.status) req.status = dto.status;
    if (dto.resolution_notes) req.resolution_notes = dto.resolution_notes;

    if (dto.status === 'Hoàn tất') {
      req.completed_at = new Date();
    }

    const saved = await req.save();
    emitDormitoryOverviewInvalidated('maintenance');
    return saved;
  }
}
