import { IsDateString, IsOptional, IsString, Matches, MaxDate, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const PHONE_PATTERN = /^[0-9+().\s-]{8,20}$/;

export class ParentInformationDto {
  @IsOptional() @IsString() full_name?: string;
  @IsOptional() @IsString() @Matches(/^\d{1,3}$/, { message: 'Parent age is invalid' }) age?: string;
  @IsOptional() @IsString() permanent_address?: string;
  @IsOptional() @IsString() contact_address?: string;
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsString() @Matches(PHONE_PATTERN, { message: 'Phone number is invalid' }) phone_number?: string;
}

export class ApplicantProfileDto {
  @IsOptional() @IsString() ethnicity?: string;
  @IsOptional() @IsString() religion?: string;
  @IsOptional() @IsString() @Matches(/^\d{9,12}$/, { message: 'Citizen ID must contain 9 to 12 digits' }) citizen_id_number?: string;
  @IsOptional() @IsDateString() @MaxDate(() => new Date(), { message: 'Citizen ID issue date cannot be in the future' }) citizen_id_issue_date?: string;
  @IsOptional() @IsString() citizen_id_issue_place?: string;
  @IsOptional() @IsString() permanent_address?: string;
  @IsOptional() @ValidateNested() @Type(() => ParentInformationDto) father?: ParentInformationDto;
  @IsOptional() @ValidateNested() @Type(() => ParentInformationDto) mother?: ParentInformationDto;
  @IsOptional() @IsString() priority_certificate_details?: string;
}
