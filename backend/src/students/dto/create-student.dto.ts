
import { IsNotEmpty, IsString, IsEnum, IsOptional, IsEmail, IsDateString, IsMongoId } from 'class-validator';

export class CreateStudentDto {
  @IsNotEmpty()
  @IsString()
  studentId: string;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsDateString()
  dob: string;

  @IsNotEmpty()
  @IsEnum(['Male', 'Female', 'Other'])
  gender: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsMongoId()
  classId?: string;

  @IsOptional()
  @IsString()
  course?: string;

  @IsNotEmpty()
  @IsEnum(['Studying', 'Reserved', 'Dropped', 'Graduated', 'Suspended'])
  status: string;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;
}
