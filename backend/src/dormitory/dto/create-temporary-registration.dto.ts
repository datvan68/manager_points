import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateTemporaryRegistrationDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/\S/, { message: 'Vui lòng nhập họ tên hợp lệ' })
  ho_ten: string;

  @IsNotEmpty()
  @IsDateString()
  ngay_sinh: string;

  @IsNotEmpty()
  @IsEnum(['Male', 'Female', 'Other'])
  gioi_tinh: 'Male' | 'Female' | 'Other';

  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9+().\s-]{8,20}$/, { message: 'Số điện thoại không hợp lệ' })
  so_dien_thoai: string;

  @IsOptional()
  @IsEnum(['Thường', 'Máy lạnh'])
  loai_phong?: 'Thường' | 'Máy lạnh';

  @IsOptional()
  @IsString()
  ghi_chu?: string;
}
