import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsMongoId,
} from 'class-validator';

export class ApproveRegistrationDto {
  @IsNotEmpty()
  @IsEnum(['Đã duyệt', 'Từ chối'])
  status: string;

  @IsOptional()
  @IsString()
  rejection_reason?: string;
}

export class BulkApproveRegistrationDto {
  @IsNotEmpty()
  @IsArray()
  @IsMongoId({ each: true })
  registration_ids: string[];

  @IsNotEmpty()
  @IsEnum(['Đã duyệt', 'Từ chối'])
  status: string;

  @IsOptional()
  @IsString()
  rejection_reason?: string;
}
