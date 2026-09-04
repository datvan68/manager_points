import { ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkDeleteRosterDto {
  @ApiProperty({
    description: 'Danh sách 1-100 ID mục Danh sách KTX cần xoá',
    type: [String],
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
  })
  @IsArray({ message: 'ids phải là một mảng' })
  @ArrayNotEmpty({ message: 'Danh sách ID không được để trống' })
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 mục Danh sách' })
  @ArrayMaxSize(100, { message: 'Tối đa 100 mục Danh sách mỗi lần xoá' })
  @IsString({ each: true, message: 'Mỗi ID phải là chuỗi' })
  ids: string[];
}
