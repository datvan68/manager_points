import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsMongoId,
  IsDate,
  ValidateNested,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ClubSettingsDto {
  @ApiPropertyOptional({
    description: 'Allow students to self-register',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  allow_self_registration?: boolean;

  @ApiPropertyOptional({
    description: 'Require approval for registration',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  require_approval?: boolean;

  @ApiPropertyOptional({
    description: 'Enable training points from attendance',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  attendance_point_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Points awarded per attendance',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  point_per_attendance?: number;

  @ApiPropertyOptional({
    description: 'Criterion ID for training point mapping',
  })
  @IsOptional()
  @IsMongoId()
  criterion_id?: string;
}

export class CreateClubDto {
  @ApiProperty({ description: 'Club name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Unique club code (auto uppercase)' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'Default classroom or activity room' })
  @IsString()
  @IsNotEmpty()
  classroom: string;

  @ApiPropertyOptional({ description: 'Club description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Club category',
    enum: ['academic', 'sports', 'art', 'volunteer', 'technology', 'other'],
  })
  @IsEnum(['academic', 'sports', 'art', 'volunteer', 'technology', 'other'])
  category: string;

  @ApiPropertyOptional({ description: 'Logo URL' })
  @IsOptional()
  @IsString()
  logo_url?: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsString()
  cover_url?: string;

  @ApiProperty({ description: 'Advisor (teacher) user ID' })
  @IsMongoId()
  advisor_id: string;

  @ApiPropertyOptional({ description: 'President (student) ID' })
  @IsOptional()
  @IsMongoId()
  president_id?: string;

  @ApiPropertyOptional({ description: 'Vice president student IDs' })
  @IsOptional()
  @IsMongoId({ each: true })
  vice_president_ids?: string[];

  @ApiPropertyOptional({ description: 'Maximum number of members' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_members?: number;

  @ApiPropertyOptional({ description: 'Founded date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  founded_date?: Date;

  @ApiPropertyOptional({ description: 'Activity start date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  activity_start_date?: Date;

  @ApiPropertyOptional({ description: 'Activity end date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  activity_end_date?: Date;

  @ApiPropertyOptional({ description: 'Semester ID' })
  @IsOptional()
  @IsMongoId()
  semester_id?: string;

  @ApiPropertyOptional({ description: 'Club settings' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClubSettingsDto)
  settings?: ClubSettingsDto;
}
