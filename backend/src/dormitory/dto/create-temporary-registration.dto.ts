import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicantProfileDto } from './applicant-profile.dto';

export class CreateTemporaryRegistrationDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/\S/, { message: 'Vui lòng nhập họ tên hợp lệ' })
  full_name: string;

  @IsNotEmpty()
  @IsDateString()
  date_of_birth: string;

  @IsNotEmpty()
  @IsEnum(['Male', 'Female', 'Other'])
  gender: 'Male' | 'Female' | 'Other';

  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9+().\s-]{8,20}$/, { message: 'Số điện thoại không hợp lệ' })
  phone_number: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ApplicantProfileDto)
  applicant_profile?: ApplicantProfileDto;

  @IsOptional()
  @IsEnum(['Thường', 'Máy lạnh'])
  room_type?: 'Thường' | 'Máy lạnh';

  @IsOptional()
  @IsString()
  notes?: string;
}
