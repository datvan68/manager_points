import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateDepartmentDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;
}
