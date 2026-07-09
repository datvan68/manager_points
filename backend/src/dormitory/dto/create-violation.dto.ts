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
  loai_vi_pham: string;

  @IsNotEmpty()
  @IsEnum(['Nhẹ', 'Trung bình', 'Nghiêm trọng'])
  muc_do: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  diem_tru?: number;

  @IsOptional()
  @IsString()
  mo_ta?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  minh_chung?: string[];
}

export class HandleViolationDto {
  @IsNotEmpty()
  @IsEnum(['Nhắc nhở', 'Cảnh cáo', 'Phạt tiền', 'Buộc rời KTX'])
  hinh_thuc_xu_ly: string;

  @IsOptional()
  @IsString()
  ghi_chu_xu_ly?: string;
}
