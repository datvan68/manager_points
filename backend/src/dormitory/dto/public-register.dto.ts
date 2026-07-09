import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
} from 'class-validator';

/**
 * DTO for public (unauthenticated) KTX registration via QR scan.
 * Minimal info — no CCCD required.
 */
export class PublicRegisterDto {
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  @IsString()
  ho_ten: string;

  @IsNotEmpty({ message: 'Vui lòng nhập số điện thoại' })
  @IsString()
  so_dien_thoai: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  @IsOptional()
  @IsString()
  ma_sinh_vien?: string;

  @IsNotEmpty({ message: 'Thiếu mã phòng QR' })
  @IsString()
  qr_room_id: string;

  @IsOptional()
  @IsString()
  ky_hoc?: string;

  @IsOptional()
  @IsString()
  nam_hoc?: string;

  @IsOptional()
  @IsEnum(['Chính sách', 'Xa nhà', 'Học lực giỏi', 'Không'])
  doi_tuong_uu_tien?: string;

  @IsOptional()
  @IsString()
  ghi_chu?: string;
}
