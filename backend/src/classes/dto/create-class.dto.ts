import { IsNotEmpty, IsString, IsOptional, IsMongoId, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateClassDto {
  @ApiProperty({ description: 'Class custom string ID' })
  @IsNotEmpty()
  @IsString()
  id: string;

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

  @ApiProperty({ description: 'User/Advisor ID reference', required: false })
  @IsOptional()
  @IsMongoId()
  user_id?: string;

  @ApiProperty({ description: 'Class Courses List', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  class_courses?: string[];
}
