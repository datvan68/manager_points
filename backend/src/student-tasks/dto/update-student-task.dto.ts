import {
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
  Matches,
  ValidateIf,
} from 'class-validator';
import {
  StudentTaskType,
  StudentTaskPriority,
  StudentTaskStatus,
  StudentTaskTargetType,
  StudentTaskTargetScope,
} from '../schemas/student-task.schema';

export class UpdateStudentTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(StudentTaskType, { message: 'Loại nhiệm vụ không hợp lệ' })
  type?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsEnum(StudentTaskPriority, { message: 'Độ ưu tiên không hợp lệ' })
  priority?: string;

  @IsOptional()
  @IsEnum(StudentTaskStatus, { message: 'Trạng thái không hợp lệ' })
  status?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.linkedPage !== '' && o.linkedPage != null)
  @Matches(/^\//, { message: 'Trang liên kết (linkedPage) phải bắt đầu bằng dấu /' })
  linkedPage?: string;

  @IsOptional()
  @IsEnum(StudentTaskTargetType, { message: 'Đối tượng áp dụng không hợp lệ' })
  targetType?: string;

  @IsOptional()
  @IsEnum(StudentTaskTargetScope, { message: 'Phạm vi áp dụng không hợp lệ' })
  targetScope?: string;

  @IsOptional()
  @IsString()
  targetDetail?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetStudentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetClassIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetTeacherIds?: string[];
}
