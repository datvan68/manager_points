import {
  IsNotEmpty,
  IsNumber,
  IsMongoId,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAcademicRecordDto {
  @ApiProperty({
    example: '60c72b2f9b1d8b2bad123456',
    description: 'ID chi tiết chấm điểm (EvaluationDetail Mongoose ObjectId)',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  evaluation_detail_id?: string;

  @ApiProperty({
    example: '60c72b2f9b1d8b2bad778899',
    description: 'ID tiêu chí chấm điểm (Criterion Mongoose ObjectId)',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  criteria_id?: string;

  @ApiProperty({
    example: '60c72b2f9b1d8b2bad654321',
    description: 'ID sinh viên (Student Mongoose ObjectId)',
  })
  @IsNotEmpty()
  @IsMongoId()
  student_id: string;

  @ApiProperty({
    example: '60c72b2f9b1d8b2bad112233',
    description: 'ID học kỳ (Semester Mongoose ObjectId)',
  })
  @IsNotEmpty()
  @IsMongoId()
  semester_id: string;

  @ApiProperty({
    example: 'Vi phạm nội quy sử dụng điện thoại trong lớp',
    description: 'Tiêu đề bản ghi học thuật',
  })
  @IsNotEmpty()
  @IsString()
  record_title: string;

  @ApiProperty({ example: -5, description: 'Điểm số tác động (+/-)' })
  @IsNotEmpty()
  @IsNumber()
  points_effect: number;

  @ApiProperty({
    example: 'active',
    enum: ['active', 'inactive'],
    required: false,
    description: 'Trạng thái hoạt động',
  })
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;

  @ApiProperty({
    example: '60c72b2f9b1d8b2bad445566',
    required: false,
    description:
      'ID báo cáo ngày (DailyClassReport Mongoose ObjectId, optional)',
  })
  @IsOptional()
  @IsMongoId()
  daily_report_id?: string;

  @ApiProperty({
    example: '60c72b2f9b1d8b2bad123456',
    required: false,
    description: 'ID người tạo (User Mongoose ObjectId, optional)',
  })
  @IsOptional()
  @IsMongoId()
  user_id?: string;

  @ApiProperty({
    example: '2026-06-04T00:00:00.000Z',
    required: false,
    description: 'Ngày ghi nhận',
  })
  @IsOptional()
  @IsDateString()
  date_record?: string;

  @ApiProperty({
    example: 'Chi tiết vi phạm...',
    required: false,
    description: 'Mô tả chi tiết bản ghi học thuật',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
