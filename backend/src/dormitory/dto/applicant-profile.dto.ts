import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const PHONE_PATTERN = /^[0-9+().\s-]{8,20}$/;

function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
          const [year, month, day] = value.split('-').map(Number);
          const parsed = new Date(year, month - 1, day);
          if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return false;
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return parsed <= today;
        },
        defaultMessage(_: ValidationArguments) {
          return 'Citizen ID issue date cannot be in the future';
        },
      },
    });
  };
}

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
  @IsOptional()
  @IsDateString({ strict: true })
  @IsNotFutureDate({ message: 'Citizen ID issue date cannot be in the future' })
  citizen_id_issue_date?: string;
  @IsOptional() @IsString() citizen_id_issue_place?: string;
  @IsOptional() @IsString() permanent_address?: string;
  @IsOptional() @ValidateNested() @Type(() => ParentInformationDto) father?: ParentInformationDto;
  @IsOptional() @ValidateNested() @Type(() => ParentInformationDto) mother?: ParentInformationDto;
  @IsOptional() @IsString() priority_certificate_details?: string;
}
