import { IsMongoId, IsNotEmpty } from 'class-validator';

export class UnassignRoomDto {
  @IsNotEmpty()
  @IsMongoId()
  roster_entry_id: string;
}
