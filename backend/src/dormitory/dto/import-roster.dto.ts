import { Type, Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsMongoId, MaxLength, ValidateNested } from 'class-validator';

const asString = ({ value }: { value: unknown }) => value == null ? value : String(value);

export class ImportRosterRowDto {
  @IsOptional()
  @Transform(asString)
  @IsString()
  @MaxLength(200)
  full_name?: string;

  @IsOptional()
  @Transform(asString)
  @IsString()
  @MaxLength(50)
  date_of_birth?: string;

  @IsOptional()
  @Transform(asString)
  @IsString()
  @MaxLength(30)
  gender?: string;

  @IsOptional()
  @Transform(asString)
  @IsString()
  @MaxLength(50)
  phone_number?: string;

  @IsOptional()
  @Transform(asString)
  @IsString()
  @MaxLength(50)
  room_code?: string;
}

export class ImportRosterDto {
  @IsOptional()
  @IsMongoId()
  semester_id?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ImportRosterRowDto)
  rows: ImportRosterRowDto[];
}
