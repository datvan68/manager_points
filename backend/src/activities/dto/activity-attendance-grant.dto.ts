import { ArrayNotEmpty, ArrayUnique, IsArray, IsEnum, IsMongoId } from 'class-validator';

export class UpsertActivityAttendanceGrantDto {
  @IsMongoId()
  teacher_id: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(['qr', 'proximity', 'manual_class'], { each: true })
  allowed_methods: Array<'qr' | 'proximity' | 'manual_class'>;
}
