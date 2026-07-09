import {
  IsNotEmpty,
  IsMongoId,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateContractDto {
  @IsNotEmpty()
  @IsMongoId()
  student_id: string;

  @IsNotEmpty()
  @IsMongoId()
  bed_id: string;

  @IsNotEmpty()
  @IsMongoId()
  room_id: string;

  @IsOptional()
  @IsMongoId()
  registration_id?: string;

  @IsNotEmpty()
  @IsDateString()
  ngay_bat_dau: string;

  @IsNotEmpty()
  @IsDateString()
  ngay_ket_thuc: string;
}

export class CancelContractDto {
  @IsNotEmpty()
  @IsString()
  ly_do_huy: string;
}
