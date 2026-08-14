import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicantProfileDto } from './applicant-profile.dto';

class UpdateRegistrationPreferenceDto {
  @IsOptional()
  @IsString()
  room_type?: string;

  @IsOptional()
  @IsMongoId()
  building_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRegistrationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  semester?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  academic_year?: string;

  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @IsOptional()
  @IsEnum(['Male', 'Female', 'Other'])
  gender?: 'Male' | 'Female' | 'Other';

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+().\s-]{8,20}$/, { message: 'Số điện thoại không hợp lệ' })
  phone_number?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ApplicantProfileDto)
  applicant_profile?: ApplicantProfileDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateRegistrationPreferenceDto)
  preference?: UpdateRegistrationPreferenceDto;

  @IsOptional()
  @IsEnum(['Chính sách', 'Xa nhà', 'Học lực giỏi', 'Khó khăn', 'Không'])
  priority_group?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  full_name?: string;

  @IsOptional()
  @IsString()
  student_code?: string;

  @IsOptional()
  @IsEnum(['Thường', 'Máy lạnh'])
  room_type?: 'Thường' | 'Máy lạnh';

  @IsOptional()
  @IsString()
  notes?: string;
}
