import { IsNotEmpty, IsMongoId, IsOptional, IsString, IsIn, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IntentScoreDto {
  @ApiProperty({ description: 'ID sinh viên' })
  @IsNotEmpty()
  @IsMongoId({ message: "student_id phải là MongoDB ObjectId của sinh viên, không phải MSSV" })
  student_id: string;

  @ApiProperty({ description: 'ID tiêu chí' })
  @IsNotEmpty()
  @IsMongoId()
  criterion_id: string;

  @ApiProperty({ description: 'ID học kỳ' })
  @IsNotEmpty()
  @IsMongoId()
  semester_id: string;

  @ApiProperty({ description: 'Loại intent', enum: ['increase', 'decrease', 'set_target_count', 'select_option', 'set_manual_score', 'clear_score'] })
  @IsNotEmpty()
  @IsIn(['increase', 'decrease', 'set_target_count', 'select_option', 'set_manual_score', 'clear_score'])
  intent_type: 'increase' | 'decrease' | 'set_target_count' | 'select_option' | 'set_manual_score' | 'clear_score';

  @ApiProperty({ description: 'Giá trị count đích (dùng cho set_target_count)', required: false })
  @IsOptional()
  @IsNumber()
  target_count?: number;

  @ApiProperty({ description: 'Giá trị điểm thủ công (dùng cho set_manual_score)', required: false })
  @IsOptional()
  @IsNumber()
  manual_score?: number;

  @ApiProperty({ description: 'ID option được chọn (dùng cho select_option)', required: false })
  @IsOptional()
  @IsString()
  selected_option_id?: string;

  @ApiProperty({ description: 'Ghi chú thêm', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
