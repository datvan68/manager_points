import {
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsDate,
  IsNumber,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RecurrenceDto {
  @ApiProperty({
    description: 'Recurrence type',
    enum: ['weekly', 'biweekly', 'monthly'],
  })
  @IsEnum(['weekly', 'biweekly', 'monthly'])
  type: string;

  @ApiPropertyOptional({ description: 'Day of week (0=Sun, 6=Sat)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6)
  day_of_week?: number;

  @ApiPropertyOptional({ description: 'Recurrence end date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  until?: Date;

  @ApiPropertyOptional({ description: 'Recurrence start date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  start?: Date;

  @ApiPropertyOptional({ description: 'Source week start date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  source_week_start_date?: Date;

  @ApiPropertyOptional({ description: 'Source week end date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  source_week_end_date?: Date;
}

export class CreateScheduleDto {
  @ApiProperty({ description: 'Club ID' })
  @IsMongoId()
  club_id: string;

  @ApiPropertyOptional({ description: 'Activity ID' })
  @IsOptional()
  @IsMongoId()
  activity_id?: string;

  @ApiProperty({ description: 'Session title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Session description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Schedule type',
    enum: ['regular', 'event', 'exam', 'meeting'],
  })
  @IsOptional()
  @IsEnum(['regular', 'event', 'exam', 'meeting'])
  schedule_type?: string;

  @ApiPropertyOptional({ description: 'Location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ description: 'Start time' })
  @Type(() => Date)
  @IsDate()
  start_time: Date;

  @ApiProperty({ description: 'End time' })
  @Type(() => Date)
  @IsDate()
  end_time: Date;

  @ApiPropertyOptional({ description: 'Recurrence settings' })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceDto)
  recurrence?: RecurrenceDto;

  @ApiProperty({ description: 'Semester ID' })
  @IsMongoId()
  semester_id: string;

  @ApiPropertyOptional({ description: 'Instructor user ID' })
  @IsOptional()
  @IsMongoId()
  instructor_id?: string;

  @ApiPropertyOptional({ description: 'Maximum attendees' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_attendees?: number;
}
