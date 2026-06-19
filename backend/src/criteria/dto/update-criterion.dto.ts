import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateCriterionDto } from './create-criterion.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCriterionDto extends PartialType(CreateCriterionDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_score_counted?: boolean;
}
