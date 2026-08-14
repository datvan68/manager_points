import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicantProfileDto } from './applicant-profile.dto';

/**
 * DTO for public (unauthenticated) KTX registration via QR scan.
 * Minimal info — no CCCD required.
 */
export class PublicRegisterDto {
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  @IsString()
  full_name: string;

  @IsNotEmpty({ message: 'Vui lòng nhập số điện thoại' })
  @IsString()
  phone_number: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ApplicantProfileDto)
  applicant_profile?: ApplicantProfileDto;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  @IsOptional()
  @IsString()
  student_code?: string;

  @IsOptional()
  @IsString()
  qr_room_id?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh không hợp lệ' })
  date_of_birth?: string;

  @IsOptional()
  @IsEnum(['Male', 'Female', 'Other'], { message: 'Giới tính không hợp lệ' })
  gender?: 'Male' | 'Female' | 'Other';

  @IsOptional()
  @IsEnum(['Thường', 'Máy lạnh'], { message: 'Loại phòng không hợp lệ' })
  room_type?: 'Thường' | 'Máy lạnh';

  @IsOptional()
  @IsString()
  semester?: string;

  @IsOptional()
  @IsString()
  academic_year?: string;

  @IsOptional()
  @IsEnum(['Chính sách', 'Xa nhà', 'Học lực giỏi', 'Không'])
  priority_group?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
