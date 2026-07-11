import {
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsNumber,
  Min,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateActivityCompletionRuleDto {
  @ApiProperty({ description: 'Activity/Activity ID' })
  @IsMongoId()
  activity_id: string;

  @ApiProperty({ description: 'Semester ID' })
  @IsMongoId()
  semester_id: string;

  @ApiProperty({ description: 'Minimum attendance count required to complete', minimum: 1 })
  @IsNumber()
  @Min(1)
  minimum_attendance: number;

  @ApiProperty({ description: 'List of Criterion IDs to award upon completion', type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  @ArrayMinSize(1)
  criterion_ids: string[];

  @ApiPropertyOptional({ description: 'Status of the rule', enum: ['active', 'inactive'], default: 'active' })
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;
}

export class UpdateActivityCompletionRuleDto extends PartialType(CreateActivityCompletionRuleDto) {}
