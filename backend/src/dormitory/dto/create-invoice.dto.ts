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
  loai: string;

  @IsOptional()
  @IsString()
  mo_ta?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  so_tien: number;
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
  ky_thu: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  chi_tiet: InvoiceItemDto[];

  @IsNotEmpty()
  @IsDateString()
  han_thanh_toan: string;

  @IsOptional()
  @IsString()
  ghi_chu?: string;
}

export class PayInvoiceDto {
  @IsNotEmpty()
  @IsEnum(['Tiền mặt', 'Chuyển khoản', 'Cổng thanh toán'])
  phuong_thuc: string;

  @IsOptional()
  @IsString()
  ghi_chu?: string;
}

export class BulkCreateInvoiceDto {
  @IsNotEmpty()
  @IsString()
  ky_thu: string;

  @IsNotEmpty()
  @IsDateString()
  han_thanh_toan: string;
}
