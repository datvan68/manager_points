import {
  IsArray,
  ValidateNested,
  IsNotEmpty,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateAcademicRecordDto } from './create-academic-record.dto';

export class BulkCreateAcademicRecordDto {
  @ApiProperty({
    type: [CreateAcademicRecordDto],
    description: 'Danh sách các ghi nhận rèn luyện cần tạo',
  })
  @IsArray()
  @IsNotEmpty()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CreateAcademicRecordDto)
  records: CreateAcademicRecordDto[];
}
