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
  building_code: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(['Trống', 'Đầy'])
  status?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
