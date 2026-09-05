import { IsBoolean, IsNotEmpty, IsMongoId } from 'class-validator';

export class SetRoomLeaderDto {
  @IsNotEmpty()
  @IsMongoId()
  roster_entry_id: string;

  @IsBoolean()
  is_room_leader: boolean;
}
