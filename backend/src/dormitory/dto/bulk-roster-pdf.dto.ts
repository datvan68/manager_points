import { ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, ArrayUnique, IsArray, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkRosterPdfDto {
  @ApiProperty({
    description: 'Danh sách 1-100 ObjectId của các mục Danh sách KTX cần xuất PDF',
    type: [String],
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
  })
  @IsArray({ message: 'ids phải là một mảng' })
  @ArrayNotEmpty({ message: 'Danh sách ID không được để trống' })
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 mục Danh sách' })
  @ArrayMaxSize(100, { message: 'Tối đa 100 mục Danh sách mỗi lần xuất PDF' })
  @ArrayUnique({ message: 'Danh sách ID không được chứa phần tử trùng lặp' })
  @IsMongoId({ each: true, message: 'Mỗi ID phải là một Mongo ObjectId hợp lệ' })
  ids: string[];
}
