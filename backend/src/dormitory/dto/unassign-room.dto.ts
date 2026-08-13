import { IsMongoId } from 'class-validator';

export class UnassignRoomDto {
  @IsMongoId()
  registration_id: string;
}
