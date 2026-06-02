import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsOptional,
  IsMongoId,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSummaryPointDto {
  @ApiProperty({
    example: '60c72b2f9b1d8b2bad123456',
    description: 'ID sinh viên (Mongoose ObjectId)',
  })
  @IsNotEmpty()
  @IsMongoId()
  student_id: string;

  @ApiProperty({
    example: '60c72b2f9b1d8b2bad654321',
    description: 'ID học kỳ (Mongoose ObjectId)',
  })
  @IsNotEmpty()
  @IsMongoId()
  semester_id: string;

  @ApiProperty({
    example: 85,
    description: 'Điểm tổng kết',
    minimum: 0,
    maximum: 100,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  total_score: number;

  @ApiProperty({ example: 'Tốt', description: 'Xếp loại học tập/rèn luyện' })
  @IsNotEmpty()
  @IsString()
  grading: string;

  @ApiProperty({
    example: 'active',
    enum: ['active', 'inactive'],
    required: false,
    description: 'Trạng thái điểm tổng kết',
  })
  @IsOptional()
  @IsString()
  @IsEnum(['active', 'inactive'])
  status?: string;
}
