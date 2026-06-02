import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Criterion, CriterionDocument } from './schemas/criterion.schema';
import { CreateCriterionDto } from './dto/create-criterion.dto';
import { UpdateCriterionDto } from './dto/update-criterion.dto';

@Injectable()
export class CriteriaService {
  constructor(
    @InjectModel(Criterion.name)
    private criterionModel: Model<CriterionDocument>,
  ) {}

  async create(createCriterionDto: CreateCriterionDto): Promise<Criterion> {
    const createdCriterion = new this.criterionModel(createCriterionDto);
    return createdCriterion.save();
  }

  async findAll(): Promise<Criterion[]> {
    return this.criterionModel.find().populate('category_id').exec();
  }

  async findByCategoryId(categoryId: string): Promise<Criterion[]> {
    if (!Types.ObjectId.isValid(categoryId)) {
      throw new BadRequestException('ID danh mục không hợp lệ');
    }
    return this.criterionModel
      .find({ category_id: new Types.ObjectId(categoryId) as any })
      .populate('category_id')
      .exec();
  }

  async findOne(id: string): Promise<Criterion> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID tiêu chí không hợp lệ');
    }
    const criterion = await this.criterionModel
      .findById(id)
      .populate('category_id')
      .exec();
    if (!criterion) {
      throw new NotFoundException(`Criterion with ID ${id} not found`);
    }
    return criterion;
  }

  async update(
    id: string,
    updateCriterionDto: UpdateCriterionDto,
  ): Promise<Criterion> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID tiêu chí không hợp lệ');
    }
    const updatedCriterion = await this.criterionModel
      .findByIdAndUpdate(id, updateCriterionDto, { returnDocument: 'after' })
      .populate('category_id')
      .exec();
    if (!updatedCriterion) {
      throw new NotFoundException(`Criterion with ID ${id} not found`);
    }
    return updatedCriterion;
  }

  async remove(id: string): Promise<Criterion> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID tiêu chí không hợp lệ');
    }
    const deletedCriterion = await this.criterionModel
      .findByIdAndDelete(id)
      .exec();
    if (!deletedCriterion) {
      throw new NotFoundException(`Criterion with ID ${id} not found`);
    }
    return deletedCriterion;
  }

  async bulkDelete(ids: string[]): Promise<{ deletedCount: number }> {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException(
        'Danh sách ID tiêu chí không hợp lệ hoặc rỗng',
      );
    }
    for (const id of ids) {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`ID tiêu chí không hợp lệ: ${id}`);
      }
    }
    const result = await this.criterionModel
      .deleteMany({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .exec();
    return { deletedCount: result.deletedCount };
  }
}
