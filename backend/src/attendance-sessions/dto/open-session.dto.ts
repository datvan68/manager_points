import {
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class OpenSessionDto {
  @ApiProperty({
    description: 'Context type',
    enum: ['club', 'activity', 'class', 'event', 'dormitory'],
  })
  @IsEnum(['club', 'activity', 'class', 'event', 'dormitory'])
  context_type: string;

  @ApiProperty({ description: 'Context ID (e.g. activity_id)' })
  @IsMongoId()
  context_id: string;

  @ApiProperty({ description: 'Schedule ID for today\'s activity schedule' })
  @IsMongoId()
  schedule_id: string;

  @ApiProperty({ description: 'Semester ID' })
  @IsMongoId()
  semester_id: string;

  @ApiProperty({
    description: 'Attendance method',
    enum: ['qr', 'proximity'],
  })
  @IsEnum(['qr', 'proximity'])
  method: string;

  // ── QR options ──
  @ApiPropertyOptional({
    description: 'QR refresh interval in seconds',
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(300)
  qr_refresh_interval?: number;

  // ── Proximity options ──
  @ApiPropertyOptional({ description: 'Latitude of session origin' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude of session origin' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Radius in meters',
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(5000)
  radius_meters?: number;

  // ── Settings ──
  @ApiPropertyOptional({ description: 'Allow late check-in', default: false })
  @IsOptional()
  @IsBoolean()
  allow_late_checkin?: boolean;

  @ApiPropertyOptional({ description: 'Auto approve check-ins', default: true })
  @IsOptional()
  @IsBoolean()
  auto_approve?: boolean;

  @ApiPropertyOptional({ description: 'Auto close time (ISO string)' })
  @IsOptional()
  @IsString()
  auto_close_at?: string;

  @ApiPropertyOptional({ description: 'Session title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Session description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Max number of check-ins' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  max_checkins?: number;
}
