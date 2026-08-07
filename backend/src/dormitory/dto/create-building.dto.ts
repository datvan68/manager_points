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
  @IsNumber()
  @Min(1)
  floor_count?: number;

  @IsOptional()
  @IsEnum(['Active', 'Inactive', 'Maintenance'])
  status?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
