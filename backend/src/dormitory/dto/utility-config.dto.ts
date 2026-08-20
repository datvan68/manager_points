import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  Matches,
  Max,
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

export class TransferQrImageDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\/uploads\/invoice-transfer-qr-[a-zA-Z0-9-]+\.(png|jpe?g|webp)$/i)
  url: string;

  @IsOptional()
  @IsString()
  file_name?: string;

  @IsNotEmpty()
  @IsString()
  @IsEnum(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
  mime_type: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(5 * 1024 * 1024)
  size: number;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => TransferQrImageDto)
  transfer_qr_image?: TransferQrImageDto;
}
