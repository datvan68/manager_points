import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class PurgeAcademicRecordsDto {
  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ example: '2026-01-31' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;
}
