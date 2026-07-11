import { PartialType } from '@nestjs/swagger';
import { CreateActivityDto } from './create-activity.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateActivityDto extends PartialType(CreateActivityDto) {
  @ApiPropertyOptional({
    description: 'Activity status',
    enum: ['active', 'inactive', 'suspended'],
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'suspended'])
  status?: string;
}
