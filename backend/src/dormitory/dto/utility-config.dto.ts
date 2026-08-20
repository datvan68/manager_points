import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UtilityTariffDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  quota_per_person: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  unit_price: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class UpdateUtilityConfigDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => UtilityTariffDto)
  electricity: UtilityTariffDto;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => UtilityTariffDto)
  water: UtilityTariffDto;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  configured_collection_days: number;
}
