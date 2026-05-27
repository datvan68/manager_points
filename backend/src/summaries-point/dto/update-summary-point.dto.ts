import { PartialType } from '@nestjs/swagger';
import { CreateSummaryPointDto } from './create-summary-point.dto';

export class UpdateSummaryPointDto extends PartialType(CreateSummaryPointDto) {}
