import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckinQrDto {
  @ApiProperty({ description: 'QR token scanned by student' })
  @IsString()
  token: string;
}
