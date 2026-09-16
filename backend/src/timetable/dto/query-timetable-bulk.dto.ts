import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { QueryTimetableDto } from './query-timetable.dto';

export class QueryTimetableBulkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QueryTimetableDto)
  selections!: QueryTimetableDto[];
}
