import { IsNotEmpty, IsNumber, Min, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEvaluationDetailDto {
  @ApiProperty({ example: '60c72b2f9b1d8b2bad123456', description: 'ID bảng tổng kết điểm (Mongoose ObjectId)' })
  @IsNotEmpty()
  @IsMongoId()
  summary_id: string;

  @ApiProperty({ example: '60c72b2f9b1d8b2bad654321', description: 'ID tiêu chí chấm điểm (Mongoose ObjectId)' })
  @IsNotEmpty()
  @IsMongoId()
  criterion_id: string;

  @ApiProperty({ example: 5, description: 'Điểm do sinh viên tự chấm', minimum: 0 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  student_score: number;

  @ApiProperty({ example: 8, description: 'Điểm do cố vấn/lớp chấm', minimum: 0 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  advisor_score: number;
}
