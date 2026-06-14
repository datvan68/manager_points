import { IsOptional, IsString, IsEnum, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryNotificationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(['warning', 'success', 'info', 'system'])
  type?: 'warning' | 'success' | 'info' | 'system';

  @IsOptional()
  @IsEnum(['true', 'false'])
  isRead?: 'true' | 'false';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  recipientUserId?: string;

  @IsOptional()
  @IsEnum(['all', 'student', 'teacher', 'supervisor'])
  targetRole?: 'all' | 'student' | 'teacher' | 'supervisor';
}
