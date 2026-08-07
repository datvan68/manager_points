import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsMongoId,
  IsDateString,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class InvoiceItemDto {
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

export class PayInvoiceDto {
  @IsNotEmpty()
  @IsEnum(['Tiền mặt', 'Chuyển khoản', 'Cổng thanh toán'])
  payment_method: string;

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
