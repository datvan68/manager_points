import { IsOptional, IsString, IsNumber, IsEnum, Min } from 'class-validator';

export class QueryDormitoryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  building_id?: string;

  @IsOptional()
  @IsString()
  room_id?: string;

  @IsOptional()
  @IsString()
  student_id?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  semester?: string;

  @IsOptional()
  @IsString()
  academic_year?: string;
}
