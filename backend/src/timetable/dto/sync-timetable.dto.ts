import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TimetableCoverageDto {
  @IsString() year!: string;
  @IsString() semester!: string;
  @IsString() week!: string;
  @IsOptional() @IsString() faculty?: string;
  @IsOptional() @IsString() course?: string;
  @IsOptional() @IsString() className?: string;
}

export class StartTimetableSyncDto {
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => TimetableCoverageDto)
  coverage!: TimetableCoverageDto[];
}

export class TimetableSettingsDto {
  @IsBoolean() enabled!: boolean;
  @IsInt() @Min(30) @Max(7 * 24 * 60) intervalMinutes!: number;
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => TimetableCoverageDto)
  coverage!: TimetableCoverageDto[];
}
