import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsEmail,
  IsDateString,
  IsMongoId,
} from 'class-validator';

export class CreateStudentDto {
  @IsNotEmpty()
  @IsString()
  student_code: string;

  @IsNotEmpty()
  @IsString()
  full_name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsNotEmpty()
  @IsDateString()
  date_bir: string;

  @IsNotEmpty()
  @IsEnum(['Male', 'Female', 'Other'])
  sex: string;

  @IsNotEmpty()
  @IsEnum(['Studying', 'Reserved', 'Dropped', 'Graduated', 'Suspended'])
  status: string;

  @IsOptional()
  @IsMongoId()
  class_id?: string;

  @IsOptional()
  @IsMongoId()
  training_point_id?: string;
}
