import { ArrayMaxSize, IsArray, IsBoolean, IsInt, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { QueryTimetableDto } from './query-timetable.dto';

export class TimetableCoverageDto extends QueryTimetableDto {}

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
