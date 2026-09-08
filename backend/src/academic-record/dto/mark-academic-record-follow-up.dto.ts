import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkAcademicRecordFollowUpDto {
  @ApiPropertyOptional({ description: 'Ghi chú nội bộ của lần xử lý' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
