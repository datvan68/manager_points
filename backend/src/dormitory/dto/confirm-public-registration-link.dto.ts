import { IsBoolean, IsDateString, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';

export class ConfirmPublicRegistrationLinkDto {
  @IsMongoId()
  @IsNotEmpty()
  student_id!: string;

  @IsDateString()
  expected_public_updated_at!: string;

  @IsDateString()
  expected_student_updated_at!: string;

  @IsBoolean()
  sync_email!: boolean;

  @IsBoolean()
  sync_gender!: boolean;
}
