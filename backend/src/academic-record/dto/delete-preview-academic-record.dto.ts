import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsMongoId,
  IsOptional,
} from 'class-validator';

export class DeletePreviewAcademicRecordDto {
  @ApiProperty({ type: [String], description: 'Danh sách sinh viên cần lập bản xem trước xoá' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsMongoId({ each: true })
  studentIds: string[];

  @ApiPropertyOptional({ description: 'Lọc theo lớp' })
  @IsOptional()
  @IsMongoId()
  classId?: string;

  @ApiPropertyOptional({ description: 'Ngày bắt đầu, định dạng ISO' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Ngày kết thúc, định dạng ISO' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: ['admin', 'supervisor', 'teacher', 'student'] })
  @IsOptional()
  @IsIn(['admin', 'supervisor', 'teacher', 'student'])
  creator?: string;
}
