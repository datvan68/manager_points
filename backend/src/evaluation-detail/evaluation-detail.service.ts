import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EvaluationDetail,
  EvaluationDetailDocument,
} from './schemas/evaluation-detail.schema';
import { CreateEvaluationDetailDto } from './dto/create-evaluation-detail.dto';
import { UpdateEvaluationDetailDto } from './dto/update-evaluation-detail.dto';

@Injectable()
export class EvaluationDetailService {
  constructor(
    @InjectModel(EvaluationDetail.name)
    private readonly evaluationDetailModel: Model<EvaluationDetailDocument>,
  ) {}

  async create(
    createEvaluationDetailDto: CreateEvaluationDetailDto,
  ): Promise<EvaluationDetail> {
    const { history, current_count, ...rest } = createEvaluationDetailDto;

    const dataToCreate: any = { ...rest };
    const countVal = current_count || 0;

    dataToCreate.current_count = countVal;
    dataToCreate.history =
      history && history.length > 0
        ? history
        : [{ role: 'student', count: countVal, updated_at: new Date() }];

    const created = new this.evaluationDetailModel(dataToCreate);
    const saved = await created.save();
    return saved.populate(['summary_id', 'criterion_id']);
  }

  async findAll(): Promise<EvaluationDetail[]> {
    return this.evaluationDetailModel
      .find()
      .populate('summary_id')
      .populate('criterion_id')
      .exec();
  }

  async findOne(id: string): Promise<EvaluationDetail> {
    const detail = await this.evaluationDetailModel
      .findById(id)
      .populate('summary_id')
      .populate('criterion_id')
      .exec();
    if (!detail) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }
    return detail;
  }

  async findBySummaryId(summaryId: string): Promise<EvaluationDetail[]> {
    return this.evaluationDetailModel
      .find({ summary_id: summaryId as any })
      .populate('criterion_id')
      .exec();
  }

  async update(
    id: string,
    updateEvaluationDetailDto: UpdateEvaluationDetailDto,
  ): Promise<EvaluationDetail> {
    const updated = await this.evaluationDetailModel
      .findByIdAndUpdate(id, updateEvaluationDetailDto, {
        returnDocument: 'after',
      })
      .populate('summary_id')
      .populate('criterion_id')
      .exec();
    if (!updated) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<EvaluationDetail> {
    const deleted = await this.evaluationDetailModel
      .findByIdAndDelete(id)
      .exec();
    if (!deleted) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }
    return deleted;
  }
}
