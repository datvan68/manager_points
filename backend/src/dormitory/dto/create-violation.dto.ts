import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsMongoId,
  IsEnum,
  IsArray,
  Min,
} from 'class-validator';

export class CreateViolationDto {
  @IsNotEmpty()
  @IsMongoId()
  student_id: string;

  @IsOptional()
  @IsMongoId()
  room_id?: string;

  @IsNotEmpty()
  @IsString()
  violation_type: string;

  @IsNotEmpty()
  @IsEnum(['Nhẹ', 'Trung bình', 'Nghiêm trọng'])
  severity: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deducted_points?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence?: string[];
}

export class HandleViolationDto {
  @IsNotEmpty()
  @IsEnum(['Nhắc nhở', 'Cảnh cáo', 'Phạt tiền', 'Buộc rời KTX'])
  resolution_type: string;

  @IsOptional()
  @IsString()
  resolution_notes?: string;
}
