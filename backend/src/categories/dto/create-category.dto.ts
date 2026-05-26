import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Mã danh mục duy nhất', example: 'CAT001' })
  @IsNotEmpty()
  @IsString()
  category_code: string;

  @ApiProperty({ description: 'Tên chi tiết danh mục', example: 'Ý thức học tập' })
  @IsNotEmpty()
  @IsString()
  category_name: string;

  @ApiProperty({ description: 'Điểm tối đa của danh mục', example: 100, default: 10, required: false })
  @IsOptional()
  @IsNumber()
  max_score?: number;

  @ApiProperty({ description: 'Thứ tự sắp xếp của danh mục', example: 1, default: 10, required: false })
  @IsOptional()
  @IsNumber()
  sort_order?: number;
}
