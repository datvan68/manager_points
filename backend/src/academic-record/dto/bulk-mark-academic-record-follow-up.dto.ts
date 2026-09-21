import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class BulkMarkAcademicRecordFollowUpDto {
  @ApiProperty({ description: 'Học kỳ áp dụng cho thao tác xử lý hàng loạt' })
  @IsMongoId()
  semesterId: string;

  @ApiProperty({ type: [String], description: 'Danh sách sinh viên cần đánh dấu đã xử lý' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsMongoId({ each: true })
  studentIds: string[];

  @ApiPropertyOptional({ description: 'Ghi chú chung cho các sinh viên xử lý thành công' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
