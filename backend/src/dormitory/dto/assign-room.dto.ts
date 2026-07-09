import { IsNotEmpty, IsMongoId } from 'class-validator';

export class AssignRoomDto {
  @IsNotEmpty()
  @IsMongoId()
  registration_id: string;

  @IsNotEmpty()
  @IsMongoId()
  room_id: string;

  @IsNotEmpty()
  @IsMongoId()
  bed_id: string;
}
