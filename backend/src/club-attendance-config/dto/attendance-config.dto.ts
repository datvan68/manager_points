import {
  IsOptional,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';

export class CreateAttendanceConfigDto {
  @ApiPropertyOptional({ description: 'Club ID (null for default config)' })
  @IsOptional()
  @IsMongoId()
  club_id?: string;

  @ApiProperty({ description: 'Semester ID' })
  @IsMongoId()
  semester_id: string;

  @ApiProperty({ description: 'Training point criterion ID' })
  @IsMongoId()
  criterion_id: string;

  @ApiProperty({ description: 'Points per attendance (present)', default: 0.5 })
  @IsNumber()
  @Min(0)
  point_per_attendance: number;

  @ApiPropertyOptional({
    description: 'Points per late attendance',
    default: 0.25,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  point_per_late?: number;

  @ApiPropertyOptional({ description: 'Maximum points per semester' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  max_points_per_semester?: number;

  @ApiPropertyOptional({
    description: 'Minimum attendances to earn points',
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  min_attendance_for_points?: number;

  @ApiPropertyOptional({
    description: 'Auto-sync on attendance approval',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  auto_sync_on_approve?: boolean;

  @ApiPropertyOptional({
    description: 'Require all sessions approved before sync',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  require_all_approved?: boolean;
}

export class UpdateAttendanceConfigDto extends PartialType(
  CreateAttendanceConfigDto,
) {
  @ApiPropertyOptional({
    description: 'Config status',
    enum: ['active', 'inactive'],
  })
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;
}
