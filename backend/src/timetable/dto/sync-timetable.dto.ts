import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
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
  @IsOptional() @IsInt() @Min(1) @Max(100) weekCount?: number;
  @IsOptional() @IsString() derivedFromSystemClassId?: string;
}

export class TimetableClassLinkDto extends TimetableClassSelectionDto {
  @IsString() @IsNotEmpty() systemClassId!: string;
  @IsString() @IsNotEmpty() sourceLabel!: string;
  @IsIn(['auto', 'manual']) matchMethod!: 'auto' | 'manual';
}

export class SavedTimetableClassSyncDto extends TimetableClassSelectionDto {}

export class SavedTimetableWeekSyncDto extends TimetableClassSelectionDto {
  @IsString() week!: string;
  @IsOptional() @IsIn(['sync', 'update']) intent?: 'sync' | 'update';
}

export class BulkTimetableWeekSyncItemDto extends TimetableClassLinkDto {
  @IsString() @IsNotEmpty() week!: string;
}

export class BulkTimetableWeekSyncDto {
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => BulkTimetableWeekSyncItemDto)
  selections!: BulkTimetableWeekSyncItemDto[];
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

export class TimetableSourcePeriodDto {
  @IsString() @IsNotEmpty() year!: string;
  @IsString() @IsNotEmpty() semester!: string;
}

export class TimetableSettingsDto {
  @IsBoolean() enabled!: boolean;
  @IsInt() @Min(30) @Max(7 * 24 * 60) intervalMinutes!: number;
  @IsOptional() @ValidateNested() @Type(() => TimetableSourcePeriodDto)
  sourcePeriod?: TimetableSourcePeriodDto;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => TimetableCoverageDto)
  coverage?: TimetableCoverageDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => TimetableClassSelectionDto)
  selectedClasses?: TimetableClassSelectionDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => TimetableClassLinkDto)
  classLinks?: TimetableClassLinkDto[];
  @IsOptional() @ValidateNested() @Type(() => TimetableRollingPolicyDto)
  rolling?: TimetableRollingPolicyDto;
}

export class TimetableDemandDto extends QueryTimetableDto {
  @IsOptional() @IsBoolean() force?: boolean;
}
