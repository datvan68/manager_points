import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  ValidateNested,
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

  @IsOptional()
  @ValidateNested()
  @Type(() => NguyenVongDto)
  nguyen_vong?: NguyenVongDto;

  @IsOptional()
  @IsEnum(['Chính sách', 'Xa nhà', 'Học lực giỏi', 'Không'])
  doi_tuong_uu_tien?: string;
}
