import { IsEnum, IsNotEmpty } from 'class-validator';
import { StudentTaskStatus } from '../../student-tasks/schemas/student-task.schema';

export class UpdateProgressStatusDto {
  @IsNotEmpty()
  @IsEnum(StudentTaskStatus)
  status: StudentTaskStatus;
}
