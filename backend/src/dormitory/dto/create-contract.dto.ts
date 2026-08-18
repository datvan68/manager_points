import {
  IsNotEmpty,
  IsMongoId,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateContractDto {
  @IsNotEmpty()
  @IsMongoId()
  student_id: string;

  @IsNotEmpty()
  @IsMongoId()
  bed_id: string;

  @IsNotEmpty()
  @IsMongoId()
  room_id: string;

  @IsOptional()
  @IsMongoId()
  roster_entry_id?: string;

  @IsNotEmpty()
  @IsDateString()
  start_date: string;

  @IsNotEmpty()
  @IsDateString()
  end_date: string;
}

export class CancelContractDto {
  @IsNotEmpty()
  @IsString()
  cancellation_reason: string;
}
