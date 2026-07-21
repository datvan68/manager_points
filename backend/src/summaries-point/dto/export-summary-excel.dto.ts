import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  ValidateIf,
} from 'class-validator';

export class ExportSummaryExcelDto {
  @ApiProperty({ description: 'ID của học kỳ' })
  @IsNotEmpty({ message: 'Học kỳ không được để trống' })
  @IsString()
  semesterId: string;

  @ApiPropertyOptional({ description: 'ID của lớp khi xuất theo lớp' })
  @ValidateIf((dto) => !dto.scope || dto.scope === 'class')
  @IsNotEmpty({ message: 'Lớp không được để trống' })
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ description: 'ID của khoa khi xuất theo khoa' })
  @ValidateIf((dto) => dto.scope === 'faculty')
  @IsNotEmpty({ message: 'Khoa không được để trống' })
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ enum: ['class', 'faculty', 'all'], default: 'class' })
  @IsOptional()
  @IsIn(['class', 'faculty', 'all'])
  scope?: 'class' | 'faculty' | 'all';

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
