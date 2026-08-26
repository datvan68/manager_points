import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsMongoId } from 'class-validator';

export class BulkDeleteAcademicRecordDto {
  @ApiProperty({ type: [String], description: 'Danh sách ID ghi nhận cần xoá' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  ids: string[];
}
