import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsMongoId,
  IsEnum,
  IsArray,
} from 'class-validator';

export class CreateMaintenanceDto {
  @IsNotEmpty()
  @IsMongoId()
  room_id: string;

  @IsOptional()
  @IsMongoId()
  student_id?: string;

  @IsNotEmpty()
  @IsEnum(['Điện', 'Nước', 'Thiết bị', 'Cơ sở vật chất', 'Khác'])
  loai_su_co: string;

  @IsNotEmpty()
  @IsString()
  mo_ta: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hinh_anh?: string[];

  @IsOptional()
  @IsEnum(['Thấp', 'Trung bình', 'Cao', 'Khẩn cấp'])
  do_uu_tien?: string;
}

export class HandleMaintenanceDto {
  @IsOptional()
  @IsMongoId()
  ky_thuat_vien_id?: string;

  @IsOptional()
  @IsEnum(['Mới', 'Đang xử lý', 'Hoàn tất', 'Từ chối'])
  trang_thai?: string;

  @IsOptional()
  @IsString()
  ghi_chu_xu_ly?: string;
}
