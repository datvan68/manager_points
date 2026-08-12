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
  room_code: string;

  @IsNotEmpty()
  @IsString()
  room_name: string;

  @IsNotEmpty()
  @IsMongoId()
  building_id: string;

  @IsNotEmpty()
  @IsString()
  room_type: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  bed_count: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  room_price: number;

  @IsOptional()
  @IsEnum(['Trống', 'Đầy', 'Khóa', 'Bảo trì'])
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsString()
  description?: string;
}
