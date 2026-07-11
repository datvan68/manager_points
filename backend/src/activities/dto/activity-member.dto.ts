import { IsMongoId, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddActivityMemberDto {
  @ApiProperty({ description: 'Student ID' })
  @IsMongoId()
  student_id: string;

  @ApiPropertyOptional({
    description: 'Member role in club',
    enum: ['member', 'president', 'vice_president', 'secretary', 'treasurer'],
  })
  @IsOptional()
  @IsEnum(['member', 'president', 'vice_president', 'secretary', 'treasurer'])
  role?: string;

  @ApiProperty({ description: 'Semester ID' })
  @IsMongoId()
  semester_id: string;
}

export class UpdateActivityMemberDto {
  @ApiPropertyOptional({
    description: 'Member role in club',
    enum: ['member', 'president', 'vice_president', 'secretary', 'treasurer'],
  })
  @IsOptional()
  @IsEnum(['member', 'president', 'vice_president', 'secretary', 'treasurer'])
  role?: string;

  @ApiPropertyOptional({
    description: 'Member status',
    enum: ['active', 'inactive', 'left'],
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'left'])
  status?: string;
}

export class ApproveMemberDto {
  @ApiProperty({
    description: 'Approval decision',
    enum: ['active', 'rejected'],
  })
  @IsEnum(['active', 'rejected'])
  status: string;

  @ApiPropertyOptional({ description: 'Rejection reason' })
  @IsOptional()
  @IsString()
  rejection_reason?: string;
}

export class JoinActivityDto {
  @ApiProperty({ description: 'Semester ID' })
  @IsMongoId()
  semester_id: string;
}

export class SwitchActivityDto {
  @ApiProperty({ description: 'Semester ID' })
  @IsMongoId()
  semester_id: string;
}

export class LeaveActivityDto {
  @ApiProperty({ description: 'Semester ID' })
  @IsMongoId()
  semester_id: string;
}

export class AdminTransferActivityDto {
  @ApiProperty({ description: 'Student ID' })
  @IsMongoId()
  student_id: string;

  @ApiProperty({ description: 'Semester ID' })
  @IsMongoId()
  semester_id: string;
}
