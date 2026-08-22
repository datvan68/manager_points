import { IsOptional, IsString, IsInt, Min, Max, IsEnum, Matches, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import type { AssetLifecycleState, StorageNamespace } from '../storage.interface';

export class StorageInventoryQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['staged', 'active', 'orphan_candidate', 'quarantined', 'purged'] })
  @IsOptional()
  @IsEnum(['staged', 'active', 'orphan_candidate', 'quarantined', 'purged'])
  status?: AssetLifecycleState;

  @ApiPropertyOptional({ enum: ['activities', 'dormitory'] })
  @IsOptional()
  @IsEnum(['activities', 'dormitory'])
  domain?: 'activities' | 'dormitory';

  @ApiPropertyOptional({ enum: ['activities', 'invoices', 'dormitory-qr', 'room-fee-invoices'] })
  @IsOptional()
  @IsEnum(['activities', 'invoices', 'dormitory-qr', 'room-fee-invoices'])
  namespace?: StorageNamespace;

  @ApiPropertyOptional({ description: 'Search term for file or token' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class StorageAuditLogQueryDto {
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class StorageAssetParamDto {
  @ApiProperty({ description: 'Opaque asset identifier (UUID or SHA1/SHA256 hex string)' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,128}$/, {
    message: 'Asset ID không hợp lệ',
  })
  assetId: string;
}

export class StoragePurgeDto {
  @ApiPropertyOptional({ description: 'Confirmation token for permanent purge' })
  @IsOptional()
  @IsString()
  confirmationToken?: string;
}
