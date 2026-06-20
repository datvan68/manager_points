import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsArray,
  ValidateIf,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class OptionDto {
  @ApiProperty({ description: 'MongoDB subdocument ID (được thêm tự động)', required: false })
  @IsOptional()
  @IsString()
  _id?: string;

  @ApiProperty({ description: 'ID của tùy chọn' })
  @IsNotEmpty()
  @IsString()
  id: string;

  @ApiProperty({ description: 'Nhãn hiển thị của tùy chọn' })
  @IsNotEmpty()
  @IsString()
  label: string;

  @ApiProperty({ description: 'Điểm của tùy chọn' })
  @IsNotEmpty()
  @IsNumber()
  score: number;
}

export class CreateCriterionDto {
  @ApiProperty({
    description: 'ID của danh mục cha (Category ID)',
    example: '60c72b2f9b1d8e251c888888',
  })
  @IsNotEmpty()
  @IsString()
  category_id: string;

  @ApiProperty({
    description: 'Tên chi tiết tiêu chí',
    example: 'Đi học đúng giờ',
  })
  @IsNotEmpty()
  @IsString()
  criterion_name: string;

  @ApiProperty({
    description: 'Bước nhảy điểm (số điểm thay đổi mỗi lần chấm)',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  score_per_unit?: number;

  @ApiProperty({
    description: 'Điểm dải tối đa của tiêu chí',
    example: 10,
    default: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  max_score?: number;

  @ApiProperty({
    description: 'Điểm dải tối thiểu của tiêu chí',
    example: 0,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  min_score?: number;

  @ApiProperty({
    description: 'Phân loại tiêu chí',
    enum: ['khen_thuong', 'cong_diem', 'ky_luat'],
    default: 'cong_diem',
  })
  @IsNotEmpty()
  @IsEnum(['khen_thuong', 'cong_diem', 'ky_luat'])
  criterion_type: string;

  @ApiProperty({
    description: 'Đánh dấu tiêu chí bị khóa rèn luyện',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  is_locked?: boolean;

  @ApiProperty({
    description: 'Xác định điểm kỷ luật có được cộng vào tổng điểm không',
    example: true,
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  is_score_counted?: boolean;

  @ApiProperty({
    description: 'Chế độ chấm điểm: tính lượt (count) hoặc chọn 1 (single_option)',
    enum: ['count', 'single_option'],
    default: 'count',
    required: false,
  })
  @IsOptional()
  @IsEnum(['count', 'single_option'])
  scoring_mode?: string;

  @ApiProperty({
    description: 'Danh sách các tùy chọn (bắt buộc nếu scoring_mode là single_option)',
    type: [OptionDto],
    required: false,
  })
  @ValidateIf(o => o.scoring_mode === 'single_option')
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique((o: OptionDto) => o.id)
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options?: OptionDto[];
}
