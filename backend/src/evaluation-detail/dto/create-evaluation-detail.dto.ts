import { IsNotEmpty, IsNumber, Min, IsMongoId, IsOptional, IsArray, ValidateNested, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class EvaluationLogDto {
  @ApiProperty({ example: 'student', enum: ['student', 'teacher', 'supervisor', 'admin'] })
  @IsNotEmpty()
  @IsEnum(['student', 'teacher', 'supervisor', 'admin'])
  role: string;

  @ApiProperty({ example: '60c72b2f9b1d8b2bad123456', required: false })
  @IsOptional()
  @IsMongoId()
  updated_by?: string;

  @ApiProperty({ example: 3 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  count: number;

  @ApiProperty({ example: 'Tích cực tham gia câu lạc bộ học thuật', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateEvaluationDetailDto {
  @ApiProperty({ example: '60c72b2f9b1d8b2bad123456', description: 'ID bảng tổng kết điểm (Mongoose ObjectId)' })
  @IsNotEmpty()
  @IsMongoId()
  summary_id: string;

  @ApiProperty({ example: '60c72b2f9b1d8b2bad654321', description: 'ID tiêu chí chấm điểm (Mongoose ObjectId)' })
  @IsNotEmpty()
  @IsMongoId()
  criterion_id: string;

  @ApiProperty({ type: [EvaluationLogDto], required: false, description: 'Mảng lịch sử chấm điểm các vai trò' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvaluationLogDto)
  history?: EvaluationLogDto[];

  @ApiProperty({ example: 2, required: false, description: 'Số lần thực hiện hiện tại' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  current_count?: number;

  @ApiProperty({ example: 'draft', enum: ['draft', 'teacher_evaluated', 'supervisor_evaluated', 'finalized'], required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ example: 'Tham gia đầy đủ và tích cực các hoạt động tình nguyện', required: false, description: 'Mô tả chi tiết hoặc ghi chú chấm điểm' })
  @IsOptional()
  @IsString()
  description?: string;
}
