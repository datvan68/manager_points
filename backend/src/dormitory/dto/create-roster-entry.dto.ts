import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { ApplicantProfileDto } from './applicant-profile.dto';

export class CreateRosterEntryDto {
  @IsOptional()
  @IsMongoId()
  student_id?: string;

  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @IsOptional()
  @IsEnum(['Male', 'Female', 'Other'])
  gender?: 'Male' | 'Female' | 'Other';

  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9+().\s-]{8,20}$/)
  phone_number: string;

  @IsOptional()
  @IsString()
  student_code?: string;

  @IsNotEmpty()
  @IsEnum(['Thường', 'Máy lạnh'])
  room_type: 'Thường' | 'Máy lạnh';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ApplicantProfileDto)
  applicant_profile?: ApplicantProfileDto;
}
