import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsMongoId,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEvaluationPeriodDto {
  @ApiProperty({ example: '65f1...', description: 'Semester ID' })
  @IsMongoId()
  @IsNotEmpty({ message: 'semester_id không được để trống' })
  semester_id: string;

  @ApiProperty({
    example: 'pending',
    enum: ['pending', 'sv_phase', 'gv_phase', 'admin_phase', 'closed'],
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({
    example: '2026-06-30T23:59:59Z',
    description: 'Hạn SV tự chấm',
  })
  @IsDateString()
  @IsNotEmpty({ message: 'sv_deadline không được để trống' })
  sv_deadline: string;

  @ApiProperty({
    example: '2026-07-15T23:59:59Z',
    description: 'Hạn GVCN duyệt',
  })
  @IsDateString()
  @IsNotEmpty({ message: 'gv_deadline không được để trống' })
  gv_deadline: string;

  @ApiProperty({
    example: '2026-07-30T23:59:59Z',
    description: 'Hạn admin chốt',
  })
  @IsDateString()
  @IsNotEmpty({ message: 'admin_deadline không được để trống' })
  admin_deadline: string;
}

export class UpdateEvaluationPeriodDto {
  @ApiProperty({ example: '65f1...' })
  @IsMongoId()
  @IsOptional()
  semester_id?: string;

  @ApiProperty({
    example: 'sv_phase',
    enum: ['pending', 'sv_phase', 'gv_phase', 'admin_phase', 'closed'],
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ example: '2026-06-30T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  sv_deadline?: string;

  @ApiProperty({ example: '2026-07-15T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  gv_deadline?: string;

  @ApiProperty({ example: '2026-07-30T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  admin_deadline?: string;
}
