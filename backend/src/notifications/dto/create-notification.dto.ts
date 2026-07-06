import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
} from 'class-validator';

export class CreateNotificationDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsEnum(['warning', 'success', 'info', 'system'])
  type?: 'warning' | 'success' | 'info' | 'system';

  @IsOptional()
  @IsString()
  routeUrl?: string;

  @IsOptional()
  @IsString()
  recipientUserId?: string;

  @IsOptional()
  @IsEnum(['all', 'student', 'teacher', 'supervisor'])
  targetRole?: 'all' | 'student' | 'teacher' | 'supervisor';

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
