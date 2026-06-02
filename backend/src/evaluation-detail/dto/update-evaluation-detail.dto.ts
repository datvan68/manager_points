import { PartialType } from '@nestjs/swagger';
import { CreateEvaluationDetailDto } from './create-evaluation-detail.dto';

export class UpdateEvaluationDetailDto extends PartialType(
  CreateEvaluationDetailDto,
) {}
