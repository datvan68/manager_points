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
  trang_thai: string;

  @IsOptional()
  @IsString()
  ly_do_tu_choi?: string;
}

export class BulkApproveRegistrationDto {
  @IsNotEmpty()
  @IsArray()
  @IsMongoId({ each: true })
  registration_ids: string[];

  @IsNotEmpty()
  @IsEnum(['Đã duyệt', 'Từ chối'])
  trang_thai: string;

  @IsOptional()
  @IsString()
  ly_do_tu_choi?: string;
}
