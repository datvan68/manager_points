import {
  IsNotEmpty,
  IsString,
  IsOptional,
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

export class CreateStudentTaskDto {
  @IsNotEmpty({ message: 'Tên nhiệm vụ không được để trống' })
  @IsString()
  title: string;

  @IsNotEmpty({ message: 'Loại nhiệm vụ không được để trống' })
  @IsEnum(StudentTaskType, { message: 'Loại nhiệm vụ không hợp lệ' })
  type: string;

  @IsNotEmpty({ message: 'Môn học/lĩnh vực không được để trống' })
  @IsString()
  subject: string;

  @IsNotEmpty({ message: 'Hạn chót không được để trống' })
  @IsString()
  deadline: string;

  @IsNotEmpty({ message: 'Độ ưu tiên không được để trống' })
  @IsEnum(StudentTaskPriority, { message: 'Độ ưu tiên không hợp lệ' })
  priority: string;

  @IsNotEmpty({ message: 'Trạng thái không được để trống' })
  @IsEnum(StudentTaskStatus, { message: 'Trạng thái không hợp lệ' })
  status: string;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.linkedPage !== '' && o.linkedPage != null)
  @Matches(/^\//, { message: 'Trang liên kết (linkedPage) phải bắt đầu bằng dấu /' })
  linkedPage?: string;

  @IsNotEmpty({ message: 'Đối tượng áp dụng không được để trống' })
  @IsEnum(StudentTaskTargetType, { message: 'Đối tượng áp dụng không hợp lệ' })
  targetType: string;

  @IsNotEmpty({ message: 'Phạm vi không được để trống' })
  @IsEnum(StudentTaskTargetScope, { message: 'Phạm vi áp dụng không hợp lệ' })
  targetScope: string;

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
