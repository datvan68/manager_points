import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

class NguyenVongDto {
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

export class CreateRegistrationDto {
  @IsNotEmpty()
  @IsMongoId()
  student_id: string;

  @IsNotEmpty()
  @IsString()
  semester: string;

  @IsNotEmpty()
  @IsString()
  academic_year: string;

  @IsNotEmpty()
  @IsDateString()
  date_of_birth: string;

  @IsNotEmpty()
  @IsEnum(['Male', 'Female', 'Other'])
  gender: 'Male' | 'Female' | 'Other';

  @IsNotEmpty()
  @IsString()
  phone_number: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NguyenVongDto)
  preference?: NguyenVongDto;

  @IsOptional()
  @IsEnum(['Chính sách', 'Xa nhà', 'Học lực giỏi', 'Khó khăn', 'Không'])
  priority_group?: string;
}
