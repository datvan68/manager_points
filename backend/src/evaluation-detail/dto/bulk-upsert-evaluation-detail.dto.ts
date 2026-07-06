import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class BulkUpsertDetailItemDto {
  @ApiProperty({
    description: 'ID của tiêu chí',
    example: '60d0fe4f5311236168a109ca',
  })
  @IsNotEmpty()
  @IsMongoId()
  criterion_id: string;

  @ApiPropertyOptional({
    description: 'Số lần / số lượt vi phạm, khen thưởng',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  current_count?: number;

  @ApiPropertyOptional({
    description: 'Option được chọn nếu criterion dạng single_option',
    example: 'opt-1',
  })
  @IsOptional()
  @IsString()
  selected_option_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  selected_option_label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  selected_option_score?: number;

  @ApiPropertyOptional({ description: 'Điểm sinh viên tự chấm', example: 10 })
  @IsOptional()
  @IsNumber()
  sv_score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  sv_submitted_at?: Date;

  @ApiPropertyOptional({
    description: 'Điểm cố vấn / quản sinh / admin duyệt',
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  gv_score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  gv_reviewed_at?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  gv_reviewed_by?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  log?: any[];
}

export class BulkUpsertEvaluationDetailDto {
  @ApiProperty({
    description: 'ID của bảng tổng kết',
    example: '60d0fe4f5311236168a109ca',
  })
  @IsNotEmpty()
  @IsMongoId()
  summary_id: string;

  @ApiProperty({
    description: 'Danh sách các tiêu chí cần cập nhật hoặc thêm mới',
    type: [BulkUpsertDetailItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpsertDetailItemDto)
  details: BulkUpsertDetailItemDto[];

  @ApiPropertyOptional({
    description: 'Lý do cập nhật',
    example: 'Cập nhật tự động từ UI',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
