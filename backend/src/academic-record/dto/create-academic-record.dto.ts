import {
  IsNotEmpty,
  IsMongoId,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAcademicRecordDto {
  @ApiProperty({
    example: '60c72b2f9b1d8b2bad654321',
    description: 'ID sinh viên (Student Mongoose ObjectId)',
  })
  @IsNotEmpty()
  @IsMongoId()
  student_id: string;

  @ApiProperty({
    example: '60c72b2f9b1d8b2bad778899',
    description: 'ID tiêu chí chấm điểm (Criterion Mongoose ObjectId)',
  })
  @IsNotEmpty()
  @IsMongoId()
  criterion_id: string;

  @ApiProperty({
    example: '60c72b2f9b1d8b2bad112233',
    description: 'ID học kỳ (Semester Mongoose ObjectId)',
  })
  @IsNotEmpty()
  @IsMongoId()
  semester_id: string;

  @ApiProperty({
    example: '60c72b2f9b1d8b2bad445566',
    required: false,
    description: 'ID báo cáo ngày (DailyClassReport Mongoose ObjectId, optional)',
  })
  @IsOptional()
  @IsMongoId()
  daily_report_id?: string;

  @ApiProperty({
    example: 'Nghỉ học tiết 1-2 ngày 10/10',
    description: 'Tiêu đề bản ghi học thuật',
    required: false,
  })
  @IsOptional()
  @IsString()
  record_title?: string;

  @ApiProperty({
    example: 'https://evidence-url.com/image.jpg',
    description: 'URL bằng chứng hình ảnh/tài liệu',
    required: false,
  })
  @IsOptional()
  @IsString()
  evidence_url?: string;

  @ApiProperty({
    example: '60c72b2f9b1d8b2bad123456',
    required: false,
    description: 'ID người ghi nhận (User Mongoose ObjectId, optional)',
  })
  @IsOptional()
  @IsMongoId()
  recorded_by?: string;

  @ApiProperty({
    example: '2026-06-04T00:00:00.000Z',
    required: false,
    description: 'Thời gian ghi nhận',
  })
  @IsOptional()
  @IsDateString()
  recorded_at?: string;

  @ApiProperty({
    example: 'Chi tiết ghi nhận vi phạm...',
    required: false,
    description: 'Mô tả chi tiết/ghi chú cho bản ghi học thuật',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'active',
    enum: ['active', 'inactive'],
    required: false,
    description: 'Trạng thái hoạt động',
  })
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;
}
