import { IsNotEmpty, IsMongoId, IsOptional, IsString } from 'class-validator';

export class TransferRoomDto {
  @IsNotEmpty()
  @IsMongoId()
  contract_id: string;

  @IsNotEmpty()
  @IsMongoId()
  new_room_id: string;

  @IsNotEmpty()
  @IsMongoId()
  new_bed_id: string;

  @IsOptional()
  @IsString()
  ly_do?: string;
}
