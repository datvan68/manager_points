import { PartialType } from '@nestjs/swagger';
import { CreateClubDto } from './create-club.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClubDto extends PartialType(CreateClubDto) {
  @ApiPropertyOptional({
    description: 'Club status',
    enum: ['active', 'inactive', 'suspended'],
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'suspended'])
  status?: string;
}
