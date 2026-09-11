import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class QueryTimetableDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  year!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  semester!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  week!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  faculty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  course?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  className?: string;
}
