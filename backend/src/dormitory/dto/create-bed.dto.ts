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
  bed_code: string;

  @IsNotEmpty()
  @IsMongoId()
  room_id: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsEnum(['Trống', 'Đang sử dụng', 'Bảo trì', 'Đã nghỉ'])
  status?: string;
}
