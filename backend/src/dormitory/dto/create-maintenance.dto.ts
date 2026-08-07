import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsMongoId,
  IsEnum,
  IsArray,
} from 'class-validator';

export class CreateMaintenanceDto {
  @IsNotEmpty()
  @IsMongoId()
  room_id: string;

  @IsOptional()
  @IsMongoId()
  student_id?: string;

  @IsNotEmpty()
  @IsEnum(['Điện', 'Nước', 'Thiết bị', 'Cơ sở vật chất', 'Khác'])
  issue_type: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsEnum(['Thấp', 'Trung bình', 'Cao', 'Khẩn cấp'])
  priority?: string;
}

export class HandleMaintenanceDto {
  @IsOptional()
  @IsMongoId()
  technician_id?: string;

  @IsOptional()
  @IsEnum(['Mới', 'Đang xử lý', 'Hoàn tất', 'Từ chối'])
  status?: string;

  @IsOptional()
  @IsString()
  resolution_notes?: string;
}
