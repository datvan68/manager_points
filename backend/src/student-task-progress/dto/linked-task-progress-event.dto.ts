import { IsNotEmpty, IsOptional, IsString, IsObject, IsMongoId, IsIn, Matches, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsString()
  assigneeStudentId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class BulkLinkedTaskProgressEventItemDto {
  @IsOptional()
  @IsString()
  assigneeStudentId?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class BulkLinkedTaskProgressEventDto {
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkLinkedTaskProgressEventItemDto)
  items: BulkLinkedTaskProgressEventItemDto[];
}
