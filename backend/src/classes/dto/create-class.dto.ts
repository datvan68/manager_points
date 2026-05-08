
import { IsNotEmpty, IsString, IsOptional, IsMongoId } from 'class-validator';

export class CreateClassDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  year: string;

  @IsOptional()
  @IsMongoId()
  departmentId?: string;
}
