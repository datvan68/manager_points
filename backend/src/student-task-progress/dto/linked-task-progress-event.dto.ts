import { IsNotEmpty, IsOptional, IsString, IsObject, IsMongoId, IsIn, Matches } from 'class-validator';

export class LinkedTaskProgressEventDto {
  @IsNotEmpty()
  @IsMongoId()
  taskId: string;

  @IsNotEmpty()
  @IsIn(['started', 'completed', 'reset'])
  event: 'started' | 'completed' | 'reset';

  @IsOptional()
  @IsString()
  @Matches(/^\//)
  linkedPage?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
