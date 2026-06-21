import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';

export class UpdateNotificationDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['warning', 'success', 'info', 'system'])
  type?: 'warning' | 'success' | 'info' | 'system';

  @IsOptional()
  @IsString()
  routeUrl?: string;

  @IsOptional()
  @IsEnum(['all', 'student', 'teacher', 'supervisor'])
  targetRole?: 'all' | 'student' | 'teacher' | 'supervisor';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
