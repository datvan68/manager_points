import { IsNotEmpty, IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCriterionDto {
  @ApiProperty({ description: 'ID của danh mục cha (Category ID)', example: '60c72b2f9b1d8e251c888888' })
  @IsNotEmpty()
  @IsString()
  category_id: string;

  @ApiProperty({ description: 'Tên chi tiết tiêu chí', example: 'Đi học đúng giờ' })
  @IsNotEmpty()
  @IsString()
  criterion_name: string;

  @ApiProperty({ description: 'Bước nhảy điểm (số điểm thay đổi mỗi lần chấm)', example: 1, default: 1, required: false })
  @IsOptional()
  @IsNumber()
  score_per_unit?: number;

  @ApiProperty({ description: 'Điểm dải tối đa của tiêu chí', example: 10, default: 10, required: false })
  @IsOptional()
  @IsNumber()
  max_score?: number;

  @ApiProperty({ description: 'Điểm dải tối thiểu của tiêu chí', example: 0, default: 0, required: false })
  @IsOptional()
  @IsNumber()
  min_score?: number;

  @ApiProperty({ description: 'Phân loại tiêu chí', enum: ['khen_thuong', 'cong_diem', 'ky_luat'], default: 'cong_diem' })
  @IsNotEmpty()
  @IsEnum(['khen_thuong', 'cong_diem', 'ky_luat'])
  criterion_type: string;
}
