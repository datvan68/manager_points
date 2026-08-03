import {
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsDate,
  IsDateString,
  ValidateNested,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateAttendanceDto {
  @ApiProperty({ description: 'Activity ID' })
  @IsMongoId()
  activity_id: string;

  @ApiProperty({ description: 'Schedule session ID' })
  @IsMongoId()
  schedule_id: string;

  @ApiProperty({ description: 'Student ID' })
  @IsMongoId()
  student_id: string;

  @ApiProperty({ description: 'Semester ID' })
  @IsMongoId()
  semester_id: string;

  @ApiProperty({
    description: 'Attendance status',
    enum: ['present', 'absent', 'late', 'excused'],
  })
  @IsEnum(['present', 'absent', 'late', 'excused'])
  status: string;

  @ApiPropertyOptional({ description: 'Check-in time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  check_in_time?: Date;

  @ApiPropertyOptional({ description: 'Note' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class AttendanceEntryDto {
  @ApiProperty({ description: 'Student ID' })
  @IsMongoId()
  student_id: string;

  @ApiProperty({
    description: 'Attendance status',
    enum: ['present', 'absent', 'late', 'excused'],
  })
  @IsEnum(['present', 'absent', 'late', 'excused'])
  status: string;

  @ApiPropertyOptional({ description: 'Note' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class BatchAttendanceDto {
  @ApiProperty({ description: 'Activity ID' })
  @IsMongoId()
  activity_id: string;

  @ApiProperty({ description: 'Schedule session ID' })
  @IsMongoId()
  schedule_id: string;

  @ApiProperty({ description: 'Semester ID' })
  @IsMongoId()
  semester_id: string;

  @ApiProperty({
    description: 'Attendance entries',
    type: [AttendanceEntryDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  entries: AttendanceEntryDto[];
}

export class ApproveAttendanceDto {
  @ApiProperty({
    description: 'Approval decision',
    enum: ['approved', 'rejected'],
  })
  @IsEnum(['approved', 'rejected'])
  status: string;

  @ApiPropertyOptional({ description: 'Rejection reason' })
  @IsOptional()
  @IsString()
  rejection_reason?: string;
}

export class BatchApproveDto {
  @ApiProperty({ description: 'Attendance IDs to approve' })
  @IsArray()
  @IsMongoId({ each: true })
  ids: string[];
}

export class QueryAttendanceDto {
  @ApiPropertyOptional({ description: 'Search activity, student, schedule, or class names/codes' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Recorded date lower bound (inclusive), ISO date' })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({ description: 'Recorded date upper bound (inclusive), ISO date' })
  @IsOptional()
  @IsDateString()
  end_date?: string;
  @ApiPropertyOptional({ description: 'Filter by activity ID' })
  @IsOptional()
  @IsMongoId()
  activity_id?: string;

  @ApiPropertyOptional({ description: 'Filter by schedule ID' })
  @IsOptional()
  @IsMongoId()
  schedule_id?: string;

  @ApiPropertyOptional({ description: 'Filter by student ID' })
  @IsOptional()
  @IsMongoId()
  student_id?: string;

  @ApiPropertyOptional({ description: 'Filter by semester ID' })
  @IsOptional()
  @IsMongoId()
  semester_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by approval status',
    enum: ['pending', 'approved', 'rejected'],
  })
  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected'])
  approval_status?: string;

  @ApiPropertyOptional({
    description: 'Filter by attendance status',
    enum: ['present', 'absent', 'late', 'excused'],
  })
  @IsOptional()
  @IsEnum(['present', 'absent', 'late', 'excused'])
  status?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
