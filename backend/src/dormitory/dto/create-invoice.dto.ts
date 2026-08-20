import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsMongoId,
  IsDateString,
  IsEnum,
  IsArray,
  ArrayNotEmpty,
  IsBoolean,
  ValidateNested,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UtilityInputDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  previous_reading: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  current_reading: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  quota_per_person: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  unit_price: number;
}

export class CreateMonthlyInvoiceDto {
  @IsNotEmpty()
  @IsMongoId()
  room_id: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'billing_month phải có định dạng YYYY-MM (ví dụ: 2026-03)',
  })
  billing_month: string;

  @IsNotEmpty()
  @IsDateString()
  reading_date: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  occupant_count?: number;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => UtilityInputDto)
  electricity: UtilityInputDto;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => UtilityInputDto)
  water: UtilityInputDto;

  @IsOptional()
  @IsBoolean()
  is_exempt?: boolean;

  @IsOptional()
  @IsDateString()
  payment_start_date?: string;

  @IsNotEmpty()
  @IsDateString()
  due_date: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMonthlyInvoiceDto {
  @IsOptional()
  @IsDateString()
  reading_date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  occupant_count?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => UtilityInputDto)
  electricity?: UtilityInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UtilityInputDto)
  water?: UtilityInputDto;

  @IsOptional()
  @IsBoolean()
  is_exempt?: boolean;

  @IsOptional()
  @IsDateString()
  payment_start_date?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PaymentProofDto {
  @IsNotEmpty()
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  file_name?: string;

  @IsOptional()
  @IsString()
  mime_type?: string;

  @IsOptional()
  @IsNumber()
  size?: number;
}

export class PayInvoiceDto {
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

export class UpdatePaymentProofDto {
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
}

export class ReviewPaymentProofDto {
  @IsNotEmpty()
  @IsEnum(['approved', 'rejected', 'revoked'])
  decision: 'approved' | 'rejected' | 'revoked';

  @IsNotEmpty()
  @IsString()
  @IsUUID()
  request_id: string;
}

export class InvoiceItemDto {
  @IsNotEmpty()
  @IsEnum(['Phí phòng', 'Điện', 'Nước', 'Dịch vụ', 'Phạt vi phạm'])
  type: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;
}

export class CreateInvoiceDto {
  @IsNotEmpty()
  @IsMongoId()
  contract_id: string;

  @IsNotEmpty()
  @IsMongoId()
  student_id: string;

  @IsNotEmpty()
  @IsString()
  billing_period: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @IsNotEmpty()
  @IsDateString()
  due_date: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkCreateInvoiceDto {
  @IsNotEmpty()
  @IsString()
  billing_period: string;

  @IsNotEmpty()
  @IsDateString()
  due_date: string;
}

export class BulkDeleteInvoicesDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Danh sách ID hóa đơn không được rỗng' })
  @IsString({ each: true })
  ids: string[];
}
