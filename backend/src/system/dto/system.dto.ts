import { IsNotEmpty, IsString, IsOptional, IsEnum, IsInt, Min, Max, IsMongoId, IsObject, IsDateString, IsNumber, IsArray, ValidateNested, IsBoolean, MaxLength, ArrayMaxSize } from 'class-validator';
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

export class GetLoginLogsSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
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

export class ApiBreakdownDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsNumber()
  duration_ms: number;

  @IsOptional()
  @IsNumber()
  status?: number;

  @IsOptional()
  @IsBoolean()
  ok?: boolean;
}

export class CreateSystemPerformanceMetricDto {
  @IsString()
  @IsNotEmpty()
  route: string;

  @IsString()
  @IsEnum(['desktop', 'tablet', 'mobile', 'unknown'])
  device_type: string;

  @IsOptional()
  @IsString()
  network_effective_type?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['navigate', 'reload', 'back_forward', 'prerender', 'unknown'])
  navigation_type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ttfb_ms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  dom_content_loaded_ms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  load_event_ms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fcp_ms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lcp_ms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cls?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  inp_ms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  api_total_ms?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50, { message: 'api_breakdown tối đa 50 item' })
  @ValidateNested({ each: true })
  @Type(() => ApiBreakdownDto)
  api_breakdown?: ApiBreakdownDto[];
}

export class GetPerformanceSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  route?: string;
}

export class GetPerformanceMetricsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  route?: string;
}

export class RestoreBackupImportDto {
  @IsString()
  @IsNotEmpty()
  previewSessionId: string;

  @IsArray()
  @IsString({ each: true })
  collections: string[];

  @IsEnum(['replace_selected_collections', 'merge_upsert'])
  mode: string;

  @IsString()
  @IsNotEmpty()
  confirmationText: string;
}

export class UpdateMailSettingsDto {
  @IsString()
  @IsNotEmpty()
  host: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @IsBoolean()
  secure: boolean;

  @IsString()
  @IsNotEmpty()
  user: string;

  @IsOptional()
  @IsString()
  pass?: string; // Optional, nếu không truyền sẽ giữ nguyên pass cũ

  @IsString()
  @IsNotEmpty()
  from: string;
}

export class SendTestMailDto {
  @IsString()
  @IsNotEmpty()
  to: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateMailSettingsDto)
  config?: UpdateMailSettingsDto; // Optional config để test cấu hình chưa lưu
}
