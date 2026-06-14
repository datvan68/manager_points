import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsOptional,
  IsMongoId,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSummaryPointDto {
  @ApiProperty({
    example: '60c72b2f9b1d8b2bad123456',
    description: 'ID sinh viên (Mongoose ObjectId)',
  })
  @IsNotEmpty()
  @IsMongoId()
  student_id: string;

  @ApiProperty({
    example: '60c72b2f9b1d8b2bad654321',
    description: 'ID học kỳ (Mongoose ObjectId)',
  })
  @IsNotEmpty()
  @IsMongoId()
  semester_id: string;

  @ApiProperty({
    example: '60c72b2f9b1d8b2bad778899',
    description: 'ID kỳ đánh giá (Mongoose ObjectId, optional)',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  period_id?: string;

  @ApiProperty({
    example: 85,
    description: 'Điểm tổng kết (null cho đến khi khóa)',
    minimum: 0,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  total_score?: number;

  @ApiProperty({
    example: 'Tốt',
    description: 'Xếp loại rèn luyện (computed khi locked)',
    required: false,
  })
  @IsOptional()
  @IsString()
  grading?: string;

  @ApiProperty({
    example: 'draft',
    enum: ['draft', 'sv_submitted', 'gv_reviewed', 'locked'],
    required: false,
    description: 'Trạng thái điểm tổng kết',
  })
  @IsOptional()
  @IsEnum(['draft', 'sv_submitted', 'gv_reviewed', 'locked'])
  status?: string;

  @ApiProperty({
    type: [Object],
    required: false,
    description: 'Mảng chi tiết chấm điểm',
  })
  @IsOptional()
  @IsArray()
  details?: any[];

  @ApiProperty({ example: 'diamond', enum: ['diamond', 'gold', 'silver', 'bronze', 'unranked'], required: false })
  @IsOptional()
  @IsEnum(['diamond', 'gold', 'silver', 'bronze', 'unranked'])
  rank_tier?: string;

  @ApiProperty({ example: 'Kim cương', required: false })
  @IsOptional()
  @IsString()
  rank_label?: string;
}
