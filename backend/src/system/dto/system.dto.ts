import { IsNotEmpty, IsString, IsOptional, IsEnum, IsInt, Min, Max, IsMongoId, IsObject, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class MongoIdParamDto {
  @IsMongoId({ message: 'ID không hợp lệ' })
  id: string;
}

export class GetLoginLogsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100, { message: 'Limit tối đa là 100' })
  limit?: number = 20; // Default limit is 20 as per scope

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsMongoId({ message: 'userId phải là MongoId hợp lệ' })
  userId?: string;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateSystemRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['access', 'data_change', 'support', 'backup', 'other'], {
    message: 'Loại yêu cầu không hợp lệ',
  })
  type: string;

  @IsEnum(['low', 'medium', 'high', 'critical'], {
    message: 'Mức độ ưu tiên không hợp lệ',
  })
  @IsOptional()
  priority?: string = 'medium';

  @IsString()
  @IsOptional()
  related_entity_type?: string;

  @IsString()
  @IsOptional()
  related_entity_id?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateSystemRequestDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['low', 'medium', 'high', 'critical'], {
    message: 'Mức độ ưu tiên không hợp lệ',
  })
  @IsOptional()
  priority?: string;

  @IsMongoId({ message: 'assignee_id phải là MongoId hợp lệ' })
  @IsOptional()
  assignee_id?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateSystemRequestStatusDto {
  @IsEnum(['pending', 'in_progress', 'approved', 'rejected', 'completed', 'cancelled'], {
    message: 'Trạng thái không hợp lệ',
  })
  status: string;

  @IsString()
  @IsNotEmpty({ message: 'Ghi chú quyết định không được để trống' })
  decision_note: string;
}

export class GetSystemRequestsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100, { message: 'Limit tối đa là 100' })
  limit?: number = 20; // Default limit is 20

  @IsOptional()
  @IsEnum(['pending', 'in_progress', 'approved', 'rejected', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsEnum(['access', 'data_change', 'support', 'backup', 'other'])
  type?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  priority?: string;

  @IsOptional()
  @IsMongoId({ message: 'requesterId phải là MongoId hợp lệ' })
  requesterId?: string;

  @IsOptional()
  @IsMongoId({ message: 'assigneeId phải là MongoId hợp lệ' })
  assigneeId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class GetBackupsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100, { message: 'Limit tối đa là 100' })
  limit?: number = 20; // Default limit is 20
}
