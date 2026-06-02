import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsMongoId,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ClassType, Headquarters } from '../schemas/class.schema';

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

  @ApiProperty({ description: 'User/Advisor ID reference', required: false })
  @IsOptional()
  @IsMongoId()
  user_id?: string;

  @ApiProperty({ description: 'Class Type', enum: ClassType })
  @IsNotEmpty()
  @IsEnum(ClassType)
  class_type: ClassType;

  @ApiProperty({
    description: 'Headquarters/Campus',
    enum: Headquarters,
    required: false,
  })
  @IsOptional()
  @IsEnum(Headquarters)
  headquarters?: Headquarters;
}
