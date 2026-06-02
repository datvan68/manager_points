import {
  IsNotEmpty,
  IsNumber,
  Min,
  IsMongoId,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDailyClassReportDto {
  @ApiProperty({
    example: '60c72b2f9b1d8b2bad123456',
    description: 'ID lớp học (Class Mongoose ObjectId)',
  })
  @IsNotEmpty()
  @IsMongoId()
  class_id: string;

  @ApiProperty({
    example: '60c72b2f9b1d8b2bad654321',
    description: 'ID giáo viên/người ghi nhận (User Mongoose ObjectId)',
  })
  @IsNotEmpty()
  @IsMongoId()
  user_id: string;

  @ApiProperty({
    example: '2026-06-01T00:00:00.000Z',
    description: 'Ngày báo cáo',
  })
  @IsNotEmpty()
  @IsDateString()
  report_date: string;

  @ApiProperty({ example: 40, description: 'Số lượng sinh viên có mặt' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  total_present: number;

  @ApiProperty({ example: 2, description: 'Số lượng sinh viên vắng mặt' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  total_absent: number;

  @ApiProperty({
    example: 'Nguyễn Văn A',
    description: 'Tên giảng viên giảng dạy',
  })
  @IsNotEmpty()
  @IsString()
  teacher_name: string;

  @ApiProperty({
    example: 'Lớp học nghiêm túc, vắng có phép 1 em',
    required: false,
    description: 'Ghi chú lớp học',
  })
  @IsOptional()
  @IsString()
  class_note?: string;
}
