import { IsNotEmpty, IsString, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSemesterDto {
  @ApiProperty({ example: 'Học kỳ 1 - 2025-2026', description: 'Tên học kỳ' })
  @IsNotEmpty()
  @IsString()
  semester_name: string;

  @ApiProperty({ example: '2025-09-01T00:00:00.000Z', description: 'Ngày bắt đầu học kỳ' })
  @IsNotEmpty()
  @IsDateString()
  start_date: string;

  @ApiProperty({ example: '2026-01-31T23:59:59.000Z', description: 'Ngày kết thúc học kỳ' })
  @IsNotEmpty()
  @IsDateString()
  end_date: string;

  @ApiProperty({ example: 'active', enum: ['active', 'inactive', 'upcoming'], required: false, description: 'Trạng thái học kỳ' })
  @IsOptional()
  @IsString()
  @IsEnum(['active', 'inactive', 'upcoming'])
  status?: string;
}
