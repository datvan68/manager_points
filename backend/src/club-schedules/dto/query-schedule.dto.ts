import { IsOptional, IsEnum, IsMongoId, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryScheduleDto {
  @ApiPropertyOptional({ description: 'Filter by club ID' })
  @IsOptional()
  @IsMongoId()
  club_id?: string;

  @ApiPropertyOptional({ description: 'Filter by activity ID' })
  @IsOptional()
  @IsMongoId()
  activity_id?: string;

  @ApiPropertyOptional({ description: 'Filter by semester ID' })
  @IsOptional()
  @IsMongoId()
  semester_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
  })
  @IsOptional()
  @IsEnum(['scheduled', 'ongoing', 'completed', 'cancelled'])
  status?: string;

  @ApiPropertyOptional({ description: 'Start date range filter' })
  @IsOptional()
  @Type(() => Date)
  start_date?: Date;

  @ApiPropertyOptional({ description: 'End date range filter' })
  @IsOptional()
  @Type(() => Date)
  end_date?: Date;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
