import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsMongoId,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AssigneeType } from '../schemas/student-task-progress.schema';
import { StudentTaskStatus } from '../../student-tasks/schemas/student-task.schema';

export enum SortOption {
  NEWEST = 'newest',
  DEADLINE_ASC = 'deadline_asc',
  DEADLINE_DESC = 'deadline_desc',
  STATUS = 'status',
}

export enum OverviewStatusFilter {
  ALL = 'all',
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export enum AssigneeTypeFilter {
  ALL = 'all',
  STUDENT = 'student',
  TEACHER = 'teacher',
  SUPERVISOR = 'supervisor',
}

export class GetProgressOverviewDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsMongoId({ message: 'Mã nhiệm vụ không hợp lệ' })
  taskId?: string;

  @IsOptional()
  @IsEnum(OverviewStatusFilter)
  status?: OverviewStatusFilter;

  @IsOptional()
  @IsEnum(AssigneeTypeFilter)
  assigneeType?: AssigneeTypeFilter;

  @IsOptional()
  @IsMongoId({ message: 'Mã lớp không hợp lệ' })
  classId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(SortOption)
  sort?: SortOption;

  @IsOptional()
  @IsString()
  deadlineFrom?: string;

  @IsOptional()
  @IsString()
  deadlineTo?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive?: boolean;
}
