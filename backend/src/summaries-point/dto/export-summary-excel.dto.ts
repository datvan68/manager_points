import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsIn,
} from 'class-validator';

export class ExportSummaryExcelDto {
  @ApiProperty({ description: 'ID của học kỳ' })
  @IsNotEmpty({ message: 'Học kỳ không được để trống' })
  @IsString()
  semesterId: string;

  @ApiProperty({ description: 'ID của lớp' })
  @IsNotEmpty({ message: 'Lớp không được để trống' })
  @IsString()
  classId: string;

  @ApiPropertyOptional({
    description: 'Danh sách ID sinh viên (nếu mode = selected)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentIds?: string[];

  @ApiPropertyOptional({
    description: 'Chế độ xuất',
    enum: ['all_filtered', 'selected'],
  })
  @IsOptional()
  @IsIn(['all_filtered', 'selected'])
  mode?: 'all_filtered' | 'selected';
}
