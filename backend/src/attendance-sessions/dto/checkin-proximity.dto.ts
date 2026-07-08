import { IsMongoId, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CheckinProximityDto {
  @ApiProperty({ description: 'Session ID' })
  @IsMongoId()
  session_id: string;

  @ApiProperty({ description: 'Student latitude' })
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @ApiProperty({ description: 'Student longitude' })
  @Type(() => Number)
  @IsNumber()
  longitude: number;
}
