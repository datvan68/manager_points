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
import { CategoriesService } from '../categories/categories.service';

@Injectable()
export class CriteriaService {
  constructor(
    @InjectModel(Criterion.name)
    private criterionModel: Model<CriterionDocument>,
    private categoriesService: CategoriesService,
  ) {}

  async create(createCriterionDto: CreateCriterionDto): Promise<Criterion> {
    if (createCriterionDto.criterion_code) {
      createCriterionDto.criterion_code = createCriterionDto.criterion_code.trim().toUpperCase();
      const existing = await this.criterionModel.findOne({ 
        criterion_code: { $regex: new RegExp(`^${createCriterionDto.criterion_code}$`, 'i') } 
      });
      if (existing) {
        throw new BadRequestException('Mã tiêu chí đã tồn tại');
      }
    }
    const createdCriterion = new this.criterionModel(createCriterionDto);
    try {
      return await createdCriterion.save();
    } catch (error: any) {
      if (error.code === 11000) {
        throw new BadRequestException('Mã tiêu chí đã tồn tại');
      }
      throw error;
    }
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

  async suggestCode(categoryId: string): Promise<{ suggestedCode: string }> {
    if (!categoryId || categoryId === 'undefined' || categoryId === 'null' || !Types.ObjectId.isValid(categoryId)) {
      throw new BadRequestException('ID danh mục không hợp lệ hoặc bị thiếu');
    }
    const category = await this.categoriesService.findOne(categoryId);
    const categoryCode = category.category_code;

    const criteria = await this.criterionModel
      .find({ category_id: new Types.ObjectId(categoryId) as any })
      .exec();

    if (criteria.length === 0) {
      return { suggestedCode: `${categoryCode}.1` };
    }

    let maxNumber = 0;
    for (const criterion of criteria) {
      const code = criterion.criterion_code;
      if (code && code.startsWith(`${categoryCode}.`)) {
        const suffix = code.slice(categoryCode.length + 1);
        const number = parseInt(suffix, 10);
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    }

    return { suggestedCode: `${categoryCode}.${maxNumber + 1}` };
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
    if (updateCriterionDto.criterion_code) {
      updateCriterionDto.criterion_code = updateCriterionDto.criterion_code.trim().toUpperCase();
      const existing = await this.criterionModel.findOne({ 
        criterion_code: { $regex: new RegExp(`^${updateCriterionDto.criterion_code}$`, 'i') },
        _id: { $ne: new Types.ObjectId(id) }
      });
      if (existing) {
        throw new BadRequestException('Mã tiêu chí đã tồn tại');
      }
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
