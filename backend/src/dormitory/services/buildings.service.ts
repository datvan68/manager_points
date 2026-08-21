import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Building, BuildingDocument } from '../schemas/building.schema';
import { CreateBuildingDto } from '../dto/create-building.dto';
import { UpdateBuildingDto } from '../dto/update-building.dto';
import { Room, RoomDocument } from '../schemas/room.schema';
import { emitDormitoryOverviewInvalidated } from '../dormitory-overview-event-emitter';

@Injectable()
export class BuildingsService {
  constructor(
    @InjectModel(Building.name)
    private buildingModel: Model<BuildingDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
  ) {}

  async create(dto: CreateBuildingDto, user: any): Promise<Building> {
    const existing = await this.buildingModel.findOne({ building_code: dto.building_code });
    if (existing) {
      throw new ConflictException(`Tòa nhà với mã "${dto.building_code}" đã tồn tại`);
    }
    const building = new this.buildingModel(dto);
    const saved = await building.save();
    emitDormitoryOverviewInvalidated('buildings');
    return saved;
  }

  async findAll(query: { search?: string; status?: string; page?: number; limit?: number }) {
    const filter: any = {};
    if (query.search) {
      filter.$or = [
        { building_code: { $regex: query.search, $options: 'i' } },
        { name: { $regex: query.search, $options: 'i' } },
      ];
    }
    if (query.status) {
      filter.status = query.status;
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.buildingModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.buildingModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Building> {
    const building = await this.buildingModel.findById(id).exec();
    if (!building) {
      throw new NotFoundException(`Không tìm thấy tòa nhà với ID: ${id}`);
    }
    return building;
  }

  async update(id: string, dto: UpdateBuildingDto, user: any): Promise<Building> {
    const building = await this.buildingModel
      .findByIdAndUpdate(id, { $set: dto }, { returnDocument: 'after' })
      .exec();
    if (!building) {
      throw new NotFoundException(`Không tìm thấy tòa nhà với ID: ${id}`);
    }
    emitDormitoryOverviewInvalidated('buildings');
    return building;
  }

  async remove(id: string, user: any): Promise<Building> {
    if (await this.roomModel.exists({ building_id: id })) {
      throw new ConflictException('Không thể xóa tòa nhà còn phòng tham chiếu');
    }
    const building = await this.buildingModel.findByIdAndDelete(id).exec();
    if (!building) {
      throw new NotFoundException(`Không tìm thấy tòa nhà với ID: ${id}`);
    }
    emitDormitoryOverviewInvalidated('buildings');
    return building;
  }
}
