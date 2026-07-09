import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
} from 'class-validator';

export class CreateBedDto {
  @IsNotEmpty()
  @IsString()
  ma_giuong: string;

  @IsNotEmpty()
  @IsMongoId()
  room_id: string;

  @IsOptional()
  @IsString()
  vi_tri?: string;

  @IsOptional()
  @IsEnum(['Trống', 'Đang sử dụng', 'Bảo trì'])
  trang_thai?: string;
}
