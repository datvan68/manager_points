import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class QueryTimetableSnapshotsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() @MaxLength(80) year?: string;
  @IsOptional() @IsString() @MaxLength(30) semester?: string;
  @IsOptional() @IsString() @MaxLength(30) week?: string;
  @IsOptional() @IsString() @MaxLength(120) faculty?: string;
  @IsOptional() @IsString() @MaxLength(120) course?: string;
  @IsOptional() @IsString() @MaxLength(120) className?: string;
}
