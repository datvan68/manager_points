import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDateString,
  IsString,
  IsEnum,
  IsBoolean,
  Matches,
  Max,
  Min,
  ValidateNested,
  IsArray,
  IsIn,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransferQrImageDto } from './utility-config.dto';
import { PaymentProofDto } from './create-invoice.dto';

export class UpdateRoomFeeConfigDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  standard_monthly_rate: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  air_conditioned_monthly_rate: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(36)
  months_to_collect: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TransferQrImageDto)
  transfer_qr_image?: TransferQrImageDto;

  @IsOptional()
  @IsBoolean()
  clear_qr?: boolean;
}

export class PreviewRoomFeePeriodDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'start_month phải có định dạng YYYY-MM (ví dụ: 2026-03)',
  })
  start_month: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(36)
  months_count?: number;

  @IsOptional()
  @IsDateString()
  due_date?: string;
}

export class CreateRoomFeePeriodDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'start_month phải có định dạng YYYY-MM (ví dụ: 2026-03)',
  })
  start_month: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(36)
  months_count?: number;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PreviewIndividualRoomFeeDto {
  @IsNotEmpty()
  @IsString()
  roster_entry_id: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'start_month phải có định dạng YYYY-MM (ví dụ: 2026-03)',
  })
  start_month: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(36)
  months_count?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthly_rate?: number;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateIndividualRoomFeeDto {
  @IsNotEmpty()
  @IsString()
  roster_entry_id: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'start_month phải có định dạng YYYY-MM (ví dụ: 2026-03)',
  })
  start_month: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(36)
  months_count: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  monthly_rate: number;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PayRoomFeeInvoiceDto {
  @IsNotEmpty()
  @IsEnum(['Tiền mặt', 'Chuyển khoản', 'Cổng thanh toán'])
  payment_method: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentProofDto)
  payment_proof?: PaymentProofDto;

  @IsOptional()
  @IsString()
  proof_url?: string;
}

export class UpdateRoomFeeProofDto {
  @IsOptional()
  @IsEnum(['Tiền mặt', 'Chuyển khoản', 'Cổng thanh toán'])
  payment_method?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentProofDto)
  payment_proof?: PaymentProofDto;

  @IsOptional()
  @IsString()
  proof_url?: string;

  @IsOptional()
  @IsBoolean()
  clear_proof?: boolean;
}

export class ReviewRoomFeeProofDto {
  @IsNotEmpty()
  @IsIn(['approved', 'rejected', 'revoked'])
  decision: 'approved' | 'rejected' | 'revoked';

  @IsOptional()
  @IsString()
  request_id?: string;
}

export class BulkReviewRoomFeeProofDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];

  @IsNotEmpty()
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  @IsNotEmpty()
  @IsString()
  request_id: string;
}

export class BulkDeleteRoomFeeInvoicesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];
}

export class QueryRoomFeeInvoiceDto {
  @IsOptional()
  @IsString()
  room_id?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  start_month?: string;

  @IsOptional()
  @IsString()
  end_month?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: string | number;

  @IsOptional()
  limit?: string | number;
}
