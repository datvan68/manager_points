import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

class NguyenVongDto {
  @IsOptional()
  @IsString()
  loai_phong?: string;

  @IsOptional()
  @IsMongoId()
  building_id?: string;

  @IsOptional()
  @IsString()
  ghi_chu?: string;
}

export class CreateRegistrationDto {
  @IsNotEmpty()
  @IsMongoId()
  student_id: string;

  @IsNotEmpty()
  @IsString()
  ky_hoc: string;

  @IsNotEmpty()
  @IsString()
  nam_hoc: string;

  @IsNotEmpty()
  @IsDateString()
  ngay_sinh: string;

  @IsNotEmpty()
  @IsEnum(['Male', 'Female', 'Other'])
  gioi_tinh: 'Male' | 'Female' | 'Other';

  @IsNotEmpty()
  @IsString()
  so_dien_thoai: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NguyenVongDto)
  nguyen_vong?: NguyenVongDto;

  @IsOptional()
  @IsEnum(['Chính sách', 'Xa nhà', 'Học lực giỏi', 'Khó khăn', 'Không'])
  doi_tuong_uu_tien?: string;
}
