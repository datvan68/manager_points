import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsMongoId,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateClassDto {
  @ApiProperty({ description: 'Class Name' })
  @IsNotEmpty()
  @IsString()
  class_name: string;

  @ApiProperty({ description: 'Class Academic Year' })
  @IsNotEmpty()
  @IsString()
  class_year: string;

  @ApiProperty({ description: 'Department ID reference' })
  @IsNotEmpty()
  @IsMongoId()
  dept_id: string;

  @ApiProperty({ description: 'Advisor (User) ID reference', required: false })
  @IsOptional()
  @IsMongoId()
  advisor_id?: string;

  @ApiProperty({
    description: 'Loại lớp: Chính quy, CLC...',
    required: false,
  })
  @IsOptional()
  @IsString()
  class_course?: string;

  @ApiProperty({
    description: 'Cơ sở: PH-CSSĐ, PH-CK...',
    required: false,
  })
  @IsOptional()
  @IsString()
  headquarters?: string;
}
