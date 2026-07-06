import { IsMongoId, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddClubMemberDto {
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

export class UpdateClubMemberDto {
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

export class JoinClubDto {
  @ApiProperty({ description: 'Semester ID' })
  @IsMongoId()
  semester_id: string;
}
