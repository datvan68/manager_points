import { IsNotEmpty, IsNumber, IsMongoId, IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAcademicRecordDto {
  @ApiProperty({ example: '60c72b2f9b1d8b2bad123456', description: 'ID chi tiết chấm điểm (EvaluationDetail Mongoose ObjectId)' })
  @IsNotEmpty()
  @IsMongoId()
  evaluation_detail_id: string;

  @ApiProperty({ example: '60c72b2f9b1d8b2bad654321', description: 'ID sinh viên (Student Mongoose ObjectId)' })
  @IsNotEmpty()
  @IsMongoId()
  student_id: string;

  @ApiProperty({ example: '60c72b2f9b1d8b2bad112233', description: 'ID học kỳ (Semester Mongoose ObjectId)' })
  @IsNotEmpty()
  @IsMongoId()
  semester_id: string;

  @ApiProperty({ example: 'Vi phạm nội quy sử dụng điện thoại trong lớp', description: 'Tiêu đề bản ghi học thuật' })
  @IsNotEmpty()
  @IsString()
  record_title: string;

  @ApiProperty({ example: -5, description: 'Điểm số tác động (+/-)' })
  @IsNotEmpty()
  @IsNumber()
  points_effect: number;

  @ApiProperty({ example: 'active', enum: ['active', 'inactive'], required: false, description: 'Trạng thái hoạt động' })
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;

  @ApiProperty({ example: '60c72b2f9b1d8b2bad445566', required: false, description: 'ID báo cáo ngày (DailyClassReport Mongoose ObjectId, optional)' })
  @IsOptional()
  @IsMongoId()
  daily_report_id?: string;
}
