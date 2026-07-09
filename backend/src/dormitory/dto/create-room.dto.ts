import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsMongoId,
  IsArray,
  Min,
} from 'class-validator';

export class CreateRoomDto {
  @IsNotEmpty()
  @IsString()
  ma_phong: string;

  @IsNotEmpty()
  @IsMongoId()
  building_id: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  tang: number;

  @IsNotEmpty()
  @IsString()
  loai_phong: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  so_giuong: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  gia_phong: number;

  @IsOptional()
  @IsEnum(['Trống', 'Đầy', 'Khóa', 'Bảo trì'])
  trang_thai?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tien_ich?: string[];

  @IsOptional()
  @IsString()
  mo_ta?: string;
}
