import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class DeleteStudentDto {
  @ApiProperty({
    description: 'False returns the redacted impact; true commits the deletion.',
  })
  @IsBoolean()
  confirmed: boolean;
}
