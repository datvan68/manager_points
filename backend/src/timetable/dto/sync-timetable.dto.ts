import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { QueryTimetableDto } from './query-timetable.dto';

export class TimetableCoverageDto extends QueryTimetableDto {}

export class StartTimetableSyncDto {
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => TimetableCoverageDto)
  coverage!: TimetableCoverageDto[];
}

export class TimetableClassSelectionDto {
  @IsString() year!: string;
  @IsString() semester!: string;
  @IsOptional() @IsString() faculty?: string;
  @IsOptional() @IsString() course?: string;
  @IsString() className!: string;
}

export class TimetableWeekDateDto {
  @IsString() year!: string;
  @IsString() semester!: string;
  @IsString() week!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
}

export class TimetableRollingPolicyDto {
  @IsBoolean() enabled!: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => TimetableWeekDateDto)
  weekDates?: TimetableWeekDateDto[];
}

export class TimetableSettingsDto {
  @IsBoolean() enabled!: boolean;
  @IsInt() @Min(30) @Max(7 * 24 * 60) intervalMinutes!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => TimetableCoverageDto)
  coverage?: TimetableCoverageDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => TimetableClassSelectionDto)
  selectedClasses?: TimetableClassSelectionDto[];
  @IsOptional() @ValidateNested() @Type(() => TimetableRollingPolicyDto)
  rolling?: TimetableRollingPolicyDto;
}

export class TimetableDemandDto extends QueryTimetableDto {
  @IsOptional() @IsBoolean() force?: boolean;
}
