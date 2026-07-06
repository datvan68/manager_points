import {
  IsNotEmpty,
  IsMongoId,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsUrl,
  IsNumber,
  IsObject,
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
    description:
      'ID báo cáo ngày (DailyClassReport Mongoose ObjectId, optional)',
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
    enum: ['active', 'inactive', 'cancelled', 'rejected', 'confirmed'],
    required: false,
    description: 'Trạng thái hoạt động',
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'cancelled', 'rejected', 'confirmed'])
  status?: string;

  @ApiProperty({
    example: 'uuid-v4-string',
    required: false,
    description: 'Key dùng để tránh ghi nhận trùng lặp (idempotency)',
  })
  @IsOptional()
  @IsString()
  idempotency_key?: string;

  @ApiProperty({
    example: 'manual',
    required: false,
    description:
      'Nguồn tạo bản ghi (manual, import, bulk_grading, etc.) — legacy field',
  })
  @IsOptional()
  @IsString()
  source?: string;

  // === NEW FIELDS — Role-Aware Academic Record ===

  @ApiProperty({
    example: 'teacher',
    enum: ['student', 'teacher', 'supervisor', 'admin', 'system', 'import'],
    required: false,
    description: 'Vai trò của người ghi nhận bản ghi',
  })
  @IsOptional()
  @IsEnum(['student', 'teacher', 'supervisor', 'admin', 'system', 'import'])
  recorded_by_role?: string;

  @ApiProperty({
    example: 'activity',
    enum: [
      'activity',
      'discipline',
      'manual_score',
      'selected_option',
      'adjustment',
    ],
    required: false,
    description: 'Loại bản ghi',
  })
  @IsOptional()
  @IsEnum([
    'activity',
    'discipline',
    'manual_score',
    'selected_option',
    'adjustment',
  ])
  record_type?: string;

  @ApiProperty({
    example: 'count',
    enum: ['count', 'select_option', 'manual_score', 'bonus', 'penalty'],
    required: false,
    description: 'Loại hành động tính điểm',
  })
  @IsOptional()
  @IsEnum(['count', 'select_option', 'manual_score', 'bonus', 'penalty'])
  action_type?: string;

  @ApiProperty({
    example: 1,
    required: false,
    description: 'Số lượng lần xảy ra (mặc định: 1)',
  })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiProperty({
    example: 'daily_report',
    required: false,
    description: 'Loại nguồn tạo bản ghi (thay thế source sau migration)',
  })
  @IsOptional()
  @IsString()
  source_type?: string;

  @ApiProperty({
    example: '60c72b2f9b1d8b2bad999999',
    required: false,
    description: 'ID nguồn cụ thể (ghép cặp với source_type)',
  })
  @IsOptional()
  @IsString()
  source_id?: string;

  @ApiProperty({
    example: { manual_score: 8.5 },
    required: false,
    description: 'Dữ liệu có cấu trúc — thay thế parsing từ record_title',
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiProperty({
    example: '2026-06-04T00:00:00.000Z',
    required: false,
    description: 'Thời điểm sự kiện thực tế xảy ra',
  })
  @IsOptional()
  @IsDateString()
  occurred_at?: string;

  @ApiProperty({
    example: 'event:abc123',
    required: false,
    description: 'Key nhóm các bản ghi thuộc cùng một sự kiện logic',
  })
  @IsOptional()
  @IsString()
  occurrence_key?: string;
}
