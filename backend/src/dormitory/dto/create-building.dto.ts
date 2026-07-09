import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';

export class CreateBuildingDto {
  @IsNotEmpty()
  @IsString()
  ma_toa_nha: string;

  @IsNotEmpty()
  @IsString()
  ten: string;

  @IsOptional()
  @IsString()
  dia_chi?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  so_tang?: number;

  @IsOptional()
  @IsEnum(['Active', 'Inactive', 'Maintenance'])
  trang_thai?: string;

  @IsOptional()
  @IsString()
  mo_ta?: string;
}
