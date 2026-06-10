import { IsOptional, IsString, IsEnum, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryStudentTaskDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(['all', 'not_started', 'in_progress', 'completed'], {
    message: 'Trạng thái lọc không hợp lệ',
  })
  status?: string; // all | not_started | in_progress | completed

  @IsOptional()
  @IsEnum(['all', 'high', 'medium', 'low'], {
    message: 'Mức độ ưu tiên lọc không hợp lệ',
  })
  priority?: string; // all | high | medium | low

  @IsOptional()
  @IsEnum(['all', 'student', 'teacher', 'supervisor'], {
    message: 'Đối tượng lọc không hợp lệ',
  })
  targetType?: string; // all | student | teacher | supervisor

  @IsOptional()
  @IsEnum(['newest', 'deadline_asc', 'deadline_desc', 'priority_desc'], {
    message: 'Kiểu sắp xếp không hợp lệ',
  })
  sort?: 'newest' | 'deadline_asc' | 'deadline_desc' | 'priority_desc';
}
