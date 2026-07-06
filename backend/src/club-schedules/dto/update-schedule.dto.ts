import { PartialType } from '@nestjs/swagger';
import { CreateScheduleDto } from './create-schedule.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateScheduleDto extends PartialType(CreateScheduleDto) {
  @ApiPropertyOptional({
    description: 'Schedule status',
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
  })
  @IsOptional()
  @IsEnum(['scheduled', 'ongoing', 'completed', 'cancelled'])
  status?: string;
}
