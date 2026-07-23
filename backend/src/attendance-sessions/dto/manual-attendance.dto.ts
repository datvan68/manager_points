import { IsMongoId } from 'class-validator';

export class ManualAttendanceDto {
  @IsMongoId()
  student_id: string;
}
