import {
  IsNotEmpty,
  IsNumber,
  Min,
  IsMongoId,
  IsOptional,
  IsArray,
  ValidateNested,
  IsString,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class EvaluationLogDto {
  @ApiProperty({ example: 'draft', required: false })
  @IsOptional()
  @IsString()
  from_status?: string;

  @ApiProperty({ example: 'sv_submitted', required: false })
  @IsOptional()
  @IsString()
  to_status?: string;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  score_before?: number;

  @ApiProperty({ example: 8, required: false })
  @IsOptional()
  @IsNumber()
  score_after?: number;

  @ApiProperty({ example: 2, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  count?: number;

  @ApiProperty({ example: '60c72b2f9b1d8b2bad123456', required: false })
  @IsOptional()
  @IsMongoId()
  updated_by?: string;

  @ApiProperty({ example: '2026-06-04T00:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  updated_at?: string;

  @ApiProperty({
    example: 'Tích cực tham gia câu lạc bộ học thuật',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateEvaluationDetailDto {
  @ApiProperty({
    example: '60c72b2f9b1d8b2bad123456',
    description: 'ID bảng tổng kết điểm (Mongoose ObjectId)',
  })
  @IsNotEmpty()
  @IsMongoId()
  summary_id: string;

  @ApiProperty({
    example: '60c72b2f9b1d8b2bad654321',
    description: 'ID tiêu chí chấm điểm (Mongoose ObjectId)',
  })
  @IsNotEmpty()
  @IsMongoId()
  criterion_id: string;

  @ApiProperty({
    example: 2,
    required: false,
    description: 'Số lần thực hiện hiện tại',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  current_count?: number;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  system_score?: number;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  sv_score?: number;

  @ApiProperty({ example: '2026-06-04T00:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  sv_submitted_at?: string;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  gv_score?: number;

  @ApiProperty({ example: '2026-06-04T00:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  gv_reviewed_at?: string;

  @ApiProperty({ example: '60c72b2f9b1d8b2bad123456', required: false })
  @IsOptional()
  @IsMongoId()
  gv_reviewed_by?: string;



  @ApiProperty({
    example: 'draft',
    enum: ['draft', 'sv_submitted', 'gv_reviewed', 'locked'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['draft', 'sv_submitted', 'gv_reviewed', 'locked'])
  status?: string;

  @ApiProperty({
    example: 'Tham gia đầy đủ và tích cực các hoạt động tình nguyện',
    required: false,
    description: 'Mô tả chi tiết hoặc ghi chú chấm điểm',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: [EvaluationLogDto],
    required: false,
    description: 'Mảng lịch sử chấm điểm',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvaluationLogDto)
  log?: EvaluationLogDto[];
}
